define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks,
        expectOrderedPks = utils.expectOrderedPks;


    function testResultReaction(resolve, reject) {
        var registry = new store.Registry();

        var postStore = new store.Store('id', ['slug', 'author'], {}, new store.DummyStore());
        registry.register('post', postStore);

        registry.ready();

        var posts = [
            {id: 1, slug: 'sl1', title: 'tl1', author: 1},
            {id: 2, slug: 'sl1', title: 'tl2', author: 1},  // slug can be unique per date
            {id: 3, slug: 'sl3', title: 'tl1', author: 2},
            {id: 4, slug: 'sl4', title: 'tl4', author: 3}
        ];
        store.whenIter(posts, function(post) { return postStore.getLocalStore().add(post); });

        var r1 = registry.get('post').find({author: 1});
        r1.observe();
        assert(expectPks(r1, [1, 2]));
        assert(r1.length = 2);

        r1.sort(function(a, b){ return b.id - a.id; });
        assert(expectOrderedPks(r1, [2, 1]));

        var r2 = r1.slice();
        assert(expectOrderedPks(r2, [2, 1]));
        assert(r2.length = 2);


        var observer = function(aspect, obj) {
            observer.args.push([this].concat(Array.prototype.slice.call(arguments)));
        };
        observer.args = [];
        r2.observed().attach(['add', 'update', 'delete'], observer);

        // add
        postStore.getLocalStore().add({id: 5, slug: 'sl5', title: 'tl5', author: 1});
        assert(expectOrderedPks(r1, [5, 2, 1]));
        assert(r1.length = 3);
        assert(expectOrderedPks(r2, [5, 2, 1]));
        assert(r2.length = 3);

        assert(observer.args.length === 1);
        assert(observer.args[0][0] === r2);
        assert(observer.args[0][1] === 'add');
        assert(observer.args[0][2] === r2[0]);

        observer.args = [];
        postStore.getLocalStore().add({id: 6, slug: 'sl6', title: 'tl6', author: 2});
        assert(expectOrderedPks(r1, [5, 2, 1]));
        assert(r1.length = 3);
        assert(expectOrderedPks(r2, [5, 2, 1]));
        assert(r2.length = 3);
        assert(observer.args.length === 0);

        // update
        observer.args = [];
        postStore.getLocalStore().update(postStore.get(5));
        assert(expectOrderedPks(r1, [5, 2, 1]));
        assert(r1.length = 3);
        assert(expectOrderedPks(r2, [5, 2, 1]));
        assert(r2.length = 3);

        assert(observer.args.length === 1);
        assert(observer.args[0][0] === r2);
        assert(observer.args[0][1] === 'update');
        assert(observer.args[0][2] === r2[0]);
        assert(observer.args[0][3].id === 5);

        // delete
        observer.args = [];
        postStore.getLocalStore().delete(postStore.get(5));
        assert(expectOrderedPks(r1, [2, 1]));
        assert(r1.length = 2);
        assert(expectOrderedPks(r2, [2, 1]));
        assert(r2.length = 2);

        assert(observer.args.length === 1);
        assert(observer.args[0][0] === r2);
        assert(observer.args[0][1] === 'delete');
        assert(observer.args[0][2].id === 5);

        registry.destroy();
        resolve();
    }


    function testResultAttachByAttr(resolve, reject) {
        var registry = new store.Registry();


        var postStore = new store.Store('id', ['slug', 'author'], {
            foreignKey: {
                author: {
                    field: 'author',
                    relatedStore: 'author',
                    relatedField: 'id',
                    relatedName: 'posts',
                    onDelete: store.cascade
                }
            }
        }, new store.DummyStore());
        registry.register('post', postStore);


        var authorStore = new store.Store('id', ['firstName', 'lastName'], {}, new store.DummyStore());
        registry.register('author', authorStore);

        registry.get('author').getLocalStore().observed().attach('add', function(aspect, author) {
            author.views_total = 0;
            registry.get('post').find({
                'author.id': author.id
            }).observe().forEachByAttr('views_count', 0, function(attr, oldValue, newValue) {
                author.views_total = author.views_total + newValue - oldValue;
                registry.get('author').getLocalStore().update(author);
            });
        });


        registry.ready();

        var authors = [
            {id: 1, firstName: 'Fn1', lastName: 'Ln1'},
            {id: 2, firstName: 'Fn2', lastName: 'Ln2'},
            {id: 3, firstName: 'Fn3', lastName: 'Ln1'}
        ];
        store.whenIter(authors, function(author) { return authorStore.getLocalStore().add(author); });

        var posts = [
            {id: 1, slug: 'sl1', title: 'tl1', author: 1, views_count: 5},
            {id: 2, slug: 'sl1', title: 'tl2', author: 1, views_count: 6},  // slug can be unique per date
            {id: 3, slug: 'sl3', title: 'tl1', author: 2, views_count: 7},
            {id: 4, slug: 'sl3', title: 'tl1', author: 2, views_count: 8},
            {id: 5, slug: 'sl4', title: 'tl4', author: 3, views_count: 9}
        ];
        store.whenIter(posts, function(post) { return postStore.getLocalStore().add(post); });

        var author = registry.get('author').get(1);
        assert(author.views_total === 11);

        // update
        var post = registry.get('post').find({author: author.id})[0];
        post.views_count += 1;
        registry.get('post').getLocalStore().update(post);
        assert(author.views_total === 12);

        // add
        registry.get('post').getLocalStore().add(
            {id: 6, slug: 'sl6', title: 'tl6', author: 1, views_count: 10}
        );
        assert(author.views_total === 22);

        // delete
        registry.get('post').getLocalStore().delete(
            registry.get('post').get(6)
        );
        assert(author.views_total === 12);
        resolve();
    }


    function testResultRelation(resolve, reject) {
        var registry = new store.Registry();


        var postStore = new store.Store('id', ['slug', 'author'], {
            foreignKey: {
                author: {
                    field: 'author',
                    relatedStore: 'author',
                    relatedField: 'id',
                    relatedName: 'posts',
                    onDelete: store.cascade
                }
            }
        }, new store.DummyStore());
        registry.register('post', postStore);


        var authorStore = new store.Store('id', ['firstName', 'lastName'], {}, new store.DummyStore());
        registry.register('author', authorStore);


        registry.ready();

        var authors = [
            {id: 1, firstName: 'Fn1', lastName: 'Ln1'},
            {id: 2, firstName: 'Fn2', lastName: 'Ln2'},
            {id: 3, firstName: 'Fn3', lastName: 'Ln1'},
            {id: 4, firstName: 'Fn4', lastName: 'Ln4'}
        ];
        store.whenIter(authors, function(author) { return authorStore.getLocalStore().add(author); });

        var posts = [
            {id: 1, slug: 'sl1', title: 'tl1', author: 1, views_count: 5},
            {id: 2, slug: 'sl1', title: 'tl2', author: 1, views_count: 6},  // slug can be unique per date
            {id: 3, slug: 'sl3', title: 'tl1', author: 2, views_count: 7},
            {id: 4, slug: 'sl3', title: 'tl1', author: 2, views_count: 8},
            {id: 5, slug: 'sl4', title: 'tl4', author: 3, views_count: 9}
        ];
        store.whenIter(posts, function(post) { return postStore.getLocalStore().add(post); });


        var r1 = registry.get('author').find({'posts.title': 'tl1'});
        r1.observe();
        assert(expectPks(r1, [1, 2]));
        assert(r1.length = 2);

        r1.sort(function(a, b){ return b.id - a.id; });
        assert(expectOrderedPks(r1, [2, 1]));

        var r2 = r1.slice();
        assert(expectOrderedPks(r2, [2, 1]));
        assert(r2.length = 2);


        var observer = function(aspect, obj) {
            observer.args.push([this].concat(Array.prototype.slice.call(arguments)));
        };
        observer.args = [];
        r2.observed().attach(['add', 'update', 'delete'], observer);

        // add
        postStore.getLocalStore().add({id: 6, slug: 'sl6', title: 'tl1', author: 3, views_count: 8});
        assert(expectOrderedPks(r1, [3, 2, 1]));
        assert(r1.length = 3);
        assert(expectOrderedPks(r2, [3, 2, 1]));
        assert(r2.length = 3);

        assert(observer.args.length === 1);
        assert(observer.args[0][0] === r2);
        assert(observer.args[0][1] === 'add');
        assert(observer.args[0][2] === r2[0]);
        assert(observer.args[0][3] === 0);

        // add 2
        observer.args = [];
        postStore.getLocalStore().add({id: 7, slug: 'sl7', title: 'tl7', author: 4, views_count: 8});
        assert(expectOrderedPks(r1, [3, 2, 1]));
        assert(r1.length = 3);
        assert(expectOrderedPks(r2, [3, 2, 1]));
        assert(r2.length = 3);
        assert(observer.args.length === 0);

        // update
        observer.args = [];
        var post = postStore.get(7);
        post.title = 'tl1'
        postStore.getLocalStore().update(post);
        assert(expectOrderedPks(r1, [4, 3, 2, 1]));
        assert(r1.length = 4);
        assert(expectOrderedPks(r2, [4, 3, 2, 1]));
        assert(r2.length = 4);

        assert(observer.args.length === 1);
        assert(observer.args[0][0] === r2);
        assert(observer.args[0][1] === 'add');
        assert(observer.args[0][2] === r2[0]);
        assert(observer.args[0][3] === 0);

        // update 2
        observer.args = [];
        var post = postStore.get(7);
        post.slug = 'tl1';
        postStore.getLocalStore().update(post);
        assert(expectOrderedPks(r1, [4, 3, 2, 1]));
        assert(r1.length = 4);
        assert(expectOrderedPks(r2, [4, 3, 2, 1]));
        assert(r2.length = 4);
        assert(observer.args.length === 0);

        // update 3
        observer.args = [];
        var post = postStore.get(7);
        post.title = 'tl7'
        postStore.getLocalStore().update(post);
        assert(expectOrderedPks(r1, [3, 2, 1]));
        assert(r1.length = 3);
        assert(expectOrderedPks(r2, [3, 2, 1]));
        assert(r2.length = 3);

        assert(observer.args.length === 1);
        assert(observer.args[0][0] === r2);
        assert(observer.args[0][1] === 'delete');
        assert(observer.args[0][2] === authorStore.get(4));
        assert(observer.args[0][3] === 0);

        // delete
        observer.args = [];
        var post = postStore.get(7);
        postStore.getLocalStore().delete(post);
        assert(expectOrderedPks(r1, [3, 2, 1]));
        assert(r1.length = 3);
        assert(expectOrderedPks(r2, [3, 2, 1]));
        assert(r2.length = 3);
        assert(observer.args.length === 0);

        // delete
        observer.args = [];
        var post = postStore.get(6);
        postStore.getLocalStore().delete(post);
        assert(expectOrderedPks(r1, [2, 1]));
        assert(r1.length = 2);
        assert(expectOrderedPks(r2, [2, 1]));
        assert(r2.length = 2);
        assert(observer.args.length === 1);
        assert(observer.args[0][0] === r2);
        assert(observer.args[0][1] === 'delete');
        assert(observer.args[0][2] === authorStore.get(3));
        assert(observer.args[0][3] === 0);

        registry.destroy();
        resolve();
    }


    function testResult(resolve, reject) {
        store.when(store.whenIter([testResultReaction, testResultAttachByAttr, testResultRelation], function(suite) {
            return new Promise(suite);
        }), function() {
            resolve();
        });
    }


    return testResult;
});
define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert;


    function testStoreObservable(resolve, reject) {
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

        registry.get('post').getLocalStore().observed().attachByAttr('views_count', 0, function(attr, oldValue, newValue) {
            var post = this;
            var author = registry.get('author').get(post.author);
            author.views_total = (author.views_total || 0) + newValue - oldValue;
            registry.get('author').getLocalStore().update(author);
        });


        var authorStore = new store.Store('id', ['firstName', 'lastName'], {}, new store.DummyStore());
        registry.register('author', authorStore);


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
    return testStoreObservable;
});

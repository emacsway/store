define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert;


    function testObservable(resolve, reject) {
        // Example of fast real-time aggregation
        var registry = new store.Registry();
        registry.observed().attach('register', function(aspect, newStore) {
            newStore.getLocalStore().observed().attach('add', function(aspect, obj) { store.observe(obj); });
        });

        var postStore = new store.Store({
            indexes: ['slug', 'author'],
            relations: {
                foreignKey: {
                    author: {
                        field: 'author',
                        relatedStore: 'author',
                        relatedField: 'id',
                        relatedName: 'posts',
                        onDelete: store.cascade
                    }
                }
            },
            remoteStore: new store.DummyStore()
        });
        registry.register('post', postStore);

        var authorStore = new store.Store({
            indexes: ['firstName', 'lastName'],
            remoteStore: new store.DummyStore()
        });
        registry.register('author', authorStore);
        registry.observed().attach('ready', function() {
            registry.get('post').getLocalStore().observed().attach('add', function(aspect, post) {
                registry.get('author').find({id: post.author}).forEach(function(author) {
                    author.observed().set('views_total', author.views_total + post.views_count);
                    post.observed().attach('views_count', function(name, oldValue, newValue) {
                        author.observed().set('views_total', author.views_total - oldValue + newValue);
                    });
                });
            });
        });

        registry.ready();

        var authors = [
            {id: 1, firstName: 'Fn1', lastName: 'Ln1', views_total: 0},
            {id: 2, firstName: 'Fn1', lastName: 'Ln2', views_total: 0},
            {id: 3, firstName: 'Fn3', lastName: 'Ln1', views_total: 0}
        ];
        store.whenIter(authors, function(author) { return authorStore.getLocalStore().add(author); });

        var posts = [
            {id: 1, slug: 'sl1', title: 'tl1', author: 1, views_count: 5},
            {id: 2, slug: 'sl1', title: 'tl2', author: 1, views_count: 6},  // slug can be unique per date
            {id: 3, slug: 'sl3', title: 'tl1', author: 2, views_count: 7},
            {id: 4, slug: 'sl4', title: 'tl4', author: 3, views_count: 8}
        ];
        store.whenIter(posts, function(post) { return postStore.getLocalStore().add(post); });

        var author = registry.get('author').get(1);
        assert(author.views_total === 11);
        var post = registry.get('post').find({author: author.id})[0];
        post.observed().set('views_count', post.views_count + 1);
        assert(author.views_total === 12);

        postStore.getLocalStore().add({id: 5, slug: 'sl5', title: 'tl5', author: 1, views_count: 8});
        assert(author.views_total === 20);
        resolve();

    }
    return testObservable;
});
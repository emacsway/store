define(['../../store', '../utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks;


    function testSimpleRelationsMemoryStore(resolve, reject) {
        var registry = new store.Registry();

        var postStore = store.withAspect(
            store.CircularReferencesStoreAspect,
            store.withAspect(
                store.ObservableStoreAspect,
                store.withAspect(
                    store.RelationalStoreAspect,
                    new store.MemoryStore({indexes: ['slug', 'author']}),
                    {
                        foreignKey: {
                            author: {
                                field: 'author',
                                relatedStore: 'author',
                                relatedField: 'id',
                                relatedName: 'posts',
                                onDelete: store.cascade
                            }
                        }
                    }
                )
            )
        ).init();
        registry.register('post', postStore);

        var authorStore = store.withAspect(
            store.CircularReferencesStoreAspect,
            store.withAspect(
                store.ObservableStoreAspect,
                store.withAspect(
                    store.RelationalStoreAspect,
                    new store.MemoryStore({indexes: ['firstName', 'lastName']})
                )
            )
        ).init();
        registry.register('author', authorStore);

        registry.ready();

        var authors = [
            {id: 1, firstName: 'Fn1', lastName: 'Ln1'},
            {id: 2, firstName: 'Fn1', lastName: 'Ln2'},
            {id: 3, firstName: 'Fn3', lastName: 'Ln1'}
        ];
        authors.forEach(function(author) {
            authorStore.add(author);
        });

        var posts = [
            {id: 1, slug: 'sl1', title: 'tl1', author: 1},
            {id: 2, slug: 'sl1', title: 'tl2', author: 1},  // slug can be unique per date
            {id: 3, slug: 'sl3', title: 'tl1', author: 2},
            {id: 4, slug: 'sl4', title: 'tl4', author: 3}
        ];
        posts.forEach(function(post) {
            postStore.add(post);
        });

        var r = registry.get('post').find({slug: 'sl1'});
        assert(expectPks(r, [1, 2]));

        var author = registry.get('author').get(1);
        r = registry.get('post').find({'author': author});
        assert(expectPks(r, [1, 2]));

        r = registry.get('post').find({'author.firstName': 'Fn1'});
        assert(expectPks(r, [1, 2, 3]));

        r = registry.get('post').find({author: {'$rel': {firstName: 'Fn1'}}});
        assert(expectPks(r, [1, 2, 3]));

        r = registry.get('author').find({'posts.slug': {'$in': ['sl1', 'sl3']}});
        assert(expectPks(r, [1, 2]));

        r = registry.get('author').find({posts: {'$rel': {slug: {'$in': ['sl1', 'sl3']}}}});
        assert(expectPks(r, [1, 2]));


        // Add
        var post = {id: 5, slug: 'sl5', title: 'tl5', author: 3};
        return registry.get('post').add(post).then(function(post) {
            assert(5 in registry.get('post').pkIndex);
            assert(registry.get('post').indexes['slug']['sl5'].indexOf(post) !== -1);


            // Update
            post = registry.get('post').get(5);
            post.slug = 'sl5.2';
            return registry.get('post').update(post).then(function(post) {
                assert(5 in registry.get('post').pkIndex);
                assert(registry.get('post').indexes['slug']['sl5.2'].indexOf(post) !== -1);
                assert(registry.get('post').indexes['slug']['sl5'].indexOf(post) === -1);


                // Delete
                var author = registry.get('author').get(1);
                post = registry.get('post').find({author: 1})[0];
                assert(registry.get('post').indexes['slug']['sl1'].indexOf(post) !== -1);
                assert(1 in registry.get('post').pkIndex);
                return registry.get('author').delete(author).then(function() {
                    assert(registry.get('post').indexes['slug']['sl1'].indexOf(post) === -1);
                    assert(!(1 in registry.get('post').pkIndex));
                    var r = registry.get('author').find();
                    assert(expectPks(r, [2, 3]));
                    r = registry.get('post').find();
                    assert(expectPks(r, [3, 4, 5]));

                    registry.destroy();
                    // resolve();
                });
            });
        });
    }
    return testSimpleRelationsMemoryStore;
});
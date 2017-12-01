define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks;


    function testSimpleRelations(resolve, reject) {
        var registry = new store.Registry();

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

        registry.ready();

        var authors = [
            {id: 1, firstName: 'Fn1', lastName: 'Ln1'},
            {id: 2, firstName: 'Fn1', lastName: 'Ln2'},
            {id: 3, firstName: 'Fn3', lastName: 'Ln1'}
        ];
        store.whenIter(authors, function(author) { return authorStore.getLocalStore().add(author); });

        var posts = [
            {id: 1, slug: 'sl1', title: 'tl1', author: 1},
            {id: 2, slug: 'sl1', title: 'tl2', author: 1},  // slug can be unique per date
            {id: 3, slug: 'sl3', title: 'tl1', author: 2},
            {id: 4, slug: 'sl4', title: 'tl4', author: 3}
        ];
        store.whenIter(posts, function(post) { return postStore.getLocalStore().add(post); });

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
            assert(5 in registry.get('post').getLocalStore().pkIndex);
            assert(registry.get('post').getLocalStore().indexes['slug']['sl5'].indexOf(post) !== -1);


            // Update
            post = registry.get('post').get(5);
            post.slug = 'sl5.2';
            return registry.get('post').update(post).then(function(post) {
                assert(5 in registry.get('post').getLocalStore().pkIndex);
                assert(registry.get('post').getLocalStore().indexes['slug']['sl5.2'].indexOf(post) !== -1);
                assert(registry.get('post').getLocalStore().indexes['slug']['sl5'].indexOf(post) === -1);


                // Delete
                var author = registry.get('author').get(1);
                post = registry.get('post').find({author: 1})[0];
                assert(registry.get('post').getLocalStore().indexes['slug']['sl1'].indexOf(post) !== -1);
                assert(1 in registry.get('post').getLocalStore().pkIndex);
                return registry.get('author').delete(author).then(function() {
                    assert(registry.get('post').getLocalStore().indexes['slug']['sl1'].indexOf(post) === -1);
                    assert(!(1 in registry.get('post').getLocalStore().pkIndex));
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
    return testSimpleRelations;
});
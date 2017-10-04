define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks;


    function testCompositeRelations(resolve, reject) {
        var registry = new store.Registry();

        // Use reverse order of store creation.
        var authorStore = new store.Store(['id', 'lang'], ['firstName', 'lastName'], {}, new store.DummyStore());
        registry.register('author', authorStore);

        var postStore = new store.Store(['id', 'lang'], ['lang', 'slug', 'author'], {
            foreignKey: {
                author: {
                    field: ['author', 'lang'],
                    relatedStore: 'author',
                    relatedField: ['id', 'lang'],
                    relatedName: 'posts',
                    onDelete: store.cascade
                }
            }
        }, new store.DummyStore());
        registry.register('post', postStore);

        registry.ready();

        var authors = [
            {id: 1, lang: 'en', firstName: 'Fn1', lastName: 'Ln1'},
            {id: 1, lang: 'ru', firstName: 'Fn1-ru', lastName: 'Ln1-ru'},
            {id: 2, lang: 'en', firstName: 'Fn1', lastName: 'Ln2'},
            {id: 3, lang: 'en', firstName: 'Fn3', lastName: 'Ln1'}
        ];
        store.whenIter(authors, function(author) { return authorStore.getLocalStore().add(author); });

        var posts = [
            {id: 1, lang: 'en', slug: 'sl1', title: 'tl1', author: 1},
            {id: 1, lang: 'ru', slug: 'sl1-ru', title: 'tl1-ru', author: 1},
            {id: 2, lang: 'en', slug: 'sl1', title: 'tl2', author: 1},  // slug can be unique per date
            {id: 3, lang: 'en', slug: 'sl3', title: 'tl1', author: 2},
            {id: 4, lang: 'en', slug: 'sl4', title: 'tl4', author: 3}
        ];
        store.whenIter(posts, function(post) { return postStore.getLocalStore().add(post); });

        var compositePkAccessor = function(o) { return [o.id, o.lang]; };

        var r = postStore.find({slug: 'sl1'});
        assert(expectPks(r, [[1, 'en'], [2, 'en']], compositePkAccessor));

        var author = registry.get('author').get([1, 'en']);
        r = registry.get('post').find({'author': author});
        assert(expectPks(r, [[1, 'en'], [2, 'en']], compositePkAccessor));

        r = postStore.find({'author.firstName': 'Fn1'});
        assert(expectPks(r, [[1, 'en'], [2, 'en'], [3, 'en']], compositePkAccessor));

        r = postStore.find({author: {'$rel': {firstName: 'Fn1'}}});
        assert(expectPks(r, [[1, 'en'], [2, 'en'], [3, 'en']], compositePkAccessor));

        r = authorStore.find({'posts.slug': {'$in': ['sl1', 'sl3']}});
        assert(expectPks(r, [[1, 'en'], [2, 'en']], compositePkAccessor));

        r = authorStore.find({posts: {'$rel': {slug: {'$in': ['sl1', 'sl3']}}}});
        assert(expectPks(r, [[1, 'en'], [2, 'en']], compositePkAccessor));

        // Add
        var post = {id: 5, lang: 'en', slug: 'sl5', title: 'tl5', author: 3};
        postStore.add(post).then(function(post) {
            assert([5, 'en'] in postStore.getLocalStore().pkIndex);
            assert(postStore.getLocalStore().indexes['slug']['sl5'].indexOf(post) !== -1);


            // Update
            var post = postStore.get([5, 'en']);
            post.slug = 'sl5.2';
            postStore.update(post).then(function(post) {
                assert([5, 'en'] in postStore.getLocalStore().pkIndex);
                assert(postStore.getLocalStore().indexes['slug']['sl5.2'].indexOf(post) !== -1);
                assert(postStore.getLocalStore().indexes['slug']['sl5'].indexOf(post) === -1);


                // Delete
                var author = authorStore.get([1, 'en']);
                post = postStore.find({author: 1, lang: 'en'})[0];
                assert(postStore.getLocalStore().indexes['slug']['sl1'].indexOf(post) !== -1);
                assert([1, 'en'] in postStore.getLocalStore().pkIndex);
                authorStore.delete(author).then(function(post) {
                    assert(postStore.getLocalStore().indexes['slug']['sl1'].indexOf(post) === -1);
                    assert(!([1, 'en'] in postStore.getLocalStore().pkIndex));
                    var r = authorStore.find();
                    assert(expectPks(r, [[1, 'ru'], [2, 'en'], [3, 'en']], compositePkAccessor));
                    r = postStore.find();
                    assert(expectPks(r, [[1, 'ru'], [3, 'en'], [4, 'en'], [5, 'en']], compositePkAccessor));

                    registry.destroy();
                    resolve();
                });
            });
        });
    }
    return testCompositeRelations;
});
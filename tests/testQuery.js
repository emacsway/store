define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks;


    function testQuery(resolve, reject) {
        var registry = new store.Registry();

        function Post(attrs) {
            store.clone(attrs, this);
        }
        Post.prototype = {
            constructor: Post,
            getSlug: function() {
                return this.slug;
            }
        };

        var postStore = new store.Store('id', ['slug', 'author'], {}, new store.DummyStore(), Post);
        registry.register('post', postStore);

        registry.ready();


        var posts = [
            new Post({id: 1, slug: 'sl1', title: 'tl1', author: 1}),
            new Post({id: 2, slug: 'sl1', title: 'tl2', author: 1}),  // slug can be unique per date
            new Post({id: 3, slug: 'sl3', title: 'tl1', author: 2}),
            new Post({id: 4, slug: 'sl4', title: 'tl4', author: 3})
        ];
        store.whenIter(posts, function(post) { return postStore.getLocalStore().add(post); });

        var r;

        r = registry.get('post').find({slug: 'sl1'});
        assert(expectPks(r, [1, 2]));

        r = registry.get('post').find({getSlug: 'sl1'});
        assert(expectPks(r, [1, 2]));

        r = registry.get('post').find({slug: 'sl1', author: 1});
        assert(expectPks(r, [1, 2]));

        r = registry.get('post').find({author: {'$ne': 1}});
        assert(expectPks(r, [3, 4]));

        r = registry.get('post').find({'$callable': function(post) { return post.author === 1; }});
        assert(expectPks(r, [1, 2]));

        r = registry.get('post').find({author: function(author_id) { return author_id === 1; }});
        assert(expectPks(r, [1, 2]));

        r = registry.get('post').find({'$and': [{slug: 'sl1'}, {author: 1}]});
        assert(expectPks(r, [1, 2]));

        r = registry.get('post').find({'$or': [{slug: 'sl1'}, {author: 2}]});
        assert(expectPks(r, [1, 2, 3]));

        r = registry.get('post').find({'$or': [{slug: 'sl1'}, {title: 'tl1'}]}); // No index
        assert(expectPks(r, [1, 2, 3]));

        r = registry.get('post').find({
            '$and': [
                {
                    '$or': [
                        {slug: 'sl1'},
                        {slug: 'sl2'}
                    ]
                },
                {author: 1}
            ]
        });
        assert(expectPks(r, [1, 2]));

        r = registry.get('post').find({slug: {'$in': ['sl1', 'sl3']}});
        assert(expectPks(r, [1, 2, 3]));

        registry.destroy();
        resolve();
    }
    return testQuery;
});
define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks;


    function testManyToMany(resolve, reject) {
        var registry = new store.Registry();

        var tagStore = new store.Store(['id', 'lang'], ['slug'], {}, new store.DummyStore());
        registry.register('tag', tagStore);

        var tagPostStore = new store.Store('id', [], {
            foreignKey: {
                post: {
                    field: ['postId', 'postLang'],
                    relatedStore: 'post',
                    relatedField: ['id', 'lang'],
                    relatedName: 'tagPostSet',
                    onDelete: store.cascade
                },
                tag: {
                    field: ['tagId', 'tagLang'],
                    relatedStore: 'tag',
                    relatedField: ['id', 'lang'],
                    relatedName: 'tagPostSet',
                    onDelete: store.cascade
                }
            }
        }, new store.DummyStore());
        tagPostStore.getLocalStore().setNextPk = function(obj) {
            tagPostStore._pkCounter || (tagPostStore._pkCounter = 0);
            this.getObjectAccessor().setPk(obj, ++tagPostStore._pkCounter);
        };
        registry.register('tagPost', tagPostStore);

        var postStore = new store.Store(['id', 'lang'], ['lang', 'slug', 'author'], {
            manyToMany: {
                tags: {
                    relation: 'tagPostSet',
                    relatedStore: 'tag',
                    relatedRelation: 'tagPostSet'
                }
            }
        }, new store.DummyStore());
        registry.register('post', postStore);

        registry.ready();

        var tags = [
            {id: 1, lang: 'en', name: 'T1'},
            {id: 1, lang: 'ru', name: 'T1-ru'},
            {id: 2, lang: 'en', name: 'T1'},
            {id: 3, lang: 'en', name: 'T3'},
            {id: 4, lang: 'en', name: 'T4'}
        ];
        store.whenIter(tags, function(tag) { return tagStore.getLocalStore().add(tag); });

        var posts = [
            {id: 1, lang: 'en', slug: 'sl1', title: 'tl1'},
            {id: 1, lang: 'ru', slug: 'sl1-ru', title: 'tl1-ru'},
            {id: 2, lang: 'en', slug: 'sl1', title: 'tl2'},  // slug can be unique per date
            {id: 3, lang: 'en', slug: 'sl3', title: 'tl1'},
            {id: 4, lang: 'en', slug: 'sl4', title: 'tl4'}
        ];
        store.whenIter(posts, function(post) { return postStore.getLocalStore().add(post); });

        var tagPosts = [
            {postId: 1, postLang: 'en', tagId: 1, tagLang: 'en'},
            {postId: 1, postLang: 'ru', tagId: 1, tagLang: 'ru'},
            {postId: 2, postLang: 'en', tagId: 1, tagLang: 'en'},
            {postId: 3, postLang: 'en', tagId: 2, tagLang: 'en'},
            {postId: 4, postLang: 'en', tagId: 4, tagLang: 'en'}
        ];
        store.whenIter(tagPosts, function(tagPost) { return tagPostStore.getLocalStore().add(tagPost); });

        var compositePkAccessor = function(o) { return [o.id, o.lang]; };
        var r;

        r = postStore.find({slug: 'sl1'});
        assert(expectPks(r, [[1, 'en'], [2, 'en']], compositePkAccessor));

        r = postStore.find({'tags.name': 'T1'});
        assert(expectPks(r, [[1, 'en'], [2, 'en'], [3, 'en']], compositePkAccessor));

        r = postStore.find({tags: {'$rel': {name: 'T1'}}});
        assert(expectPks(r, [[1, 'en'], [2, 'en'], [3, 'en']], compositePkAccessor));

        registry.destroy();
        resolve();
    }
    return testManyToMany;
});
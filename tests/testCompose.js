define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks;


    function testCompose() {
        var registry = new store.Registry();

        var authorStore = new store.Store(['id', 'lang'], ['firstName', 'lastName'], {}, new store.DummyBackend());
        registry.register('author', authorStore);

        var tagStore = new store.Store(['id', 'lang'], ['slug'], {}, new store.DummyBackend());
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
        }, new store.AutoIncrementBackend('id'));
        registry.register('tagPost', tagPostStore);

        var postStore = new store.Store(['id', 'lang'], ['lang', 'slug', 'author'], {
            foreignKey: {
                author: {
                    field: ['author', 'lang'],
                    relatedStore: 'author',
                    relatedField: ['id', 'lang'],
                    relatedName: 'posts',
                    onDelete: store.cascade
                }
            },
            manyToMany: {
                tags: {
                    relation: 'tagPostSet',
                    relatedStore: 'tag',
                    relatedRelation: 'tagPostSet'
                }
            }
        }, new store.DummyBackend());
        registry.register('post', postStore);

        registry.ready();

        var authors = [
            {id: 1, lang: 'en', firstName: 'Fn1', lastName: 'Ln1'},
            {id: 1, lang: 'ru', firstName: 'Fn1-ru', lastName: 'Ln1-ru'},
            {id: 2, lang: 'en', firstName: 'Fn1', lastName: 'Ln2'},
            {id: 3, lang: 'en', firstName: 'Fn3', lastName: 'Ln1'}
        ];
        authorStore.loadCollection(authors);

        var tags = [
            {id: 1, lang: 'en', name: 'T1'},
            {id: 1, lang: 'ru', name: 'T1-ru'},
            {id: 2, lang: 'en', name: 'T1'},
            {id: 3, lang: 'en', name: 'T3'}
        ];
        tagStore.loadCollection(tags);

        var posts = [
            {id: 1, lang: 'en', slug: 'sl1', title: 'tl1', author: 1},
            {id: 1, lang: 'ru', slug: 'sl1-ru', title: 'tl1-ru', author: 1},
            {id: 2, lang: 'en', slug: 'sl1', title: 'tl2', author: 1},  // slug can be unique per date
            {id: 3, lang: 'en', slug: 'sl3', title: 'tl1', author: 2},
            {id: 4, lang: 'en', slug: 'sl4', title: 'tl4', author: 3}
        ];
        postStore.loadCollection(posts);

        var tagPosts = [
            {postId: 1, postLang: 'en', tagId: 1, tagLang: 'en'},
            {postId: 1, postLang: 'ru', tagId: 1, tagLang: 'ru'},
            {postId: 2, postLang: 'en', tagId: 1, tagLang: 'en'},
            {postId: 3, postLang: 'en', tagId: 2, tagLang: 'en'},
            {postId: 4, postLang: 'en', tagId: 4, tagLang: 'en'}
        ];
        tagPostStore.loadCollection(tagPosts);

        registry.init();

        var author = authorStore.get([1, 'en']);
        authorStore.compose(author);
        console.debug(author);
        /*
         * Similar output of composite object:
         * {"id":1, "lang":"en", "firstName": "Fn1", "lastName": "Ln1","posts": [
         *     {"id":1, "lang": "en", "slug": "sl1", "title": "tl1", "author":1, "tags": [
         *         {"id": 1, "lang": "en", "name": "T1"}
         *     ]},
         *     {"id": 2, "lang": "en", "slug": "sl1", "title": "tl2", "author": 1, "tags":[
         *         {"id": 1, "lang": "en", "name": "T1"}
         *     ]}
         * ]}"
         */
        var compositePkAccessor = function(o) { return [o.id, o.lang]; };
        assert(expectPks(author.posts, [[1, 'en'], [2, 'en']], compositePkAccessor));
        assert(expectPks(author.posts[0].tags, [[1, 'en']], compositePkAccessor));
        assert(expectPks(author.posts[1].tags, [[1, 'en']], compositePkAccessor));

        registry.destroy();
    }
    return testCompose;
});
define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks;


    function testCompose(resolve, reject) {
        var registry = new store.Registry();

        var authorStore = new store.Store({
            pk: ['id', 'lang'],
            indexes: ['firstName', 'lastName'],
            remoteStore: new store.DummyStore()
        });
        registry.register('author', authorStore);

        var tagStore = new store.Store({
            pk: ['id', 'lang'],
            indexes: ['slug'],
            remoteStore: new store.DummyStore()
        });
        registry.register('tag', tagStore);

        var tagPostStore = new store.Store({
            relations: {
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
            },
            remoteStore: new store.DummyStore()
        });
        tagPostStore.getLocalStore().setNextPk = function(obj) {
            tagPostStore._pkCounter || (tagPostStore._pkCounter = 0);
            this.getObjectAccessor().setPk(obj, ++tagPostStore._pkCounter);
        };
        registry.register('tagPost', tagPostStore);

        var postStore = new store.Store({
            pk: ['id', 'lang'],
            indexes: ['lang', 'slug', 'author'],
            relations: {
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
            },
            remoteStore: new store.DummyStore()
        });
        registry.register('post', postStore);

        registry.ready();

        var authors = [
            {id: 1, lang: 'en', firstName: 'Fn1', lastName: 'Ln1'},
            {id: 1, lang: 'ru', firstName: 'Fn1-ru', lastName: 'Ln1-ru'},
            {id: 2, lang: 'en', firstName: 'Fn1', lastName: 'Ln2'},
            {id: 3, lang: 'en', firstName: 'Fn3', lastName: 'Ln1'}
        ];
        store.whenIter(authors, function(author) { return authorStore.getLocalStore().add(author); });

        var tags = [
            {id: 1, lang: 'en', name: 'T1'},
            {id: 1, lang: 'ru', name: 'T1-ru'},
            {id: 2, lang: 'en', name: 'T1'},
            {id: 3, lang: 'en', name: 'T3'},
            {id: 4, lang: 'en', name: 'T4'}
        ];
        store.whenIter(tags, function(tag) { return tagStore.getLocalStore().add(tag); });

        var posts = [
            {id: 1, lang: 'en', slug: 'sl1', title: 'tl1', author: 1},
            {id: 1, lang: 'ru', slug: 'sl1-ru', title: 'tl1-ru', author: 1},
            {id: 2, lang: 'en', slug: 'sl1', title: 'tl2', author: 1},  // slug can be unique per date
            {id: 3, lang: 'en', slug: 'sl3', title: 'tl1', author: 2},
            {id: 4, lang: 'en', slug: 'sl4', title: 'tl4', author: 3}
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

        var author = authorStore.get([1, 'en']);

        store.when(authorStore.compose(author), function(author) {
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
            resolve();
        });
    }
    return testCompose;
});
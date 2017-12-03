define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks;


    function testDecompose(resolve, reject) {
        var registry = new store.Registry();

        var categoryStore = new store.Store({
            pk: ['id', 'lang'],
            remoteStore: new store.DummyStore()
        });
        registry.register('category', categoryStore);

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
                    },
                    category: {
                        field: ['category_id', 'lang'],
                        relatedStore: 'category',
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

        var author = {
            id: 1,
            lang: 'en',
            firstName: 'Fn1',
            lastName: 'Ln1',
            posts: [
                {
                    id: 2,
                    lang: 'en',
                    slug: 'sl1',
                    title: 'tl1',
                    category: {id: 8, lang: 'en', name: 'C1'},
                    tags: [
                        {id: 5, lang: 'en', name: 'T1'},
                        {id: 6, lang: 'en', name: 'T1'}
                    ]
                },
                {
                    id: 3,
                    lang: 'en',
                    slug: 'sl1',
                    title: 'tl2',
                    category: {id: 9, lang: 'en', name: 'C2'},
                    tags: [
                        {id: 5, lang: 'en', name: 'T1'},
                        {id: 7, lang: 'en', name: 'T3'}
                    ]
                }
            ]
        };

        store.when(authorStore.decompose(author), function(author) {
            var compositePkAccessor = function(o) { return [o.id, o.lang]; };
            var r;
            r = authorStore.find();
            assert(expectPks(r, [[1, 'en']], compositePkAccessor));
            r = postStore.find();
            assert(expectPks(r, [[2, 'en'], [3, 'en']], compositePkAccessor));
            for (var i = 0; i < r.length; i++) {
                assert(r[i].author === 1);
            }
            r = tagStore.find();
            assert(expectPks(r, [[5, 'en'], [6, 'en'], [7, 'en']], compositePkAccessor));
            r = tagPostStore.find({postId: 2, postLang: 'en', tagId: 5, tagLang: 'en'});
            assert(r.length === 1);
            r = tagPostStore.find({postId: 2, postLang: 'en', tagId: 6, tagLang: 'en'});
            assert(r.length === 1);
            r = tagPostStore.find({postId: 3, postLang: 'en', tagId: 5, tagLang: 'en'});
            assert(r.length === 1);
            r = tagPostStore.find({postId: 3, postLang: 'en', tagId: 7, tagLang: 'en'});
            assert(r.length === 1);

            r = categoryStore.find();
            assert(expectPks(r, [[8, 'en'], [9, 'en']], compositePkAccessor));

            assert(author.posts[0].id === 2);
            assert(author.posts[0].author === 1);
            assert(author.posts[1].id === 3);
            assert(author.posts[1].author === 1);
            assert(author.posts.length === 2);

            assert(author.posts[0].tags[0].id === 5);
            assert(author.posts[0].tags[1].id === 6);
            assert(author.posts[0].tags.length === 2);

            assert(author.posts[1].tags[0].id === 5);
            assert(author.posts[1].tags[1].id === 7);
            assert(author.posts[1].tags.length === 2);

            assert(author.posts[0].category_id === 8);
            assert(author.posts[1].category_id === 9);

            registry.destroy();
            resolve();
        });
    }
    return testDecompose;
});
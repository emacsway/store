define(['../store', './utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectOrderedPks;


    function testTransaction(resolve, reject) {
        var registry = new store.Registry();

        var authorEndpoint = [];
        var postEndpoint = [];

        function TestStore(options) {
            store.DummyStore.call(this, options);
            this._endpoint = options.endpoint;
            this._counter = options.counter;
        }
        TestStore.prototype = store.clone({
            constructor: TestStore,
            setNextPk: function(obj) {
                this.getObjectAccessor().setPk(obj, [++this._counter, obj.lang]);
            },
            add: function(obj) {
                this._endpoint.push(['add', obj]);
                return store.DummyStore.prototype.add.apply(this, arguments);
            },
            update: function(obj) {
                this._endpoint.push(['update', obj]);
                return store.DummyStore.prototype.update.apply(this, arguments);
            },
            delete: function(obj) {
                this._endpoint.push(['delete', obj]);
                return store.DummyStore.prototype.delete.apply(this, arguments);
            },
            isNull: function() {
                return false;
            }
        }, Object.create(store.DummyStore.prototype));


        function Author(attrs) {
            store.clone(attrs, this);
        }


        function Post(attrs) {
            store.clone(attrs, this);
        }


        var authorStore = new store.Store({
            pk: ['id', 'lang'],
            indexes: ['firstName', 'lastName'],
            remoteStore: new TestStore({
                pk: ['id', 'lang'],
                counter: 10,
                endpoint: authorEndpoint
            }),
            model: Author
        });
        registry.register('author', authorStore);

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
                }
            },
            remoteStore: new TestStore({
                pk: ['id', 'lang'],
                counter: 20,
                endpoint: postEndpoint
            }),
            model: Post
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

        var posts = [
            {id: 1, lang: 'en', slug: 'sl1', title: 'tl1', author: 1},
            {id: 1, lang: 'ru', slug: 'sl1-ru', title: 'tl1-ru', author: 1},
            {id: 2, lang: 'en', slug: 'sl1', title: 'tl2', author: 1},  // slug can be unique per date
            {id: 3, lang: 'en', slug: 'sl3', title: 'tl1', author: 2},
            {id: 4, lang: 'en', slug: 'sl4', title: 'tl4', author: 3}
        ];
        store.whenIter(posts, function(post) { return postStore.getLocalStore().add(post); });

        var compositePkAccessor = function(o) { return [o.id, o.lang]; };

        // Add
        registry.begin();
        var author = {lang: 'en', firstName: 'Fn11', lastName: 'Ln11'};
        registry.get('author').add(author).then(function() {
            author = registry.get('author').get(['__tmp_1', 'en']);
            assert(author instanceof Author);
            assert(author.lang === 'en');
            assert(author.id === '__tmp_1');
            assert(author.firstName === 'Fn11');
            assert(registry.get('author').get(['__tmp_1', 'en']) === author);
            var r = registry.get('author').find();
            assert(expectPks(
                r,
            [[1, 'en'], [1, 'ru'], [2, 'en'], [3, 'en'], ['__tmp_1', 'en']],
            compositePkAccessor
                ));

            var post = {lang: 'en', slug: 'sl4', title: 'tl4', author: author.id};
            registry.get('post').add(post).then(function() {
                post = registry.get('post').get(['__tmp_2', 'en']);
                assert(post instanceof Post);
                assert(post.lang === 'en');
                assert(post.id === '__tmp_2');

                assert(authorEndpoint.length === 0);
                assert(postEndpoint.length === 0);

                registry.commit().then(function() {
                    assert(author.lang === 'en');
                    assert(author.id === 11);
                    assert(registry.get('author').get([11, 'en']) === author);

                    assert(post.lang === 'en');
                    assert(post.id === 21);
                    assert(post.author === 11);

                    assert(authorEndpoint.length === 1);
                    assert(authorEndpoint[0][0] === 'add');
                    assert(authorEndpoint[0][1] === author);
                    assert(postEndpoint.length === 1);
                    assert(postEndpoint[0][0] === 'add');
                    assert(postEndpoint[0][1] === post);

                    // Delete
                    registry.begin();
                    authorEndpoint.splice(0, Number.MAX_VALUE);
                    postEndpoint.splice(0, Number.MAX_VALUE);
                    registry.get('author').delete(author).then(function() {
                        r = registry.get('author').find();
                        assert(expectPks(
                            r,
                        [[1, 'en'], [1, 'ru'], [2, 'en'], [3, 'en']],
                        compositePkAccessor
                            ));
                        r = registry.get('post').find();
                        assert(expectPks(
                            r,
                        [[1, 'en'], [1, 'ru'], [2, 'en'], [3, 'en'], [4, 'en']],
                        compositePkAccessor
                            ));

                        assert(authorEndpoint.length === 0);
                        assert(postEndpoint.length === 0);

                        registry.commit().then(function() {

                            assert(authorEndpoint.length === 1);
                            assert(authorEndpoint[0][0] === 'delete');
                            assert(authorEndpoint[0][1] === author);
                            assert(postEndpoint.length === 1);
                            assert(postEndpoint[0][0] === 'delete');
                            assert(postEndpoint[0][1] === post);

                            registry.destroy();
                            resolve();
                        });
                    });
                });
            });
        });
    }
    return testTransaction;
});
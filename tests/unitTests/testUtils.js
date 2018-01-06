define(['../../store', '../utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        Promise = window.Promise;


    function testArrayRemove(resolve, reject) {
        assert(store.arrayRemove([1, 2, 3, 4, 3, 5], 3).toString() === [1, 2, 4, 5].toString());
        assert(store.arrayRemove([1, 2, 3, 3, 4, 5], 3).toString() === [1, 2, 4, 5].toString());
        assert(store.arrayRemove([1, 2, 3, 4, 5], 3).toString() === [1, 2, 4, 5].toString());
        assert(store.arrayRemove([1, 2, 3, 4, 5], 1).toString() === [2, 3, 4, 5].toString());
        assert(store.arrayRemove([1, 2, 3, 4, 5], 5).toString() === [1, 2, 3, 4].toString());
        resolve();
    }


    function testResolveRejection(resolve, reject) {
        Promise.all([
            store.resolveRejection(Promise.reject(2), function(reason) {
                return Promise.resolve(reason + 2);
            }).then(function(value) {
                assert(value === 4);
            }),
            store.resolveRejection(Promise.resolve(2), function(reason) {
                return Promise.resolve(reason + 2);
            }).then(function(value) {
                assert(value === 2);
            }),
            store.when(store.resolveRejection(2, function(reason) {
                return Promise.resolve(reason + 2);
            }), function(value) {
                assert(value === 2);
            })
        ]).then(function() { resolve(); });
    }


    function testUtils(resolve, reject) {
        store.when(store.whenIter([testArrayRemove, testResolveRejection], function(suite) {
            return new Promise(suite);
        }), function() {
            resolve();
        });
    }
    return testUtils;
});
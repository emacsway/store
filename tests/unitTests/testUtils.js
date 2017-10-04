define(['../../store', '../utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert;


    function testUtils(resolve, reject) {
        assert(store.arrayRemove([1, 2, 3, 4, 3, 5], 3).toString() === [1, 2, 4, 5].toString());
        assert(store.arrayRemove([1, 2, 3, 3, 4, 5], 3).toString() === [1, 2, 4, 5].toString());
        assert(store.arrayRemove([1, 2, 3, 4, 5], 3).toString() === [1, 2, 4, 5].toString());
        assert(store.arrayRemove([1, 2, 3, 4, 5], 1).toString() === [2, 3, 4, 5].toString());
        assert(store.arrayRemove([1, 2, 3, 4, 5], 5).toString() === [1, 2, 3, 4].toString());
        resolve();
    }
    return testUtils;
});
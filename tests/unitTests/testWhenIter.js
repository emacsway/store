define(['../../store', '../utils'], function(store, utils) {
    'use strict';
    var Promise = window.Promise;
    var when = store.when;
    var whenIter = store.whenIter;
    var assert = utils.assert;


    function testWhenIter(resolve, reject) {
        var collection = [1, 2, 3, 4];
        var result = whenIter(collection, function(item, i) {
            collection[i] = item * 2;
        });
        // console.debug(result);
        assert(result === collection);
        assert(result.length === 4);
        assert(store.arrayEqual(result, [2, 4, 6, 8]));


        var collection = [1, 2, 3, 4];
        when(whenIter(collection, function(item, i) {
            return when(new Promise(function(resolve, reject) {
                setTimeout(function() { resolve(item); }, 15);
            }), function(item) {
                collection[i] = item * 2;
            });
        }), function(result) {
            // console.debug(result);
            assert(result === collection);
            assert(result.length === 4);
            assert(store.arrayEqual(result, [2, 4, 6, 8]));
            resolve();
        });
    }
    return testWhenIter;
});
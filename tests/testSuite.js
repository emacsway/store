define([
    '../store',

    './unitTests/testQueryDjangoSerializer',
    './unitTests/testUtils',
    './unitTests/testWhenIter',
    './unitTests/testMapper',

    './testQuery',
    './testSimpleRelations',
    './testCompositeRelations',
    './testManyToMany',
    './testCompose',
    './testDecompose',
    './testObservable',
    './testStoreObservable',
    './testResult',
    './testTransaction',
    './testDataAccessingWithCrossCuttingConcerns',

    './MemoryStoreTests/testSimpleRelationsMemoryStore',

    './testBench'
], function(store) {

    'use strict';
    var suites = Array.prototype.slice.call(arguments, 1);

    function log(msg) {
        console.debug(msg);
    }

    function testSuite() {
        log('Total tests: ' + suites.length);
        console.time && console.time('testSuite');
        // suites[5](function(){}); return;
        store.when(store.whenIter(suites, function(suite, i) {
            log("Run test " + (i + 1));
            return new Promise(function(resolve, reject) {
                var result = suite(resolve, reject);
                if (result && typeof result.then === "function") {
                    result.then(resolve);
                }
            });
        }), function() {
            log('Test OK');
            console.timeEnd && console.timeEnd('testSuite');
        }, function() {
            log('Test FAILED!');
        });
    }
    return testSuite;
});
define(['../../store', '../utils'], function(store, utils) {
    'use strict';
    var assert = utils.assert,
        objectEqual = utils.objectEqual;


    function testQueryDjangoSerializer(resolve, reject) {
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$eq': 'Ivan'}}}}
            ),
            {'author__name': 'Ivan'}
        ));
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$ne': 'Ivan'}}}}
            ),
            {'author__name__ne': 'Ivan'}
        ));
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$eq': null}}}}
            ),
            {'author__name__isnull': true}
        ));
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$ne': null}}}}
            ),
            {'author__name__isnull': false}
        ));
        resolve();
    }
    return testQueryDjangoSerializer;
});
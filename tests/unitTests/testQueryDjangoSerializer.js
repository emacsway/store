define(['../../store', '../utils'], function(store, utils) {
    'use strict';
    var assert = utils.assert,
        objectEqual = utils.objectEqual;


    function testQueryDjangoSerializer(resolve, reject) {
        var mapper = new store.Mapper();
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$eq': 'Ivan'}}}}, mapper
            ),
            {'author__name': 'Ivan'}
        ));
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$ne': 'Ivan'}}}}, mapper
            ),
            {'author__name__ne': 'Ivan'}
        ));
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$eq': null}}}}, mapper
            ),
            {'author__name__isnull': true}
        ));
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$ne': null}}}}, mapper
            ),
            {'author__name__isnull': false}
        ));
        resolve();
    }
    return testQueryDjangoSerializer;
});
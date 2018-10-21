define(['../../store', '../utils'], function(store, utils) {
    'use strict';
    var assert = utils.assert,
        objectEqual = utils.objectEqual;


    function testQueryDjangoSerializer(resolve, reject) {
        var serializer = new store.Serializer();
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$eq': 'Ivan'}}}}, serializer
            ),
            {'author__name': 'Ivan'}
        ));
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$ne': 'Ivan'}}}}, serializer
            ),
            {'author__name__ne': 'Ivan'}
        ));
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$eq': null}}}}, serializer
            ),
            {'author__name__isnull': true}
        ));
        assert(objectEqual(
            store.queryDjangoSerializer.execute(
                {'author': {'$rel': {'name': {'$ne': null}}}}, serializer
            ),
            {'author__name__isnull': false}
        ));
        resolve();
    }
    return testQueryDjangoSerializer;
});
define(['../../store', '../utils'], function(store, utils) {

    'use strict';

    var assert = utils.assert,
        expectPks = utils.expectPks,
        expectOrderedPks = utils.expectOrderedPks;


    function testSerializer(resolve, reject) {

        function Model(attrs) {
            store.clone(attrs, this);
        }

        var serializer = new store.Serializer({
            model: Model,
            fields: [
                new store.RenamedField('alias1', 'column1'),
                new store.Field('column2')
            ]
        });

        var obj = serializer.load({column1: 2, column2: 3});
        assert(obj instanceof Model);
        assert(obj.alias1 === 2);
        assert(typeof obj.column1 === "undefined");
        assert(obj.column2 === 3);

        var record = serializer.dump(obj);
        assert(typeof record.alias1 === "undefined");
        assert(record.column1 === 2);
        assert(record.column2 === 3);
        resolve();

    }
    return testSerializer;
});
const store = require('../../../../store');

const { assert } = intern.getPlugin('chai');
const { registerSuite } = intern.getPlugin('interface.object');

function TestModel (id, a, b, c) {
    this.id = id;
    this.a = a;
    this.b = b;
    this.c = c;
}

const TEST_COLLECTION = [
	new TestModel(1, 1, [
		new TestModel(11, 11),
		new TestModel(12, 12),
		new TestModel(13, 13)
	], new TestModel(14, 14)),
	new TestModel(2, 2, [
		new TestModel(21, 21),
		new TestModel(22, 22),
		new TestModel(23, 23)
	], new TestModel(24, 24)),
	new TestModel(3, 3, [
		new TestModel(31, 31),
		new TestModel(32, 32),
		new TestModel(33, 33)
	], new TestModel(34, 34))
];

registerSuite('QueryObjectFilter', () => {
    let queryObjectFilter;
    let objectAccessor;

    return {
        beforeEach() {
            queryObjectFilter = store.queryObjectFilter;
            objectAccessor = new store.ObjectAccessor();
        },
        'resolve property': {
            'should return false for an incorrect value of field'() {
                assert.isFalse(queryObjectFilter.execute({"a": {"$eq": 2}}, objectAccessor, TEST_COLLECTION[0]));
            }
        }
    };
});
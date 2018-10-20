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
        'should resolve property': {
            'should return false for an incorrect value of field'() {
                assert.isFalse(queryObjectFilter.execute({"a": {"$eq": 2}}, objectAccessor, TEST_COLLECTION[0]));
            },
            'should return true for the correct value of field'() {
                assert.isTrue(queryObjectFilter.execute({"a": {"$eq": 2}}, objectAccessor, TEST_COLLECTION[1]));
            },
            'should return false for an incorrect value of nested collection field'() {
                assert.isFalse(queryObjectFilter.execute({"b.a": {"$eq": 22}}, objectAccessor, TEST_COLLECTION[0]));
            },
            'should return true for the correct value of nested collection field'() {
                assert.isTrue(queryObjectFilter.execute({"b.a": {"$eq": 22}}, objectAccessor, TEST_COLLECTION[1]));
            },
            'should return false for an incorrect value of nested object field'() {
                assert.isFalse(queryObjectFilter.execute({"c.a": {"$eq": 24}}, objectAccessor, TEST_COLLECTION[0]));
            },
            'should return true for the correct value of nested object field'() {
                assert.isTrue(queryObjectFilter.execute({"c.a": {"$eq": 24}}, objectAccessor, TEST_COLLECTION[1]));
            }
        },
        'should evaluate $eq operator': {
            'should return false for an incorrect value'() {
                assert.isFalse(queryObjectFilter.execute({"a": {"$eq": 2}}, objectAccessor, TEST_COLLECTION[0]));
            },
            'should return true for the correct value'() {
                assert.isTrue(queryObjectFilter.execute({"a": {"$eq": 2}}, objectAccessor, TEST_COLLECTION[1]));
            }
        },
        'should evaluate $ne operator': {
            'should return false for an incorrect value'() {
                assert.isFalse(queryObjectFilter.execute({"a": {"$ne": 2}}, objectAccessor, TEST_COLLECTION[1]));
            },
            'should return true for the correct value'() {
                assert.isTrue(queryObjectFilter.execute({"a": {"$ne": 2}}, objectAccessor, TEST_COLLECTION[0]));
            }
        }
    };
});
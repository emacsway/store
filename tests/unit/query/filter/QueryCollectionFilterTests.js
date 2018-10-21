const store = require('../../../../store');

const { assert } = intern.getPlugin('chai');
const { registerSuite } = intern.getPlugin('interface.object');

function TestModel (id, a, b) {
    this.id = id;
    this.a = a;
    this.b = b;
}

const TEST_COLLECTION = [
	new TestModel(1, 1, 1),
	new TestModel(2, 2, 2),
	new TestModel(3, 2, 3),
	new TestModel(4, 5, 4),
	new TestModel(5, 4, 4)
];

registerSuite('QueryCollectionFilter', () => {
    let queryCollectionFilter;
    let objectAccessor;

    return {
        beforeEach() {
            queryCollectionFilter = store.queryCollectionFilter;
            objectAccessor = new store.ObjectAccessor();
        },
        '$query operator': {
            'should return a filtered list'() {
                var result = queryCollectionFilter.execute({
                    "$query": {"a": {"$eq": 5}}
                }, objectAccessor, TEST_COLLECTION);
                assert.lengthOf(result, 1);
            }
        },
        '$orderby operator': {
            'sorted by ascending'() {
                var result = queryCollectionFilter.execute({"$orderby": "a"}, objectAccessor, TEST_COLLECTION);
                assert.deepEqual(result.map((obj) => obj.a), [1, 2, 2, 4, 5]);
            },
            'sorted by descending'() {
                var result = queryCollectionFilter.execute({"$orderby": "-a"}, objectAccessor, TEST_COLLECTION);
                assert.deepEqual(result.map((obj) => obj.a), [5, 4, 2, 2, 1]);
            },
            'sorted by specified custom order'() {
                var result = queryCollectionFilter.execute(
                    {"$orderby": {"a": [3, 2, 4, 5, 1]}}, objectAccessor, TEST_COLLECTION
                );
                assert.deepEqual(result.map((obj) => obj.a), [2, 2, 4, 5, 1]);
            },
            'sorted by ascending for multiple fields'() {
                var result = queryCollectionFilter.execute({"$orderby": ["a", "b"]}, objectAccessor, TEST_COLLECTION);
                assert.deepEqual(result.map((obj) => obj.a), [1, 2, 2, 4, 5]);
                assert.deepEqual(result.map((obj) => obj.b), [1, 2, 3, 4, 4]);
            },
            'sorted by descending for multiple fields'() {
                var result = queryCollectionFilter.execute({"$orderby": ["-a", "-b"]}, objectAccessor, TEST_COLLECTION);
                assert.deepEqual(result.map((obj) => obj.a), [5, 4, 2, 2, 1]);
                assert.deepEqual(result.map((obj) => obj.b), [4, 4, 3, 2, 1]);
            },
            'sorted by both for multiple fields'() {
                var result = queryCollectionFilter.execute({"$orderby": ["a", "-b"]}, objectAccessor, TEST_COLLECTION);
                assert.deepEqual(result.map((obj) => obj.a), [1, 2, 2, 4, 5]);
                assert.deepEqual(result.map((obj) => obj.b), [1, 3, 2, 4, 4]);
            }
        },
        '$offset operator': {
            'should return a list sliced by offset'() {
                var result = queryCollectionFilter.execute({"$offset": 3}, objectAccessor, TEST_COLLECTION);
                assert.deepEqual(result.map((obj) => obj.id), [4, 5]);
            }
        },
        '$limit operator': {
            'should return a list sliced by limit'() {
                var result = queryCollectionFilter.execute({"$limit": 3}, objectAccessor, TEST_COLLECTION);
                assert.deepEqual(result.map((obj) => obj.id), [1, 2, 3]);
            }
        }
    };
});
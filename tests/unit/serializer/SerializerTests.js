const store = require('../../../store');

const { assert } = intern.getPlugin('chai');
const { registerSuite } = intern.getPlugin('interface.object');


/*
 * @constructor
 * @param {number} x
 * @param {number} y
 */
function Point(x, y) {
    this.x = x;
    this.y = y;
}


/*
 * @constructor
 * @param {number} id
 * @param {number} a
 * @param {Point} point
 */
function TestModel (id, a, point) {
    this.id = id;
    this.a = a;
    this.point = point;
}


registerSuite('Serializer', () => {
    let serializer;

    return {
        beforeEach() {
            serializer = new store.Serializer({
                fields: [
                    new store.Field('id'),
                    new store.RenamedField('a', 'aRenamed'),
                    new store.Field(
                        'point',
                        (record) => new Point(record['x'], record['y']),
                        (value) => ({x: value['x'], y: value['y']}),
                        (error) => [error.x, error.y]
                    )
                ]
            });
        },
        'TestModel': {
            'load'() {
                const obj = serializer.load({
                    id: 1,
                    aRenamed: 2,
                    x: 5,
                    y: 6
                });
                assert.deepEqual(obj, new TestModel(1, 2, new Point(5, 6)));
            },
            'dump'() {
                debugger;
                const record = serializer.dump(new TestModel(1, 2, new Point(5, 6)));
                assert.deepEqual(record, {
                    id: 1,
                    aRenamed: 2,
                    x: 5,
                    y: 6
                });
            }
        }
    };
});
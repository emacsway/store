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


registerSuite('Mapper', () => {
    let mapper;

    return {
        beforeEach() {
            mapper = new store.Mapper();
        },
        'TestModel': {
            'should map point'() {
                var obj = mapper.load({
                    id: 1,
                    aRenamed: 2,
                    x: 5,
                    y: 6
                });
                assert.deepEqual(obj, new TestModel(1, 2, newPoint(5, 6)));
            }
        }
    };
});
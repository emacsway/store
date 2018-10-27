const store = require('../../../store');

const { assert } = intern.getPlugin('chai');
const { registerSuite } = intern.getPlugin('interface.object');


/*
 * @constructor
 * @param {number} id
 * @param {number} a
 */
function TestModel (id, a) {
    this.id = id;
    this.a = a;
}


registerSuite('Field', () => {
    const expected = {
        id: 2,
        a: 5,
        name: 'a'
    };
    let field;
    let obj;

    return {
        beforeEach() {
            obj = new TestModel(expected.id, expected.a);
        },
        'default behaviour': {
            beforeEach() {
                field = new store.Field(expected.name);
            },
            'getName'() {
                const name = field.getName();
                assert.equal(name, expected.name);
            },
            'load'() {
                const a = field.load({[expected.name]: expected.a});
                assert.deepEqual(a, expected.a);
            },
            'dump'() {
                const record = field.dump(expected.a);
                assert.deepEqual(record, {[expected.name]: expected.a});
            },
            'loadError'() {
                const msg = "Error msg";
                const errorA = field.load({[expected.name]: msg});
                assert.deepEqual(errorA, msg);
            }
        }
    };
});
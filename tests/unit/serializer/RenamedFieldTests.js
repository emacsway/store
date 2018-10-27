const store = require('../../../store');

const { assert } = intern.getPlugin('chai');
const { registerSuite } = intern.getPlugin('interface.object');


/*
 * @constructor
 * @param {number} a
 */
function TestModel (a) {
    this.a = a;
}


registerSuite('RenamedField', () => {
    const expected = {
        obj: {
            value: 5,
            name: "a",
            msg: "Error msg"
        },
        record: {
            value: 5,
            name: "a",
            msg: "Error msg"
        }
    };
    let field;
    let obj;

    return {
        beforeEach() {
            obj = new TestModel(expected.obj.value);
        },
        'default behaviour': {
            beforeEach() {
                field = new store.Field(expected.obj.name);
            },
            'getName'() {
                const name = field.getName();
                assert.equal(name, expected.obj.name);
            },
            'load'() {
                const value = field.load({[expected.record.name]: expected.record.value});
                assert.deepEqual(value, expected.obj.value);
            },
            'dump'() {
                const record = field.dump(expected.obj.value);
                assert.deepEqual(record, {[expected.record.name]: expected.record.value});
            },
            'loadError'() {
                const msg = field.load({[expected.record.name]: expected.record.msg});
                assert.deepEqual(msg, expected.obj.msg);
            }
        }
    };
});
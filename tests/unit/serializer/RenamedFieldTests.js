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
        value: 5,
        objName: 'a',
        recordName: 'recordA'
    };
    let field;
    let obj;

    return {
        beforeEach() {
            obj = new TestModel(expected.value);
        },
        'default behaviour': {
            beforeEach() {
                field = new store.Field(expected.objName);
            },
            'getName'() {
                const name = field.getName();
                assert.equal(name, expected.objName);
            },
            'load'() {
                const value = field.load({[expected.recordName]: expected.value});
                assert.deepEqual(value, expected.value);
            },
            'dump'() {
                const record = field.dump(expected.value);
                assert.deepEqual(record, {[expected.recordName]: expected.value});
            },
            'loadError'() {
                const expectedMsg = "Error msg";
                const msg = field.load({[expected.recordName]: expectedMsg});
                assert.deepEqual(msg, expectedMsg);
            }
        }
    };
});
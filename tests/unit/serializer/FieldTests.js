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


registerSuite('Field', () => {
    let field;
    let obj;
    let expected;

    return {
        'default behaviour': {
            beforeEach() {
                expected = {
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
                field = new store.Field(expected.obj.name);
                obj = new TestModel(expected.obj.value);
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
                const msg = field.loadError({[expected.record.name]: expected.record.msg});
                assert.deepEqual(msg, expected.obj.msg);
            }
        },

        'defined behaviour': {
            beforeEach() {
                expected = {
                    obj: {
                        value: 7,
                        name: "a",
                        msg: "Error msg1 - Error msg2"
                    },
                    record: {
                        value: [5, 2],
                        name: "recordA",
                        msg: ["Error msg1", "Error msg2"]
                    }
                };
                field = new store.Field(
                    expected.obj.name,
                    (record) => {
                        return record[expected.record.name][0] + record[expected.record.name][1];
                    },
                    (value) => {
                        return {[expected.record.name]: [value - 2, 2]};
                    },
                    (error) => {
                        return error[expected.record.name].join(' - ');
                    }
                );
                obj = new TestModel(expected.obj.value);
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
                const msg = field.loadError({[expected.record.name]: expected.record.msg});
                assert.deepEqual(msg, expected.obj.msg);
            }
        }
    };
});
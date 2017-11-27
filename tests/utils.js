define(function() {

    'use strict';


    function objectEqual(obj1, obj2) {
        for (var i in obj1) {
            if (obj1.hasOwnProperty(i)) {
                if (!obj2.hasOwnProperty(i)) return false;
                if (typeof obj1[i] === "object") {
                    if (!objectEqual(obj1[i], obj2[i])) return false;
                } else {
                    if (obj1[i] !== obj2[i]) return false;
                }
            }
        }
        for (var i in obj2) {
            if (obj2.hasOwnProperty(i)) {
                if (!obj1.hasOwnProperty(i)) return false;
                if (typeof obj1[i] === "object") {
                    if (!objectEqual(obj1[i], obj2[i])) return false;
                } else {
                    if (obj1[i] !== obj2[i]) return false;
                }
            }
        }
        return true;
    }


    function expectOrderedPks(objectList, expectedPks, pkAccessor) {
        if (!pkAccessor) {
            pkAccessor = function(o) { return o.id; };
        }
        var pks = Array.prototype.map.call(objectList, pkAccessor);
        pks = Array.apply(Array(), pks);
        return JSON.stringify(pks) === JSON.stringify(expectedPks);
    }


    function expectPks(objectList, expectedPks, pkAccessor) {
        if (!pkAccessor) {
            pkAccessor = function(o) { return o.id; };
        }
        var pks = Array.prototype.map.call(objectList, pkAccessor).sort();
        pks = Array.apply(Array(), pks);
        expectedPks = expectedPks.sort();
        return JSON.stringify(pks) === JSON.stringify(expectedPks);
    }


    function assert(condition, failMessage) {
        if (!condition) throw new Error(failMessage || "Assertion failed.");
    }

    return {
        objectEqual: objectEqual,
        expectOrderedPks: expectOrderedPks,
        expectPks: expectPks,
        assert: assert
    };
});
import assert from "node:assert/strict";
import util from "node:util";
import { test, describe, beforeEach, afterEach } from "node:test";
import { watch, store } from "./state.js";

describe("nested watchers", () => {
    let data;
    let fired;
    let w1, w2, w3;

    beforeEach(() => {
        data = store({
            count1: 0,
            count2: 0,
            count3: 0,
        });

        fired = {
            count1: 0,
            count2: 0,
            count3: 0,
        };

        w1 = watch(() => {
            fired.count1++;
            data.count1;

            w2?.unwatch();
            w2 = watch(() => {
                fired.count2++;
                data.count2;

                w3?.unwatch();
                w3 = watch(() => {
                    fired.count3++;
                    data.count3;
                });
            });
        });
    });

    afterEach(() => {
        w1.unwatch();
        w2.unwatch();
        w3.unwatch();
    });

    test("watchers initialization", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count1, 0, "data.count1");
        assert.strictEqual(data.count2, 0, "data.count2");
        assert.strictEqual(data.count3, 0, "data.count3");
        assert.strictEqual(fired.count1, 1, "fired.count1");
        assert.strictEqual(fired.count2, 1, "fired.count2");
        assert.strictEqual(fired.count3, 1, "fired.count3");
    });

    test("updating a child dependency should update only its watcher", async () => {
        data.count3++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count1, 0, "data.count1");
        assert.strictEqual(data.count2, 0, "data.count2");
        assert.strictEqual(data.count3, 1, "data.count3");
        assert.strictEqual(fired.count1, 1, "fired.count1");
        assert.strictEqual(fired.count2, 1, "fired.count2");
        assert.strictEqual(fired.count3, 2, "fired.count3");
    });

    test("updating a parent dependency should reinitialize all of its children", async () => {
        data.count1++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count1, 1, "data.count1");
        assert.strictEqual(data.count2, 0, "data.count2");
        assert.strictEqual(data.count3, 0, "data.count3");
        assert.strictEqual(fired.count1, 2, "fired.count1");
        assert.strictEqual(fired.count2, 2, "fired.count2");
        assert.strictEqual(fired.count3, 2, "fired.count3");
    });

    test("updating a child dependency again should update only its watcher once, not twice", async () => {
        data.count3++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count1, 0, "data.count1");
        assert.strictEqual(data.count2, 0, "data.count2");
        assert.strictEqual(data.count3, 1, "data.count3");
        assert.strictEqual(fired.count1, 1, "fired.count1");
        assert.strictEqual(fired.count2, 1, "fired.count2");
        assert.strictEqual(fired.count3, 2, "fired.count3");
    });

    test("updating both parent and child dependency should trigger only the parent watcher, which will initialize its children again", async () => {
        data.count1++;
        data.count2++;
        data.count3++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count1, 1, "data.count1");
        assert.strictEqual(data.count2, 1, "data.count2");
        assert.strictEqual(data.count3, 1, "data.count3");
        assert.strictEqual(fired.count1, 2, "fired.count1");
        assert.strictEqual(fired.count2, 2, "fired.count2");
        assert.strictEqual(fired.count3, 2, "fired.count3");
    });

    test("deleting a parent watcher should unwatch all of its children watchers", async () => {
        // no more watchers should be fired after this
        w1.unwatch();

        // unwatch is currently debounced!
        await new Promise((resolve) => setTimeout(resolve, 200));

        // call one by one in reverse to ensure that the calls are not batched
        data.count3++;
        await new Promise((resolve) => setTimeout(resolve, 0));
        data.count2++;
        await new Promise((resolve) => setTimeout(resolve, 0));
        data.count1++;
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count1, 1, "data.count1");
        assert.strictEqual(data.count2, 1, "data.count2");
        assert.strictEqual(data.count3, 1, "data.count3");
        assert.strictEqual(fired.count1, 1, "fired.count1");
        assert.strictEqual(fired.count2, 1, "fired.count2");
        assert.strictEqual(fired.count3, 1, "fired.count3");
    });
});

describe("store with simple values", () => {
    let data;
    let fired;
    const watchers = [];

    beforeEach(() => {
        data = store({
            count: 0,
            name: "",
            nowatch: false,
        });

        fired = {
            count: 0,
            name: 0,
            nowatch: 0,
        };

        // count only watcher
        watchers.push(
            watch(() => {
                fired.count++;
                data.count;
            }),
        );

        // name only watcher
        watchers.push(
            watch(() => {
                fired.name++;
                data.name;
            }),
        );

        // name and count watcher
        watchers.push(
            watch(() => {
                fired.name++;
                fired.count++;
                data.count && data.name;
            }),
        );
    });

    afterEach(() => {
        watchers.forEach((w) => w.unwatch());
    });

    test("watchers initialization", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count, 0, "data.count");
        assert.strictEqual(data.name, "", "data.name");
        assert.strictEqual(data.nowatch, false, "data.nowatch");
        assert.strictEqual(fired.count, 2, "fired.count");
        assert.strictEqual(fired.name, 2, "fired.name");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("changing none-watched value", async () => {
        data.nowatch = true;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count, 0, "data.count");
        assert.strictEqual(data.name, "", "data.name");
        assert.strictEqual(data.nowatch, true, "data.nowatch");
        assert.strictEqual(fired.count, 2, "fired.count");
        assert.strictEqual(fired.name, 2, "fired.name");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("changing only the counter", async () => {
        data.count++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count, 1, "data.count");
        assert.strictEqual(data.name, "", "data.name");
        assert.strictEqual(data.nowatch, false, "data.nowatch");
        assert.strictEqual(fired.count, 4, "fired.count");
        assert.strictEqual(fired.name, 3, "fired.name");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("changing only the name", async () => {
        data.name = "test1";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count, 0, "data.count");
        assert.strictEqual(data.name, "test1", "data.name");
        assert.strictEqual(data.nowatch, false, "data.nowatch");
        assert.strictEqual(fired.count, 2, "fired.count");
        assert.strictEqual(fired.name, 3, "fired.name");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("changing both name and counter", async () => {
        data.name = "test2";
        data.count++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count, 1, "data.count");
        assert.strictEqual(data.name, "test2", "data.name");
        assert.strictEqual(data.nowatch, false, "data.nowatch");
        assert.strictEqual(fired.count, 4, "fired.count");
        assert.strictEqual(fired.name, 4, "fired.name");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("multiple changes to a single property should be batched", async () => {
        data.count++;
        data.count++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count, 2, "data.count");
        assert.strictEqual(data.name, "", "data.name");
        assert.strictEqual(data.nowatch, false, "data.nowatch");
        assert.strictEqual(fired.count, 4, "fired.count");
        assert.strictEqual(fired.name, 3, "fired.name");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("no changes to the value shouldn't trigger watchers", async () => {
        data.count = data.count;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.count, 0, "data.count");
        assert.strictEqual(data.name, "", "data.name");
        assert.strictEqual(data.nowatch, false, "data.nowatch");
        assert.strictEqual(fired.count, 2, "fired.count");
        assert.strictEqual(fired.name, 2, "fired.name");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });
});

describe("store with objects", () => {
    const obj = { b: { c1: 1, c2: 2 } };
    let data;
    let fired;
    const watchers = [];

    beforeEach(() => {
        data = store({
            a: JSON.parse(JSON.stringify(obj)),
            nowatch: 0,
        });

        fired = {
            a: 0,
            ab: 0,
            abc1: 0,
            abc2: 0,
            nowatch: 0,
        };

        watchers.push(
            watch(() => {
                fired.a++;
                data.a;
            }),
        );

        watchers.push(
            watch(() => {
                fired.ab++;
                data.a?.b;
            }),
        );

        watchers.push(
            watch(() => {
                fired.abc1++;
                data.a?.b?.c1;
            }),
        );

        watchers.push(
            watch(() => {
                fired.abc2++;
                data.a?.b?.c2;
            }),
        );
    });

    afterEach(() => {
        watchers.forEach((w) => w.unwatch());
    });

    test("watchers initialization", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.a, 1, "fired.a");
        assert.strictEqual(fired.ab, 1, "fired.ab");
        assert.strictEqual(fired.abc1, 1, "fired.abc1");
        assert.strictEqual(fired.abc2, 1, "fired.abc2");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("replacing top level object should trigger the watchers for all children", async () => {
        data.a = JSON.parse(JSON.stringify(obj));

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.a, 2, "fired.a");
        assert.strictEqual(fired.ab, 2, "fired.ab");
        assert.strictEqual(fired.abc1, 2, "fired.abc1");
        assert.strictEqual(fired.abc2, 2, "fired.abc2");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("replacing sub object should trigger the watchers for only its children and not the parent", async () => {
        data.a.b = JSON.parse(JSON.stringify(obj.b));

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.a, 1, "fired.a");
        assert.strictEqual(fired.ab, 2, "fired.ab");
        assert.strictEqual(fired.abc1, 2, "fired.abc1");
        assert.strictEqual(fired.abc2, 2, "fired.abc2");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("updating an object prop should trigger only the watchers depending on that prop", async () => {
        data.a.b.c1++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.a.b.c1, 2, "data.a.b.c1");
        assert.strictEqual(fired.a, 1, "fired.a");
        assert.strictEqual(fired.ab, 1, "fired.ab");
        assert.strictEqual(fired.abc1, 2, "fired.abc1");
        assert.strictEqual(fired.abc2, 1, "fired.abc2");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("setting the same value shouldn't trigger the watchers", async () => {
        data.a.b.c1 = data.a.b.c1;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.a.b.c1, 1, "data.a.b.c1");
        assert.strictEqual(fired.a, 1, "fired.a");
        assert.strictEqual(fired.ab, 1, "fired.ab");
        assert.strictEqual(fired.abc1, 1, "fired.abc1");
        assert.strictEqual(fired.abc2, 1, "fired.abc2");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });
});

describe("store with arrays", () => {
    let data;
    let fired;
    const watchers = [];
    const simpleArr = [1, 2, 3];
    const complexArr = [{ name: "a" }, { name: "b" }];

    beforeEach(() => {
        data = store({
            simple: JSON.parse(JSON.stringify(simpleArr)),
            complex: JSON.parse(JSON.stringify(complexArr)),
            nowatch: 0,
        });

        fired = {
            simple: 0,
            simpleLength: 0,
            simpleChildA: 0,
            simpleChildB: 0,
            complex: 0,
            complexChildA: 0,
            complexChildB: 0,
            nowatch: 0,
        };

        watchers.push(
            watch(() => {
                fired.simple++;
                data.simple;
            }),
        );

        watchers.push(
            watch(() => {
                fired.simpleLength++;
                data.simple.length;
            }),
        );

        watchers.push(
            watch(() => {
                fired.simpleChildA++;
                data.simple[0];
            }),
        );

        watchers.push(
            watch(() => {
                fired.simpleChildB++;
                data.simple[1];
            }),
        );

        watchers.push(
            watch(() => {
                fired.complex++;
                data.complex;
            }),
        );

        watchers.push(
            watch(() => {
                fired.complexChildA++;
                data.complex[0];
            }),
        );

        watchers.push(
            watch(() => {
                fired.complexChildB++;
                data.complex[1].name;
            }),
        );
    });

    afterEach(() => {
        watchers.forEach((w) => w.unwatch());
    });

    test("watchers initialization", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 1, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 1, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 1, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("replacing top level array value should trigger the watchers for all children", async () => {
        data.complex = JSON.parse(JSON.stringify(complexArr));

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 1, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 1, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 1, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 2, "fired.complex");
        assert.strictEqual(fired.complexChildA, 2, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 2, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("replacing a single item by its index (simple)", async () => {
        data.simple[0] = 10;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.simple[0], 10, "data.simple.0");
        assert.strictEqual(data.simple[1], simpleArr[1], "data.simple.1");
        assert.strictEqual(data.simple[2], simpleArr[2], "data.simple.2");
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 1, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 2, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 1, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("setting the same value in a single item by its index shouldn't trigger watchers", async () => {
        data.simple[0] = data.simple[0];

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.simple[0], simpleArr[0], "data.simple.0");
        assert.strictEqual(data.simple[1], simpleArr[1], "data.simple.1");
        assert.strictEqual(data.simple[2], simpleArr[2], "data.simple.2");
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 1, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 1, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 1, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("reassigning with new array", async () => {
        // should fire for all children even though they may have the same value
        const newArr = [7, simpleArr[1], 9];
        data.simple = newArr;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.simple[0], newArr[0], "data.simple.0");
        assert.strictEqual(data.simple[1], newArr[1], "data.simple.1");
        assert.strictEqual(data.simple[2], newArr[2], "data.simple.2");
        assert.strictEqual(fired.simple, 2, "fired.simple");
        assert.strictEqual(fired.simpleLength, 2, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 2, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 2, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("push", async () => {
        data.simple.push(9);

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.simple[0], simpleArr[0], "data.simple.0");
        assert.strictEqual(data.simple[1], simpleArr[1], "data.simple.1");
        assert.strictEqual(data.simple[2], simpleArr[2], "data.simple.2");
        assert.strictEqual(data.simple[3], 9, "data.simple.3");
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 2, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 1, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 1, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("pop", async () => {
        data.simple.pop();
        data.simple.pop();

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(
            data.simple.length,
            simpleArr.length - 2,
            "data.simple.length",
        );
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 2, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 1, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 2, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("unshift", async () => {
        data.simple.unshift(9);

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(
            data.simple.length,
            simpleArr.length + 1,
            "data.simple.length",
        );
        assert.strictEqual(data.simple[0], 9, "data.simple.0");
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 2, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 2, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 2, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("shift", async () => {
        data.simple.shift();

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(
            data.simple.length,
            simpleArr.length - 1,
            "data.simple.length",
        );
        assert.strictEqual(data.simple[0], simpleArr[1], "data.simple.0");
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 2, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 2, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 2, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("splice", async () => {
        data.simple.splice(1, 0, 9);

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(
            data.simple.length,
            simpleArr.length + 1,
            "data.simple.length",
        );
        assert.strictEqual(data.simple[1], 9, "data.simple.0");
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 2, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 1, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 2, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("changing an array object prop (no prop watcher)", async () => {
        data.complex[0].name = "new";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.complex[0].name, "new", "data.complex.0.name");
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 1, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 1, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 1, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("changing an array object prop (prop watcher)", async () => {
        data.complex[1].name = "new";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.complex[1].name, "new", "data.complex.1.name");
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 1, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 1, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 1, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 2, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });

    test("changing an array object prop with the same value (prop watcher)", async () => {
        data.complex[1].name = data.complex[1].name;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(
            data.complex[1].name,
            data.complex[1].name,
            "data.complex.1.name",
        );
        assert.strictEqual(fired.simple, 1, "fired.simple");
        assert.strictEqual(fired.simpleLength, 1, "fired.simpleLength");
        assert.strictEqual(fired.simpleChildA, 1, "fired.simpleChildA");
        assert.strictEqual(fired.simpleChildB, 1, "fired.simpleChildB");
        assert.strictEqual(fired.complex, 1, "fired.complex");
        assert.strictEqual(fired.complexChildA, 1, "fired.complexChildA");
        assert.strictEqual(fired.complexChildB, 1, "fired.complexChildB");
        assert.strictEqual(fired.nowatch, 0, "fired.nowatch");
    });
});

describe("getters - internal cached prop", () => {
    const data = store({
        firstName: "a",
        lastName: "b",
        get fullName() {
            return data.firstName + " " + data.lastName;
        },
    });

    test("no internal prop initialization (aka. direct getter access)", () => {
        assert.strictEqual(data["@@fullName"], undefined, "[before] data.@@fullName");
        assert.strictEqual(data.fullName, "a b", "data.fullName");
        assert.strictEqual(data["@@fullName"], undefined, "[after] data.@@fullName");
    });

    test("internal prop initialization inside watch", () => {
        assert.strictEqual(data["@@fullName"], undefined, "[before] data.@@fullName");

        let watchVal;
        watch(() => {
            // this should initialize and return the internal prop
            watchVal = data.fullName;
        }).unwatch();

        assert.strictEqual(watchVal, "a b", "data.fullName");

        assert.strictEqual(data["@@fullName"], "a b", "[after] data.@@fullName");
    });

    test("internal prop should NOT be enumerable", () => {
        assert.strictEqual(
            JSON.stringify(data),
            `{"firstName":"a","lastName":"b","fullName":"a b"}`,
        );
    });
});

describe("getters - watcher", () => {
    let data;
    let fired;
    const watchers = [];

    beforeEach(() => {
        data = store({
            firstName: "a",
            lastName: "b",
            get fullName() {
                fired.getterCall++;
                return (data.firstName + " " + data.lastName).trim();
            },
        });

        fired = {
            firstName: 0,
            lastName: 0,
            getterWatch: 0,
            getterCall: 0,
        };

        watchers.push(
            watch(() => {
                fired.firstName++;
                data.firstName;
            }),
        );

        watchers.push(
            watch(() => {
                fired.lastName++;
                data.lastName;
            }),
        );

        watchers.push(
            watch(() => {
                fired.getterWatch++;
                data.fullName;
            }),
        );
    });

    afterEach(() => {
        watchers.forEach((w) => w.unwatch());
    });

    test("watchers initialization", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.firstName, 1, "fired.firstName");
        assert.strictEqual(fired.lastName, 1, "fired.lastName");
        assert.strictEqual(fired.getterWatch, 1, "fired.getterWatch");
        assert.strictEqual(fired.getterCall, 1, "fired.getterCall");
    });

    test("changing one of the getter dependency", async () => {
        data.firstName = "new";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.fullName, "new b", "data.fullName");
        assert.strictEqual(fired.firstName, 2, "fired.firstName");
        assert.strictEqual(fired.lastName, 1, "fired.lastName");
        assert.strictEqual(fired.getterWatch, 2, "fired.getterWatch");
        assert.strictEqual(fired.getterCall, 3, "fired.getterCall");
    });

    test("dependency change without affecting the getter value (aka. cached watch value)", async () => {
        data.lastName += "  ";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data.fullName, "a b", "data.fullName");
        assert.strictEqual(fired.firstName, 1, "fired.firstName");
        assert.strictEqual(fired.lastName, 2, "fired.lastName");
        assert.strictEqual(fired.getterWatch, 1, "fired.getterWatch");
        assert.strictEqual(fired.getterCall, 3, "fired.getterCall");
    });

    test("calling the getter outside of watch", async () => {
        const val = data.fullName;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(val, "a b", "data.fullName");
        assert.strictEqual(fired.firstName, 1, "fired.firstName");
        assert.strictEqual(fired.lastName, 1, "fired.lastName");
        assert.strictEqual(fired.getterWatch, 1, "fired.getterWatch");
        assert.strictEqual(fired.getterCall, 2, "fired.getterCall");
    });
});

describe("getters - watcher with mixed getter and regular field (that is also a dependency of the getter)", () => {
    const data = store({
        val: "abc",
        get isValid() {
            return !!data.val && data.val.length > 3
        },
    })

    let watchVal = false

    watch(() => {
        watchVal = !!data.val && data.isValid ? true : false
    })

    test("the internal get watcher should fire before the user defined watcher", async () => {
        data.val += "d"

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(watchVal, true, "watchVal");
        assert.strictEqual(data["@@isValid"], true, "@@isValid");
    });
});

describe("excluded set types", () => {
    let data;
    let fired;
    const sym = Symbol();
    const watchers = [];

    beforeEach(() => {
        data = store({
            a: function () {
                fired.aFuncCall++;
            },
            [sym]: "b",
        });

        fired = {
            aWatch: 0,
            symWatch: 0,
            aFuncCall: 0,
        };

        watchers.push(
            watch(() => {
                fired.aWatch++;
                data.a();
            }),
        );

        watchers.push(
            watch(() => {
                fired.symWatch++;
                data[sym];
            }),
        );
    });

    afterEach(() => {
        watchers.forEach((w) => w.unwatch());
    });

    test("watchers initialization", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.aWatch, 1, "fired.aWatch");
        assert.strictEqual(fired.symWatch, 1, "fired.symWatch");
        assert.strictEqual(fired.aFuncCall, 1, "fired.aFuncCall");
    });

    test("changing func", async () => {
        let newCalls = 0;
        data.a = function () {
            newCalls++;
        };
        data.a();

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(newCalls, 1, "newCalls");
        assert.strictEqual(fired.aWatch, 1, "fired.aWatch");
        assert.strictEqual(fired.symWatch, 1, "fired.symWatch");
        assert.strictEqual(fired.aFuncCall, 1, "fired.aFuncCall");
    });

    test("changing symbol", async () => {
        data[sym] = "new";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(data[sym], "new", "data.sym");
        assert.strictEqual(fired.aWatch, 1, "fired.aWatch");
        assert.strictEqual(fired.symWatch, 1, "fired.symWatch");
        assert.strictEqual(fired.aFuncCall, 1, "fired.aFuncCall");
    });
});

describe("check nested Proxy wrapping", () => {
    class Custom {}

    const data = store({
        number: 123,
        string: "test",
        bool: false,
        plainObj: {},
        plainObj2: Object.create(null),
        plainArr: {},
        date: new Date(),
        set: new Set(),
        map: new Map(),
        weakRef: new WeakRef({}),
        weakMap: new WeakMap(),
        weakSet: new WeakSet(),
        custom: new Custom(),
    });

    test("plain arrays and objects should be wrapped in a Proxy", () => {
        assert(util.types.isProxy(data.plainObj));
        assert(util.types.isProxy(data.plainObj2));
        assert(util.types.isProxy(data.plainArr));
    });

    test("primitive and excluded types should NOT be wrapped in a Proxy", () => {
        assert(typeof data.number == "number");
        assert(typeof data.string == "string");
        assert(typeof data.bool == "boolean");
        assert(data.date instanceof Date);
        assert(data.set instanceof Set);
        assert(data.map instanceof Map);
        assert(data.weakRef instanceof WeakRef);
        assert(data.weakMap instanceof WeakMap);
        assert(data.weakSet instanceof WeakSet);
        assert(data.custom instanceof Custom);
    });
});

describe("dependencies tracking on watch func reruns", () => {
    let fired = 0;

    const data = store({
        a: 0,
        b: 0,
        c: 0,
    });

    watch(() => {
        if (data.a > 0) {
            data.b;
        } else {
            data.c;
        }
        fired++;
    });

    beforeEach(() => {
        fired = 0;
    });

    test("updating c should fire", async () => {
        data.c++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired, 1);
    });

    test("updating b should NOT fire", async () => {
        data.b++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired, 0);
    });

    test("updating a should fire (and enable b tracking)", async () => {
        data.a++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired, 1);
    });

    test("after a>0 updating b should fire", async () => {
        data.b++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired, 1);
    });

    test("after a>0 updating c should NOT fire", async () => {
        data.c++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired, 0);
    });
});

describe("watch with optUntrackedFunc", () => {
    let fired = 0;

    const data = store({
        a: 0,
        b: 0,
        c: 0,
    });

    watch(
        () => [data.a, data.b],
        () => {
            fired++;
        },
    );

    beforeEach(() => {
        fired = 0;
    });

    test("updating a should fire", async () => {
        data.a++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired, 1);
    });

    test("updating b should fire", async () => {
        data.b++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired, 1);
    });

    test("updating c should NOT fire", async () => {
        data.c++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired, 0);
    });
});

describe("watch with detached child", () => {
    let fired = {};

    const data = store({
        a: {
            b: {
                c: 0,
            },
        },
    });

    watch(() => (fired.full = data.a?.b?.c));

    function detachedWatcher(subStore) {
        watch(() => (fired.detached = subStore?.c));
    }
    detachedWatcher(data.a.b);

    beforeEach(() => {
        fired.full = -Infinity;
        fired.detached = -Infinity;
    });

    test("update old", async () => {
        data.a.b.c++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.full, 1, "fired.full");
        assert.strictEqual(fired.detached, 1, "fired.detached");
    });

    test("replace", async () => {
        data.a = { b: { c: 3 } };

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.full, 3, "fired.full");

        // note: see the "NB!" comment in the state.js why this is not 3
        assert.strictEqual(fired.detached, -Infinity, "fired.detached");
    });

    test("update new", async () => {
        data.a.b.c++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.full, 4, "fired.full");
        assert.strictEqual(fired.detached, 4, "fired.detached");
    });

    test("delete detached prop", async () => {
        delete data.a.b;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(fired.full, undefined, "fired.full");
        assert.strictEqual(fired.detached, undefined, "fired.detached");
    });
});

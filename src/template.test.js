import assert from "node:assert/strict";
import { test, describe, beforeEach } from "node:test";
import { store } from "./state.js";
import { t } from "./template.js";
import { JSDOM } from "jsdom";

const dom = new JSDOM();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;

describe("tags creation", () => {
    test("tag name", () => {
        assert.strictEqual(t.div().tagName, "DIV");
        assert.strictEqual(t.p().tagName, "P");
        assert.strictEqual(t.span().tagName, "SPAN");
        assert.strictEqual(t.img().tagName, "IMG");
        assert.strictEqual(t.hr().tagName, "HR");
    });

    test("listeners", () => {
        let clicked = 0;

        t.div({
            onclick: () => {
                clicked++;
            },
        }).click();

        assert.strictEqual(clicked, 1, "clicked");
    });

    test("JS props", () => {
        const tag = t.div({ className: "test_class", id: "test_id" });

        assert.strictEqual(tag.tagName, "DIV");
        assert.strictEqual(tag.id, "test_id");
        assert.strictEqual(tag.className, "test_class");
    });

    test("HTML attributes", () => {
        const tag = t.div({ "html-a": 123, "html-b": "456" });

        assert.strictEqual(tag.tagName, "DIV");
        assert.strictEqual(tag.getAttribute("a"), "123");
        assert.strictEqual(tag.getAttribute("b"), "456");
    });

    test("children", () => {
        const tag = t.div(
            null,
            t.span({ id: "span0" }),
            t.span({ id: "div1" }, t.span({ id: "div1.1" }), t.span({ id: "div1.2" })),
            "test_text",
        );

        assert.strictEqual(tag.tagName, "DIV");
        assert.strictEqual(tag.childNodes.length, 3, "childNodes.length");
        assert.strictEqual(tag.children.length, 2, "children.length");
        assert.strictEqual(tag.children[0].id, "span0");
        assert.strictEqual(tag.children[1].id, "div1");
        assert.strictEqual(tag.childNodes[2].textContent, "test_text");
        assert.strictEqual(
            tag.childNodes[1].childNodes.length,
            2,
            "childNodes[1].childNodes.length",
        );
        assert.strictEqual(
            tag.childNodes[1].children.length,
            2,
            "childNodes[1].children.length",
        );
        assert.strictEqual(tag.childNodes[1].children[0].id, "div1.1");
        assert.strictEqual(tag.childNodes[1].children[1].id, "div1.2");
    });
});

describe("lifecycle hooks", () => {
    const mount = {
        div: 0,
        span0: 0,
        div1: 0,
        div11: 0,
        div12: 0,
    };

    const unmount = {
        div: 0,
        span0: 0,
        div1: 0,
        div11: 0,
        div12: 0,
    };

    const tag = t.div(
        { onunmount: () => unmount.div++, onmount: () => mount.div++ },
        t.span({
            id: "span0",
            onunmount: () => unmount.span0++,
            onmount: () => mount.span0++,
        }),
        t.span(
            { id: "div1", onunmount: () => unmount.div1++, onmount: () => mount.div1++ },
            t.span({
                id: "div1.1",
                onunmount: () => unmount.div11++,
                onmount: () => mount.div11++,
            }),
            t.span({
                id: "div1.2",
                onunmount: () => unmount.div12++,
                onmount: () => mount.div12++,
            }),
        ),
        "test_text",
    );

    test("before insert", () => {
        assert.strictEqual(mount.div, 0, "mount.div");
        assert.strictEqual(mount.span0, 0, "mount.span0");
        assert.strictEqual(mount.div1, 0, "mount.div1");
        assert.strictEqual(mount.div11, 0, "mount.div11");
        assert.strictEqual(mount.div12, 0, "mount.div12");
        // ---
        assert.strictEqual(unmount.div, 0, "unmount.div");
        assert.strictEqual(unmount.span0, 0, "unmount.span0");
        assert.strictEqual(unmount.div1, 0, "unmount.div1");
        assert.strictEqual(unmount.div11, 0, "unmount.div11");
        assert.strictEqual(unmount.div12, 0, "unmount.div12");
    });

    test("after insert", async () => {
        document.body.appendChild(tag);

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(mount.div, 1, "mount.div");
        assert.strictEqual(mount.span0, 1, "mount.span0");
        assert.strictEqual(mount.div1, 1, "mount.div1");
        assert.strictEqual(mount.div11, 1, "mount.div11");
        assert.strictEqual(mount.div12, 1, "mount.div12");
        // ---
        assert.strictEqual(unmount.div, 0, "unmount.div");
        assert.strictEqual(unmount.span0, 0, "unmount.span0");
        assert.strictEqual(unmount.div1, 0, "unmount.div1");
        assert.strictEqual(unmount.div11, 0, "unmount.div11");
        assert.strictEqual(unmount.div12, 0, "unmount.div12");
    });

    test("after remove", async () => {
        tag.remove();

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(mount.div, 1, "mount.div");
        assert.strictEqual(mount.span0, 1, "mount.span0");
        assert.strictEqual(mount.div1, 1, "mount.div1");
        assert.strictEqual(mount.div11, 1, "mount.div11");
        assert.strictEqual(mount.div12, 1, "mount.div12");
        // ---
        assert.strictEqual(unmount.div, 1, "unmount.div");
        assert.strictEqual(unmount.span0, 1, "unmount.span0");
        assert.strictEqual(unmount.div1, 1, "unmount.div1");
        assert.strictEqual(unmount.div11, 1, "unmount.div11");
        assert.strictEqual(unmount.div12, 1, "unmount.div12");
    });
});

describe("reactive attributes", () => {
    let fired;

    const data = store({
        text: "a",
        class: "b",
    });

    const tag = t.div({
        onmount: () => fired.onmount++,
        onunmount: () => fired.onunmount++,
        textContent: () => {
            fired.text++;
            return data.text;
        },
        className: () => {
            fired.class++;
            return data.class;
        },
    });

    beforeEach(() => {
        fired = {
            text: 0,
            class: 0,
            onmount: 0,
            onunmount: 0,
        };
    });

    test("before insert", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.textContent, "", "tag.textContent");
        assert.strictEqual(tag.className, "", "tag.className");
        assert.strictEqual(fired.text, 0, "fired.text");
        assert.strictEqual(fired.class, 0, "fired.class");
        assert.strictEqual(fired.onmount, 0, "fired.onmount");
        assert.strictEqual(fired.onunmount, 0, "fired.onunmount");
    });

    test("after insert", async () => {
        document.body.appendChild(tag);

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.textContent, "a", "tag.textContent");
        assert.strictEqual(tag.className, "b", "tag.className");
        assert.strictEqual(fired.text, 1, "fired.text");
        assert.strictEqual(fired.class, 1, "fired.class");
        assert.strictEqual(fired.onmount, 1, "fired.onmount");
        assert.strictEqual(fired.onunmount, 0, "fired.onunmount");
    });

    test("updating only one of the attribute", async () => {
        data.text = "new";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.textContent, "new", "tag.textContent");
        assert.strictEqual(fired.text, 1, "fired.text");
        assert.strictEqual(fired.class, 0, "fired.class");
        assert.strictEqual(fired.onmount, 0, "fired.onmount");
        assert.strictEqual(fired.onunmount, 0, "fired.onunmount");
    });

    test("after remove", async () => {
        tag.remove();

        // unwatch is debounced
        await new Promise((resolve) => setTimeout(resolve, 200));

        assert.strictEqual(fired.text, 0, "fired.text");
        assert.strictEqual(fired.class, 0, "fired.class");
        assert.strictEqual(fired.onmount, 0, "fired.onmount");
        assert.strictEqual(fired.onunmount, 1, "fired.onunmount");
    });

    test("try again updating only one of the attribute", async () => {
        data.text = "new2";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.textContent, "new", "tag.textContent");
        assert.strictEqual(fired.text, 0, "fired.text");
        assert.strictEqual(fired.class, 0, "fired.class");
        assert.strictEqual(fired.onmount, 0, "fired.onmount");
        assert.strictEqual(fired.onunmount, 0, "fired.onunmount");
    });
});

describe("reactive children", () => {
    let fired;

    const data = store({
        count: 0,
        list: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }],
    });

    function fire(name) {
        fired[name] = (fired[name] << 0) + 1;
    }

    const tag = t.ul(
        {
            onmount: () => fire("ul_onmount"),
            onunmount: () => fire("ul_onunmount"),
        },
        t.li({
            onmount: () => fire("li_static_onmount"),
            onunmount: () => fire("li_static_onunmount"),
        }),
        () => {
            return null; // should result in just a placeholder
        },
        () => {
            if (data.count > 0) {
                return data.list.map((item) => {
                    return t.li({
                        rid: item.name,
                        onmount: () => fire(`li_${item.name}_onmount`),
                        onunmount: () => fire(`li_${item.name}_onunmount`),
                    });
                });
            }

            return t.li({
                onmount: () => fire("li_else_onmount"),
                onunmount: () => fire("li_else_onunmount"),
            });
        },
    );

    beforeEach(() => {
        fired = {};
    });

    test("before insert", async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(Object.keys(fired).length, 0, "fired.length");
    });

    test("after insert", async () => {
        document.body.appendChild(tag);

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.isConnected, true, "tag.isConnected");
        assert.strictEqual(tag.childNodes.length, 4, "tag.childNodes"); // static + else + 2 placeholders
        assert.strictEqual(Object.keys(fired).length, 3, "fired.length");
        assert.strictEqual(fired.ul_onmount, 1, "fired.ul_onmount");
        assert.strictEqual(fired.li_static_onmount, 1, "fired.li_static_onmount");
        assert.strictEqual(fired.li_else_onmount, 1, "fired.li_else_onmount");
    });

    test("updating children reactive func dependency", async () => {
        data.count++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.isConnected, true, "tag.isConnected");
        assert.strictEqual(tag.childNodes.length, 7, "tag.childNodes");
        assert.strictEqual(Object.keys(fired).length, 5, "fired.length");
        assert.strictEqual(fired.li_else_onunmount, 1, "fired.li_else_onunmount");
        assert.strictEqual(fired.li_a_onmount, 1, "fired.li_a_onmount");
        assert.strictEqual(fired.li_b_onmount, 1, "fired.li_b_onmount");
        assert.strictEqual(fired.li_c_onmount, 1, "fired.li_c_onmount");
        assert.strictEqual(fired.li_d_onmount, 1, "fired.li_d_onmount");
    });

    test("updating the counter again shouldn't rerender because the list hasn't changed", async () => {
        data.count++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.isConnected, true, "tag.isConnected");
        assert.strictEqual(tag.childNodes.length, 7, "tag.childNodes");
        assert.strictEqual(Object.keys(fired).length, 0, "fired.length");
    });

    test("update children list", async () => {
        data.list.pop();
        data.list.push({ meta: 456 }); // no rid -> should rerender on the next update
        data.list[1].meta = 123;
        data.list[2].name = "new_c"; // should rerender

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.isConnected, true, "tag.isConnected");
        assert.strictEqual(tag.childNodes.length, 7, "tag.childNodes");
        assert.strictEqual(Object.keys(fired).length, 4, "fired.length");
        assert.strictEqual(fired.li_d_onunmount, 1, "fired.li_d_onunmount");
        assert.strictEqual(fired.li_undefined_onmount, 1, "fired.li_undefined_onmount");
        assert.strictEqual(fired.li_new_c_onunmount, 1, "fired.li_new_c_onunmount");
        assert.strictEqual(fired.li_new_c_onmount, 1, "fired.li_new_c_onmount");
    });

    test("updating the counter again to ensure that only non-rid children will rerender", async () => {
        data.count++;

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.isConnected, true, "tag.isConnected");
        assert.strictEqual(tag.childNodes.length, 7, "tag.childNodes");
        assert.strictEqual(Object.keys(fired).length, 2, "fired.length");
        assert.strictEqual(
            fired.li_undefined_onunmount,
            1,
            "fired.li_undefined_onunmount",
        );
        assert.strictEqual(fired.li_undefined_onmount, 1, "fired.li_undefined_onmount");
    });

    test("after remove", async () => {
        tag.remove();

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(tag.isConnected, false, "tag.isConnected");
        assert.strictEqual(tag.childNodes.length, 7, "tag.childNodes");
        assert.strictEqual(Object.keys(fired).length, 6, "fired.length");
        assert.strictEqual(fired.ul_onunmount, 1, "fired.ul_onunmount");
        assert.strictEqual(fired.li_static_onunmount, 1, "fired.li_static_onunmount");
        assert.strictEqual(fired.li_a_onunmount, 1, "fired.li_a_onunmount");
        assert.strictEqual(fired.li_b_onunmount, 1, "fired.li_b_onunmount");
        assert.strictEqual(fired.li_new_c_onunmount, 1, "fired.li_new_c_onunmount");
        assert.strictEqual(
            fired.li_undefined_onunmount,
            1,
            "fired.li_undefined_onunmount",
        );
    });
});

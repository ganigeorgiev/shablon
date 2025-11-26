import assert from "node:assert/strict";
import { test, describe, beforeEach } from "node:test";
import { router } from "./router.js";
import { JSDOM } from "jsdom";

const dom = new JSDOM("", { url: "https://example.com/", pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;

describe("default router", async () => {
    let match = {};
    let destroyed = {};

    beforeEach(() => {
        match = {};
    });

    router({
        "#/": (route) => {
            match = route;
        },
        "#/users/{id}/abc/{action}": (route) => {
            match = route;

            return () => {
                destroyed = route;
            };
        },
        "#/users/{id}/abc": (route) => {
            match = route;
        },
    });

    test("home", async () => {
        window.location.hash = "#/";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(match.path, window.location.hash, "path");
        assert.deepStrictEqual(match.query, {}, "query");
        assert.deepStrictEqual(match.params, {}, "params");
        assert.deepStrictEqual(destroyed, {}, "destroyed");
    });

    test("home (with query params)", async () => {
        window.location.hash = "#/?a=1&b=2&a=3";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(match.path, window.location.hash, "path");
        assert.deepStrictEqual(match.query, { a: ["1", "3"], b: ["2"] }, "query");
        assert.deepStrictEqual(match.params, {}, "params");
        assert.deepStrictEqual(destroyed, {}, "destroyed");
    });

    test("route with 1 parameter (with special chars)", async () => {
        window.location.hash = "#/users/ex.am-%ple_/abc?a=1&b=2&a=3";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(match.pattern, "#/users/{id}/abc", "pattern");
        assert.deepStrictEqual(match.query, { a: ["1", "3"], b: ["2"] }, "query");
        assert.strictEqual(match.params.id, "ex.am-%ple_", "params.id");
        assert.deepStrictEqual(destroyed, {}, "destroyed");
    });

    test("route with 2 parameters", async () => {
        window.location.hash = "#/users/example/abc/delete?a=1&b=2&a=3";

        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(match.pattern, "#/users/{id}/abc/{action}", "pattern");
        assert.deepStrictEqual(match.query, { a: ["1", "3"], b: ["2"] }, "query");
        assert.strictEqual(match.params.id, "example", "params.id");
        assert.strictEqual(match.params.action, "delete", "params.action");
        assert.deepStrictEqual(destroyed, {}, "destroyed");
    });

    test("missing route", async () => {
        window.location.hash = "#/missing";


        await new Promise((resolve) => setTimeout(resolve, 0));

        // wait again to ensure that it is cheched after the redirect event listener change
        await new Promise((resolve) => setTimeout(resolve, 0));

        assert.strictEqual(match.pattern, "#/", "pattern");
        assert.deepStrictEqual(match.query, {}, "query");
        assert.deepStrictEqual(match.params, {}, "params");
        assert.strictEqual(destroyed.pattern, "#/users/{id}/abc/{action}", "destroyed");
    });
});

import { defineConfig } from "rolldown";

export default defineConfig([
    {
        input: "index.js",
        output: {
            file:      "dist/shablon.iife.js",
            format:    "iife",
            name:      "window",
            extend:    true,
            sourcemap: true,
            minify:    true,
        },
    },
    {
        input: "index.js",
        output: {
            file:      "dist/shablon.es.js",
            format:    "es",
            sourcemap: true,
            minify:    true,
        },
    },
]);

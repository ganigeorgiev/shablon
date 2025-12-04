Shablon - No-build JavaScript frontend framework
======================================================================

> [!CAUTION]
>  This is mostly an experiment created for the planned [PocketBase](https://github.com/pocketbase/pocketbase) UI rewrite to allow frontend plugins support.
>
> **Don't use it yet - it hasn't been actually tested in real applications and it may change without notice!**

**Shablon** _("template" in Bulgarian)_ is a ~5KB JS framework that comes with deeply reactive state management, plain JS extendable templates and hash-based router.

Shablon has very small learning curve (**4 main exported functions**) and it is suitable for building Single-page applications (SPA):

- State: `store(obj)` and `watch(trackedFunc, optUntrackedFunc)`
- Template: `t.[tag](attrs, ...children)`
- Router: `router(routes, options)`

There is no dedicated "component" structure. Everything is essentially plain DOM elements sprinkled with a little reactivity.

Below is an example _Todos list "component"_ to see how it looks:

```js
function todos() {
    const data = store({
        todos: [],
        newTitle: "",
    })

    // external watcher
    const w = watch(() => {
        console.log("new title:", data.newTitle)
    })

    return t.div({ className: "todos-list", onunmount: () => w.unwatch() },
        t.h1({ textContent: "Todos" }),
        t.ul({ style: "margin: 20px 0" },
            () => {
                if (!data.todos.length) {
                    return t.li({ rid: "notodos", textContent: "No todos." })
                }

                return data.todos.map((todo) => {
                    return t.li({ rid: todo, textContent: () => todo.title })
                })
            }
        ),
        t.hr(),
        t.input({ type: "text", value: () => data.newTitle, oninput: (e) => data.newTitle = e.target.value }),
        t.button({ textContent: "Add", onclick: () => data.todos.push({ title: data.newTitle }) })
    )
}

document.getElementById("app").replaceChildren(todos());
```

<details>

<summary>
Example Svelte 5 equivalent code for comparison

_Shablon is not as pretty as Svelte but it strives for similar developer experience._
</summary>


```svelte
<script>
    let todos = $state([])
    let newTitle = $state("")

    // external watcher
    // note: no need to manually call "untrack" because Svelte does it automatically on component unmount
    $effect(() => {
        console.log("new title:", newTitle)
    })
</script>

<div class="todos-list">
    <h1>Todos</h1>
    <ul style="margin: 20px 0">
        {#each todos as todo}
            <li>{todo.title}</li>
        {:else}
            <li>No todos.</li>
        {/each}
    </ul>
    <hr>
    <input type="text" bind:value="{newTitle}">
    <button onclick="{() => todos.push({ title: newTitle })}">Add</button>
</div>
```

</details>



## Installation

> You can also check the [`example` folder](https://github.com/ganigeorgiev/shablon/tree/master/example) for a showcase of a minimal SPA with 2 pages.

#### Global via script tag (browsers)

The default [IIFE](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) bundle will load all exported Shablon functions in the global context.
You can find the bundle file at [`dist/shablon.iife.js`](https://github.com/ganigeorgiev/shablon/blob/master/dist/shablon.iife.js) (or use a CDN pointing to it):

```html
<!-- <script src="https://cdn.jsdelivr.net/gh/ganigeorgiev/shablon@master/dist/shablon.iife.js"></script> -->
<script src="/path/to/dist/shablon.iife.js"></script>
<script type="text/javascript">
    const data = store({ count: 0 })
    ...
</script>
```

#### ES module (browsers and npm)

Alternatively, you can load the package as ES module either by using the [`dist/shablon.es.js`](https://github.com/ganigeorgiev/shablon/blob/master/dist/shablon.es.js) file or
importing it from [npm](https://www.npmjs.com/package/shablon).

- browsers:
    ```html
    <!-- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules -->
    <script type="module">
        import { t, store, watch, router } from "/path/to/dist/shablon.es.js"

        const data = store({ count: 0 })
        ...
    </script>
    ```

- npm (`npm -i shablon`):
    ```js
    import { t, store, watch, router } from "shablon"

    const data = store({ count: 0 })
    ...
    ```

## API
<details>
<summary><strong id="api.store">store(obj)</strong></summary>

`store(obj)` returns a reactive `Proxy` of the specified plain object.

The keys of an `obj` must be "stringifiable" because they are used internally to construct a path to the reactive value.

The values can be any valid JS primitive value, including nested plain arrays and objects (aka. it is recursively reactive).

Getters are also supported and can be used as reactive computed properties.
The value of a reactive getter is "cached", meaning that even if one of the getter dependency changes, as long as the resulting value is the same there will be no unnecessary watch events fired.

Multiple changes from one or many stores are also automatically batched in a microtask. For example:

```js
const data = store({ age: 49, activity: "work" })

watch(() => {
    console.log("age", data.age)
    console.log("activity", data.activity)
})

// changing both fields will trigger the watcher only once
data.age++
data.activity = "rest"
```

> Note that Object values like `Date`, `Set`, `Map`, `WeakRef`, `WeakSet` and `WeakMap` are not wrapped in a nested `Proxy` and they will be resolved as they are to avoid access errors.
> For other custom object types thay you may want to access without a `Proxy` you can use the special `__raw` key, e.g. `data.myCustomType.__raw.someKey`.

</details>


<details>
<summary><strong id="api.watch">watch(trackedFunc, optUntrackedFunc)</strong></summary>

Watch registers a callback function that fires on initialization and
every time any of its evaluated `store` reactive properties change.

Note that for reactive getters, initially the watch `trackedFunc` will be invoked twice because we register a second internal watcher to cache the getter value.

It returns a "watcher" object that could be used to `unwatch()` the registered listener.

_Optionally also accepts a second callback function that is excluded from the evaluated
store props tracking and instead is invoked only when `trackedFunc` is called
(could be used as a "track-only" watch pattern)._

For example:

```js
const data = store({ count: 0 })

const w = watch(() => console.log(data.count))

data.count++ // triggers watch update

w.unwatch()

data.count++ // doesn't trigger watch update
```

"Track-only" pattern example:

```js
const data = store({
    a: 0,
    b: 0,
    c: 0,
})

// watch only "a" and "b" props
watch(() => [
   data.a,
   data.b,
], () => {
    console.log(data.a)
    console.log(data.b)
    console.log(data.c)
})

data.a++ // trigger watch update
data.b++ // trigger watch update
data.c++ // doesn't trigger watch update
```

</details>


<details>
<summary><strong id="api.t">t.[tag](attrs, ...children)</strong></summary>

`t.[tag](attrs, ...children)` constructs and returns a new DOM element (aka. `document.createElement(tag)`).

`tag` could be any valid HTML element name - `div`, `span`, `hr`, `img`, registered custom web component, etc.

`attrs` is an object where the keys are:
- valid element's [JS property](https://developer.mozilla.org/en-US/docs/Web/API/Element#instance_properties)
    _(note that some HTML attribute names are different from their JS property equivalent, e.g. `class` vs `className`, `for` vs `htmlFor`, etc.)_
- regular or custom HTML attribute if it has `html-` prefix _(it is stripped from the final attribute)_, e.g. `html-data-name`

The attributes value could be a plain JS value or reactive function that returns such value _(e.g. `() => data.count`)_.

`children` is an optional list of child elements that could be:
- plain text (inserted as `TextNode`)
- single tag
- array of tags
- reactive function that returns any of the above

When a reactive function is set as attribute value or child, it is invoked only when the element is mounted and automatically "unwatched" on element removal _(with slight debounce to minimize render blocking)_.

**Lifecycle attributes**

Each constructed tag has 3 additional optional lifecycle attributes:

- `onmount: func(el)` - optional callback called when the element is inserted in the DOM
- `onunmount: func(el)` - optional callback called when the element is removed from the DOM
- `rid: any` - "replacement id" is an identifier based on which we can decide whether to reuse the element or not during rerendering (e.g. on list change); the value could be anything comparable with `==`

</details>


<details>
<summary><strong id="api.router">router(routes, options)</strong></summary>

`router(routes, options = { fallbackPath: "#/", transition: true })` initializes a hash-based client-side router by loading the provided routes configuration and listens for hash navigation changes.

`routes` is a key-value object where:
- the key must be a string path such as `#/a/b/{someParam}`
- value is a route handler function that executes every time the page hash matches with the route's path
    _(the route handler can return a "destroy" function that is invoked when navigating away from that route)_

Note that by default the router expects to have at least one "#/" route that will be also used as fallback in case the user navigate to a missing page.

For example:

```js
router({
    "#/": (route) => {
        document.getElementById(app).replaceChildren(
            t.div({ textContent: "Homepage!"})
        )
    },
    "#/users/{id}": (route) => {
        document.getElementById(app).replaceChildren(
            t.div({ textContent: "User " + route.params.id })
        )
        return () => { console.log("cleanup...") }
    },
})
```

</details>


## Performance and caveats

No extensive testing or benchmarks have been done yet but for the simple cases it should perform as fast as it could get because we update only the targeted DOM attribute when possible _(furthermore multiple store changes are auto batched per microtask to ensure that watchers are not invoked unnecessary)_.

For example, the expression `t.div({ textContent: () => data.title })` is roughly the same as the following pseudo-code:

```js
const div = document.createElement("div")
div.textContent = data.title

function onTitleChange() {
    div.textContent = data.title
}
```

Conditional rendering tags as part of a reactive child function is a little bit more complicated though.
By default when such function runs due to a store dependency change, the old children will be removed and the new ones will be inserted on every call of that function which could be unnecessary if the tags hasn't really changed.

To avoid this you can specify the `rid` attribute which instructs Shablon to reuse the same element if the old and new `rid` are the same minimizing the DOM operations. For example:

```js
const data = store({ count: 0, list: ["a", "b", "c"] })

// ALWAYS replace the child tags on every data.count or data.list change
t.div({ className: "bad"},
    () => {
        if (data.count < 2) {
            return t.strong({}, "Not enough elements")
        }
        return data.list.map((item) => t.div({}, item))
    }
)

// replace the child tags on data.count or data.list change
// ONLY if the tags "rid" attribute has changed
t.div({ className: "good"},
    () => {
        if (data.count < 2) {
            return t.strong({ rid: "noelems" }, "Not enough elements")
        }
        return data.list.map((item) => t.div({ rid: item }, item))
    }
)
```

Other things that could be a performance bottleneck are the lifecycle attributes (`onmount`, `onunmount`) because currently they rely on a global `MutationObserver` which could be potentially slow for deeply nested elements due to the nature of the current recursive implementation _(this will be further evaluated during the actual integration in PocketBase)_.


## Security

Shablon **DOES NOT** perform any explicit escaping on its own and it relies on:

- modern browsers to perform TextNode _(when a child is a plain string)_ and attributes value escaping out of the box for us
- developers to use the appropriate safe JS properties (e.g. `textContent` instead of `innerHTML`)

**There could be some gaps and edge cases so I strongly recommend registering a [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) either as `meta` tag or HTTP header to prevent XSS attacks.**


## Why Shablon?

If you are not sure why would you use Shablon instead of Svelte, Lit, Vue, etc., then I'd suggest to simply pick one of the latter because they usually have a lot more features, can offer better ergonomics and have abundance of tutorials.

Shablon was created for my own projects, and more specifically for PocketBase in order to allow writing dynamically loaded dashboard UI plugins without requiring a Node.js build step.
Since I didn't feel comfortable maintaining UI plugins system on top of another framework with dozens other dependencies that tend to change in a non-compatible way over time, I've decided to try building my own with minimal API surface and that can be safely "frozen".

Shablon exists because:

- it can be quickly learned (4 main exported functions)
- it has minimal "magic" and no unsafe-eval (aka. it is Content Security Policy friendly)
- no IDE plugin or custom syntax highlighter is needed (it is plain JavaScript)
- the templates return regular [JS `Element`](https://developer.mozilla.org/en-US/docs/Web/API/Element) allowing direct mutations
- it doesn't require build step and can be imported in the browser with a regular script tag
- it has no external dependencies and doesn't need to be updated frequently
- it is easy to maintain on my own _(under 2000 LOC with tests)_


## Contributing

Shablon is free and open source project licensed under the [Zero-Clause BSD License](https://github.com/ganigeorgiev/shablon/blob/master/LICENSE.md) _(no attribution required)_.

Feel free to report bugs, but feature requests are not welcomed.

**There are no plans to extend the project scope and once a stable PocketBase release is published it could be considered complete.**

/**
 * @callback routeHandler
 * @param {{params:Object.<string,string>, query:Object.<string,string[]>, path:string, regex:string, pattern:string, handler:Function}} route
 * @return {Function|void} Optional destroy function.
 */
/**
 * Router set up a hash-based client-side router by loading the
 * provided routes configuration and listens for hash navigation changes.
 *
 * `routes` is a key-value object where:
 * - the key must be a string path such as "#/a/b/{someParam}"
 * - value is a route handler function that executes every time the page hash matches with the route's path.
 *     The route handler can return a "destroy" function that will be invoked when navigating away from that route.
 *
 * Note that by default it expects to have at least one "#/" route that will be
 * also used as fallback in case the user navigate to a page that is not defined.
 *
 * Example:
 *
 * ```js
 * router({
 *     "#/": (route) => {
 *         document.getElementById(app).replaceChildren(
 *             t.div({ textContent: "Homepage!"})
 *         )
 *     },
 *     "#/users/{id}": (route) => {
 *         document.getElementById(app).replaceChildren(
 *             t.div({ textContent: "User " + route.params.id })
 *         )
 *     },
 * })
 * ```
 *
 * `router` returns an optional destroy function that could be used to
 * remove the already registered listeners, allowing you to initialize a new router.
 *
 * @param {Object.<string, routeHandler>} routes
 * @param {Object} [options]
 * @param {string} [options.fallbackPath]
 * @param {boolean} [options.transition]
 * @param {boolean} [options.pretty] If true, enables pretty URLs and uses the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation), otherwise fallbacks to hash-based routes.
 * @param {function} Destroy function.
 */
export function router(routes, options = {}) {
    let defs = prepareRoutes(routes);

    options = Object.assign({ pretty: false, transition: false }, options);
    if (!options.fallbackPath) {
        options.fallbackPath = options.pretty ? "/" : "#/";
    }

    let prevDestroy;
    function onchange() {
        let path = strategy.path;

        let route = findActiveRoute(defs, path);
        if (!route) {
            if (options.fallbackPath != path) {
                strategy.path = options.fallbackPath;
                return;
            }

            console.warn("missing route:", path);
            return;
        }

        let navigate = async () => {
            try {
                await prevDestroy?.();
                prevDestroy = await route.handler(route);
            } catch (err) {
                console.warn("route navigation failed:", err);
            }
        };

        if (options.transition && document.startViewTransition) {
            document.startViewTransition(navigate);
        } else {
            navigate();
        }
    }

    let strategy = options.pretty
        ? defaultStrategies.navigation(onchange)
        : defaultStrategies.hash(onchange);

    onchange();

    return function () {
        prevDestroy?.();
        strategy.destroy();
        strategy = null;
    };
}

const defaultStrategies = {
    hash(onchangeHandler) {
        window.addEventListener("hashchange", onchangeHandler);

        return {
            get path() {
                return window.location.hash || "#/";
            },
            set path(newPath) {
                window.location.hash = newPath;
            },
            destroy() {
                window.removeEventListener("hashchange", onchangeHandler);
            },
        };
    },
    navigation(onchangeHandler) {
        // https://web.dev/blog/baseline-navigation-api
        let navigateListener = (e) => {
            if (
                !e.canIntercept ||
                // if this is just a hashChange, let the browser handle scrolling to the content
                e.hashChange ||
                // if this is a download, let the browser perform the download
                e.downloadRequest ||
                // don't intercept page reloads
                e.navigationType == "reload"
            ) {
                return;
            }

            let url = new URL(e.destination.url);

            // intercept navigation and call the registered route handler
            e.intercept({
                handler() {
                    // escape hatch to allow updating the current app URL
                    // without triggering route navigation, for example:
                    //
                    // ```js
                    // navigation.navigate(newURL, {
                    //     state: { nonavigate: true },
                    //     history: "push",
                    // })
                    // ```
                    const state = e.destination.getState();
                    if (state?.nonavigate) {
                        return;
                    }

                    return onchangeHandler(url.pathname + url.search);
                },
            });
        };

        navigation.addEventListener("navigate", navigateListener);

        return {
            get path() {
                return (window.location.pathname || "/") + window.location.search;
            },
            set path(newPath) {
                navigation.navigate(newPath);
            },
            destroy() {
                navigation.removeEventListener("navigate", navigateListener);
            },
        };
    },
};

function findActiveRoute(defs, path) {
    for (let def of defs) {
        let match = path.match(def.regex);
        if (!match) {
            continue;
        }

        // try to decode the path params
        for (let key in match.groups) {
            try {
                // note: could be undefined in case of empty wildcard
                match.groups[key] = match.groups[key]
                    ? decodeURIComponent(match.groups[key])
                    : "";
            } catch {}
        }

        // extract query params (the value is always stored as array)
        let query = {};
        let rawQuery = path.split("?")?.[1];
        if (rawQuery) {
            let searchParams = new URLSearchParams(rawQuery);
            for (let [key, value] of searchParams.entries()) {
                if (!query.hasOwnProperty(key)) {
                    query[key] = [];
                }
                query[key].push(value);
            }
        }

        return Object.assign(
            {
                path: path,
                query: query,
                params: match.groups || {},
            },
            def,
        );
    }
}

function prepareRoutes(routes) {
    let defs = [];

    routesLoop: for (let path in routes) {
        let parts = path.split("/");

        let wildcardExpr = "";
        if (path.endsWith("...}")) {
            let lastPart = parts.pop();
            wildcardExpr =
                "(?:\/(?<" + lastPart.substring(1, lastPart.length - 4) + ">[^#?]*))?";
        }

        for (let i in parts) {
            if (
                parts[i].length > 2 &&
                parts[i].startsWith("{") &&
                parts[i].endsWith("}")
            ) {
                let paramName = parts[i].substring(1, parts[i].length - 1);

                if (paramName.endsWith("...")) {
                    console.warn(
                        "skipping invalid route - wildcard param can be only at the end:",
                        path,
                    );
                    continue routesLoop;
                }

                // single param
                parts[i] = "(?<" + paramName + ">[^\\/#?]+)";
            } else {
                // regular path segment
                parts[i] = RegExp.escape(parts[i]);
            }
        }

        defs.push({
            regex: new RegExp("^" + parts.join("\\/") + wildcardExpr + "(?:[\?\#].*)?$"),
            pattern: path,
            handler: routes[path],
            wildcard: wildcardExpr != "",
        });
    }

    // wildcard routes are sorted last
    defs.sort((a, b) => {
        if (a.wildcard && !b.wildcard) {
            return 1;
        }

        if (!a.wildcard && b.wildcard) {
            return -1;
        }

        // prioritize longer wildcards first as they are more concrete
        if (a.wildcard && b.wildcard) {
            return b.pattern.length - a.pattern.length;
        }

        return 0;
    });

    return defs;
}

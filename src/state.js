let activeWatcher;

let flushQueue = new Set();
let allWatchers = new Map();
let toRemove = [];
let cleanTimeoutId;

let idSym = Symbol();
let parentSym = Symbol();
let childrenSym = Symbol();
let pathsSubsSym = Symbol();
let unwatchedSym = Symbol();
let onRemoveSym = Symbol();
let skipSym = Symbol();
let detachedSym = Symbol();

let pathSeparator = "/";

/**
 * Watch registers a callback function that fires on initialization and
 * every time any of its evaluated `store` reactive properties change.
 *
 * It returns a "watcher" object that could be used to `unwatch()` the registered listener.
 *
 * Optionally also accepts a second callback function that is excluded from the evaluated
 * store props tracking and instead is invoked only when `trackedFunc` is called
 * (could be used as a "track-only" watch pattern).
 *
 * Simple example:
 *
 * ```js
 * const data = store({ count: 0 })
 *
 * const sub = watch(() => console.log(data.count))
 *
 * data.count++ // triggers watch update
 *
 * sub.unwatch()
 *
 * data.count++ // doesn't trigger watch update
 * ```
 *
 * "Track-only" example:
 *
 * ```js
 * const data = store({
 *     a: 0,
 *     b: 0,
 *     c: 0,
 * })
 *
 * // watch only "a" and "b" props
 * watch(() => [
 *    data.a,
 *    data.b,
 * ], () => {
 *     console.log(data.a)
 *     console.log(data.b)
 *     console.log(data.c)
 * })
 *
 * data.a++ // trigger watch update
 * data.b++ // trigger watch update
 * data.c++ // doesn't trigger watch update
 * ```
 *
 * @param {Function} trackedFunc
 * @param {Function} [optUntrackedFunc]
 * @return {{unwatch:Function, last:any, run:Function}}
 */
export function watch(trackedFunc, optUntrackedFunc) {
    let watcher = {
        [idSym]: "_" + Math.random(),
    };

    allWatchers.set(watcher[idSym], watcher);

    watcher.run = () => {
        let oldActiveWatcher;

        // nested watcher -> register previous watcher as parent
        if (activeWatcher) {
            oldActiveWatcher = activeWatcher;
            watcher[parentSym] = activeWatcher[idSym];

            // store immediate children references for quicker cleanup
            activeWatcher[childrenSym] = activeWatcher[childrenSym] || [];
            activeWatcher[childrenSym].push(watcher[idSym]);
        }

        // On watcher function run, resets any previous tracking paths
        // because after this new run some of the old dependencies
        // may no longer be reachable/evaluatable.
        //
        // For example, in the below code:
        //
        // ```js
        // const data = store({ a: 0, b: 0, c: 0 })
        //
        // watch(() => {
        //     if (data.a > 0) {
        //         data.b
        //     } else {
        //         data.c
        //     }
        // })
        // ```
        //
        // initially ONLY "a" and "c" should be trackable because "b"
        // is not reachable (aka. its getter is never invoked).
        //
        // If we increment `a++`, then in the new run  ONLY "a" and "b" should be trackable
        // because this time "c" is not reachable (aka. its getter is never invoked)
        // and its previous tracking should be removed for this watcher.
        //
        // Note: The below code works because it reuses the same "subs" reference as in pathWatcherIds
        //       and this is intentional to avoid unnecessary iterations.
        watcher[pathsSubsSym]?.forEach((subs) => {
            subs.delete(watcher[idSym]);
        });

        activeWatcher = watcher;
        const result = trackedFunc();

        if (optUntrackedFunc) {
            activeWatcher = null;
            optUntrackedFunc(result);
        }

        // restore original ref (if any)
        activeWatcher = oldActiveWatcher;
    };

    watcher.unwatch = function () {
        watcher[unwatchedSym] = 1;

        toRemove.push(watcher[idSym]);

        if (cleanTimeoutId) {
            clearTimeout(cleanTimeoutId);
        }

        // note: debounced and executed as separate task to minimize blocking unmount rendering
        cleanTimeoutId = setTimeout(() => {
            for (let id of toRemove) {
                removeWatcher(id);
            }

            toRemove = [];
            cleanTimeoutId = null;
        }, 50);
    };

    watcher.run();

    return watcher;
}

function removeWatcher(id) {
    let w = allWatchers.get(id);

    w?.[onRemoveSym]?.();

    if (w?.[childrenSym]) {
        for (let childId of w[childrenSym]) {
            removeWatcher(childId);
        }
        w[parentSym] = null;
        w[childrenSym] = null;
    }

    if (w?.[pathsSubsSym]) {
        for (let sub of w[pathsSubsSym]) {
            sub.delete(id);
        }
        w[pathsSubsSym] = null;
    }

    allWatchers.delete(id);
}

// -------------------------------------------------------------------

/**
 * Creates a new deeply reactive store object that triggers `watch`
 * update on change of a specific watched store property.
 *
 * Example:
 *
 * ```js
 * const data = store({ count: 0, name: "test" })
 *
 * watch(() => console.log(data.count)) // should fire twice: 0 (initial), 1 (on increment)
 *
 * data.count++
 * ```
 *
 * Getters are also supported out of the box and they are invoked every
 * time when any of their dependencies change.
 * If a getter is used in a reactive function, its resulting value is cached,
 * aka. if the final value hasn't changed it will not trigger an unnecessary reactive update.
 *
 * Multiple changes from one or many stores are also automatically batched in a microtask.
 *
 * @param  {Object} obj
 * @return {Object} Proxied object.
 */
export function store(obj) {
    let pathWatcherIds = new Map();

    return createProxy(obj, pathWatcherIds);
}

function createProxy(obj, pathWatcherIds) {
    // extract props info to identify getters
    let descriptors =
        typeof obj == "object" && !Array.isArray(obj)
            ? Object.getOwnPropertyDescriptors(obj)
            : {};

    return new Proxy(obj, {
        get(obj, prop, receiver) {
            if (typeof prop == "symbol") {
                return obj[prop];
            }

            if (prop == "__raw") {
                return obj;
            }

            // getter?
            let getterProp;
            if (descriptors[prop]?.get) {
                // if not invoked inside a watch function, call the original
                // getter to ensure that an up-to-date value is computed
                if (!activeWatcher) {
                    return descriptors[prop]?.get?.call(obj);
                }

                getterProp = prop;

                // replace with an internal property so that reactive statements can be cached
                prop = "@@" + prop;
                Object.defineProperty(obj, prop, { writable: true, enumerable: false });
            }

            // detached child?
            let isDetached;
            if (!obj[skipSym] && obj[parentSym]) {
                let props = [];
                let activeObj = obj;

                // travel up to the root proxy
                // (aka. x.a.b*.c -> x)
                while (activeObj?.[parentSym]) {
                    if (activeObj[detachedSym]) {
                        isDetached = true;
                    }

                    props.push(activeObj[parentSym][1]);
                    activeObj = activeObj[parentSym][0];
                }

                // try to access the original path but this time from
                // the root point of view to ensure that we are always accessing
                // an up-to-date store child reference
                // (we want: x.a.b(old).c -> x -> x.a.b(new).c)
                //
                // note: this technically could "leak" but for our case it should be fine
                // because the detached object will become again garbage collectable
                // once the related watcher(s) are removed
                if (isDetached) {
                    for (let i = props.length - 1; i >= 0; i--) {
                        activeObj[skipSym] = true;
                        let item = activeObj?.[props[i]];
                        activeObj[skipSym] = false;

                        if (i == 0) {
                            activeObj = item?.__raw;
                        } else {
                            activeObj = item;
                        }
                    }

                    // the original full nested path is no longer available (null/undefined)
                    if (activeObj == undefined) {
                        return activeObj;
                    }

                    // update the current obj with the one from the retraced path
                    obj = activeObj;
                }
            }

            let propVal = obj[prop];

            // directly return for functions (pop, push, etc.)
            if (typeof propVal == "function") {
                return propVal;
            }

            // wrap child plain object or array as sub store
            if (
                propVal != null &&
                typeof propVal == "object" &&
                !propVal[parentSym] &&
                (propVal.constructor?.name == "Object" ||
                    propVal.constructor?.name == "Array" ||
                    propVal.constructor?.name == undefined) // e.g. Object.create(null)
            ) {
                propVal[parentSym] = [receiver, prop];
                propVal = createProxy(propVal, pathWatcherIds);
                obj[prop] = propVal;
            }

            // register watch subscriber (if any)
            if (activeWatcher) {
                let currentPath = getPath(obj, prop);
                let activeWatcherId = activeWatcher[idSym];

                let propPaths = [currentPath];

                // ---
                // NB! Disable for now because of the nonblocking and delayed
                // nature of the current MutationObserver implementation for the `onunmount` hook
                // leading to unexpected and delayed watch calls in methods like `Array.map`.
                // ---
                // if (isDetached) {
                //     // always construct all parent paths ("x.a.b.c" => ["a", "a.b", "a.b.c"])
                //     // because a store child object can be passed as argument to a function
                //     // and in that case the parents proxy get trap will not be invoked,
                //     // and their path will not be registered
                //     let parts = currentPath.split(pathSeparator);
                //     while (parts.pop() && parts.length) {
                //         propPaths.push(parts.join(pathSeparator));
                //     }
                // }

                // initialize a watcher paths tracking set (if not already)
                activeWatcher[pathsSubsSym] = activeWatcher[pathsSubsSym] || new Set();

                // register the paths to watch
                for (let path of propPaths) {
                    let subs = pathWatcherIds.get(path);
                    if (!subs) {
                        subs = new Set();
                        pathWatcherIds.set(path, subs);
                    }

                    subs.add(activeWatcherId);

                    activeWatcher[pathsSubsSym].add(subs);
                }

                // register an extra child watcher to update the custom getter prop replacement
                // (should be removed automatically with the removal of the parent watcher)
                if (
                    getterProp &&
                    !descriptors[getterProp]._watchers?.has(activeWatcherId)
                ) {
                    descriptors[getterProp]._watchers =
                        descriptors[getterProp]._watchers || new Set();
                    descriptors[getterProp]._watchers.add(activeWatcherId);

                    let getFunc = descriptors[getterProp].get.bind(obj);

                    let getWatcher = watch(getFunc, (result) => (receiver[prop] = result));

                    getWatcher[onRemoveSym] = () => {
                        descriptors[getterProp]?.watchers?.delete(watcherId);
                    };

                    // update with the cached get value after the above watch initialization
                    propVal = obj[prop]
                }
            }

            return propVal;
        },
        set(obj, prop, value) {
            if (typeof prop == "symbol") {
                obj[prop] = value;
                return true;
            }

            let oldValue = obj[prop];

            // mark as "detached" in case a proxy child object/array is being replaced
            if (oldValue?.[parentSym]) {
                oldValue[detachedSym] = true;
            }

            // update the stored parent reference in case of index change (e.g. unshift)
            if (value?.[parentSym] && Array.isArray(obj) && !isNaN(prop)) {
                value[parentSym][1] = prop;
            }

            obj[prop] = value;

            // trigger only on value change
            // (exclude length since the old value would have been already changed on access)
            if (value != oldValue || prop === "length") {
                callWatchers(obj, prop, pathWatcherIds);
            }

            return true;
        },
        deleteProperty(obj, prop) {
            if (typeof prop != "symbol") {
                callWatchers(obj, prop, pathWatcherIds);

                let currentPath = getPath(obj, prop);

                for (const item of pathWatcherIds) {
                    if (
                        // exact match
                        item[0] == currentPath ||
                        // child path
                        item[0].startsWith(currentPath + pathSeparator)
                    ) {
                        pathWatcherIds.delete(item[0]);
                    }
                }
            }

            return delete obj[prop];
        },
    });
}

function getPath(obj, prop) {
    let currentPath = prop;

    let parentData = obj?.[parentSym];
    while (parentData) {
        currentPath = parentData[1] + pathSeparator + currentPath;
        parentData = parentData[0][parentSym];
    }

    return currentPath;
}

function callWatchers(obj, prop, pathWatcherIds) {
    let currentPath = getPath(obj, prop);

    let watcherIds = pathWatcherIds.get(currentPath);

    if (!watcherIds) {
        return true;
    }

    for (let id of watcherIds) {
        flushQueue.add(id);

        if (flushQueue.size != 1) {
            continue;
        }

        queueMicrotask(() => {
            let watcher;
            for (let runId of flushQueue) {
                watcher = allWatchers.get(runId);
                if (!watcher || watcher[unwatchedSym]) {
                    continue;
                }

                // if both parent and child watcher exists,
                // execute only the parent because the child
                // watchers will be invoked automatically
                if (watcher[parentSym] && flushQueue.has(watcher[parentSym])) {
                    continue;
                }

                watcher.run();
            }

            flushQueue.clear();
        });
    }
}

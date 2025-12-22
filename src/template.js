import { watch } from "./state.js";

/**
 * Proxy object for creating and returning a new HTML element in the format `t.[tag](attrs, ...children)`.
 *
 * For example:
 *
 * ```js
 * t.div({ className: "test-div" },
 *     t.span({ textContent: "child1"}),
 *     t.span({ textContent: "child2"}),
 * )
 * ```
 *
 * `attrs` is an object where the keys are:
 * - valid element's [JS property](https://developer.mozilla.org/en-US/docs/Web/API/Element#instance_properties)
 *   _(note that some HTML attribute names are different from their JS property equivalent, e.g. `class` vs `className`, `for` vs `htmlFor`, etc.)_
 * - regular or custom HTML attribute if it has `html-` prefix _(it is stripped from the final attribute)_, e.g. `html-data-name`
 *
 * The attributes value could be a plain JS value or reactive function that returns such value _(e.g. `() => data.count`)_.
 *
 * `children` is an optional list of child elements that could be:
 * - plain text (inserted as `TextNode`)
 * - single tag
 * - array of tags
 * - reactive function that returns any of the above
 *
 * Each constructed tag has 3 additional optional lifecycle attributes:
 * - `onmount: func` - optional callback called when the element is inserted in the DOM
 * - `onunmount: func` - optional callback called when the element is removed from the DOM
 * - `rid: any` - "replacement id" is an identifier based on which we can decide whether to reuse the element or not during rerendering (e.g. on list change); the value could be anything comparable with `==`
 *
 * @param  {string} tagName
 * @param  {Object} attrs
 * @param  {...Node} children
 * @return {HTMLElement}
 */
export const t = new Proxy(
    {},
    {
        get(_, prop) {
            return function () {
                initMutationObserver();

                return tag.call(undefined, prop, ...arguments);
            };
        },
    },
);

// -------------------------------------------------------------------

let isMutationObserverInited = false;
function initMutationObserver() {
    if (isMutationObserverInited) {
        return;
    }

    isMutationObserverInited = true;

    function recursiveObserveCall(method, nodes) {
        for (let n of nodes) {
            if (n[method]) {
                n[method](n);
            }
            if (n.childNodes) {
                recursiveObserveCall(method, n.childNodes);
            }
        }
    }

    const observer = new MutationObserver((mutations) => {
        for (let m of mutations) {
            recursiveObserveCall("onmount", m.addedNodes);
            recursiveObserveCall("onunmount", m.removedNodes);
        }
    });

    observer.observe(document, { childList: true, subtree: true });
}

let watchFuncsSym = Symbol();
let registeredWatchersSym = Symbol();
let isMountedSym = Symbol();
let cleanupFuncsSym = Symbol();

function tag(tagName, attrs = {}, ...children) {
    let el = document.createElement(tagName);

    if (attrs) {
        for (let attr in attrs) {
            let val = attrs[attr];
            let useSetAttr = false;

            if (attr.length > 5 && attr.startsWith("html-")) {
                useSetAttr = true;
                attr = attr.substring(5);
            }

            if (typeof val === "undefined") {
                el.removeAttribute(attr);
            } else if (
                // JS property or regular HTML attribute
                typeof val != "function" ||
                // event
                (attr.length > 2 && attr.startsWith("on"))
            ) {
                if (useSetAttr) {
                    el.setAttribute(attr, val);
                } else {
                    el[attr] = val;
                }
            } else {
                el[watchFuncsSym] = el[watchFuncsSym] || [];
                el[watchFuncsSym].push(() => {
                    if (!el) {
                        return;
                    }

                    const result = val(el, attr);

                    if (useSetAttr) {
                        el.setAttribute(attr, result);
                    } else {
                        el[attr] = result;
                    }
                });
            }
        }
    }

    let customMount = el.onmount;
    el.onmount = () => {
        if (el[isMountedSym]) {
            return;
        }

        el[isMountedSym] = true;

        if (el[watchFuncsSym]) {
            el[registeredWatchersSym] = el[registeredWatchersSym] || [];
            for (let fn of el[watchFuncsSym]) {
                el[registeredWatchersSym].push(watch(fn));
            }
        }

        customMount?.(el);
    };

    let customUnmount = el.onunmount;
    el.onunmount = () => {
        if (!el[isMountedSym]) {
            return;
        }

        el[isMountedSym] = false;

        if (el[registeredWatchersSym]) {
            for (let w of el[registeredWatchersSym]) {
                w.unwatch();
            }
        }
        el[registeredWatchersSym] = null;

        if (el[cleanupFuncsSym]) {
            for (let cleanup of el[cleanupFuncsSym]) {
                cleanup();
            }
        }
        el[cleanupFuncsSym] = null;

        customUnmount?.(el);
    };

    setChildren(el, children);

    return el;
}

function setChildren(el, children) {
    children = toArray(children);

    for (let childOrFunc of children) {
        if (typeof childOrFunc == "function") {
            initChildrenFuncWatcher(el, childOrFunc);
        } else {
            let normalized = normalizeNode(childOrFunc);
            if (Array.isArray(normalized)) {
                // nested array
                setChildren(el, normalized);
            } else if (normalized) {
                // plain elem
                el.appendChild(normalized);
            }
        }
    }
}

// Note: Direct nested reactive functions or direct nested arrays are not supported,
// aka. childrenFunc must return a single element or plain array of elements.
function initChildrenFuncWatcher(el, childrenFunc) {
    let endPlaceholder = document.createComment("");
    el.appendChild(endPlaceholder);

    let oldChildren = [];
    let oldKeysMap = new Map();

    let elMoveBefore = el.moveBefore || el.insertBefore;

    el[cleanupFuncsSym] = el[cleanupFuncsSym] || [];
    el[cleanupFuncsSym].push(() => {
        oldChildren = null;
        oldKeysMap = null;
        endPlaceholder = null;
    });

    el[watchFuncsSym] = el[watchFuncsSym] || [];
    el[watchFuncsSym].push(() => {
        if (!el) {
            return;
        }

        let newChildren = toArray(childrenFunc(el));
        let totalNewLength = newChildren.length;
        let newKeysMap = new Map();

        // no previous children
        if (!oldChildren?.length) {
            let fragment = document.createDocumentFragment();
            for (let i = 0; i < totalNewLength; i++) {
                newChildren[i] = normalizeNode(newChildren[i]);

                fragment.appendChild(newChildren[i]);

                let rid = newChildren[i].rid;
                if (typeof rid != "undefined") {
                    if (newKeysMap.has(rid)) {
                        console.warn("Duplicated rid:", rid, newChildren[i]);
                    } else {
                        newKeysMap.set(rid, i);
                    }
                }
            }
            el.insertBefore(fragment, endPlaceholder);
            fragment = null;

            oldChildren = newChildren;
            oldKeysMap = newKeysMap;
            return;
        }

        let toMove = [];
        let toInsert = [];
        let reused = new Set();
        let orderedActiveOldIndexes = [];

        // identify new items for reuse or insert
        for (let newI = 0; newI < totalNewLength; newI++) {
            newChildren[newI] = normalizeNode(newChildren[newI]);

            let rid = newChildren[newI].rid;
            if (typeof rid != "undefined") {
                if (newKeysMap.has(rid)) {
                    console.warn("Duplicated rid:", rid, newChildren[newI]);
                } else {
                    newKeysMap.set(rid, newI);
                }

                // reuse
                let oldI = oldKeysMap.get(rid);
                if (oldI >= 0) {
                    reused.add(oldChildren[oldI]);
                    newChildren[newI] = oldChildren[oldI];
                    orderedActiveOldIndexes.push(oldI);
                    continue;
                }
            }

            toInsert.push({
                child: newChildren[newI],
                prev: newChildren[newI - 1],
            });
        }

        // since the "reused" children could be in different order from the original ones,
        // try to find the longest subsequence that is in the correct order
        // so that we can minimize the required DOM move operations,
        // aka. only the elements not found in the resulting subsequence must be reordered
        let okSubsequence = getLongestSubsequence(orderedActiveOldIndexes);
        if (orderedActiveOldIndexes.length != okSubsequence.length) {
            orderedActiveOldIndexes.forEach((idx, i) => {
                if (!okSubsequence.has(idx)) {
                    toMove.push({
                        child: oldChildren[idx],
                        currentPos: idx,
                        targetPos: i,
                    });
                }
            });
        }

        // reorder old children
        for (let m of toMove) {
            let before = oldChildren[m.targetPos];
            arrayMove(oldChildren, m.currentPos, m.targetPos);
            elMoveBefore.call(el, m.child, before);
        }

        // insert new children
        for (let ins of toInsert) {
            if (ins.prev) {
                ins.prev.after(ins.child);
            } else {
                (oldChildren[0] || endPlaceholder).before(ins.child);
            }
        }

        // remove missing old children
        for (let i = 0; i < oldChildren.length; i++) {
            if (!reused.has(oldChildren[i])) {
                oldChildren[i].remove?.();
            }
        }

        oldChildren = newChildren;
        oldKeysMap = newKeysMap;

        // clear to make sure no lingering references remain
        newChildren = null;
        newKeysMap = null;
        reused = null;
        toMove = null;
        toInsert = null;
    });
}

// Returns the elements of the Longest Increasing Subsequence (LIS) for an array of indexes.
//
// Note that the returned sequence is in reverse order but for our case
// it doesn't matter because we are interested only in the elements.
//
// For more details and visual representation of the the algorithm, please check:
// https://en.wikipedia.org/wiki/Longest_increasing_subsequence#Efficient_algorithms
function getLongestSubsequence(arr) {
    let ends = [];
    let predecessors = [];

    for (let i = 0; i < arr.length; i++) {
        let current = arr[i];

        let low = 0;
        let mid = 0;
        let high = ends.length;
        while (low < high) {
            mid = Math.floor((low + high) / 2);
            if (arr[ends[mid]] >= current) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        if (low > 0) {
            predecessors[i] = ends[low - 1];
        }

        ends[low] = i;
    }

    let result = new Set();

    // reconstruct the LIS elements via backtracking
    let lastIdx = ends[ends.length - 1];
    while (typeof lastIdx != "undefined") {
        result.add(arr[lastIdx]);
        lastIdx = predecessors[lastIdx];
    }

    return result;
}

function arrayMove(arr, from, to) {
    if (from == to) {
        return arr;
    }

    let dir = from > to ? -1 : 1;
    let target = arr[from];

    for (let i = from; i != to; i += dir) {
        arr[i] = arr[i + dir];
    }

    arr[to] = target;
}

function toArray(val) {
    if (typeof val == "undefined" || val === null) {
        return [];
    }

    return Array.isArray(val) ? val : [val];
}

function normalizeNode(child) {
    // wrap as TextNode so that it can be "tracked" and used with appendChild or other similar methods
    if (
        typeof child == "string" ||
        typeof child == "number" ||
        typeof child == "boolean"
    ) {
        let childNode = document.createTextNode(child);
        childNode.rid = child;
        return childNode;
    }

    // in case child is DOM Proxy element/array loaded from a store object
    if (typeof child?.__raw != "undefined") {
        return child.__raw;
    }

    return child;
}

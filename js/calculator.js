
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var currency_min = createCommonjsModule(function (module, exports) {
    /*
     currency.js - v2.0.3
     http://scurker.github.io/currency.js

     Copyright (c) 2020 Jason Wilson
     Released under MIT license
    */
    (function(e,g){module.exports=g();})(commonjsGlobal,function(){function e(b,a){if(!(this instanceof e))return new e(b,a);a=Object.assign({},m,a);var d=Math.pow(10,a.precision);this.intValue=b=g(b,a);this.value=b/d;a.increment=a.increment||1/d;a.groups=a.useVedic?n:p;this.s=a;this.p=d;}function g(b,a){var d=2<arguments.length&&void 0!==arguments[2]?arguments[2]:!0;var c=a.decimal;
    var h=a.errorOnInvalid,k=a.fromCents,l=Math.pow(10,a.precision),f=b instanceof e;if(f&&k)return b.intValue;if("number"===typeof b||f)c=f?b.value:b;else if("string"===typeof b)h=new RegExp("[^-\\d"+c+"]","g"),c=new RegExp("\\"+c,"g"),c=(c=b.replace(/\((.*)\)/,"-$1").replace(h,"").replace(c,"."))||0;else {if(h)throw Error("Invalid Input");c=0;}k||(c=(c*l).toFixed(4));return d?Math.round(c):c}var m={symbol:"$",separator:",",decimal:".",errorOnInvalid:!1,precision:2,pattern:"!#",negativePattern:"-!#",format:function(b,
    a){var d=a.pattern,c=a.negativePattern,h=a.symbol,k=a.separator,l=a.decimal;a=a.groups;var f=(""+b).replace(/^-/,"").split("."),q=f[0];f=f[1];return (0<=b.value?d:c).replace("!",h).replace("#",q.replace(a,"$1"+k)+(f?l+f:""))},fromCents:!1},p=/(\d)(?=(\d{3})+\b)/g,n=/(\d)(?=(\d\d)+\d\b)/g;e.prototype={add:function(b){var a=this.s,d=this.p;return e((this.intValue+g(b,a))/(a.fromCents?1:d),a)},subtract:function(b){var a=this.s,d=this.p;return e((this.intValue-g(b,a))/(a.fromCents?1:d),a)},multiply:function(b){var a=
    this.s;return e(this.intValue*b/(a.fromCents?1:Math.pow(10,a.precision)),a)},divide:function(b){var a=this.s;return e(this.intValue/g(b,a,!1),a)},distribute:function(b){var a=this.intValue,d=this.p,c=this.s,h=[],k=Math[0<=a?"floor":"ceil"](a/b),l=Math.abs(a-k*b);for(d=c.fromCents?1:d;0!==b;b--){var f=e(k/d,c);0<l--&&(f=f[0<=a?"add":"subtract"](1/d));h.push(f);}return h},dollars:function(){return ~~this.value},cents:function(){return ~~(this.intValue%this.p)},format:function(b){var a=this.s;return "function"===
    typeof b?b(this,a):a.format(this,Object.assign({},a,b))},toString:function(){var b=this.s,a=b.increment;return (Math.round(this.intValue/this.p/a)*a).toFixed(b.precision)},toJSON:function(){return this.value}};return e});
    });

    var uikit_min = createCommonjsModule(function (module, exports) {
    /*! UIkit 3.6.3 | https://www.getuikit.com | (c) 2014 - 2020 YOOtheme | MIT License */

    !function(t,e){module.exports=e();}(commonjsGlobal,function(){var t=Object.prototype,n=t.hasOwnProperty;function h(t,e){return n.call(t,e)}var e={},i=/([a-z\d])([A-Z])/g;function d(t){return t in e||(e[t]=t.replace(i,"$1-$2").toLowerCase()),e[t]}var r=/-(\w)/g;function f(t){return t.replace(r,o)}function o(t,e){return e?e.toUpperCase():""}function p(t){return t.length?o(0,t.charAt(0))+t.slice(1):""}var s=String.prototype,a=s.startsWith||function(t){return 0===this.lastIndexOf(t,0)};function g(t,e){return a.call(t,e)}var u=s.endsWith||function(t){return this.substr(-t.length)===t};function c(t,e){return u.call(t,e)}var l=Array.prototype,m=function(t,e){return !!~this.indexOf(t,e)},v=s.includes||m,w=l.includes||m;function b(t,e){return t&&(D(t)?v:w).call(t,e)}var x=l.findIndex||function(t){for(var e=arguments,n=0;n<this.length;n++)if(t.call(e[1],this[n],n,this))return n;return -1};function y(t,e){return x.call(t,e)}var k=Array.isArray;function $(t){return "function"==typeof t}function S(t){return null!==t&&"object"==typeof t}var I=t.toString;function E(t){return "[object Object]"===I.call(t)}function T(t){return S(t)&&t===t.window}function C(t){return 9===M(t)}function _(t){return 1<=M(t)}function A(t){return 1===M(t)}function M(t){return !T(t)&&S(t)&&t.nodeType}function z(t){return "boolean"==typeof t}function D(t){return "string"==typeof t}function N(t){return "number"==typeof t}function B(t){return N(t)||D(t)&&!isNaN(t-parseFloat(t))}function P(t){return !(k(t)?t.length:S(t)&&Object.keys(t).length)}function O(t){return void 0===t}function H(t){return z(t)?t:"true"===t||"1"===t||""===t||"false"!==t&&"0"!==t&&t}function L(t){t=Number(t);return !isNaN(t)&&t}function j(t){return parseFloat(t)||0}var F=Array.from||function(t){return l.slice.call(t)};function W(t){return V(t)[0]}function V(t){return t&&(_(t)?[t]:F(t).filter(_))||[]}function R(t){return T(t)?t:(t=W(t))?(C(t)?t:t.ownerDocument).defaultView:window}function q(t){return t?c(t,"ms")?j(t):1e3*j(t):0}function U(t,n){return t===n||S(t)&&S(n)&&Object.keys(t).length===Object.keys(n).length&&K(t,function(t,e){return t===n[e]})}function Y(t,e,n){return t.replace(new RegExp(e+"|"+n,"g"),function(t){return t===e?n:e})}var X=Object.assign||function(t){for(var e=[],n=arguments.length-1;0<n--;)e[n]=arguments[n+1];t=Object(t);for(var i=0;i<e.length;i++){var r=e[i];if(null!==r)for(var o in r)h(r,o)&&(t[o]=r[o]);}return t};function G(t){return t[t.length-1]}function K(t,e){for(var n in t)if(!1===e(t[n],n))return !1;return !0}function J(t,n){return t.slice().sort(function(t,e){t=t[n];void 0===t&&(t=0);e=e[n];return void 0===e&&(e=0),e<t?1:t<e?-1:0})}function Z(t,e){var n=new Set;return t.filter(function(t){t=t[e];return !n.has(t)&&(n.add(t)||!0)})}function Q(t,e,n){return void 0===e&&(e=0),void 0===n&&(n=1),Math.min(Math.max(L(t)||0,e),n)}function tt(){}function et(){for(var i=[],t=arguments.length;t--;)i[t]=arguments[t];return [["bottom","top"],["right","left"]].every(function(t){var e=t[0],n=t[1];return 0<Math.min.apply(Math,i.map(function(t){return t[e]}))-Math.max.apply(Math,i.map(function(t){return t[n]}))})}function nt(t,e){return t.x<=e.right&&t.x>=e.left&&t.y<=e.bottom&&t.y>=e.top}var it={ratio:function(t,e,n){var i="width"===e?"height":"width",r={};return r[i]=t[e]?Math.round(n*t[i]/t[e]):t[i],r[e]=n,r},contain:function(n,i){var r=this;return K(n=X({},n),function(t,e){return n=n[e]>i[e]?r.ratio(n,e,i[e]):n}),n},cover:function(n,i){var r=this;return K(n=this.contain(n,i),function(t,e){return n=n[e]<i[e]?r.ratio(n,e,i[e]):n}),n}};function rt(t,e,n){if(S(e))for(var i in e)rt(t,i,e[i]);else {if(O(n))return (t=W(t))&&t.getAttribute(e);V(t).forEach(function(t){$(n)&&(n=n.call(t,rt(t,e))),null===n?st(t,e):t.setAttribute(e,n);});}}function ot(t,e){return V(t).some(function(t){return t.hasAttribute(e)})}function st(t,e){t=V(t),e.split(" ").forEach(function(e){return t.forEach(function(t){return t.hasAttribute(e)&&t.removeAttribute(e)})});}function at(t,e){for(var n=0,i=[e,"data-"+e];n<i.length;n++)if(ot(t,i[n]))return rt(t,i[n])}var ut="undefined"!=typeof window,ct=ut&&/msie|trident/i.test(window.navigator.userAgent),ht=ut&&"rtl"===rt(document.documentElement,"dir"),lt=ut&&"ontouchstart"in window,dt=ut&&window.PointerEvent,ft=ut&&(lt||window.DocumentTouch&&document instanceof DocumentTouch||navigator.maxTouchPoints),pt=dt?"pointerdown":lt?"touchstart":"mousedown",mt=dt?"pointermove":lt?"touchmove":"mousemove",gt=dt?"pointerup":lt?"touchend":"mouseup",vt=dt?"pointerenter":lt?"":"mouseenter",wt=dt?"pointerleave":lt?"":"mouseleave",bt=dt?"pointercancel":"touchcancel";function xt(t,e){return W(t)||$t(t,kt(t,e))}function yt(t,e){var n=V(t);return n.length&&n||St(t,kt(t,e))}function kt(t,e){return void 0===e&&(e=document),Ct(t)||C(e)?e:e.ownerDocument}function $t(t,e){return W(It(t,e,"querySelector"))}function St(t,e){return V(It(t,e,"querySelectorAll"))}function It(t,o,e){if(void 0===o&&(o=document),!t||!D(t))return null;var s;Ct(t=t.replace(Tt,"$1 *"))&&(s=[],t=t.match(_t).map(function(t){return t.replace(/,$/,"").trim()}).map(function(t,e){var n,i,r=o;return "!"===t[0]&&(i=t.substr(1).trim().split(" "),r=Nt(Bt(o),i[0]),t=i.slice(1).join(" ").trim()),"-"===t[0]&&(n=t.substr(1).trim().split(" "),i=(r||o).previousElementSibling,r=zt(i,t.substr(1))?i:null,t=n.slice(1).join(" ")),r?(r.id||(r.id="uk-"+Date.now()+e,s.push(function(){return st(r,"id")})),"#"+Ot(r.id)+" "+t):null}).filter(Boolean).join(","),o=document);try{return o[e](t)}catch(t){return null}finally{s&&s.forEach(function(t){return t()});}}var Et=/(^|[^\\],)\s*[!>+~-]/,Tt=/([!>+~-])(?=\s+[!>+~-]|\s*$)/g;function Ct(t){return D(t)&&t.match(Et)}var _t=/.*?[^\\](?:,|$)/g;var At=ut?Element.prototype:{},Mt=At.matches||At.webkitMatchesSelector||At.msMatchesSelector||tt;function zt(t,e){return V(t).some(function(t){return Mt.call(t,e)})}var Dt=At.closest||function(t){var e=this;do{if(zt(e,t))return e}while(e=Bt(e))};function Nt(t,e){return g(e,">")&&(e=e.slice(1)),A(t)?Dt.call(t,e):V(t).map(function(t){return Nt(t,e)}).filter(Boolean)}function Bt(t){return (t=W(t))&&A(t.parentNode)&&t.parentNode}var Pt=ut&&window.CSS&&CSS.escape||function(t){return t.replace(/([^\x7f-\uFFFF\w-])/g,function(t){return "\\"+t})};function Ot(t){return D(t)?Pt.call(null,t):""}var Ht={area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,menuitem:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0};function Lt(t){return V(t).some(function(t){return Ht[t.tagName.toLowerCase()]})}function jt(t){return V(t).some(function(t){return t.offsetWidth||t.offsetHeight||t.getClientRects().length})}var Ft="input,select,textarea,button";function Wt(t){return V(t).some(function(t){return zt(t,Ft)})}function Vt(t,e){return V(t).filter(function(t){return zt(t,e)})}function Rt(t,e){return D(e)?zt(t,e)||!!Nt(t,e):t===e||(C(e)?e.documentElement:W(e)).contains(W(t))}function qt(t,e){for(var n=[];t=Bt(t);)e&&!zt(t,e)||n.push(t);return n}function Ut(t,e){t=(t=W(t))?V(t.children):[];return e?Vt(t,e):t}function Yt(){for(var t=[],e=arguments.length;e--;)t[e]=arguments[e];var n,i,r=Zt(t),o=r[0],s=r[1],a=r[2],u=r[3],c=r[4],o=ne(o);return 1<u.length&&(n=u,u=function(t){return k(t.detail)?n.apply(void 0,[t].concat(t.detail)):n(t)}),c&&c.self&&(i=u,u=function(t){if(t.target===t.currentTarget||t.target===t.current)return i.call(null,t)}),a&&(u=function(t,i,r){var o=this;return function(n){t.forEach(function(t){var e=">"===i[0]?St(i,t).reverse().filter(function(t){return Rt(n.target,t)})[0]:Nt(n.target,i);e&&(n.delegate=t,n.current=e,r.call(o,n));});}}(o,a,u)),c=Qt(c),s.split(" ").forEach(function(e){return o.forEach(function(t){return t.addEventListener(e,u,c)})}),function(){return Xt(o,s,u,c)}}function Xt(t,e,n,i){void 0===i&&(i=!1),i=Qt(i),t=ne(t),e.split(" ").forEach(function(e){return t.forEach(function(t){return t.removeEventListener(e,n,i)})});}function Gt(){for(var t=[],e=arguments.length;e--;)t[e]=arguments[e];var n=Zt(t),i=n[0],r=n[1],o=n[2],s=n[3],a=n[4],u=n[5],c=Yt(i,r,o,function(t){var e=!u||u(t);e&&(c(),s(t,e));},a);return c}function Kt(t,n,i){return ne(t).reduce(function(t,e){return t&&e.dispatchEvent(Jt(n,!0,!0,i))},!0)}function Jt(t,e,n,i){var r;return void 0===e&&(e=!0),void 0===n&&(n=!1),D(t)&&((r=document.createEvent("CustomEvent")).initCustomEvent(t,e,n,i),t=r),t}function Zt(t){return $(t[2])&&t.splice(2,0,!1),t}function Qt(t){return t&&ct&&!z(t)?!!t.capture:t}function te(t){return t&&"addEventListener"in t}function ee(t){return te(t)?t:W(t)}function ne(t){return k(t)?t.map(ee).filter(Boolean):D(t)?St(t):te(t)?[t]:V(t)}function ie(t){return "touch"===t.pointerType||!!t.touches}function re(t){var e=t.touches,n=t.changedTouches,t=e&&e[0]||n&&n[0]||t;return {x:t.clientX,y:t.clientY}}function oe(){var n=this;this.promise=new se(function(t,e){n.reject=e,n.resolve=t;});}var se=ut&&window.Promise||ce,ae=2,ue=ut&&window.setImmediate||setTimeout;function ce(t){this.state=ae,this.value=void 0,this.deferred=[];var e=this;try{t(function(t){e.resolve(t);},function(t){e.reject(t);});}catch(t){e.reject(t);}}ce.reject=function(n){return new ce(function(t,e){e(n);})},ce.resolve=function(n){return new ce(function(t,e){t(n);})},ce.all=function(o){return new ce(function(n,t){var i=[],r=0;0===o.length&&n(i);for(var e=0;e<o.length;e+=1)ce.resolve(o[e]).then(function(e){return function(t){i[e]=t,(r+=1)===o.length&&n(i);}}(e),t);})},ce.race=function(i){return new ce(function(t,e){for(var n=0;n<i.length;n+=1)ce.resolve(i[n]).then(t,e);})};var he=ce.prototype;function le(s,a){return new se(function(t,e){var n=X({data:null,method:"GET",headers:{},xhr:new XMLHttpRequest,beforeSend:tt,responseType:""},a);n.beforeSend(n);var i,r,o=n.xhr;for(i in n)if(i in o)try{o[i]=n[i];}catch(t){}for(r in o.open(n.method.toUpperCase(),s),n.headers)o.setRequestHeader(r,n.headers[r]);Yt(o,"load",function(){0===o.status||200<=o.status&&o.status<300||304===o.status?("json"===n.responseType&&D(o.response)&&(o=X(function(t){var e,n={};for(e in t)n[e]=t[e];return n}(o),{response:JSON.parse(o.response)})),t(o)):e(X(Error(o.statusText),{xhr:o,status:o.status}));}),Yt(o,"error",function(){return e(X(Error("Network Error"),{xhr:o}))}),Yt(o,"timeout",function(){return e(X(Error("Network Timeout"),{xhr:o}))}),o.send(n.data);})}function de(i,r,o){return new se(function(t,e){var n=new Image;n.onerror=function(t){return e(t)},n.onload=function(){return t(n)},o&&(n.sizes=o),r&&(n.srcset=r),n.src=i;})}function fe(t){var e;"loading"===document.readyState?e=Yt(document,"DOMContentLoaded",function(){e(),t();}):t();}function pe(t,e){return e?V(t).indexOf(W(e)):Ut(Bt(t)).indexOf(t)}function me(t,e,n,i){void 0===n&&(n=0),void 0===i&&(i=!1);var r=(e=V(e)).length;return t=B(t)?L(t):"next"===t?n+1:"previous"===t?n-1:pe(e,t),i?Q(t,0,r-1):(t%=r)<0?t+r:t}function ge(t){return (t=Ae(t)).innerHTML="",t}function ve(t,e){return t=Ae(t),O(e)?t.innerHTML:we(t.hasChildNodes()?ge(t):t,e)}function we(e,t){return e=Ae(e),ye(t,function(t){return e.appendChild(t)})}function be(e,t){return e=Ae(e),ye(t,function(t){return e.parentNode.insertBefore(t,e)})}function xe(e,t){return e=Ae(e),ye(t,function(t){return e.nextSibling?be(e.nextSibling,t):we(e.parentNode,t)})}function ye(t,e){return (t=D(t)?Ce(t):t)?"length"in t?V(t).map(e):e(t):null}function ke(t){V(t).forEach(function(t){return t.parentNode&&t.parentNode.removeChild(t)});}function $e(t,e){for(e=W(be(t,e));e.firstChild;)e=e.firstChild;return we(e,t),e}function Se(t,e){return V(V(t).map(function(t){return t.hasChildNodes?$e(V(t.childNodes),e):we(t,e)}))}function Ie(t){V(t).map(Bt).filter(function(t,e,n){return n.indexOf(t)===e}).forEach(function(t){be(t,t.childNodes),ke(t);});}he.resolve=function(t){var e=this;if(e.state===ae){if(t===e)throw new TypeError("Promise settled with itself.");var n=!1;try{var i=t&&t.then;if(null!==t&&S(t)&&$(i))return void i.call(t,function(t){n||e.resolve(t),n=!0;},function(t){n||e.reject(t),n=!0;})}catch(t){return void(n||e.reject(t))}e.state=0,e.value=t,e.notify();}},he.reject=function(t){var e=this;if(e.state===ae){if(t===e)throw new TypeError("Promise settled with itself.");e.state=1,e.value=t,e.notify();}},he.notify=function(){var o=this;ue(function(){if(o.state!==ae)for(;o.deferred.length;){var t=o.deferred.shift(),e=t[0],n=t[1],i=t[2],r=t[3];try{0===o.state?$(e)?i(e.call(void 0,o.value)):i(o.value):1===o.state&&($(n)?i(n.call(void 0,o.value)):r(o.value));}catch(t){r(t);}}});},he.then=function(n,i){var r=this;return new ce(function(t,e){r.deferred.push([n,i,t,e]),r.notify();})},he.catch=function(t){return this.then(void 0,t)};var Ee=/^\s*<(\w+|!)[^>]*>/,Te=/^<(\w+)\s*\/?>(?:<\/\1>)?$/;function Ce(t){var e=Te.exec(t);if(e)return document.createElement(e[1]);e=document.createElement("div");return Ee.test(t)?e.insertAdjacentHTML("beforeend",t.trim()):e.textContent=t,1<e.childNodes.length?V(e.childNodes):e.firstChild}function _e(t,e){if(A(t))for(e(t),t=t.firstElementChild;t;){var n=t.nextElementSibling;_e(t,e),t=n;}}function Ae(t,e){return D(t)?ze(t)?W(Ce(t)):$t(t,e):W(t)}function Me(t,e){return D(t)?ze(t)?V(Ce(t)):St(t,e):V(t)}function ze(t){return "<"===t[0]||t.match(/^\s*</)}function De(t){for(var e=[],n=arguments.length-1;0<n--;)e[n]=arguments[n+1];Le(t,e,"add");}function Ne(t){for(var e=[],n=arguments.length-1;0<n--;)e[n]=arguments[n+1];Le(t,e,"remove");}function Be(t,e){rt(t,"class",function(t){return (t||"").replace(new RegExp("\\b"+e+"\\b","g"),"")});}function Pe(t){for(var e=[],n=arguments.length-1;0<n--;)e[n]=arguments[n+1];e[0]&&Ne(t,e[0]),e[1]&&De(t,e[1]);}function Oe(t,e){return e&&V(t).some(function(t){return t.classList.contains(e.split(" ")[0])})}function He(t){for(var i,r=[],e=arguments.length-1;0<e--;)r[e]=arguments[e+1];r.length&&(i=D(G(r=je(r)))?[]:r.pop(),r=r.filter(Boolean),V(t).forEach(function(t){for(var e=t.classList,n=0;n<r.length;n++)Fe.Force?e.toggle.apply(e,[r[n]].concat(i)):e[(O(i)?!e.contains(r[n]):i)?"add":"remove"](r[n]);}));}function Le(t,n,i){(n=je(n).filter(Boolean)).length&&V(t).forEach(function(t){var e=t.classList;Fe.Multiple?e[i].apply(e,n):n.forEach(function(t){return e[i](t)});});}function je(t){return t.reduce(function(t,e){return t.concat.call(t,D(e)&&b(e," ")?e.trim().split(" "):e)},[])}var Fe={get Multiple(){return this.get("_multiple")},get Force(){return this.get("_force")},get:function(t){var e;return h(this,t)||((e=document.createElement("_").classList).add("a","b"),e.toggle("c",!1),this._multiple=e.contains("b"),this._force=!e.contains("c")),this[t]}},We={"animation-iteration-count":!0,"column-count":!0,"fill-opacity":!0,"flex-grow":!0,"flex-shrink":!0,"font-weight":!0,"line-height":!0,opacity:!0,order:!0,orphans:!0,"stroke-dasharray":!0,"stroke-dashoffset":!0,widows:!0,"z-index":!0,zoom:!0};function Ve(t,e,r,o){return V(t).map(function(n){if(D(e)){if(e=Ge(e),O(r))return qe(n,e);r||N(r)?n.style.setProperty(e,B(r)&&!We[e]?r+"px":r,o):n.style.removeProperty(e);}else {if(k(e)){var i=Re(n);return e.reduce(function(t,e){return t[e]=i[Ge(e)],t},{})}S(e)&&(o=r,K(e,function(t,e){return Ve(n,e,t,o)}));}return n})[0]}function Re(t,e){return (t=W(t)).ownerDocument.defaultView.getComputedStyle(t,e)}function qe(t,e,n){return Re(t,n)[e]}var Ue={};function Ye(t){var e,n=document.documentElement;return ct?(t in Ue||(De(e=we(n,document.createElement("div")),"uk-"+t),Ue[t]=qe(e,"content",":before").replace(/^["'](.*)["']$/,"$1"),ke(e)),Ue[t]):Re(n).getPropertyValue("--uk-"+t)}var Xe={};function Ge(t){return Xe[t]||(Xe[t]=function(t){t=d(t);var e=document.documentElement.style;if(t in e)return t;var n,i=Ke.length;for(;i--;)if((n="-"+Ke[i]+"-"+t)in e)return n;return t}(t)),Xe[t]}var Ke=["webkit","moz","ms"];function Je(t,s,a,u){return void 0===a&&(a=400),void 0===u&&(u="linear"),se.all(V(t).map(function(o){return new se(function(e,n){for(var t in s){var i=Ve(o,t);""===i&&Ve(o,t,i);}var r=setTimeout(function(){return Kt(o,"transitionend")},a);Gt(o,"transitionend transitioncanceled",function(t){t=t.type;clearTimeout(r),Ne(o,"uk-transition"),Ve(o,{transitionProperty:"",transitionDuration:"",transitionTimingFunction:""}),"transitioncanceled"===t?n():e(o);},{self:!0}),De(o,"uk-transition"),Ve(o,X({transitionProperty:Object.keys(s).map(Ge).join(","),transitionDuration:a+"ms",transitionTimingFunction:u},s));})}))}var Ze={start:Je,stop:function(t){return Kt(t,"transitionend"),se.resolve()},cancel:function(t){Kt(t,"transitioncanceled");},inProgress:function(t){return Oe(t,"uk-transition")}},Qe="uk-animation-";function tn(t,o,s,a,u){return void 0===s&&(s=200),se.all(V(t).map(function(r){return new se(function(e,n){Kt(r,"animationcanceled");var i=setTimeout(function(){return Kt(r,"animationend")},s);Gt(r,"animationend animationcanceled",function(t){t=t.type;clearTimeout(i),"animationcanceled"===t?n():e(r),Ve(r,"animationDuration",""),Be(r,Qe+"\\S*");},{self:!0}),Ve(r,"animationDuration",s+"ms"),De(r,o,Qe+(u?"leave":"enter")),g(o,Qe)&&De(r,a&&"uk-transform-origin-"+a,u&&Qe+"reverse");})}))}var en=new RegExp(Qe+"(enter|leave)"),nn={in:tn,out:function(t,e,n,i){return tn(t,e,n,i,!0)},inProgress:function(t){return en.test(rt(t,"class"))},cancel:function(t){Kt(t,"animationcanceled");}},rn={width:["left","right"],height:["top","bottom"]};function on(t){t=T(t)||!W(t)?{height:cn(t),width:hn(t),top:0,left:0}:W(t).getBoundingClientRect();return {height:t.height,width:t.width,top:t.top,left:t.left,bottom:t.top+t.height,right:t.left+t.width}}function sn(n,i){var t,r=on(n),e=R(n),o={height:e.pageYOffset,width:e.pageXOffset};for(t in rn)for(var s in rn[t])r[rn[t][s]]+=o[t];if(!i)return r;var a=Ve(n,"position");K(Ve(n,["left","top"]),function(t,e){return Ve(n,e,i[e]-r[e]+j("absolute"===a&&"auto"===t?an(n)[e]:t))});}function an(t,e){t=W(t),e=e||t.offsetParent||t.documentElement;var n=sn(t),t=sn(e);return {top:n.top-t.top-j(Ve(e,"borderTopWidth")),left:n.left-t.left-j(Ve(e,"borderLeftWidth"))}}function un(t){var e=[0,0];t=W(t);do{if(e[0]+=t.offsetTop,e[1]+=t.offsetLeft,"fixed"===Ve(t,"position")){var n=R(t);return e[0]+=n.pageYOffset,e[1]+=n.pageXOffset,e}}while(t=t.offsetParent);return e}var cn=ln("height"),hn=ln("width");function ln(i){var r=p(i);return function(t,e){if(O(e)){if(T(t))return t["inner"+r];if(C(t)){var n=t.documentElement;return Math.max(n["offset"+r],n["scroll"+r])}return (e="auto"===(e=Ve(t=W(t),i))?t["offset"+r]:j(e)||0)-dn(t,i)}return Ve(t,i,e||0===e?+e+dn(t,i)+"px":"")}}function dn(n,t,e){return void 0===e&&(e="border-box"),Ve(n,"boxSizing")===e?rn[t].map(p).reduce(function(t,e){return t+j(Ve(n,"padding"+e))+j(Ve(n,"border"+e+"Width"))},0):0}function fn(t){for(var e in rn)for(var n in rn[e])if(rn[e][n]===t)return rn[e][1-n];return t}function pn(t,e,n){return void 0===e&&(e="width"),void 0===n&&(n=window),B(t)?+t:c(t,"vh")?mn(cn(R(n)),t):c(t,"vw")?mn(hn(R(n)),t):c(t,"%")?mn(on(n)[e],t):j(t)}function mn(t,e){return t*j(e)/100}var gn={reads:[],writes:[],read:function(t){return this.reads.push(t),bn(),t},write:function(t){return this.writes.push(t),bn(),t},clear:function(t){return yn(this.reads,t)||yn(this.writes,t)},flush:vn};function vn(t){void 0===t&&(t=1),xn(gn.reads),xn(gn.writes.splice(0,gn.writes.length)),gn.scheduled=!1,(gn.reads.length||gn.writes.length)&&bn(t+1);}var wn=4;function bn(t){gn.scheduled||(gn.scheduled=!0,t&&t<wn?se.resolve().then(function(){return vn(t)}):requestAnimationFrame(function(){return vn()}));}function xn(t){for(var e;e=t.shift();)e();}function yn(t,e){e=t.indexOf(e);return !!~e&&!!t.splice(e,1)}function kn(){}kn.prototype={positions:[],init:function(){var e,t=this;this.positions=[],this.unbind=Yt(document,"mousemove",function(t){return e=re(t)}),this.interval=setInterval(function(){e&&(t.positions.push(e),5<t.positions.length&&t.positions.shift());},50);},cancel:function(){this.unbind&&this.unbind(),this.interval&&clearInterval(this.interval);},movesTo:function(t){if(this.positions.length<2)return !1;var e=t.getBoundingClientRect(),n=e.left,i=e.right,r=e.top,o=e.bottom,s=this.positions[0],t=G(this.positions),a=[s,t];return !nt(t,e)&&[[{x:n,y:r},{x:i,y:o}],[{x:n,y:o},{x:i,y:r}]].some(function(t){t=function(t,e){var n=t[0],i=n.x,r=n.y,o=t[1],s=o.x,a=o.y,u=e[0],n=u.x,t=u.y,o=e[1],u=o.x,e=o.y,o=(e-t)*(s-i)-(u-n)*(a-r);if(0==o)return !1;o=((u-n)*(r-t)-(e-t)*(i-n))/o;if(o<0)return !1;return {x:i+o*(s-i),y:r+o*(a-r)}}(a,t);return t&&nt(t,e)})}};var $n={};function Sn(t,e,n){return $n.computed($(t)?t.call(n,n):t,$(e)?e.call(n,n):e)}function In(t,e){return t=t&&!k(t)?[t]:t,e?t?t.concat(e):k(e)?e:[e]:t}function En(e,n,i){var t,r,o={};if($(n)&&(n=n.options),n.extends&&(e=En(e,n.extends,i)),n.mixins)for(var s=0,a=n.mixins.length;s<a;s++)e=En(e,n.mixins[s],i);for(t in e)u(t);for(r in n)h(e,r)||u(r);function u(t){o[t]=($n[t]||function(t,e){return O(e)?t:e})(e[t],n[t],i);}return o}function Tn(t,e){var n;void 0===e&&(e=[]);try{return t?g(t,"{")?JSON.parse(t):e.length&&!b(t,":")?((n={})[e[0]]=t,n):t.split(";").reduce(function(t,e){var n=e.split(/:(.*)/),e=n[0],n=n[1];return e&&!O(n)&&(t[e.trim()]=n.trim()),t},{}):{}}catch(t){return {}}}function Cn(t){if(zn(t)&&Bn(t,{func:"playVideo",method:"play"}),Mn(t))try{t.play().catch(tt);}catch(t){}}function _n(t){zn(t)&&Bn(t,{func:"pauseVideo",method:"pause"}),Mn(t)&&t.pause();}function An(t){zn(t)&&Bn(t,{func:"mute",method:"setVolume",value:0}),Mn(t)&&(t.muted=!0);}function Mn(t){return t&&"VIDEO"===t.tagName}function zn(t){return t&&"IFRAME"===t.tagName&&(Dn(t)||Nn(t))}function Dn(t){return !!t.src.match(/\/\/.*?youtube(-nocookie)?\.[a-z]+\/(watch\?v=[^&\s]+|embed)|youtu\.be\/.*/)}function Nn(t){return !!t.src.match(/vimeo\.com\/video\/.*/)}function Bn(t,e){(function(e){if(e[On])return e[On];var n,i=Dn(e),r=Nn(e),o=++Hn;return e[On]=new se(function(t){i&&Gt(e,"load",function(){function t(){return Pn(e,{event:"listening",id:o})}n=setInterval(t,100),t();}),Gt(window,"message",t,!1,function(t){var e=t.data;try{return (e=JSON.parse(e))&&(i&&e.id===o&&"onReady"===e.event||r&&Number(e.player_id)===o)}catch(t){}}),e.src=e.src+(b(e.src,"?")?"&":"?")+(i?"enablejsapi=1":"api=1&player_id="+o);}).then(function(){return clearInterval(n)})})(t).then(function(){return Pn(t,e)});}function Pn(t,e){try{t.contentWindow.postMessage(JSON.stringify(X({event:"command"},e)),"*");}catch(t){}}$n.events=$n.created=$n.beforeConnect=$n.connected=$n.beforeDisconnect=$n.disconnected=$n.destroy=In,$n.args=function(t,e){return !1!==e&&In(e||t)},$n.update=function(t,e){return J(In(t,$(e)?{read:e}:e),"order")},$n.props=function(t,e){return k(e)&&(e=e.reduce(function(t,e){return t[e]=String,t},{})),$n.methods(t,e)},$n.computed=$n.methods=function(t,e){return e?t?X({},t,e):e:t},$n.data=function(e,n,t){return t?Sn(e,n,t):n?e?function(t){return Sn(e,n,t)}:n:e};var On="_ukPlayer",Hn=0;function Ln(t,r,o){return void 0===r&&(r=0),void 0===o&&(o=0),!!jt(t)&&et.apply(void 0,Vn(t).map(function(t){var e=sn(Rn(t)),n=e.top,i=e.left,t=e.bottom,e=e.right;return {top:n-r,left:i-o,bottom:t+r,right:e+o}}).concat(sn(t)))}function jn(t,e){(t=(T(t)||C(t)?qn:W)(t)).scrollTop=e;}function Fn(s,t){void 0===t&&(t={});var a=t.offset;if(void 0===a&&(a=0),jt(s)){var c=Vn(s),h=0;return c.reduce(function(t,e,n){var i=e.scrollTop,r=e.scrollHeight,o=Rn(e),r=r-cn(o),u=Math.ceil(an(c[n-1]||s,o).top-a)+h+i;return r<u?(h=u-r,u=r):h=0,function(){return s=e,a=u-i,new se(function(n){var t,i=s.scrollTop,r=(t=Math.abs(a),40*Math.pow(t,.375)),o=Date.now();!function t(){var e,e=(e=Q((Date.now()-o)/r),.5*(1-Math.cos(Math.PI*e)));jn(s,i+a*e),1!=e?requestAnimationFrame(t):n();}();}).then(t);var s,a;}},function(){return se.resolve()})()}}function Wn(t,e){if(void 0===e&&(e=0),!jt(t))return 0;var n=Vn(t,/auto|scroll/)[0],i=n.scrollHeight,r=n.scrollTop,o=Rn(n),s=cn(o),o=un(t)[0]-r-un(n)[0],n=Math.min(s,o+r);return Q(-1*(o-n)/Math.min(cn(t)+e+n,i-(o+r),i-s))}function Vn(t,e,n){void 0===e&&(e=/auto|scroll|hidden/),void 0===n&&(n=!1);var i=qn(t),r=qt(t).reverse(),t=y(r=r.slice(r.indexOf(i)+1),function(t){return "fixed"===Ve(t,"position")});return ~t&&(r=r.slice(t)),[i].concat(r.filter(function(t){return e.test(Ve(t,"overflow"))&&(!n||t.scrollHeight>cn(t))})).reverse()}function Rn(t){return t===qn(t)?window:t}function qn(t){t=R(t).document;return t.scrollingElement||t.documentElement}var Un={width:["x","left","right"],height:["y","top","bottom"]};function Yn(t,e,h,l,d,n,i,r){h=Gn(h),l=Gn(l);var f={element:h,target:l};if(!t||!e)return f;var o,p=sn(t),m=sn(e),g=m;return Xn(g,h,p,-1),Xn(g,l,m,1),d=Kn(d,p.width,p.height),n=Kn(n,m.width,m.height),d.x+=n.x,d.y+=n.y,g.left+=d.x,g.top+=d.y,i&&(o=Vn(e).map(Rn),r&&b(o,r)&&o.unshift(r),o=o.map(function(t){return sn(t)}),K(Un,function(t,s){var a=t[0],u=t[1],c=t[2];!0!==i&&!b(i,a)||o.some(function(n){var t=h[a]===u?-p[s]:h[a]===c?p[s]:0,e=l[a]===u?m[s]:l[a]===c?-m[s]:0;if(g[u]<n[u]||g[u]+p[s]>n[c]){var i=p[s]/2,r="center"===l[a]?-m[s]/2:0;return "center"===h[a]&&(o(i,r)||o(-i,-r))||o(t,e)}function o(e,t){t=j((g[u]+e+t-2*d[a]).toFixed(4));if(t>=n[u]&&t+p[s]<=n[c])return g[u]=t,["element","target"].forEach(function(t){f[t][a]=e?f[t][a]===Un[s][1]?Un[s][2]:Un[s][1]:f[t][a];}),!0}});})),sn(t,g),f}function Xn(r,o,s,a){K(Un,function(t,e){var n=t[0],i=t[1],t=t[2];o[n]===t?r[i]+=s[e]*a:"center"===o[n]&&(r[i]+=s[e]*a/2);});}function Gn(t){var e=/left|center|right/,n=/top|center|bottom/;return 1===(t=(t||"").split(" ")).length&&(t=e.test(t[0])?t.concat("center"):n.test(t[0])?["center"].concat(t):["center","center"]),{x:e.test(t[0])?t[0]:"center",y:n.test(t[1])?t[1]:"center"}}function Kn(t,e,n){var i=(t||"").split(" "),t=i[0],i=i[1];return {x:t?j(t)*(c(t,"%")?e/100:1):0,y:i?j(i)*(c(i,"%")?n/100:1):0}}function Jn(t){return !(!g(t,"uk-")&&!g(t,"data-uk-"))&&f(t.replace("data-uk-","").replace("uk-",""))}function Zn(t){this._init(t);}var Qn,ti,ei,ni,ii,ri,oi,si,ai;function ui(t,e){if(t)for(var n in t)t[n]._connected&&t[n]._callUpdate(e);}function ci(t,e){var n={},i=t.args;void 0===i&&(i=[]);var r=t.props;void 0===r&&(r={});var o,s=t.el;if(!r)return n;for(o in r){var a=d(o),u=at(s,a);O(u)||(u=r[o]===Boolean&&""===u||li(r[o],u),("target"!==a||u&&!g(u,"_"))&&(n[o]=u));}var c,h=Tn(at(s,e),i);for(c in h){var l=f(c);void 0!==r[l]&&(n[l]=li(r[l],h[c]));}return n}function hi(e,n,i){E(n)||(n={name:i,handler:n});var t=n.name,r=n.el,o=n.handler,s=n.capture,a=n.passive,u=n.delegate,c=n.filter,h=n.self,r=$(r)?r.call(e):r||e.$el;k(r)?r.forEach(function(t){return hi(e,X({},n,{el:t}),i)}):!r||c&&!c.call(e)||e._events.push(Yt(r,t,u?D(u)?u:u.call(e):null,D(o)?e[o]:o.bind(e),{passive:a,capture:s,self:h}));}function li(t,e){return t===Boolean?H(e):t===Number?L(e):"list"===t?k(n=e)?n:D(n)?n.split(/,(?![^(]*\))/).map(function(t){return B(t)?L(t):H(t.trim())}):[n]:t?t(e):e;var n;}Zn.util=Object.freeze({__proto__:null,ajax:le,getImage:de,transition:Je,Transition:Ze,animate:tn,Animation:nn,attr:rt,hasAttr:ot,removeAttr:st,data:at,addClass:De,removeClass:Ne,removeClasses:Be,replaceClass:Pe,hasClass:Oe,toggleClass:He,dimensions:on,offset:sn,position:an,offsetPosition:un,height:cn,width:hn,boxModelAdjust:dn,flipPosition:fn,toPx:pn,ready:fe,index:pe,getIndex:me,empty:ge,html:ve,prepend:function(e,t){return (e=Ae(e)).hasChildNodes()?ye(t,function(t){return e.insertBefore(t,e.firstChild)}):we(e,t)},append:we,before:be,after:xe,remove:ke,wrapAll:$e,wrapInner:Se,unwrap:Ie,fragment:Ce,apply:_e,$:Ae,$$:Me,inBrowser:ut,isIE:ct,isRtl:ht,hasTouch:ft,pointerDown:pt,pointerMove:mt,pointerUp:gt,pointerEnter:vt,pointerLeave:wt,pointerCancel:bt,on:Yt,off:Xt,once:Gt,trigger:Kt,createEvent:Jt,toEventTargets:ne,isTouch:ie,getEventPos:re,fastdom:gn,isVoidElement:Lt,isVisible:jt,selInput:Ft,isInput:Wt,filter:Vt,within:Rt,parents:qt,children:Ut,hasOwn:h,hyphenate:d,camelize:f,ucfirst:p,startsWith:g,endsWith:c,includes:b,findIndex:y,isArray:k,isFunction:$,isObject:S,isPlainObject:E,isWindow:T,isDocument:C,isNode:_,isElement:A,isBoolean:z,isString:D,isNumber:N,isNumeric:B,isEmpty:P,isUndefined:O,toBoolean:H,toNumber:L,toFloat:j,toArray:F,toNode:W,toNodes:V,toWindow:R,toMs:q,isEqual:U,swap:Y,assign:X,last:G,each:K,sortBy:J,uniqueBy:Z,clamp:Q,noop:tt,intersectRect:et,pointInRect:nt,Dimensions:it,MouseTracker:kn,mergeOptions:En,parseOptions:Tn,play:Cn,pause:_n,mute:An,positionAt:Yn,Promise:se,Deferred:oe,query:xt,queryAll:yt,find:$t,findAll:St,matches:zt,closest:Nt,parent:Bt,escape:Ot,css:Ve,getStyles:Re,getStyle:qe,getCssVar:Ye,propName:Ge,isInView:Ln,scrollTop:jn,scrollIntoView:Fn,scrolledOver:Wn,scrollParents:Vn,getViewport:Rn}),Zn.data="__uikit__",Zn.prefix="uk-",Zn.options={},Zn.version="3.6.3",ei=(Qn=Zn).data,Qn.use=function(t){if(!t.installed)return t.call(null,this),t.installed=!0,this},Qn.mixin=function(t,e){(e=(D(e)?Qn.component(e):e)||this).options=En(e.options,t);},Qn.extend=function(t){t=t||{};function e(t){this._init(t);}return ((e.prototype=Object.create(this.prototype)).constructor=e).options=En(this.options,t),e.super=this,e.extend=this.extend,e},Qn.update=function(t,e){qt(t=t?W(t):document.body).reverse().forEach(function(t){return ui(t[ei],e)}),_e(t,function(t){return ui(t[ei],e)});},Object.defineProperty(Qn,"container",{get:function(){return ti||document.body},set:function(t){ti=Ae(t);}}),(ni=Zn).prototype._callHook=function(t){var e=this,t=this.$options[t];t&&t.forEach(function(t){return t.call(e)});},ni.prototype._callConnected=function(){this._connected||(this._data={},this._computeds={},this._frames={reads:{},writes:{}},this._initProps(),this._callHook("beforeConnect"),this._connected=!0,this._initEvents(),this._initObserver(),this._callHook("connected"),this._callUpdate());},ni.prototype._callDisconnected=function(){this._connected&&(this._callHook("beforeDisconnect"),this._observer&&(this._observer.disconnect(),this._observer=null),this._unbindEvents(),this._callHook("disconnected"),this._connected=!1);},ni.prototype._callUpdate=function(t){var r=this;void 0===t&&(t="update");var o=t.type||t;b(["update","resize"],o)&&this._callWatches();var e=this.$options.update,t=this._frames,s=t.reads,a=t.writes;e&&e.forEach(function(t,e){var n=t.read,i=t.write,t=t.events;"update"!==o&&!b(t,o)||(n&&!b(gn.reads,s[e])&&(s[e]=gn.read(function(){var t=r._connected&&n.call(r,r._data,o);!1===t&&i?gn.clear(a[e]):E(t)&&X(r._data,t);})),i&&!b(gn.writes,a[e])&&(a[e]=gn.write(function(){return r._connected&&i.call(r,r._data,o)})));});},ni.prototype._callWatches=function(){var a,u=this,c=this._frames;c._watch||(a=!h(c,"_watch"),c._watch=gn.read(function(){if(u._connected){var t,e=u.$options.computed,n=u._computeds;for(t in e){var i=h(n,t),r=n[t];delete n[t];var o=e[t],s=o.watch,o=o.immediate;s&&(a&&o||i&&!U(r,u[t]))&&s.call(u,u[t],r);}c._watch=null;}}));},ri=0,(ii=Zn).prototype._init=function(t){(t=t||{}).data=function(t,e){var n=t.data,i=(t.el,e.args),r=e.props;void 0===r&&(r={});if(n=k(n)?P(i)?void 0:n.slice(0,i.length).reduce(function(t,e,n){return E(e)?X(t,e):t[i[n]]=e,t},{}):n)for(var o in n)O(n[o])?delete n[o]:n[o]=r[o]?li(r[o],n[o]):n[o];return n}(t,this.constructor.options),this.$options=En(this.constructor.options,t,this),this.$el=null,this.$props={},this._uid=ri++,this._initData(),this._initMethods(),this._initComputeds(),this._callHook("created"),t.el&&this.$mount(t.el);},ii.prototype._initData=function(){var t,e=this.$options.data;for(t in void 0===e&&(e={}),e)this.$props[t]=this[t]=e[t];},ii.prototype._initMethods=function(){var t=this.$options.methods;if(t)for(var e in t)this[e]=t[e].bind(this);},ii.prototype._initComputeds=function(){var t=this.$options.computed;if(this._computeds={},t)for(var e in t)!function(i,r,o){Object.defineProperty(i,r,{enumerable:!0,get:function(){var t=i._computeds,e=i.$props,n=i.$el;return h(t,r)||(t[r]=(o.get||o).call(i,e,n)),t[r]},set:function(t){var e=i._computeds;e[r]=o.set?o.set.call(i,t):t,O(e[r])&&delete e[r];}});}(this,e,t[e]);},ii.prototype._initProps=function(t){for(var e in t=t||ci(this.$options,this.$name))O(t[e])||(this.$props[e]=t[e]);var n=[this.$options.computed,this.$options.methods];for(e in this.$props)e in t&&function(t,e){return t.every(function(t){return !t||!h(t,e)})}(n,e)&&(this[e]=this.$props[e]);},ii.prototype._initEvents=function(){var n=this;this._events=[];var t=this.$options.events;t&&t.forEach(function(t){if(h(t,"handler"))hi(n,t);else for(var e in t)hi(n,t[e],e);});},ii.prototype._unbindEvents=function(){this._events.forEach(function(t){return t()}),delete this._events;},ii.prototype._initObserver=function(){var i=this,t=this.$options,r=t.attrs,e=t.props,t=t.el;!this._observer&&e&&!1!==r&&(r=k(r)?r:Object.keys(e),this._observer=new MutationObserver(function(t){var n=ci(i.$options,i.$name);t.some(function(t){var e=t.attributeName,t=e.replace("data-","");return (t===i.$name?r:[f(t),f(e)]).some(function(t){return !O(n[t])&&n[t]!==i.$props[t]})})&&i.$reset();}),e=r.map(d).concat(this.$name),this._observer.observe(t,{attributes:!0,attributeFilter:e.concat(e.map(function(t){return "data-"+t}))}));},si=(oi=Zn).data,ai={},oi.component=function(s,t){var e=d(s);if(s=f(e),!t)return E(ai[s])&&(ai[s]=oi.extend(ai[s])),ai[s];oi[s]=function(t,n){for(var e=arguments.length,i=Array(e);e--;)i[e]=arguments[e];var r=oi.component(s);return r.options.functional?new r({data:E(t)?t:[].concat(i)}):t?Me(t).map(o)[0]:o(t);function o(t){var e=oi.getComponent(t,s);if(e){if(!n)return e;e.$destroy();}return new r({el:t,data:n})}};var n=E(t)?X({},t):t.options;return n.name=s,n.install&&n.install(oi,n,s),oi._initialized&&!n.functional&&gn.read(function(){return oi[s]("[uk-"+e+"],[data-uk-"+e+"]")}),ai[s]=E(t)?n:t},oi.getComponents=function(t){return t&&t[si]||{}},oi.getComponent=function(t,e){return oi.getComponents(t)[e]},oi.connect=function(t){if(t[si])for(var e in t[si])t[si][e]._callConnected();for(var n=0;n<t.attributes.length;n++){var i=Jn(t.attributes[n].name);i&&i in ai&&oi[i](t);}},oi.disconnect=function(t){for(var e in t[si])t[si][e]._callDisconnected();},function(i){var r=i.data;i.prototype.$create=function(t,e,n){return i[t](e,n)},i.prototype.$mount=function(t){var e=this.$options.name;t[r]||(t[r]={}),t[r][e]||((t[r][e]=this).$el=this.$options.el=this.$options.el||t,Rt(t,document)&&this._callConnected());},i.prototype.$reset=function(){this._callDisconnected(),this._callConnected();},i.prototype.$destroy=function(t){void 0===t&&(t=!1);var e=this.$options,n=e.el,e=e.name;n&&this._callDisconnected(),this._callHook("destroy"),n&&n[r]&&(delete n[r][e],P(n[r])||delete n[r],t&&ke(this.$el));},i.prototype.$emit=function(t){this._callUpdate(t);},i.prototype.$update=function(t,e){void 0===t&&(t=this.$el),i.update(t,e);},i.prototype.$getComponent=i.getComponent;var e={};Object.defineProperties(i.prototype,{$container:Object.getOwnPropertyDescriptor(i,"container"),$name:{get:function(){var t=this.$options.name;return e[t]||(e[t]=i.prefix+d(t)),e[t]}}});}(Zn);var di={connected:function(){Oe(this.$el,this.$name)||De(this.$el,this.$name);}},fi={props:{cls:Boolean,animation:"list",duration:Number,origin:String,transition:String},data:{cls:!1,animation:[!1],duration:200,origin:!1,transition:"linear",clsEnter:"uk-togglabe-enter",clsLeave:"uk-togglabe-leave",initProps:{overflow:"",height:"",paddingTop:"",paddingBottom:"",marginTop:"",marginBottom:""},hideProps:{overflow:"hidden",height:0,paddingTop:0,paddingBottom:0,marginTop:0,marginBottom:0}},computed:{hasAnimation:function(t){return !!t.animation[0]},hasTransition:function(t){t=t.animation;return this.hasAnimation&&!0===t[0]}},methods:{toggleElement:function(t,i,r){var s=this;return se.all(V(t).map(function(t){var e=z(i)?i:!s.isToggled(t);if(!Kt(t,"before"+(e?"show":"hide"),[s]))return se.reject();var o,n=($(r)?r:!1!==r&&s.hasAnimation?s.hasTransition?pi(s):(o=s,function(t,e){nn.cancel(t);var n=o.animation,i=o.duration,r=o._toggle;return e?(r(t,!0),nn.in(t,n[0],i,o.origin)):nn.out(t,n[1]||n[0],i,o.origin).then(function(){return r(t,!1)})}):s._toggle)(t,e)||se.resolve();return De(t,e?s.clsEnter:s.clsLeave),Kt(t,e?"show":"hide",[s]),n.catch(tt).then(function(){return Ne(t,e?s.clsEnter:s.clsLeave)}),n.then(function(){Ne(t,e?s.clsEnter:s.clsLeave),Kt(t,e?"shown":"hidden",[s]),s.$update(t);},tt)}))},isToggled:function(t){return void 0===t&&(t=this.$el),!!Oe(this.clsEnter)||!Oe(this.clsLeave)&&(this.cls?Oe(t,this.cls.split(" ")[0]):!ot(t,"hidden"))},_toggle:function(t,e){var n;t&&(e=Boolean(e),this.cls?(n=b(this.cls," ")||e!==Oe(t,this.cls))&&He(t,this.cls,b(this.cls," ")?void 0:e):(n=e===t.hidden)&&(t.hidden=!e),Me("[autofocus]",t).some(function(t){return jt(t)?t.focus()||!0:t.blur()}),n&&(Kt(t,"toggled",[e,this]),this.$update(t)));}}};function pi(t){var o=t.isToggled,s=t.duration,a=t.initProps,u=t.hideProps,c=t.transition,h=t._toggle;return function(t,e){var n=Ze.inProgress(t),i=t.hasChildNodes?j(Ve(t.firstElementChild,"marginTop"))+j(Ve(t.lastElementChild,"marginBottom")):0,r=jt(t)?cn(t)+(n?0:i):0;Ze.cancel(t),o(t)||h(t,!0),cn(t,""),gn.flush();i=cn(t)+(n?0:i);return cn(t,r),(e?Ze.start(t,X({},a,{overflow:"hidden",height:i}),Math.round(s*(1-r/i)),c):Ze.start(t,u,Math.round(s*(r/i)),c).then(function(){return h(t,!1)})).then(function(){return Ve(t,a)})}}var mi={mixins:[di,fi],props:{targets:String,active:null,collapsible:Boolean,multiple:Boolean,toggle:String,content:String,transition:String,offset:Number},data:{targets:"> *",active:!1,animation:[!0],collapsible:!0,multiple:!1,clsOpen:"uk-open",toggle:"> .uk-accordion-title",content:"> .uk-accordion-content",transition:"ease",offset:0},computed:{items:{get:function(t,e){return Me(t.targets,e)},watch:function(t,e){var n=this;t.forEach(function(t){return gi(Ae(n.content,t),!Oe(t,n.clsOpen))}),e||Oe(t,this.clsOpen)||(t=!1!==this.active&&t[Number(this.active)]||!this.collapsible&&t[0])&&this.toggle(t,!1);},immediate:!0},toggles:function(t){var e=t.toggle;return this.items.map(function(t){return Ae(e,t)})}},events:[{name:"click",el:function(){return this.toggles},handler:function(t){t.preventDefault(),this.toggle(pe(this.toggles,t.target));}}],methods:{toggle:function(t,r){var o=this,e=[this.items[me(t,this.items)]],t=Vt(this.items,"."+this.clsOpen);this.multiple||b(t,e[0])||(e=e.concat(t)),!this.collapsible&&t.length<2&&!Vt(e,":not(."+this.clsOpen+")").length||e.forEach(function(t){return o.toggleElement(t,!Oe(t,o.clsOpen),function(e,n){He(e,o.clsOpen,n),rt(Ae(o.$props.toggle,e),"aria-expanded",n);var i=Ae((e._wrapper?"> * ":"")+o.content,e);if(!1!==r&&o.hasTransition)return e._wrapper||(e._wrapper=$e(i,"<div"+(n?" hidden":"")+">")),gi(i,!1),pi(o)(e._wrapper,n).then(function(){var t;gi(i,!n),delete e._wrapper,Ie(i),n&&(Ln(t=Ae(o.$props.toggle,e))||Fn(t,{offset:o.offset}));});gi(i,!n);})});}}};function gi(t,e){t&&(t.hidden=e);}var vi={mixins:[di,fi],args:"animation",props:{close:String},data:{animation:[!0],selClose:".uk-alert-close",duration:150,hideProps:X({opacity:0},fi.data.hideProps)},events:[{name:"click",delegate:function(){return this.selClose},handler:function(t){t.preventDefault(),this.close();}}],methods:{close:function(){var t=this;this.toggleElement(this.$el).then(function(){return t.$destroy(!0)});}}},wi={args:"autoplay",props:{automute:Boolean,autoplay:Boolean},data:{automute:!1,autoplay:!0},computed:{inView:function(t){return "inview"===t.autoplay}},connected:function(){this.inView&&!ot(this.$el,"preload")&&(this.$el.preload="none"),this.automute&&An(this.$el);},update:{read:function(){return {visible:jt(this.$el)&&"hidden"!==Ve(this.$el,"visibility"),inView:this.inView&&Ln(this.$el)}},write:function(t){var e=t.visible,t=t.inView;!e||this.inView&&!t?_n(this.$el):(!0===this.autoplay||this.inView&&t)&&Cn(this.$el);},events:["resize","scroll"]}},bi={mixins:[di,wi],props:{width:Number,height:Number},data:{automute:!0},update:{read:function(){var t=this.$el,e=function(t){for(;t=Bt(t);)if("static"!==Ve(t,"position"))return t}(t)||Bt(t),n=e.offsetHeight,e=e.offsetWidth,n=it.cover({width:this.width||t.naturalWidth||t.videoWidth||t.clientWidth,height:this.height||t.naturalHeight||t.videoHeight||t.clientHeight},{width:e+(e%2?1:0),height:n+(n%2?1:0)});return !(!n.width||!n.height)&&n},write:function(t){var e=t.height,t=t.width;Ve(this.$el,{height:e,width:t});},events:["resize"]}};var xi,yi={props:{pos:String,offset:null,flip:Boolean,clsPos:String},data:{pos:"bottom-"+(ht?"right":"left"),flip:!0,offset:!1,clsPos:""},computed:{pos:function(t){t=t.pos;return (t+(b(t,"-")?"":"-center")).split("-")},dir:function(){return this.pos[0]},align:function(){return this.pos[1]}},methods:{positionAt:function(t,e,n){Be(t,this.clsPos+"-(top|bottom|left|right)(-[a-z]+)?");var i,r=this.offset,o=this.getAxis();B(r)||(r=(i=Ae(r))?sn(i)["x"===o?"left":"top"]-sn(e)["x"===o?"right":"bottom"]:0);r=Yn(t,e,"x"===o?fn(this.dir)+" "+this.align:this.align+" "+fn(this.dir),"x"===o?this.dir+" "+this.align:this.align+" "+this.dir,"x"===o?""+("left"===this.dir?-r:r):" "+("top"===this.dir?-r:r),null,this.flip,n).target,n=r.x,r=r.y;this.dir="x"===o?n:r,this.align="x"===o?r:n,He(t,this.clsPos+"-"+this.dir+"-"+this.align,!1===this.offset);},getAxis:function(){return "top"===this.dir||"bottom"===this.dir?"y":"x"}}},ki={mixins:[yi,fi],args:"pos",props:{mode:"list",toggle:Boolean,boundary:Boolean,boundaryAlign:Boolean,delayShow:Number,delayHide:Number,clsDrop:String},data:{mode:["click","hover"],toggle:"- *",boundary:ut&&window,boundaryAlign:!1,delayShow:0,delayHide:800,clsDrop:!1,animation:["uk-animation-fade"],cls:"uk-open"},computed:{boundary:function(t,e){return xt(t.boundary,e)},clsDrop:function(t){return t.clsDrop||"uk-"+this.$options.name},clsPos:function(){return this.clsDrop}},created:function(){this.tracker=new kn;},connected:function(){De(this.$el,this.clsDrop);var t=this.$props.toggle;this.toggle=t&&this.$create("toggle",xt(t,this.$el),{target:this.$el,mode:this.mode});},disconnected:function(){this.isActive()&&(xi=null);},events:[{name:"click",delegate:function(){return "."+this.clsDrop+"-close"},handler:function(t){t.preventDefault(),this.hide(!1);}},{name:"click",delegate:function(){return 'a[href^="#"]'},handler:function(t){var e=t.defaultPrevented,t=t.current.hash;e||!t||Rt(t,this.$el)||this.hide(!1);}},{name:"beforescroll",handler:function(){this.hide(!1);}},{name:"toggle",self:!0,handler:function(t,e){t.preventDefault(),this.isToggled()?this.hide(!1):this.show(e,!1);}},{name:"toggleshow",self:!0,handler:function(t,e){t.preventDefault(),this.show(e);}},{name:"togglehide",self:!0,handler:function(t){t.preventDefault(),this.hide();}},{name:vt,filter:function(){return b(this.mode,"hover")},handler:function(t){ie(t)||this.clearTimers();}},{name:wt,filter:function(){return b(this.mode,"hover")},handler:function(t){!ie(t)&&t.relatedTarget&&this.hide();}},{name:"toggled",self:!0,handler:function(t,e){e&&(this.clearTimers(),this.position());}},{name:"show",self:!0,handler:function(){var r=this;(xi=this).tracker.init(),Gt(this.$el,"hide",Yt(document,pt,function(t){var i=t.target;return !Rt(i,r.$el)&&Gt(document,gt+" "+bt+" scroll",function(t){var e=t.defaultPrevented,n=t.type,t=t.target;e||n!==gt||i!==t||r.toggle&&Rt(i,r.toggle.$el)||r.hide(!1);},!0)}),{self:!0}),Gt(this.$el,"hide",Yt(document,"keydown",function(t){27===t.keyCode&&r.hide(!1);}),{self:!0});}},{name:"beforehide",self:!0,handler:function(){this.clearTimers();}},{name:"hide",handler:function(t){t=t.target;this.$el===t?(xi=this.isActive()?null:xi,this.tracker.cancel()):xi=null===xi&&Rt(t,this.$el)&&this.isToggled()?this:xi;}}],update:{write:function(){this.isToggled()&&!Oe(this.$el,this.clsEnter)&&this.position();},events:["resize"]},methods:{show:function(t,e){var n,i=this;if(void 0===t&&(t=this.toggle),void 0===e&&(e=!0),this.isToggled()&&t&&this.toggle&&t.$el!==this.toggle.$el&&this.hide(!1),this.toggle=t,this.clearTimers(),!this.isActive()){if(xi){if(e&&xi.isDelaying)return void(this.showTimer=setTimeout(this.show,10));for(;xi&&n!==xi&&!Rt(this.$el,xi.$el);)(n=xi).hide(!1);}this.showTimer=setTimeout(function(){return !i.isToggled()&&i.toggleElement(i.$el,!0)},e&&this.delayShow||0);}},hide:function(t){var e=this;void 0===t&&(t=!0);function n(){return e.toggleElement(e.$el,!1,!1)}var i,r;this.clearTimers(),this.isDelaying=(i=this.$el,r=[],_e(i,function(t){return "static"!==Ve(t,"position")&&r.push(t)}),r.some(function(t){return e.tracker.movesTo(t)})),t&&this.isDelaying?this.hideTimer=setTimeout(this.hide,50):t&&this.delayHide?this.hideTimer=setTimeout(n,this.delayHide):n();},clearTimers:function(){clearTimeout(this.showTimer),clearTimeout(this.hideTimer),this.showTimer=null,this.hideTimer=null,this.isDelaying=!1;},isActive:function(){return xi===this},position:function(){Ne(this.$el,this.clsDrop+"-stack"),He(this.$el,this.clsDrop+"-boundary",this.boundaryAlign);var t,e=sn(this.boundary),n=this.boundaryAlign?e:sn(this.toggle.$el);"justify"===this.align?(t="y"===this.getAxis()?"width":"height",Ve(this.$el,t,n[t])):this.$el.offsetWidth>Math.max(e.right-n.left,n.right-e.left)&&De(this.$el,this.clsDrop+"-stack"),this.positionAt(this.$el,this.boundaryAlign?this.boundary:this.toggle.$el,this.boundary);}}};var $i={mixins:[di],args:"target",props:{target:Boolean},data:{target:!1},computed:{input:function(t,e){return Ae(Ft,e)},state:function(){return this.input.nextElementSibling},target:function(t,e){t=t.target;return t&&(!0===t&&Bt(this.input)===e&&this.input.nextElementSibling||xt(t,e))}},update:function(){var t,e,n=this.target,i=this.input;!n||n[e=Wt(n)?"value":"textContent"]!==(i=i.files&&i.files[0]?i.files[0].name:zt(i,"select")&&(t=Me("option",i).filter(function(t){return t.selected})[0])?t.textContent:i.value)&&(n[e]=i);},events:[{name:"change",handler:function(){this.$update();}},{name:"reset",el:function(){return Nt(this.$el,"form")},handler:function(){this.$update();}}]},Si={update:{read:function(t){var e=Ln(this.$el);if(!e||t.isInView===e)return !1;t.isInView=e;},write:function(){this.$el.src=""+this.$el.src;},events:["scroll","resize"]}},Ii={props:{margin:String,firstColumn:Boolean},data:{margin:"uk-margin-small-top",firstColumn:"uk-first-column"},update:{read:function(){var n,t=Ei(this.$el.children);return {rows:t,columns:(n=[[]],t.forEach(function(t){return Ti(t,"left","right").forEach(function(t,e){return n[e]=n[e]?n[e].concat(t):t})}),ht?n.reverse():n)}},write:function(t){var n=this,i=t.columns;t.rows.forEach(function(t,e){return t.forEach(function(t){He(t,n.margin,0!==e),He(t,n.firstColumn,b(i[0],t));})});},events:["resize"]}};function Ei(t){return Ti(t,"top","bottom")}function Ti(t,e,n){for(var i=[[]],r=0;r<t.length;r++){var o=t[r];if(jt(o))for(var s=Ci(o),a=i.length-1;0<=a;a--){var u=i[a];if(!u[0]){u.push(o);break}var c=void 0,c=u[0].offsetParent===o.offsetParent?Ci(u[0]):(s=Ci(o,!0),Ci(u[0],!0));if(s[e]>=c[n]-1&&s[e]!==c[e]){i.push([o]);break}if(s[n]-1>c[e]||s[e]===c[e]){u.push(o);break}if(0===a){i.unshift([o]);break}}}return i}function Ci(t,e){void 0===e&&(e=!1);var n=t.offsetTop,i=t.offsetLeft,r=t.offsetHeight,o=t.offsetWidth;return e&&(n=(t=un(t))[0],i=t[1]),{top:n,left:i,bottom:n+r,right:i+o}}var _i={extends:Ii,mixins:[di],name:"grid",props:{masonry:Boolean,parallax:Number},data:{margin:"uk-grid-margin",clsStack:"uk-grid-stack",masonry:!1,parallax:0},connected:function(){this.masonry&&De(this.$el,"uk-flex-top uk-flex-wrap-top");},update:[{write:function(t){t=t.columns;He(this.$el,this.clsStack,t.length<2);},events:["resize"]},{read:function(t){var e=t.columns,n=t.rows,i=Ut(this.$el);if(!i.length||!this.masonry&&!this.parallax||Ai(this.$el))return !1;var r,o,s=!1,a=e.map(function(t){return t.reduce(function(t,e){return t+e.offsetHeight},0)}),u=(t=i,r=this.margin,j((i=t.filter(function(t){return Oe(t,r)})[0])?Ve(i,"marginTop"):Ve(t[0],"paddingLeft"))*(n.length-1)),c=Math.max.apply(Math,a)+u;this.masonry&&(e=e.map(function(t){return J(t,"offsetTop")}),t=e,o=n.map(function(t){return Math.max.apply(Math,t.map(function(t){return t.offsetHeight}))}),s=t.map(function(n){var i=0;return n.map(function(t,e){return i+=e?o[e-1]-n[e-1].offsetHeight:0})}));var h=Math.abs(this.parallax);return {padding:h=h&&a.reduce(function(t,e,n){return Math.max(t,e+u+(n%2?h:h/8)-c)},0),columns:e,translates:s,height:s?c:""}},write:function(t){var e=t.height,t=t.padding;Ve(this.$el,"paddingBottom",t||""),!1!==e&&Ve(this.$el,"height",e);},events:["resize"]},{read:function(t){t=t.height;return {scrolled:!(!this.parallax||Ai(this.$el))&&Wn(this.$el,t?t-cn(this.$el):0)*Math.abs(this.parallax)}},write:function(t){var e=t.columns,i=t.scrolled,r=t.translates;!1===i&&!r||e.forEach(function(t,n){return t.forEach(function(t,e){return Ve(t,"transform",i||r?"translateY("+((r&&-r[n][e])+(i?n%2?i:i/8:0))+"px)":"")})});},events:["scroll","resize"]}]};function Ai(t){return Ut(t).some(function(t){return "absolute"===Ve(t,"position")})}var Mi=ct?{props:{selMinHeight:String},data:{selMinHeight:!1,forceHeight:!1},computed:{elements:function(t,e){t=t.selMinHeight;return t?Me(t,e):[e]}},update:[{read:function(){Ve(this.elements,"height","");},order:-5,events:["resize"]},{write:function(){var n=this;this.elements.forEach(function(t){var e=j(Ve(t,"minHeight"));e&&(n.forceHeight||Math.round(e+dn(t,"height","content-box"))>=t.offsetHeight)&&Ve(t,"height",e);});},order:5,events:["resize"]}]}:{},zi={mixins:[Mi],args:"target",props:{target:String,row:Boolean},data:{target:"> *",row:!0,forceHeight:!0},computed:{elements:function(t,e){return Me(t.target,e)}},update:{read:function(){return {rows:(this.row?Ei(this.elements):[this.elements]).map(Di)}},write:function(t){t.rows.forEach(function(t){var n=t.heights;return t.elements.forEach(function(t,e){return Ve(t,"minHeight",n[e])})});},events:["resize"]}};function Di(t){if(t.length<2)return {heights:[""],elements:t};var n=t.map(Bi),i=Math.max.apply(Math,n),e=t.some(function(t){return t.style.minHeight}),r=t.some(function(t,e){return !t.style.minHeight&&n[e]<i});return e&&r&&(Ve(t,"minHeight",""),n=t.map(Bi),i=Math.max.apply(Math,n)),{heights:n=t.map(function(t,e){return n[e]===i&&j(t.style.minHeight).toFixed(2)!==i.toFixed(2)?"":i}),elements:t}}var Ni="uk-display-block";function Bi(t){jt(t)||De(t,Ni);var e=on(t).height-dn(t,"height","content-box");return Ne(t,Ni),e}var Pi={mixins:[Mi],props:{expand:Boolean,offsetTop:Boolean,offsetBottom:Boolean,minHeight:Number},data:{expand:!1,offsetTop:!1,offsetBottom:!1,minHeight:0},update:{read:function(t){var e=t.minHeight;if(!jt(this.$el))return !1;var n="",i=dn(this.$el,"height","content-box");if(this.expand){if(this.$el.dataset.heightExpand="",Ae("[data-height-expand]")!==this.$el)return !1;n=cn(window)-(on(document.documentElement).height-on(this.$el).height)-i||"";}else {n="calc(100vh";this.offsetTop&&(n+=0<(t=sn(this.$el).top)&&t<cn(window)/2?" - "+t+"px":""),!0===this.offsetBottom?n+=" - "+on(this.$el.nextElementSibling).height+"px":B(this.offsetBottom)?n+=" - "+this.offsetBottom+"vh":this.offsetBottom&&c(this.offsetBottom,"px")?n+=" - "+j(this.offsetBottom)+"px":D(this.offsetBottom)&&(n+=" - "+on(xt(this.offsetBottom,this.$el)).height+"px"),n+=(i?" - "+i+"px":"")+")";}return {minHeight:n,prev:e}},write:function(t){var e=t.minHeight,t=t.prev;Ve(this.$el,{minHeight:e}),e!==t&&this.$update(this.$el,"resize"),this.minHeight&&j(Ve(this.$el,"minHeight"))<this.minHeight&&Ve(this.$el,"minHeight",this.minHeight);},events:["resize"]}},Oi={args:"src",props:{id:Boolean,icon:String,src:String,style:String,width:Number,height:Number,ratio:Number,class:String,strokeAnimation:Boolean,focusable:Boolean,attributes:"list"},data:{ratio:1,include:["style","class","focusable"],class:"",strokeAnimation:!1},beforeConnect:function(){this.class+=" uk-svg";},connected:function(){var t,e=this;!this.icon&&b(this.src,"#")&&(t=this.src.split("#"),this.src=t[0],this.icon=t[1]),this.svg=this.getSvg().then(function(t){return e.applyAttributes(t),e.svgEl=function(t,e){if(Lt(e)||"CANVAS"===e.tagName){e.hidden=!0;var n=e.nextElementSibling;return Wi(t,n)?n:xe(e,t)}n=e.lastElementChild;return Wi(t,n)?n:we(e,t)}(t,e.$el)},tt);},disconnected:function(){var e=this;Lt(this.$el)&&(this.$el.hidden=!1),this.svg&&this.svg.then(function(t){return (!e._connected||t!==e.svgEl)&&ke(t)},tt),this.svg=this.svgEl=null;},update:{read:function(){return !!(this.strokeAnimation&&this.svgEl&&jt(this.svgEl))},write:function(){var t,e;t=this.svgEl,(e=Fi(t))&&t.style.setProperty("--uk-animation-stroke",e);},type:["resize"]},methods:{getSvg:function(){var e=this;return function(n){if(Hi[n])return Hi[n];return Hi[n]=new se(function(e,t){n?g(n,"data:")?e(decodeURIComponent(n.split(",")[1])):le(n).then(function(t){return e(t.response)},function(){return t("SVG not found.")}):t();})}(this.src).then(function(t){return function(t,e){e&&b(t,"<symbol")&&(t=function(t,e){if(!ji[t]){var n;for(ji[t]={},Li.lastIndex=0;n=Li.exec(t);)ji[t][n[3]]='<svg xmlns="http://www.w3.org/2000/svg"'+n[1]+"svg>";}return ji[t][e]}(t,e)||t);return (t=Ae(t.substr(t.indexOf("<svg"))))&&t.hasChildNodes()&&t}(t,e.icon)||se.reject("SVG not found.")})},applyAttributes:function(n){var t,e,i=this;for(t in this.$options.props)this[t]&&b(this.include,t)&&rt(n,t,this[t]);for(e in this.attributes){var r=this.attributes[e].split(":",2),o=r[0],r=r[1];rt(n,o,r);}this.id||st(n,"id");var s=["width","height"],a=[this.width,this.height];a.some(function(t){return t})||(a=s.map(function(t){return rt(n,t)}));var u=rt(n,"viewBox");u&&!a.some(function(t){return t})&&(a=u.split(" ").slice(2)),a.forEach(function(t,e){(t=(0|t)*i.ratio)&&rt(n,s[e],t),t&&!a[1^e]&&st(n,s[1^e]);}),rt(n,"data-svg",this.icon||this.src);}}},Hi={};var Li=/<symbol([^]*?id=(['"])(.+?)\2[^]*?<\/)symbol>/g,ji={};function Fi(t){return Math.ceil(Math.max.apply(Math,[0].concat(Me("[stroke]",t).map(function(t){try{return t.getTotalLength()}catch(t){return 0}}))))}function Wi(t,e){return rt(t,"data-svg")===rt(e,"data-svg")}var Vi={spinner:'<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" cx="15" cy="15" r="14"/></svg>',totop:'<svg width="18" height="10" viewBox="0 0 18 10" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.2" points="1 9 9 1 17 9 "/></svg>',marker:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="4" width="1" height="11"/><rect x="4" y="9" width="11" height="1"/></svg>',"close-icon":'<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><line fill="none" stroke="#000" stroke-width="1.1" x1="1" y1="1" x2="13" y2="13"/><line fill="none" stroke="#000" stroke-width="1.1" x1="13" y1="1" x2="1" y2="13"/></svg>',"close-large":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><line fill="none" stroke="#000" stroke-width="1.4" x1="1" y1="1" x2="19" y2="19"/><line fill="none" stroke="#000" stroke-width="1.4" x1="19" y1="1" x2="1" y2="19"/></svg>',"navbar-toggle-icon":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect y="9" width="20" height="2"/><rect y="3" width="20" height="2"/><rect y="15" width="20" height="2"/></svg>',"overlay-icon":'<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="19" y="0" width="1" height="40"/><rect x="0" y="19" width="40" height="1"/></svg>',"pagination-next":'<svg width="7" height="12" viewBox="0 0 7 12" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.2" points="1 1 6 6 1 11"/></svg>',"pagination-previous":'<svg width="7" height="12" viewBox="0 0 7 12" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.2" points="6 1 1 6 6 11"/></svg>',"search-icon":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="9" cy="9" r="7"/><path fill="none" stroke="#000" stroke-width="1.1" d="M14,14 L18,18 L14,14 Z"/></svg>',"search-large":'<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.8" cx="17.5" cy="17.5" r="16.5"/><line fill="none" stroke="#000" stroke-width="1.8" x1="38" y1="39" x2="29" y2="30"/></svg>',"search-navbar":'<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="10.5" cy="10.5" r="9.5"/><line fill="none" stroke="#000" stroke-width="1.1" x1="23" y1="23" x2="17" y2="17"/></svg>',"slidenav-next":'<svg width="14px" height="24px" viewBox="0 0 14 24" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.4" points="1.225,23 12.775,12 1.225,1 "/></svg>',"slidenav-next-large":'<svg width="25px" height="40px" viewBox="0 0 25 40" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="2" points="4.002,38.547 22.527,20.024 4,1.5 "/></svg>',"slidenav-previous":'<svg width="14px" height="24px" viewBox="0 0 14 24" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.4" points="12.775,1 1.225,12 12.775,23 "/></svg>',"slidenav-previous-large":'<svg width="25px" height="40px" viewBox="0 0 25 40" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="2" points="20.527,1.5 2,20.024 20.525,38.547 "/></svg>'},Ri={install:function(r){r.icon.add=function(t,e){var n,i=D(t)?((n={})[t]=e,n):t;K(i,function(t,e){Vi[e]=t,delete Ki[e];}),r._initialized&&_e(document.body,function(t){return K(r.getComponents(t),function(t){t.$options.isIcon&&t.icon in i&&t.$reset();})});};},extends:Oi,args:"icon",props:["icon"],data:{include:["focusable"]},isIcon:!0,beforeConnect:function(){De(this.$el,"uk-icon");},methods:{getSvg:function(){var t=function(t){if(!Vi[t])return null;Ki[t]||(Ki[t]=Ae((Vi[function(t){return ht?Y(Y(t,"left","right"),"previous","next"):t}(t)]||Vi[t]).trim()));return Ki[t].cloneNode(!0)}(this.icon);return t?se.resolve(t):se.reject("Icon not found.")}}},qi={args:!1,extends:Ri,data:function(t){return {icon:d(t.constructor.options.name)}},beforeConnect:function(){De(this.$el,this.$name);}},Ui={extends:qi,beforeConnect:function(){De(this.$el,"uk-slidenav");},computed:{icon:function(t,e){t=t.icon;return Oe(e,"uk-slidenav-large")?t+"-large":t}}},Yi={extends:qi,computed:{icon:function(t,e){t=t.icon;return Oe(e,"uk-search-icon")&&qt(e,".uk-search-large").length?"search-large":qt(e,".uk-search-navbar").length?"search-navbar":t}}},Xi={extends:qi,computed:{icon:function(){return "close-"+(Oe(this.$el,"uk-close-large")?"large":"icon")}}},Gi={extends:qi,connected:function(){var e=this;this.svg.then(function(t){return 1!==e.ratio&&Ve(Ae("circle",t),"strokeWidth",1/e.ratio)},tt);}},Ki={};var Ji={args:"dataSrc",props:{dataSrc:String,dataSrcset:Boolean,sizes:String,width:Number,height:Number,offsetTop:String,offsetLeft:String,target:String},data:{dataSrc:"",dataSrcset:!1,sizes:!1,width:!1,height:!1,offsetTop:"50vh",offsetLeft:"50vw",target:!1},computed:{cacheKey:function(t){t=t.dataSrc;return this.$name+"."+t},width:function(t){var e=t.width,t=t.dataWidth;return e||t},height:function(t){var e=t.height,t=t.dataHeight;return e||t},sizes:function(t){var e=t.sizes,t=t.dataSizes;return e||t},isImg:function(t,e){return rr(e)},target:{get:function(t){t=t.target;return [this.$el].concat(yt(t,this.$el))},watch:function(){this.observe();}},offsetTop:function(t){return pn(t.offsetTop,"height")},offsetLeft:function(t){return pn(t.offsetLeft,"width")}},connected:function(){window.IntersectionObserver?(sr[this.cacheKey]?Zi(this.$el,sr[this.cacheKey],this.dataSrcset,this.sizes):this.isImg&&this.width&&this.height&&Zi(this.$el,function(t,e,n){n&&(n=it.ratio({width:t,height:e},"width",pn(tr(n))),t=n.width,e=n.height);return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="'+t+'" height="'+e+'"></svg>'}(this.width,this.height,this.sizes)),this.observer=new IntersectionObserver(this.load,{rootMargin:this.offsetTop+"px "+this.offsetLeft+"px"}),requestAnimationFrame(this.observe)):Zi(this.$el,this.dataSrc,this.dataSrcset,this.sizes);},disconnected:function(){this.observer&&this.observer.disconnect();},update:{read:function(t){var e=this,t=t.image;return !!this.observer&&(t||"complete"!==document.readyState||this.load(this.observer.takeRecords()),!this.isImg&&void(t&&t.then(function(t){return t&&""!==t.currentSrc&&Zi(e.$el,or(t))})))},write:function(t){var e,n,i;this.dataSrcset&&1!==window.devicePixelRatio&&(!(n=Ve(this.$el,"backgroundSize")).match(/^(auto\s?)+$/)&&j(n)!==t.bgSize||(t.bgSize=(e=this.dataSrcset,n=this.sizes,i=pn(tr(n)),(e=(e.match(ir)||[]).map(j).sort(function(t,e){return t-e})).filter(function(t){return i<=t})[0]||e.pop()||""),Ve(this.$el,"backgroundSize",t.bgSize+"px")));},events:["resize"]},methods:{load:function(t){var e=this;t.some(function(t){return O(t.isIntersecting)||t.isIntersecting})&&(this._data.image=de(this.dataSrc,this.dataSrcset,this.sizes).then(function(t){return Zi(e.$el,or(t),t.srcset,t.sizes),sr[e.cacheKey]=or(t),t},function(t){return Kt(e.$el,new t.constructor(t.type,t))}),this.observer.disconnect());},observe:function(){var e=this;this._connected&&!this._data.image&&this.target.forEach(function(t){return e.observer.observe(t)});}}};function Zi(t,e,n,i){rr(t)?(i&&(t.sizes=i),n&&(t.srcset=n),e&&(t.src=e)):e&&!b(t.style.backgroundImage,e)&&(Ve(t,"backgroundImage","url("+Ot(e)+")"),Kt(t,Jt("load",!1)));}var Qi=/\s*(.*?)\s*(\w+|calc\(.*?\))\s*(?:,|$)/g;function tr(t){var e,n;for(Qi.lastIndex=0;e=Qi.exec(t);)if(!e[1]||window.matchMedia(e[1]).matches){e=g(n=e[2],"calc")?n.slice(5,-1).replace(er,function(t){return pn(t)}).replace(/ /g,"").match(nr).reduce(function(t,e){return t+ +e},0):n;break}return e||"100vw"}var er=/\d+(?:\w+|%)/g,nr=/[+-]?(\d+)/g;var ir=/\s+\d+w\s*(?:,|$)/g;function rr(t){return "IMG"===t.tagName}function or(t){return t.currentSrc||t.src}var sr,ar="__test__";try{(sr=window.sessionStorage||{})[ar]=1,delete sr[ar];}catch(t){sr={};}var ur={props:{media:Boolean},data:{media:!1},computed:{matchMedia:function(){var t=function(t){if(D(t))if("@"===t[0])t=j(Ye("breakpoint-"+t.substr(1)));else if(isNaN(t))return t;return !(!t||isNaN(t))&&"(min-width: "+t+"px)"}(this.media);return !t||window.matchMedia(t).matches}}};var cr={mixins:[di,ur],props:{fill:String},data:{fill:"",clsWrapper:"uk-leader-fill",clsHide:"uk-leader-hide",attrFill:"data-fill"},computed:{fill:function(t){return t.fill||Ye("leader-fill-content")}},connected:function(){var t=Se(this.$el,'<span class="'+this.clsWrapper+'">');this.wrapper=t[0];},disconnected:function(){Ie(this.wrapper.childNodes);},update:{read:function(t){var e=t.changed,n=t.width,t=n;return {width:n=Math.floor(this.$el.offsetWidth/2),fill:this.fill,changed:e||t!==n,hide:!this.matchMedia}},write:function(t){He(this.wrapper,this.clsHide,t.hide),t.changed&&(t.changed=!1,rt(this.wrapper,this.attrFill,new Array(t.width).join(t.fill)));},events:["resize"]}},hr={props:{container:Boolean},data:{container:!0},computed:{container:function(t){t=t.container;return !0===t&&this.$container||t&&Ae(t)}}},lr=[],dr={mixins:[di,hr,fi],props:{selPanel:String,selClose:String,escClose:Boolean,bgClose:Boolean,stack:Boolean},data:{cls:"uk-open",escClose:!0,bgClose:!0,overlay:!0,stack:!1},computed:{panel:function(t,e){return Ae(t.selPanel,e)},transitionElement:function(){return this.panel},bgClose:function(t){return t.bgClose&&this.panel}},beforeDisconnect:function(){this.isToggled()&&this.toggleElement(this.$el,!1,!1);},events:[{name:"click",delegate:function(){return this.selClose},handler:function(t){t.preventDefault(),this.hide();}},{name:"toggle",self:!0,handler:function(t){t.defaultPrevented||(t.preventDefault(),this.isToggled()===b(lr,this)&&this.toggle());}},{name:"beforeshow",self:!0,handler:function(t){if(b(lr,this))return !1;!this.stack&&lr.length?(se.all(lr.map(function(t){return t.hide()})).then(this.show),t.preventDefault()):lr.push(this);}},{name:"show",self:!0,handler:function(){var r=this;hn(window)-hn(document)&&this.overlay&&Ve(document.body,"overflowY","scroll"),this.stack&&Ve(this.$el,"zIndex",j(Ve(this.$el,"zIndex"))+lr.length),De(document.documentElement,this.clsPage),this.bgClose&&Gt(this.$el,"hide",Yt(document,pt,function(t){var i=t.target;G(lr)!==r||r.overlay&&!Rt(i,r.$el)||Rt(i,r.panel)||Gt(document,gt+" "+bt+" scroll",function(t){var e=t.defaultPrevented,n=t.type,t=t.target;e||n!==gt||i!==t||r.hide();},!0);}),{self:!0}),this.escClose&&Gt(this.$el,"hide",Yt(document,"keydown",function(t){27===t.keyCode&&G(lr)===r&&r.hide();}),{self:!0});}},{name:"hidden",self:!0,handler:function(){var e=this;lr.splice(lr.indexOf(this),1),lr.length||Ve(document.body,"overflowY",""),Ve(this.$el,"zIndex",""),lr.some(function(t){return t.clsPage===e.clsPage})||Ne(document.documentElement,this.clsPage);}}],methods:{toggle:function(){return this.isToggled()?this.hide():this.show()},show:function(){var e=this;return this.container&&Bt(this.$el)!==this.container?(we(this.container,this.$el),new se(function(t){return requestAnimationFrame(function(){return e.show().then(t)})})):this.toggleElement(this.$el,!0,fr(this))},hide:function(){return this.toggleElement(this.$el,!1,fr(this))}}};function fr(t){var s=t.transitionElement,a=t._toggle;return function(r,o){return new se(function(n,i){return Gt(r,"show hide",function(){r._reject&&r._reject(),r._reject=i,a(r,o);var t=Gt(s,"transitionstart",function(){Gt(s,"transitionend transitioncancel",n,{self:!0}),clearTimeout(e);},{self:!0}),e=setTimeout(function(){t(),n();},q(Ve(s,"transitionDuration")));})}).then(function(){return delete r._reject})}}var pr={install:function(t){var a=t.modal;function i(t,e,n,i){e=X({bgClose:!1,escClose:!0,labels:a.labels},e);var r=a.dialog(t(e),e),o=new oe,s=!1;return Yt(r.$el,"submit","form",function(t){t.preventDefault(),o.resolve(i&&i(r)),s=!0,r.hide();}),Yt(r.$el,"hide",function(){return !s&&n(o)}),o.promise.dialog=r,o.promise}a.dialog=function(t,e){var n=a('<div class="uk-modal"> <div class="uk-modal-dialog">'+t+"</div> </div>",e);return n.show(),Yt(n.$el,"hidden",function(){return se.resolve().then(function(){return n.$destroy(!0)})},{self:!0}),n},a.alert=function(e,t){return i(function(t){t=t.labels;return '<div class="uk-modal-body">'+(D(e)?e:ve(e))+'</div> <div class="uk-modal-footer uk-text-right"> <button class="uk-button uk-button-primary uk-modal-close" autofocus>'+t.ok+"</button> </div>"},t,function(t){return t.resolve()})},a.confirm=function(e,t){return i(function(t){t=t.labels;return '<form> <div class="uk-modal-body">'+(D(e)?e:ve(e))+'</div> <div class="uk-modal-footer uk-text-right"> <button class="uk-button uk-button-default uk-modal-close" type="button">'+t.cancel+'</button> <button class="uk-button uk-button-primary" autofocus>'+t.ok+"</button> </div> </form>"},t,function(t){return t.reject()})},a.prompt=function(e,n,t){return i(function(t){t=t.labels;return '<form class="uk-form-stacked"> <div class="uk-modal-body"> <label>'+(D(e)?e:ve(e))+'</label> <input class="uk-input" value="'+(n||"")+'" autofocus> </div> <div class="uk-modal-footer uk-text-right"> <button class="uk-button uk-button-default uk-modal-close" type="button">'+t.cancel+'</button> <button class="uk-button uk-button-primary">'+t.ok+"</button> </div> </form>"},t,function(t){return t.resolve(null)},function(t){return Ae("input",t.$el).value})},a.labels={ok:"Ok",cancel:"Cancel"};},mixins:[dr],data:{clsPage:"uk-modal-page",selPanel:".uk-modal-dialog",selClose:".uk-modal-close, .uk-modal-close-default, .uk-modal-close-outside, .uk-modal-close-full"},events:[{name:"show",self:!0,handler:function(){Oe(this.panel,"uk-margin-auto-vertical")?De(this.$el,"uk-flex"):Ve(this.$el,"display","block"),cn(this.$el);}},{name:"hidden",self:!0,handler:function(){Ve(this.$el,"display",""),Ne(this.$el,"uk-flex");}}]};var mr={extends:mi,data:{targets:"> .uk-parent",toggle:"> a",content:"> ul"}},gr={mixins:[di,Mi],props:{dropdown:String,mode:"list",align:String,offset:Number,boundary:Boolean,boundaryAlign:Boolean,clsDrop:String,delayShow:Number,delayHide:Number,dropbar:Boolean,dropbarMode:String,dropbarAnchor:Boolean,duration:Number},data:{dropdown:".uk-navbar-nav > li",align:ht?"right":"left",clsDrop:"uk-navbar-dropdown",mode:void 0,offset:void 0,delayShow:void 0,delayHide:void 0,boundaryAlign:void 0,flip:"x",boundary:!0,dropbar:!1,dropbarMode:"slide",dropbarAnchor:!1,duration:200,forceHeight:!0,selMinHeight:".uk-navbar-nav > li > a, .uk-navbar-item, .uk-navbar-toggle"},computed:{boundary:function(t,e){var n=t.boundary,t=t.boundaryAlign;return !0===n||t?e:n},dropbarAnchor:function(t,e){return xt(t.dropbarAnchor,e)},pos:function(t){return "bottom-"+t.align},dropbar:{get:function(t){t=t.dropbar;return t?(t=this._dropbar||xt(t,this.$el)||Ae("+ .uk-navbar-dropbar",this.$el))||(this._dropbar=Ae("<div></div>")):null},watch:function(t){De(t,"uk-navbar-dropbar");},immediate:!0},dropdowns:{get:function(t,e){return Me(t.dropdown+" ."+t.clsDrop,e)},watch:function(t){var e=this;this.$create("drop",t.filter(function(t){return !e.getDropdown(t)}),X({},this.$props,{boundary:this.boundary,pos:this.pos,offset:this.dropbar||this.offset}));},immediate:!0}},disconnected:function(){this.dropbar&&ke(this.dropbar),delete this._dropbar;},events:[{name:"mouseover",delegate:function(){return this.dropdown},handler:function(t){var e=t.current,t=this.getActive();t&&t.toggle&&!Rt(t.toggle.$el,e)&&!t.tracker.movesTo(t.$el)&&t.hide(!1);}},{name:"mouseleave",el:function(){return this.dropbar},handler:function(){var t=this.getActive();t&&!this.dropdowns.some(function(t){return zt(t,":hover")})&&t.hide();}},{name:"beforeshow",capture:!0,filter:function(){return this.dropbar},handler:function(){Bt(this.dropbar)||xe(this.dropbarAnchor||this.$el,this.dropbar);}},{name:"show",filter:function(){return this.dropbar},handler:function(t,e){var n=e.$el,e=e.dir;Oe(n,this.clsDrop)&&("slide"===this.dropbarMode&&De(this.dropbar,"uk-navbar-dropbar-slide"),this.clsDrop&&De(n,this.clsDrop+"-dropbar"),"bottom"===e&&this.transitionTo(n.offsetHeight+j(Ve(n,"marginTop"))+j(Ve(n,"marginBottom")),n));}},{name:"beforehide",filter:function(){return this.dropbar},handler:function(t,e){var n=e.$el,e=this.getActive();zt(this.dropbar,":hover")&&e&&e.$el===n&&t.preventDefault();}},{name:"hide",filter:function(){return this.dropbar},handler:function(t,e){var n=e.$el;!Oe(n,this.clsDrop)||(!(e=this.getActive())||e&&e.$el===n)&&this.transitionTo(0);}}],methods:{getActive:function(){var t=this.dropdowns.map(this.getDropdown).filter(function(t){return t&&t.isActive()})[0];return t&&b(t.mode,"hover")&&Rt(t.toggle.$el,this.$el)&&t},transitionTo:function(t,e){var n=this,i=this.dropbar,r=jt(i)?cn(i):0;return Ve(e=r<t&&e,"clip","rect(0,"+e.offsetWidth+"px,"+r+"px,0)"),cn(i,r),Ze.cancel([e,i]),se.all([Ze.start(i,{height:t},this.duration),Ze.start(e,{clip:"rect(0,"+e.offsetWidth+"px,"+t+"px,0)"},this.duration)]).catch(tt).then(function(){Ve(e,{clip:""}),n.$update(i);})},getDropdown:function(t){return this.$getComponent(t,"drop")||this.$getComponent(t,"dropdown")}}},vr={mixins:[dr],args:"mode",props:{mode:String,flip:Boolean,overlay:Boolean},data:{mode:"slide",flip:!1,overlay:!1,clsPage:"uk-offcanvas-page",clsContainer:"uk-offcanvas-container",selPanel:".uk-offcanvas-bar",clsFlip:"uk-offcanvas-flip",clsContainerAnimation:"uk-offcanvas-container-animation",clsSidebarAnimation:"uk-offcanvas-bar-animation",clsMode:"uk-offcanvas",clsOverlay:"uk-offcanvas-overlay",selClose:".uk-offcanvas-close",container:!1},computed:{clsFlip:function(t){var e=t.flip,t=t.clsFlip;return e?t:""},clsOverlay:function(t){var e=t.overlay,t=t.clsOverlay;return e?t:""},clsMode:function(t){var e=t.mode;return t.clsMode+"-"+e},clsSidebarAnimation:function(t){var e=t.mode,t=t.clsSidebarAnimation;return "none"===e||"reveal"===e?"":t},clsContainerAnimation:function(t){var e=t.mode,t=t.clsContainerAnimation;return "push"!==e&&"reveal"!==e?"":t},transitionElement:function(t){return "reveal"===t.mode?Bt(this.panel):this.panel}},update:{read:function(){this.isToggled()&&!jt(this.$el)&&this.hide();},events:["resize"]},events:[{name:"click",delegate:function(){return 'a[href^="#"]'},handler:function(t){var e=t.current.hash;!t.defaultPrevented&&e&&Ae(e,document.body)&&this.hide();}},{name:"touchstart",passive:!0,el:function(){return this.panel},handler:function(t){t=t.targetTouches;1===t.length&&(this.clientY=t[0].clientY);}},{name:"touchmove",self:!0,passive:!1,filter:function(){return this.overlay},handler:function(t){t.cancelable&&t.preventDefault();}},{name:"touchmove",passive:!1,el:function(){return this.panel},handler:function(t){var e,n,i,r;1===t.targetTouches.length&&(e=event.targetTouches[0].clientY-this.clientY,n=(r=this.panel).scrollTop,((i=r.scrollHeight)<=(r=r.clientHeight)||0===n&&0<e||i-n<=r&&e<0)&&t.cancelable&&t.preventDefault());}},{name:"show",self:!0,handler:function(){"reveal"!==this.mode||Oe(Bt(this.panel),this.clsMode)||($e(this.panel,"<div>"),De(Bt(this.panel),this.clsMode)),Ve(document.documentElement,"overflowY",this.overlay?"hidden":""),De(document.body,this.clsContainer,this.clsFlip),Ve(document.body,"touch-action","pan-y pinch-zoom"),Ve(this.$el,"display","block"),De(this.$el,this.clsOverlay),De(this.panel,this.clsSidebarAnimation,"reveal"!==this.mode?this.clsMode:""),cn(document.body),De(document.body,this.clsContainerAnimation),this.clsContainerAnimation&&(wr().content+=",user-scalable=0");}},{name:"hide",self:!0,handler:function(){Ne(document.body,this.clsContainerAnimation),Ve(document.body,"touch-action","");}},{name:"hidden",self:!0,handler:function(){var t;this.clsContainerAnimation&&((t=wr()).content=t.content.replace(/,user-scalable=0$/,"")),"reveal"===this.mode&&Ie(this.panel),Ne(this.panel,this.clsSidebarAnimation,this.clsMode),Ne(this.$el,this.clsOverlay),Ve(this.$el,"display",""),Ne(document.body,this.clsContainer,this.clsFlip),Ve(document.documentElement,"overflowY","");}},{name:"swipeLeft swipeRight",handler:function(t){this.isToggled()&&c(t.type,"Left")^this.flip&&this.hide();}}]};function wr(){return Ae('meta[name="viewport"]',document.head)||we(document.head,'<meta name="viewport">')}var br={mixins:[di],props:{selContainer:String,selContent:String},data:{selContainer:".uk-modal",selContent:".uk-modal-dialog"},computed:{container:function(t,e){return Nt(e,t.selContainer)},content:function(t,e){return Nt(e,t.selContent)}},connected:function(){Ve(this.$el,"minHeight",150);},update:{read:function(){return !!(this.content&&this.container&&jt(this.$el))&&{current:j(Ve(this.$el,"maxHeight")),max:Math.max(150,cn(this.container)-(on(this.content).height-cn(this.$el)))}},write:function(t){var e=t.current,t=t.max;Ve(this.$el,"maxHeight",t),Math.round(e)!==Math.round(t)&&Kt(this.$el,"resize");},events:["resize"]}},s={props:["width","height"],connected:function(){De(this.$el,"uk-responsive-width");},update:{read:function(){return !!(jt(this.$el)&&this.width&&this.height)&&{width:hn(Bt(this.$el)),height:this.height}},write:function(t){cn(this.$el,it.contain({height:this.height,width:this.width},t).height);},events:["resize"]}},m={props:{offset:Number},data:{offset:0},methods:{scrollTo:function(t){var e=this;t=t&&Ae(t)||document.body,Kt(this.$el,"beforescroll",[this,t])&&Fn(t,{offset:this.offset}).then(function(){return Kt(e.$el,"scrolled",[e,t])});}},events:{click:function(t){t.defaultPrevented||(t.preventDefault(),this.scrollTo(Ot(decodeURIComponent(this.$el.hash)).substr(1)));}}},xr="_ukScrollspy",t={args:"cls",props:{cls:String,target:String,hidden:Boolean,offsetTop:Number,offsetLeft:Number,repeat:Boolean,delay:Number},data:function(){return {cls:!1,target:!1,hidden:!0,offsetTop:0,offsetLeft:0,repeat:!1,delay:0,inViewClass:"uk-scrollspy-inview"}},computed:{elements:{get:function(t,e){t=t.target;return t?Me(t,e):[e]},watch:function(t){this.hidden&&Ve(Vt(t,":not(."+this.inViewClass+")"),"visibility","hidden");},immediate:!0}},disconnected:function(){var e=this;this.elements.forEach(function(t){Ne(t,e.inViewClass,t[xr]?t[xr].cls:""),delete t[xr];});},update:[{read:function(t){var e=this;t.update&&this.elements.forEach(function(t){t[xr]||(t[xr]={cls:at(t,"uk-scrollspy-class")||e.cls}),t[xr].show=Ln(t,e.offsetTop,e.offsetLeft);});},write:function(i){var r=this;if(!i.update)return this.$emit(),i.update=!0;this.elements.forEach(function(e){function t(t){Ve(e,"visibility",!t&&r.hidden?"hidden":""),He(e,r.inViewClass,t),He(e,n.cls),Kt(e,t?"inview":"outview"),n.inview=t,r.$update(e);}var n=e[xr];!n.show||n.inview||n.queued?!n.show&&n.inview&&!n.queued&&r.repeat&&t(!1):(n.queued=!0,i.promise=(i.promise||se.resolve()).then(function(){return new se(function(t){return setTimeout(t,r.delay)})}).then(function(){t(!0),setTimeout(function(){n.queued=!1,r.$emit();},300);}));});},events:["scroll","resize"]}]},lt={props:{cls:String,closest:String,scroll:Boolean,overflow:Boolean,offset:Number},data:{cls:"uk-active",closest:!1,scroll:!1,overflow:!0,offset:0},computed:{links:{get:function(t,e){return Me('a[href^="#"]',e).filter(function(t){return t.hash})},watch:function(t){this.scroll&&this.$create("scroll",t,{offset:this.offset||0});},immediate:!0},targets:function(){return Me(this.links.map(function(t){return Ot(t.hash).substr(1)}).join(","))},elements:function(t){t=t.closest;return Nt(this.links,t||"*")}},update:[{read:function(){var n=this,t=this.targets.length;if(!t||!jt(this.$el))return !1;var e=Vn(this.targets,/auto|scroll/,!0)[0],i=e.scrollTop,r=e.scrollHeight,o=Rn(e),r=r-cn(o),s=!1;return i===r?s=t-1:(this.targets.every(function(t,e){if(an(t,o).top-n.offset<=0)return s=e,!0}),!1===s&&this.overflow&&(s=0)),{active:s}},write:function(t){t=t.active;this.links.forEach(function(t){return t.blur()}),Ne(this.elements,this.cls),!1!==t&&Kt(this.$el,"active",[t,De(this.elements[t],this.cls)]);},events:["scroll","resize"]}]},dt={mixins:[di,ur],props:{top:null,bottom:Boolean,offset:String,animation:String,clsActive:String,clsInactive:String,clsFixed:String,clsBelow:String,selTarget:String,widthElement:Boolean,showOnUp:Boolean,targetOffset:Number},data:{top:0,bottom:!1,offset:0,animation:"",clsActive:"uk-active",clsInactive:"",clsFixed:"uk-sticky-fixed",clsBelow:"uk-sticky-below",selTarget:"",widthElement:!1,showOnUp:!1,targetOffset:!1},computed:{offset:function(t){return pn(t.offset)},selTarget:function(t,e){t=t.selTarget;return t&&Ae(t,e)||e},widthElement:function(t,e){return xt(t.widthElement,e)||this.placeholder},isActive:{get:function(){return Oe(this.selTarget,this.clsActive)},set:function(t){t&&!this.isActive?(Pe(this.selTarget,this.clsInactive,this.clsActive),Kt(this.$el,"active")):t||Oe(this.selTarget,this.clsInactive)||(Pe(this.selTarget,this.clsActive,this.clsInactive),Kt(this.$el,"inactive"));}}},connected:function(){this.placeholder=Ae("+ .uk-sticky-placeholder",this.$el)||Ae('<div class="uk-sticky-placeholder"></div>'),this.isFixed=!1,this.isActive=!1;},disconnected:function(){this.isFixed&&(this.hide(),Ne(this.selTarget,this.clsInactive)),ke(this.placeholder),this.placeholder=null,this.widthElement=null;},events:[{name:"load hashchange popstate",el:ut&&window,handler:function(){var i,r=this;!1!==this.targetOffset&&location.hash&&0<window.pageYOffset&&((i=Ae(location.hash))&&gn.read(function(){var t=sn(i).top,e=sn(r.$el).top,n=r.$el.offsetHeight;r.isFixed&&t<=e+n&&e<=t+i.offsetHeight&&jn(window,t-n-(B(r.targetOffset)?r.targetOffset:0)-r.offset);}));}}],update:[{read:function(t,e){t=t.height;if(this.inactive=!this.matchMedia||!jt(this.$el),this.inactive)return !1;this.isActive&&"update"!==e&&(this.hide(),t=this.$el.offsetHeight,this.show()),t=this.isActive?t:this.$el.offsetHeight,this.topOffset=sn(this.isFixed?this.placeholder:this.$el).top,this.bottomOffset=this.topOffset+t;e=yr("bottom",this);return this.top=Math.max(j(yr("top",this)),this.topOffset)-this.offset,this.bottom=e&&e-this.$el.offsetHeight,this.width=on(jt(this.widthElement)?this.widthElement:this.$el).width,{height:t,top:un(this.placeholder)[0],margins:Ve(this.$el,["marginTop","marginBottom","marginLeft","marginRight"])}},write:function(t){var e=t.height,n=t.margins,t=this.placeholder;Ve(t,X({height:e},n)),Rt(t,document)||(xe(this.$el,t),t.hidden=!0),this.isActive=!!this.isActive;},events:["resize"]},{read:function(t){t=t.scroll;return void 0===t&&(t=0),this.scroll=window.pageYOffset,{dir:t<=this.scroll?"down":"up",scroll:this.scroll}},write:function(t,e){var n=this,i=Date.now(),r=t.initTimestamp;void 0===r&&(r=0);var o=t.dir,s=t.lastDir,a=t.lastScroll,u=t.scroll,c=t.top;(t.lastScroll=u)<0||u===a&&"scroll"===e||this.showOnUp&&"scroll"!==e&&!this.isFixed||((300<i-r||o!==s)&&(t.initScroll=u,t.initTimestamp=i),t.lastDir=o,this.showOnUp&&!this.isFixed&&Math.abs(t.initScroll-u)<=30&&Math.abs(a-u)<=10||(this.inactive||u<this.top||this.showOnUp&&(u<=this.top||"down"===o&&"scroll"===e||"up"===o&&!this.isFixed&&u<=this.bottomOffset)?this.isFixed?(this.isFixed=!1,this.animation&&u>this.topOffset?(nn.cancel(this.$el),nn.out(this.$el,this.animation).then(function(){return n.hide()},tt)):this.hide()):nn.inProgress(this.$el)&&u<c&&(nn.cancel(this.$el),this.hide()):this.isFixed?this.update():this.animation?(nn.cancel(this.$el),this.show(),nn.in(this.$el,this.animation).catch(tt)):this.show()));},events:["resize","scroll"]}],methods:{show:function(){this.isFixed=!0,this.update(),this.placeholder.hidden=!1;},hide:function(){this.isActive=!1,Ne(this.$el,this.clsFixed,this.clsBelow),Ve(this.$el,{position:"",top:"",width:""}),this.placeholder.hidden=!0;},update:function(){var t=0!==this.top||this.scroll>this.top,e=Math.max(0,this.offset);B(this.bottom)&&this.scroll>this.bottom-this.offset&&(e=this.bottom-this.scroll),Ve(this.$el,{position:"fixed",top:e+"px",width:this.width}),this.isActive=t,He(this.$el,this.clsBelow,this.scroll>this.bottomOffset),De(this.$el,this.clsFixed);}}};function yr(t,e){var n=e.$props,i=e.$el,e=e[t+"Offset"],t=n[t];if(t)return D(t)&&t.match(/^-?\d/)?e+pn(t):sn(!0===t?Bt(i):xt(t,i)).bottom}var kr,$r,Sr,At={mixins:[fi],args:"connect",props:{connect:String,toggle:String,active:Number,swiping:Boolean},data:{connect:"~.uk-switcher",toggle:"> * > :first-child",active:0,swiping:!0,cls:"uk-active",attrItem:"uk-switcher-item"},computed:{connects:{get:function(t,e){return yt(t.connect,e)},watch:function(t){this.swiping&&Ve(t,"touch-action","pan-y pinch-zoom");},immediate:!0},toggles:{get:function(t,e){return Me(t.toggle,e).filter(function(t){return !zt(t,".uk-disabled *, .uk-disabled, [disabled]")})},watch:function(t){var e=this.index();this.show(~e&&e||t[this.active]||t[0]);},immediate:!0},children:function(){var t=this;return Ut(this.$el).filter(function(e){return t.toggles.some(function(t){return Rt(t,e)})})}},events:[{name:"click",delegate:function(){return this.toggle},handler:function(t){t.preventDefault(),this.show(t.current);}},{name:"click",el:function(){return this.connects},delegate:function(){return "["+this.attrItem+"],[data-"+this.attrItem+"]"},handler:function(t){t.preventDefault(),this.show(at(t.current,this.attrItem));}},{name:"swipeRight swipeLeft",filter:function(){return this.swiping},el:function(){return this.connects},handler:function(t){t=t.type;this.show(c(t,"Left")?"next":"previous");}}],methods:{index:function(){var e=this;return y(this.children,function(t){return Oe(t,e.cls)})},show:function(t){var n=this,i=this.index(),r=me(this.children[me(t,this.toggles,i)],Ut(this.$el));i!==r&&(this.children.forEach(function(t,e){He(t,n.cls,r===e),rt(n.toggles[e],"aria-expanded",r===e);}),this.connects.forEach(function(t){var e=t.children;return n.toggleElement(V(e).filter(function(t,e){return e!==r&&n.isToggled(t)}),!1,0<=i).then(function(){return n.toggleElement(e[r],!0,0<=i)})}));}}},he={mixins:[di],extends:At,props:{media:Boolean},data:{media:960,attrItem:"uk-tab-item"},connected:function(){var t=Oe(this.$el,"uk-tab-left")?"uk-tab-left":!!Oe(this.$el,"uk-tab-right")&&"uk-tab-right";t&&this.$create("toggle",this.$el,{cls:t,mode:"media",media:this.media});}},Mi={mixins:[ur,fi],args:"target",props:{href:String,target:null,mode:"list",queued:Boolean},data:{href:!1,target:!1,mode:"click",queued:!0},computed:{target:{get:function(t,e){var n=t.href,t=t.target;return (t=yt(t||n,e)).length&&t||[e]},watch:function(){this.updateAria();},immediate:!0}},events:[{name:vt+" "+wt,filter:function(){return b(this.mode,"hover")},handler:function(t){ie(t)||this.toggle("toggle"+(t.type===vt?"show":"hide"));}},{name:"click",filter:function(){return b(this.mode,"click")||ft&&b(this.mode,"hover")},handler:function(t){var e;(Nt(t.target,'a[href="#"], a[href=""]')||(e=Nt(t.target,"a[href]"))&&(!Ir(this.target,this.cls)||e.hash&&zt(this.target,e.hash)))&&t.preventDefault(),this.toggle();}},{name:"toggled",self:!0,el:function(){return this.target},handler:function(t,e){this.updateAria(e);}}],update:{read:function(){return !(!b(this.mode,"media")||!this.media)&&{match:this.matchMedia}},write:function(t){var e=t.match,t=this.isToggled(this.target);(e?!t:t)&&this.toggle();},events:["resize"]},methods:{toggle:function(t){var n=this;if(Kt(this.target,t||"toggle",[this])){if(!this.queued)return this.toggleElement(this.target);var e,i=this.target.filter(function(t){return Oe(t,n.clsLeave)});i.length?this.target.forEach(function(t){var e=b(i,t);n.toggleElement(t,e,e);}):(e=this.target.filter(this.isToggled),this.toggleElement(e,!1).then(function(){return n.toggleElement(n.target.filter(function(t){return !b(e,t)}),!0)}));}},updateAria:function(t){rt(this.$el,"aria-expanded",z(t)?t:Ir(this.target,this.cls));}}};function Ir(t,e){return e?Oe(t,e.split(" ")[0]):jt(t)}K(Object.freeze({__proto__:null,Accordion:mi,Alert:vi,Cover:bi,Drop:ki,Dropdown:ki,FormCustom:$i,Gif:Si,Grid:_i,HeightMatch:zi,HeightViewport:Pi,Icon:Ri,Img:Ji,Leader:cr,Margin:Ii,Modal:pr,Nav:mr,Navbar:gr,Offcanvas:vr,OverflowAuto:br,Responsive:s,Scroll:m,Scrollspy:t,ScrollspyNav:lt,Sticky:dt,Svg:Oi,Switcher:At,Tab:he,Toggle:Mi,Video:wi,Close:Xi,Spinner:Gi,SlidenavNext:Ui,SlidenavPrevious:Ui,SearchIcon:Yi,Marker:qi,NavbarToggleIcon:qi,OverlayIcon:qi,PaginationNext:qi,PaginationPrevious:qi,Totop:qi}),function(t,e){return Zn.component(e,t)}),Zn.use(function(o){ut&&fe(function(){var t;o.update();function e(){t||(t=!0,gn.write(function(){return t=!1}),o.update(null,"resize"));}var n;Yt(window,"load resize",e),Yt(document,"loadedmetadata load",e,!0),"ResizeObserver"in window&&new ResizeObserver(e).observe(document.documentElement),Yt(window,"scroll",function(t){n||(n=!0,gn.write(function(){return n=!1}),o.update(null,t.type));},{passive:!0,capture:!0});var i,r=0;Yt(document,"animationstart",function(t){t=t.target;(Ve(t,"animationName")||"").match(/^uk-.*(left|right)/)&&(r++,Ve(document.documentElement,"overflowX","hidden"),setTimeout(function(){--r||Ve(document.documentElement,"overflowX","");},q(Ve(t,"animationDuration"))+100));},!0),Yt(document,pt,function(t){var s,a;i&&i(),ie(t)&&(s=re(t),a="tagName"in t.target?t.target:parent(t.target),i=Gt(document,gt+" "+bt,function(t){var t=re(t),r=t.x,o=t.y;(a&&r&&100<Math.abs(s.x-r)||o&&100<Math.abs(s.y-o))&&setTimeout(function(){var t,e,n,i;Kt(a,"swipe"),Kt(a,"swipe"+(t=s.x,e=s.y,n=r,i=o,Math.abs(t-n)>=Math.abs(e-i)?0<t-n?"Left":"Right":0<e-i?"Up":"Down"));});}));},{passive:!0});});}),$r=(kr=Zn).connect,Sr=kr.disconnect,ut&&window.MutationObserver&&gn.read(function(){document.body&&_e(document.body,$r);new MutationObserver(function(t){var i=[];t.forEach(function(t){return e=i,n=(t=t).target,void(("attributes"!==t.type?function(t){for(var e=t.addedNodes,n=t.removedNodes,i=0;i<e.length;i++)_e(e[i],$r);for(var r=0;r<n.length;r++)_e(n[r],Sr);return 1}:function(t){var e=t.target,n=t.attributeName;if("href"===n)return 1;t=Jn(n);if(!(t&&t in kr))return;if(ot(e,n))return kr[t](e),1;t=kr.getComponent(e,t);if(t)return t.$destroy(),1})(t)&&!e.some(function(t){return t.contains(n)})&&e.push(n.contains?n:n.parentNode));var e,n;}),i.forEach(function(t){return kr.update(t)});}).observe(document,{childList:!0,subtree:!0,characterData:!0,attributes:!0}),kr._initialized=!0;});At={mixins:[di],props:{date:String,clsWrapper:String},data:{date:"",clsWrapper:".uk-countdown-%unit%"},computed:{date:function(t){t=t.date;return Date.parse(t)},days:function(t,e){return Ae(t.clsWrapper.replace("%unit%","days"),e)},hours:function(t,e){return Ae(t.clsWrapper.replace("%unit%","hours"),e)},minutes:function(t,e){return Ae(t.clsWrapper.replace("%unit%","minutes"),e)},seconds:function(t,e){return Ae(t.clsWrapper.replace("%unit%","seconds"),e)},units:function(){var e=this;return ["days","hours","minutes","seconds"].filter(function(t){return e[t]})}},connected:function(){this.start();},disconnected:function(){var e=this;this.stop(),this.units.forEach(function(t){return ge(e[t])});},events:[{name:"visibilitychange",el:ut&&document,handler:function(){document.hidden?this.stop():this.start();}}],update:{write:function(){var i=this,r=function(t){t-=Date.now();return {total:t,seconds:t/1e3%60,minutes:t/1e3/60%60,hours:t/1e3/60/60%24,days:t/1e3/60/60/24}}(this.date);r.total<=0&&(this.stop(),r.days=r.hours=r.minutes=r.seconds=0),this.units.forEach(function(t){var e=(e=String(Math.floor(r[t]))).length<2?"0"+e:e,n=i[t];n.textContent!==e&&((e=e.split("")).length!==n.children.length&&ve(n,e.map(function(){return "<span></span>"}).join("")),e.forEach(function(t,e){return n.children[e].textContent=t}));});}},methods:{start:function(){this.stop(),this.date&&this.units.length&&(this.$update(),this.timer=setInterval(this.$update,1e3));},stop:function(){this.timer&&(clearInterval(this.timer),this.timer=null);}}};var Er="uk-transition-leave",Tr="uk-transition-enter";function Cr(t,s,a,u){void 0===u&&(u=40);var c=_r(s,!0),h={opacity:1},l={opacity:0},e=function(t){return function(){return c===_r(s)?t():se.reject()}},n=e(function(){return De(s,Er),se.all(Mr(s).map(function(e,n){return new se(function(t){return setTimeout(function(){return Ze.start(e,l,a/2,"ease").then(t)},n*u)})})).then(function(){return Ne(s,Er)})}),e=e(function(){var o=cn(s);return De(s,Tr),t(),Ve(Ut(s),{opacity:0}),new se(function(r){requestAnimationFrame(function(){var t=Ut(s),e=cn(s);cn(s,o);var n=Mr(s);Ve(t,l);var i=n.map(function(e,n){return new se(function(t){return setTimeout(function(){return Ze.start(e,h,a/2,"ease").then(t)},n*u)})});o!==e&&i.push(Ze.start(s,{height:e},a/2+n.length*u,"ease")),se.all(i).then(function(){Ne(s,Tr),c===_r(s)&&(Ve(s,"height",""),Ve(t,{opacity:""}),delete s.dataset.transition),r();});});})});return (Oe(s,Er)?Ar(s):Oe(s,Tr)?Ar(s).then(n):n()).then(e)}function _r(t,e){return e&&(t.dataset.transition=1+_r(t)),L(t.dataset.transition)||0}function Ar(t){return se.all(Ut(t).filter(Ze.inProgress).map(function(e){return new se(function(t){return Gt(e,"transitionend transitioncanceled",t)})}))}function Mr(t){return Ei(Ut(t)).reduce(function(t,e){return t.concat(J(e.filter(function(t){return Ln(t)}),"offsetLeft"))},[])}var zr,Dr="uk-animation-target";function Nr(t,n,i){zr=zr||!!we(document.head,"<style> ."+Dr+" > * {\n            margin-top: 0 !important;\n            transform: none !important;\n        } </style>");var r=Ut(n),e=r.map(function(t){return Br(t,!0)}),o=cn(n);Ze.cancel(n),r.forEach(Ze.cancel),Ne(n,Dr),Pr(n),t(),r=r.concat(Ut(n).filter(function(t){return !b(r,t)})),Kt(R(n),"resize"),gn.flush();var s,a,u,c=cn(n),e=(s=n,u=e,t=(a=r).map(function(t,e){return !!(Bt(t)&&e in u)&&(u[e]?jt(t)?Or(t):{opacity:0}:{opacity:jt(t)?1:0})}),e=t.map(function(t,e){e=Bt(a[e])===s&&(u[e]||Br(a[e]));return !!e&&(t?"opacity"in t||(e.opacity%1?t.opacity=1:delete e.opacity):delete e.opacity,e)}),[t,e]),h=e[0],l=e[1];return De(n,Dr),r.forEach(function(t,e){return l[e]&&Ve(t,l[e])}),Ve(n,{height:o,display:"block"}),new se(function(e){return requestAnimationFrame(function(){var t=r.map(function(t,e){return Ze.start(t,h[e],i,"ease")}).concat(Ze.start(n,{height:c},i,"ease"));se.all(t).then(function(){r.forEach(function(t,e){return Ve(t,{display:0===h[e].opacity?"none":"",zIndex:""})}),Pr(n);},tt).then(e);})})}function Br(t,e){var n=Ve(t,"zIndex");return !!jt(t)&&X({display:"",opacity:e?Ve(t,"opacity"):"0",pointerEvents:"none",position:"absolute",zIndex:"auto"===n?pe(t):n},Or(t))}function Pr(t){Ve(t.children,{height:"",left:"",opacity:"",pointerEvents:"",position:"",top:"",width:""}),Ne(t,Dr),Ve(t,{height:"",display:""});}function Or(t){var e=sn(t),n=e.height,e=e.width,t=an(t);return {top:t.top,left:t.left,height:n,width:e}}he={props:{duration:Number,animation:String},data:{duration:150,animation:"slide"},methods:{animate:function(t,e){return void 0===e&&(e=this.$el),("fade"===this.animation?Cr:Nr)(t,e,this.duration).then(function(){return Kt(R(e),"resize")},tt)}}},Mi={mixins:[he],args:"target",props:{target:Boolean,selActive:Boolean},data:{target:null,selActive:!1,attrItem:"uk-filter-control",cls:"uk-active",duration:250},computed:{toggles:{get:function(t,e){t.attrItem;return Me("["+this.attrItem+"],[data-"+this.attrItem+"]",e)},watch:function(){var e,n=this;this.updateState(),!1!==this.selActive&&(e=Me(this.selActive,this.$el),this.toggles.forEach(function(t){return He(t,n.cls,b(e,t))}));},immediate:!0},children:{get:function(t,e){return Me(t.target+" > *",e)},watch:function(t,e){var n;n=e,(t=t).length===n.length&&t.every(function(t){return ~n.indexOf(t)})||this.updateState();}}},events:[{name:"click",delegate:function(){return "["+this.attrItem+"],[data-"+this.attrItem+"]"},handler:function(t){t.preventDefault(),this.apply(t.current);}}],methods:{apply:function(t){this.setState(jr(t,this.attrItem,this.getState()));},getState:function(){var n=this;return this.toggles.filter(function(t){return Oe(t,n.cls)}).reduce(function(t,e){return jr(e,n.attrItem,t)},{filter:{"":""},sort:[]})},setState:function(n,i){var r=this;void 0===i&&(i=!0),n=X({filter:{"":""},sort:[]},n),Kt(this.$el,"beforeFilter",[this,n]),this.toggles.forEach(function(t){return He(t,r.cls,!!function(t,e,n){var i=n.filter;void 0===i&&(i={"":""});var r=n.sort,o=r[0],s=r[1],n=Hr(t,e),r=n.filter;void 0===r&&(r="");t=n.group;void 0===t&&(t="");e=n.sort,n=n.order;void 0===n&&(n="asc");return O(e)?t in i&&r===i[t]||!r&&t&&!(t in i)&&!i[""]:o===e&&s===n}(t,r.attrItem,n))}),se.all(Me(this.target,this.$el).map(function(t){var e=Ut(t);return i?r.animate(function(){return Lr(n,t,e)},t):Lr(n,t,e)})).then(function(){return Kt(r.$el,"afterFilter",[r])});},updateState:function(){var t=this;gn.write(function(){return t.setState(t.getState(),!1)});}}};function Hr(t,e){return Tn(at(t,e),["filter"])}function Lr(t,e,n){var i,r=(a=(a=t).filter,i="",K(a,function(t){return i+=t||""}),i);n.forEach(function(t){return Ve(t,"display",r&&!zt(t,r)?"none":"")});var o,s,a=t.sort,t=a[0],a=a[1];t&&(o=t,s=a,U(a=X([],n).sort(function(t,e){return at(t,o).localeCompare(at(e,o),void 0,{numeric:!0})*("asc"===s||-1)}),n)||we(e,a));}function jr(t,e,n){var i=Hr(t,e),r=i.filter,t=i.group,e=i.sort,i=i.order;return void 0===i&&(i="asc"),(r||O(e))&&(t?r?(delete n.filter[""],n.filter[t]=r):(delete n.filter[t],(P(n.filter)||""in n.filter)&&(n.filter={"":r||""})):n.filter={"":r||""}),O(e)||(n.sort=[e,i]),n}wi={slide:{show:function(t){return [{transform:Wr(-100*t)},{transform:Wr()}]},percent:Fr,translate:function(t,e){return [{transform:Wr(-100*e*t)},{transform:Wr(100*e*(1-t))}]}}};function Fr(t){return Math.abs(Ve(t,"transform").split(",")[4]/t.offsetWidth)||0}function Wr(t,e){return void 0===t&&(t=0),void 0===e&&(e="%"),t+=t?e:"",ct?"translateX("+t+")":"translate3d("+t+", 0, 0)"}function Vr(t){return "scale3d("+t+", "+t+", 1)"}var Rr=X({},wi,{fade:{show:function(){return [{opacity:0},{opacity:1}]},percent:function(t){return 1-Ve(t,"opacity")},translate:function(t){return [{opacity:1-t},{opacity:t}]}},scale:{show:function(){return [{opacity:0,transform:Vr(.8)},{opacity:1,transform:Vr(1)}]},percent:function(t){return 1-Ve(t,"opacity")},translate:function(t){return [{opacity:1-t,transform:Vr(1-.2*t)},{opacity:t,transform:Vr(.8+.2*t)}]}}});function qr(t,e,n){Kt(t,Jt(e,!1,!1,n));}Xi={mixins:[{props:{autoplay:Boolean,autoplayInterval:Number,pauseOnHover:Boolean},data:{autoplay:!1,autoplayInterval:7e3,pauseOnHover:!0},connected:function(){this.autoplay&&this.startAutoplay();},disconnected:function(){this.stopAutoplay();},update:function(){rt(this.slides,"tabindex","-1");},events:[{name:"visibilitychange",el:ut&&document,filter:function(){return this.autoplay},handler:function(){document.hidden?this.stopAutoplay():this.startAutoplay();}}],methods:{startAutoplay:function(){var t=this;this.stopAutoplay(),this.interval=setInterval(function(){return (!t.draggable||!Ae(":focus",t.$el))&&(!t.pauseOnHover||!zt(t.$el,":hover"))&&!t.stack.length&&t.show("next")},this.autoplayInterval);},stopAutoplay:function(){this.interval&&clearInterval(this.interval);}}},{props:{draggable:Boolean},data:{draggable:!0,threshold:10},created:function(){var i=this;["start","move","end"].forEach(function(t){var n=i[t];i[t]=function(t){var e=re(t).x*(ht?-1:1);i.prevPos=e!==i.pos?i.pos:i.prevPos,i.pos=e,n(t);};});},events:[{name:pt,delegate:function(){return this.selSlides},handler:function(t){var e;!this.draggable||!ie(t)&&(!(e=t.target).children.length&&e.childNodes.length)||Nt(t.target,Ft)||0<t.button||this.length<2||this.start(t);}},{name:"dragstart",handler:function(t){t.preventDefault();}}],methods:{start:function(){this.drag=this.pos,this._transitioner?(this.percent=this._transitioner.percent(),this.drag+=this._transitioner.getDistance()*this.percent*this.dir,this._transitioner.cancel(),this._transitioner.translate(this.percent),this.dragging=!0,this.stack=[]):this.prevIndex=this.index,Yt(document,mt,this.move,{passive:!1}),Yt(document,gt+" "+bt,this.end,!0),Ve(this.list,"userSelect","none");},move:function(t){var e=this,n=this.pos-this.drag;if(!(0==n||this.prevPos===this.pos||!this.dragging&&Math.abs(n)<this.threshold)){Ve(this.list,"pointerEvents","none"),t.cancelable&&t.preventDefault(),this.dragging=!0,this.dir=n<0?1:-1;for(var i=this.slides,r=this.prevIndex,o=Math.abs(n),s=this.getIndex(r+this.dir,r),a=this._getDistance(r,s)||i[r].offsetWidth;s!==r&&a<o;)this.drag-=a*this.dir,r=s,o-=a,s=this.getIndex(r+this.dir,r),a=this._getDistance(r,s)||i[r].offsetWidth;this.percent=o/a;var u,c=i[r],t=i[s],n=this.index!==s,h=r===s;[this.index,this.prevIndex].filter(function(t){return !b([s,r],t)}).forEach(function(t){Kt(i[t],"itemhidden",[e]),h&&(u=!0,e.prevIndex=r);}),(this.index===r&&this.prevIndex!==r||u)&&Kt(i[this.index],"itemshown",[this]),n&&(this.prevIndex=r,this.index=s,h||Kt(c,"beforeitemhide",[this]),Kt(t,"beforeitemshow",[this])),this._transitioner=this._translate(Math.abs(this.percent),c,!h&&t),n&&(h||Kt(c,"itemhide",[this]),Kt(t,"itemshow",[this]));}},end:function(){var t;Xt(document,mt,this.move,{passive:!1}),Xt(document,gt+" "+bt,this.end,!0),this.dragging&&(this.dragging=null,this.index===this.prevIndex?(this.percent=1-this.percent,this.dir*=-1,this._show(!1,this.index,!0),this._transitioner=null):(t=(ht?this.dir*(ht?1:-1):this.dir)<0==this.prevPos>this.pos,this.index=t?this.index:this.prevIndex,t&&(this.percent=1-this.percent),this.show(0<this.dir&&!t||this.dir<0&&t?"next":"previous",!0))),Ve(this.list,{userSelect:"",pointerEvents:""}),this.drag=this.percent=null;}}},{data:{selNav:!1},computed:{nav:function(t,e){return Ae(t.selNav,e)},selNavItem:function(t){t=t.attrItem;return "["+t+"],[data-"+t+"]"},navItems:function(t,e){return Me(this.selNavItem,e)}},update:{write:function(){var n=this;this.nav&&this.length!==this.nav.children.length&&ve(this.nav,this.slides.map(function(t,e){return "<li "+n.attrItem+'="'+e+'"><a href></a></li>'}).join("")),this.navItems.concat(this.nav).forEach(function(t){return t&&(t.hidden=!n.maxIndex)}),this.updateNav();},events:["resize"]},events:[{name:"click",delegate:function(){return this.selNavItem},handler:function(t){t.preventDefault(),this.show(at(t.current,this.attrItem));}},{name:"itemshow",handler:"updateNav"}],methods:{updateNav:function(){var n=this,i=this.getValidIndex();this.navItems.forEach(function(t){var e=at(t,n.attrItem);He(t,n.clsActive,L(e)===i),He(t,"uk-invisible",n.finite&&("previous"===e&&0===i||"next"===e&&i>=n.maxIndex));});}}}],props:{clsActivated:Boolean,easing:String,index:Number,finite:Boolean,velocity:Number,selSlides:String},data:function(){return {easing:"ease",finite:!1,velocity:1,index:0,prevIndex:-1,stack:[],percent:0,clsActive:"uk-active",clsActivated:!1,Transitioner:!1,transitionOptions:{}}},connected:function(){this.prevIndex=-1,this.index=this.getValidIndex(this.$props.index),this.stack=[];},disconnected:function(){Ne(this.slides,this.clsActive);},computed:{duration:function(t,e){t=t.velocity;return Ur(e.offsetWidth/t)},list:function(t,e){return Ae(t.selList,e)},maxIndex:function(){return this.length-1},selSlides:function(t){return t.selList+" "+(t.selSlides||"> *")},slides:{get:function(){return Me(this.selSlides,this.$el)},watch:function(){this.$reset();}},length:function(){return this.slides.length}},events:{itemshown:function(){this.$update(this.list);}},methods:{show:function(t,e){var n=this;if(void 0===e&&(e=!1),!this.dragging&&this.length){var i=this.stack,r=e?0:i.length,o=function(){i.splice(r,1),i.length&&n.show(i.shift(),!0);};if(i[e?"unshift":"push"](t),!e&&1<i.length)2===i.length&&this._transitioner.forward(Math.min(this.duration,200));else {var s,a=this.getIndex(this.index),u=Oe(this.slides,this.clsActive)&&this.slides[a],c=this.getIndex(t,this.index),h=this.slides[c];if(u!==h){if(this.dir=(s=a,"next"!==(t=t)&&("previous"===t||t<s)?-1:1),this.prevIndex=a,this.index=c,u&&!Kt(u,"beforeitemhide",[this])||!Kt(h,"beforeitemshow",[this,u]))return this.index=this.prevIndex,void o();e=this._show(u,h,e).then(function(){return u&&Kt(u,"itemhidden",[n]),Kt(h,"itemshown",[n]),new se(function(t){gn.write(function(){i.shift(),i.length?n.show(i.shift(),!0):n._transitioner=null,t();});})});return u&&Kt(u,"itemhide",[this]),Kt(h,"itemshow",[this]),e}o();}}},getIndex:function(t,e){return void 0===t&&(t=this.index),void 0===e&&(e=this.index),Q(me(t,this.slides,e,this.finite),0,this.maxIndex)},getValidIndex:function(t,e){return void 0===t&&(t=this.index),void 0===e&&(e=this.prevIndex),this.getIndex(t,e)},_show:function(t,e,n){if(this._transitioner=this._getTransitioner(t,e,this.dir,X({easing:n?e.offsetWidth<600?"cubic-bezier(0.25, 0.46, 0.45, 0.94)":"cubic-bezier(0.165, 0.84, 0.44, 1)":this.easing},this.transitionOptions)),!n&&!t)return this._translate(1),se.resolve();t=this.stack.length;return this._transitioner[1<t?"forward":"show"](1<t?Math.min(this.duration,75+75/(t-1)):this.duration,this.percent)},_getDistance:function(t,e){return this._getTransitioner(t,t!==e&&e).getDistance()},_translate:function(t,e,n){void 0===e&&(e=this.prevIndex),void 0===n&&(n=this.index);n=this._getTransitioner(e!==n&&e,n);return n.translate(t),n},_getTransitioner:function(t,e,n,i){return void 0===t&&(t=this.prevIndex),void 0===e&&(e=this.index),void 0===n&&(n=this.dir||1),void 0===i&&(i=this.transitionOptions),new this.Transitioner(N(t)?this.slides[t]:t,N(e)?this.slides[e]:e,n*(ht?-1:1),i)}}};function Ur(t){return .5*t+300}var Gi={mixins:[Xi],props:{animation:String},data:{animation:"slide",clsActivated:"uk-transition-active",Animations:wi,Transitioner:function(r,o,s,t){var e=t.animation,a=t.easing,n=e.percent,i=e.translate;void 0===(e=e.show)&&(e=tt);var u=e(s),c=new oe;return {dir:s,show:function(t,e,n){var i=this;void 0===e&&(e=0);n=n?"linear":a;return t-=Math.round(t*Q(e,-1,1)),this.translate(e),qr(o,"itemin",{percent:e,duration:t,timing:n,dir:s}),qr(r,"itemout",{percent:1-e,duration:t,timing:n,dir:s}),se.all([Ze.start(o,u[1],t,n),Ze.start(r,u[0],t,n)]).then(function(){i.reset(),c.resolve();},tt),c.promise},cancel:function(){Ze.cancel([o,r]);},reset:function(){for(var t in u[0])Ve([o,r],t,"");},forward:function(t,e){return void 0===e&&(e=this.percent()),Ze.cancel([o,r]),this.show(t,e,!0)},translate:function(t){this.reset();var e=i(t,s);Ve(o,e[1]),Ve(r,e[0]),qr(o,"itemtranslatein",{percent:t,dir:s}),qr(r,"itemtranslateout",{percent:1-t,dir:s});},percent:function(){return n(r||o,o,s)},getDistance:function(){return r&&r.offsetWidth}}}},computed:{animation:function(t){var e=t.animation,t=t.Animations;return X(t[e]||t.slide,{name:e})},transitionOptions:function(){return {animation:this.animation}}},events:{"itemshow itemhide itemshown itemhidden":function(t){t=t.target;this.$update(t);},beforeitemshow:function(t){De(t.target,this.clsActive);},itemshown:function(t){De(t.target,this.clsActivated);},itemhidden:function(t){Ne(t.target,this.clsActive,this.clsActivated);}}},Yr={mixins:[hr,dr,fi,Gi],functional:!0,props:{delayControls:Number,preload:Number,videoAutoplay:Boolean,template:String},data:function(){return {preload:1,videoAutoplay:!1,delayControls:3e3,items:[],cls:"uk-open",clsPage:"uk-lightbox-page",selList:".uk-lightbox-items",attrItem:"uk-lightbox-item",selClose:".uk-close-large",selCaption:".uk-lightbox-caption",pauseOnHover:!1,velocity:2,Animations:Rr,template:'<div class="uk-lightbox uk-overflow-hidden"> <ul class="uk-lightbox-items"></ul> <div class="uk-lightbox-toolbar uk-position-top uk-text-right uk-transition-slide-top uk-transition-opaque"> <button class="uk-lightbox-toolbar-icon uk-close-large" type="button" uk-close></button> </div> <a class="uk-lightbox-button uk-position-center-left uk-position-medium uk-transition-fade" href uk-slidenav-previous uk-lightbox-item="previous"></a> <a class="uk-lightbox-button uk-position-center-right uk-position-medium uk-transition-fade" href uk-slidenav-next uk-lightbox-item="next"></a> <div class="uk-lightbox-toolbar uk-lightbox-caption uk-position-bottom uk-text-center uk-transition-slide-bottom uk-transition-opaque"></div> </div>'}},created:function(){var t=Ae(this.template),e=Ae(this.selList,t);this.items.forEach(function(){return we(e,"<li>")}),this.$mount(we(this.container,t));},computed:{caption:function(t,e){t.selCaption;return Ae(".uk-lightbox-caption",e)}},events:[{name:mt+" "+pt+" keydown",handler:"showControls"},{name:"click",self:!0,delegate:function(){return this.selSlides},handler:function(t){t.defaultPrevented||this.hide();}},{name:"shown",self:!0,handler:function(){this.showControls();}},{name:"hide",self:!0,handler:function(){this.hideControls(),Ne(this.slides,this.clsActive),Ze.stop(this.slides);}},{name:"hidden",self:!0,handler:function(){this.$destroy(!0);}},{name:"keyup",el:ut&&document,handler:function(t){if(this.isToggled(this.$el)&&this.draggable)switch(t.keyCode){case 37:this.show("previous");break;case 39:this.show("next");}}},{name:"beforeitemshow",handler:function(t){this.isToggled()||(this.draggable=!1,t.preventDefault(),this.toggleElement(this.$el,!0,!1),this.animation=Rr.scale,Ne(t.target,this.clsActive),this.stack.splice(1,0,this.index));}},{name:"itemshow",handler:function(){ve(this.caption,this.getItem().caption||"");for(var t=-this.preload;t<=this.preload;t++)this.loadItem(this.index+t);}},{name:"itemshown",handler:function(){this.draggable=this.$props.draggable;}},{name:"itemload",handler:function(t,n){var i=this,r=n.source,e=n.type,o=n.alt;void 0===o&&(o="");var s,a,u,c=n.poster,h=n.attrs;void 0===h&&(h={}),this.setItem(n,"<span uk-spinner></span>"),r&&(a={frameborder:"0",allow:"autoplay",allowfullscreen:"",style:"max-width: 100%; box-sizing: border-box;","uk-responsive":"","uk-video":""+this.videoAutoplay},"image"===e||r.match(/\.(jpe?g|png|gif|svg|webp)($|\?)/i)?de(r,h.srcset,h.size).then(function(t){var e=t.width,t=t.height;return i.setItem(n,Xr("img",X({src:r,width:e,height:t,alt:o},h)))},function(){return i.setError(n)}):"video"===e||r.match(/\.(mp4|webm|ogv)($|\?)/i)?(Yt(u=Xr("video",X({src:r,poster:c,controls:"",playsinline:"","uk-video":""+this.videoAutoplay},h)),"loadedmetadata",function(){rt(u,{width:u.videoWidth,height:u.videoHeight}),i.setItem(n,u);}),Yt(u,"error",function(){return i.setError(n)})):"iframe"===e||r.match(/\.(html|php)($|\?)/i)?this.setItem(n,Xr("iframe",X({src:r,frameborder:"0",allowfullscreen:"",class:"uk-lightbox-iframe"},h))):(s=r.match(/\/\/(?:.*?youtube(-nocookie)?\..*?[?&]v=|youtu\.be\/)([\w-]{11})[&?]?(.*)?/))?this.setItem(n,Xr("iframe",X({src:"https://www.youtube"+(s[1]||"")+".com/embed/"+s[2]+(s[3]?"?"+s[3]:""),width:1920,height:1080},a,h))):(s=r.match(/\/\/.*?vimeo\.[a-z]+\/(\d+)[&?]?(.*)?/))&&le("https://vimeo.com/api/oembed.json?maxwidth=1920&url="+encodeURI(r),{responseType:"json",withCredentials:!1}).then(function(t){var e=t.response,t=e.height,e=e.width;return i.setItem(n,Xr("iframe",X({src:"https://player.vimeo.com/video/"+s[1]+(s[2]?"?"+s[2]:""),width:e,height:t},a,h)))},function(){return i.setError(n)}));}}],methods:{loadItem:function(t){void 0===t&&(t=this.index);t=this.getItem(t);this.getSlide(t).childElementCount||Kt(this.$el,"itemload",[t]);},getItem:function(t){return void 0===t&&(t=this.index),this.items[me(t,this.slides)]},setItem:function(t,e){Kt(this.$el,"itemloaded",[this,ve(this.getSlide(t),e)]);},getSlide:function(t){return this.slides[this.items.indexOf(t)]},setError:function(t){this.setItem(t,'<span uk-icon="icon: bolt; ratio: 2"></span>');},showControls:function(){clearTimeout(this.controlsTimer),this.controlsTimer=setTimeout(this.hideControls,this.delayControls),De(this.$el,"uk-active","uk-transition-active");},hideControls:function(){Ne(this.$el,"uk-active","uk-transition-active");}}};function Xr(t,e){t=Ce("<"+t+">");return rt(t,e),t}Ui={install:function(t,e){t.lightboxPanel||t.component("lightboxPanel",Yr);X(e.props,t.component("lightboxPanel").options.props);},props:{toggle:String},data:{toggle:"a"},computed:{toggles:{get:function(t,e){return Me(t.toggle,e)},watch:function(){this.hide();}}},disconnected:function(){this.hide();},events:[{name:"click",delegate:function(){return this.toggle+":not(.uk-disabled)"},handler:function(t){t.preventDefault(),this.show(t.current);}}],methods:{show:function(t){var e,n=this,i=Z(this.toggles.map(Gr),"source");return A(t)&&(e=Gr(t).source,t=y(i,function(t){t=t.source;return e===t})),this.panel=this.panel||this.$create("lightboxPanel",X({},this.$props,{items:i})),Yt(this.panel.$el,"hidden",function(){return n.panel=!1}),this.panel.show(t)},hide:function(){return this.panel&&this.panel.hide()}}};function Gr(e){var n={};return ["href","caption","type","poster","alt","attrs"].forEach(function(t){n["href"===t?"source":t]=at(e,t);}),n.attrs=Tn(n.attrs),n}qi={functional:!0,args:["message","status"],data:{message:"",status:"",timeout:5e3,group:null,pos:"top-center",clsContainer:"uk-notification",clsClose:"uk-notification-close",clsMsg:"uk-notification-message"},install:function(i){i.notification.closeAll=function(e,n){_e(document.body,function(t){t=i.getComponent(t,"notification");!t||e&&e!==t.group||t.close(n);});};},computed:{marginProp:function(t){return "margin"+(g(t.pos,"top")?"Top":"Bottom")},startProps:function(){var t={opacity:0};return t[this.marginProp]=-this.$el.offsetHeight,t}},created:function(){var t=Ae("."+this.clsContainer+"-"+this.pos,this.$container)||we(this.$container,'<div class="'+this.clsContainer+" "+this.clsContainer+"-"+this.pos+'" style="display: block"></div>');this.$mount(we(t,'<div class="'+this.clsMsg+(this.status?" "+this.clsMsg+"-"+this.status:"")+'"> <a href class="'+this.clsClose+'" data-uk-close></a> <div>'+this.message+"</div> </div>"));},connected:function(){var t,e=this,n=j(Ve(this.$el,this.marginProp));Ze.start(Ve(this.$el,this.startProps),((t={opacity:1})[this.marginProp]=n,t)).then(function(){e.timeout&&(e.timer=setTimeout(e.close,e.timeout));});},events:((Yi={click:function(t){Nt(t.target,'a[href="#"],a[href=""]')&&t.preventDefault(),this.close();}})[vt]=function(){this.timer&&clearTimeout(this.timer);},Yi[wt]=function(){this.timeout&&(this.timer=setTimeout(this.close,this.timeout));},Yi),methods:{close:function(t){function e(t){var e=Bt(t);Kt(t,"close",[n]),ke(t),e&&!e.hasChildNodes()&&ke(e);}var n=this;this.timer&&clearTimeout(this.timer),t?e(this.$el):Ze.start(this.$el,this.startProps).then(e);}}};var Kr=["x","y","bgx","bgy","rotate","scale","color","backgroundColor","borderColor","opacity","blur","hue","grayscale","invert","saturate","sepia","fopacity","stroke"],dr={mixins:[ur],props:Kr.reduce(function(t,e){return t[e]="list",t},{}),data:Kr.reduce(function(t,e){return t[e]=void 0,t},{}),computed:{props:function(f,p){var m=this;return Kr.reduce(function(t,e){if(O(f[e]))return t;var n,i,r=e.match(/color/i),o=r||"opacity"===e,s=f[e].slice();o&&Ve(p,e,""),s.length<2&&s.unshift(("scale"===e?1:o?Ve(p,e):0)||0);var a,u,c,h,l,o=s.reduce(function(t,e){return D(e)&&e.replace(/-|\d/g,"").trim()||t},"");if(r?(r=p.style.color,s=s.map(function(t){return Ve(Ve(p,"color",t),"color").split(/[(),]/g).slice(1,-1).concat(1).slice(0,4).map(j)}),p.style.color=r):g(e,"bg")?(a="bgy"===e?"height":"width",s=s.map(function(t){return pn(t,a,m.$el)}),Ve(p,"background-position-"+e[2],""),i=Ve(p,"backgroundPosition").split(" ")["x"===e[2]?0:1],n=m.covers?(u=Math.min.apply(Math,s),c=Math.max.apply(Math,s),h=s.indexOf(u)<s.indexOf(c),l=c-u,s=s.map(function(t){return t-(h?u:c)}),(h?-l:0)+"px"):i):s=s.map(j),"stroke"===e){if(!s.some(function(t){return t}))return t;var d=Fi(m.$el);Ve(p,"strokeDasharray",d),"%"===o&&(s=s.map(function(t){return t*d/100})),s=s.reverse(),e="strokeDashoffset";}return t[e]={steps:s,unit:o,pos:n,bgPos:i,diff:l},t},{})},bgProps:function(){var e=this;return ["bgx","bgy"].filter(function(t){return t in e.props})},covers:function(t,e){return i=(n=e).style.backgroundSize,e="cover"===Ve(Ve(n,"backgroundSize",""),"backgroundSize"),n.style.backgroundSize=i,e;var n,i;}},disconnected:function(){delete this._image;},update:{read:function(t){var e,n,a,u,c,h=this;t.active=this.matchMedia,t.active&&(t.image||!this.covers||!this.bgProps.length||(e=Ve(this.$el,"backgroundImage").replace(/^none|url\(["']?(.+?)["']?\)$/,"$1"))&&((n=new Image).src=e,(t.image=n).naturalWidth||(n.onload=function(){return h.$update()})),(n=t.image)&&n.naturalWidth&&(a={width:this.$el.offsetWidth,height:this.$el.offsetHeight},u={width:n.naturalWidth,height:n.naturalHeight},c=it.cover(u,a),this.bgProps.forEach(function(t){var e,n=h.props[t],i=n.diff,r=n.bgPos,o=n.steps,n="bgy"===t?"height":"width",s=c[n]-a[n];s<i?a[n]=c[n]+i-s:i<s&&((e=a[n]/pn(r,n,h.$el))&&(h.props[t].steps=o.map(function(t){return t-(s-i)/e}))),c=it.cover(u,a);}),t.dim=c));},write:function(t){var e=t.dim;t.active?e&&Ve(this.$el,{backgroundSize:e.width+"px "+e.height+"px",backgroundRepeat:"no-repeat"}):Ve(this.$el,{backgroundSize:"",backgroundRepeat:""});},events:["resize"]},methods:{reset:function(){var n=this;K(this.getCss(0),function(t,e){return Ve(n.$el,e,"")});},getCss:function(l){var d=this.props;return Object.keys(d).reduce(function(t,e){var n=d[e],i=n.steps,r=n.unit,o=n.pos,s=function(t,e,n){void 0===n&&(n=2);var i=Jr(t,e),t=i[0],e=i[1],i=i[2];return (N(t)?t+Math.abs(t-e)*i*(t<e?1:-1):+e).toFixed(n)}(i,l);switch(e){case"x":case"y":r=r||"px",t.transform+=" translate"+p(e)+"("+j(s).toFixed("px"===r?0:2)+r+")";break;case"rotate":r=r||"deg",t.transform+=" rotate("+(s+r)+")";break;case"scale":t.transform+=" scale("+s+")";break;case"bgy":case"bgx":t["background-position-"+e[2]]="calc("+o+" + "+s+"px)";break;case"color":case"backgroundColor":case"borderColor":var a=Jr(i,l),u=a[0],c=a[1],h=a[2];t[e]="rgba("+u.map(function(t,e){return t+=h*(c[e]-t),3===e?j(t):parseInt(t,10)}).join(",")+")";break;case"blur":r=r||"px",t.filter+=" blur("+(s+r)+")";break;case"hue":r=r||"deg",t.filter+=" hue-rotate("+(s+r)+")";break;case"fopacity":r=r||"%",t.filter+=" opacity("+(s+r)+")";break;case"grayscale":case"invert":case"saturate":case"sepia":r=r||"%",t.filter+=" "+e+"("+(s+r)+")";break;default:t[e]=s;}return t},{transform:"",filter:""})}}};function Jr(t,e){var n=t.length-1,i=Math.min(Math.floor(n*e),n-1),i=t.slice(i,i+2);return i.push(1===e?1:e%(1/n)*n),i}Yi={mixins:[dr],props:{target:String,viewport:Number,easing:Number},data:{target:!1,viewport:1,easing:1},computed:{target:function(t,e){t=t.target;return function t(e){return e?"offsetTop"in e?e:t(Bt(e)):document.body}(t&&xt(t,e)||e)}},update:{read:function(t,e){var n=t.percent;if("scroll"!==e&&(n=!1),t.active){var i=n;return e=Wn(this.target)/(this.viewport||1),t=this.easing,{percent:n=Q(e*(1-(t-t*e))),style:i!==n&&this.getCss(n)}}},write:function(t){var e=t.style;t.active?e&&Ve(this.$el,e):this.reset();},events:["scroll","resize"]}};ur={update:{write:function(){var t;this.stack.length||this.dragging||(t=this.getValidIndex(this.index),~this.prevIndex&&this.index===t||this.show(t));},events:["resize"]}};function Zr(t,e,n){var i=eo(t,e);return n?i-(t=t,on(e).width/2-on(t).width/2):Math.min(i,Qr(e))}function Qr(t){return Math.max(0,to(t)-on(t).width)}function to(t){return Ut(t).reduce(function(t,e){return on(e).width+t},0)}function eo(t,e){return t&&(an(t).left+(ht?on(t).width-on(e).width:0))*(ht?-1:1)||0}function no(t,e,n){Kt(t,Jt(e,!1,!1,n));}Xi={mixins:[di,Xi,ur],props:{center:Boolean,sets:Boolean},data:{center:!1,sets:!1,attrItem:"uk-slider-item",selList:".uk-slider-items",selNav:".uk-slider-nav",clsContainer:"uk-slider-container",Transitioner:function(i,r,o,t){var e=t.center,s=t.easing,a=t.list,u=new oe,n=i?Zr(i,a,e):Zr(r,a,e)+on(r).width*o,c=r?Zr(r,a,e):n+on(i).width*o*(ht?-1:1);return {dir:o,show:function(t,e,n){void 0===e&&(e=0);n=n?"linear":s;return t-=Math.round(t*Q(e,-1,1)),this.translate(e),i&&this.updateTranslates(),e=i?e:Q(e,0,1),no(this.getItemIn(),"itemin",{percent:e,duration:t,timing:n,dir:o}),i&&no(this.getItemIn(!0),"itemout",{percent:1-e,duration:t,timing:n,dir:o}),Ze.start(a,{transform:Wr(-c*(ht?-1:1),"px")},t,n).then(u.resolve,tt),u.promise},cancel:function(){Ze.cancel(a);},reset:function(){Ve(a,"transform","");},forward:function(t,e){return void 0===e&&(e=this.percent()),Ze.cancel(a),this.show(t,e,!0)},translate:function(t){var e=this.getDistance()*o*(ht?-1:1);Ve(a,"transform",Wr(Q(e-e*t-c,-to(a),on(a).width)*(ht?-1:1),"px")),this.updateTranslates(),i&&(t=Q(t,-1,1),no(this.getItemIn(),"itemtranslatein",{percent:t,dir:o}),no(this.getItemIn(!0),"itemtranslateout",{percent:1-t,dir:o}));},percent:function(){return Math.abs((Ve(a,"transform").split(",")[4]*(ht?-1:1)+n)/(c-n))},getDistance:function(){return Math.abs(c-n)},getItemIn:function(t){void 0===t&&(t=!1);var e=J(this.getActives(),"offsetLeft"),n=J(Ut(a),"offsetLeft"),e=pe(n,e[0<o*(t?-1:1)?e.length-1:0]);return ~e&&n[e+(i&&!t?o:0)]},getActives:function(){return [i||r].concat(Ut(a).filter(function(t){var e=eo(t,a);return n<e&&e+on(t).width<=on(a).width+n}))},updateTranslates:function(){var n=this.getActives();Ut(a).forEach(function(t){var e=b(n,t);no(t,"itemtranslate"+(e?"in":"out"),{percent:e?1:0,dir:t.offsetLeft<=r.offsetLeft?1:-1});});}}}},computed:{avgWidth:function(){return to(this.list)/this.length},finite:function(t){return t.finite||Math.ceil(to(this.list))<on(this.list).width+(t=this.list,Math.max.apply(Math,[0].concat(Ut(t).map(function(t){return on(t).width}))))+this.center},maxIndex:function(){var e=this;if(!this.finite||this.center&&!this.sets)return this.length-1;if(this.center)return G(this.sets);Ve(this.slides,"order","");var n=Qr(this.list),t=y(this.slides,function(t){return eo(t,e.list)>=n});return ~t?t:this.length-1},sets:function(t){var r=this;if(t=t.sets){var o=on(this.list).width/(this.center?2:1),s=0,a=o,u=0;return !P(t=J(this.slides,"offsetLeft").reduce(function(t,e,n){var i=on(e).width;return s<u+i&&(!r.center&&n>r.maxIndex&&(n=r.maxIndex),b(t,n)||(e=r.slides[n+1],r.center&&e&&i<a-on(e).width/2?a-=i:(a=o,t.push(n),s=u+o+(r.center?i/2:0)))),u+=i,t},[]))&&t}},transitionOptions:function(){return {center:this.center,list:this.list}}},connected:function(){He(this.$el,this.clsContainer,!Ae("."+this.clsContainer,this.$el));},update:{write:function(){var n=this;this.navItems.forEach(function(t){var e=L(at(t,n.attrItem));!1!==e&&(t.hidden=!n.maxIndex||e>n.maxIndex||n.sets&&!b(n.sets,e));}),!this.length||this.dragging||this.stack.length||(this.reorder(),this._translate(1));var e=this._getTransitioner(this.index).getActives();this.slides.forEach(function(t){return He(t,n.clsActive,b(e,t))}),this.sets&&!b(this.sets,j(this.index))||this.slides.forEach(function(t){return He(t,n.clsActivated,b(e,t))});},events:["resize"]},events:{beforeitemshow:function(t){!this.dragging&&this.sets&&this.stack.length<2&&!b(this.sets,this.index)&&(this.index=this.getValidIndex());var e=Math.abs(this.index-this.prevIndex+(0<this.dir&&this.index<this.prevIndex||this.dir<0&&this.index>this.prevIndex?(this.maxIndex+1)*this.dir:0));if(!this.dragging&&1<e){for(var n=0;n<e;n++)this.stack.splice(1,0,0<this.dir?"next":"previous");t.preventDefault();}else {t=this.dir<0||!this.slides[this.prevIndex]?this.index:this.prevIndex;this.duration=Ur(this.avgWidth/this.velocity)*(on(this.slides[t]).width/this.avgWidth),this.reorder();}},itemshow:function(){~this.prevIndex&&De(this._getTransitioner().getItemIn(),this.clsActive);}},methods:{reorder:function(){var n=this;if(this.finite)Ve(this.slides,"order","");else {var i=0<this.dir&&this.slides[this.prevIndex]?this.prevIndex:this.index;if(this.slides.forEach(function(t,e){return Ve(t,"order",0<n.dir&&e<i?1:n.dir<0&&e>=n.index?-1:"")}),this.center)for(var t=this.slides[i],e=on(this.list).width/2-on(t).width/2,r=0;0<e;){var o=this.getIndex(--r+i,i),s=this.slides[o];Ve(s,"order",i<o?-2:-1),e-=on(s).width;}}},getValidIndex:function(t,e){if(void 0===t&&(t=this.index),void 0===e&&(e=this.prevIndex),t=this.getIndex(t,e),!this.sets)return t;var n;do{if(b(this.sets,t))return t}while(n=t,(t=this.getIndex(t+this.dir,e))!==n);return t}}};dr={mixins:[dr],data:{selItem:"!li"},computed:{item:function(t,e){return xt(t.selItem,e)}},events:[{name:"itemin itemout",self:!0,el:function(){return this.item},handler:function(t){var n=this,i=t.type,t=t.detail,r=t.percent,o=t.duration,s=t.timing,a=t.dir;gn.read(function(){var t=n.getCss(ro(i,a,r)),e=n.getCss(io(i)?.5:0<a?1:0);gn.write(function(){Ve(n.$el,t),Ze.start(n.$el,e,o,s).catch(tt);});});}},{name:"transitioncanceled transitionend",self:!0,el:function(){return this.item},handler:function(){Ze.cancel(this.$el);}},{name:"itemtranslatein itemtranslateout",self:!0,el:function(){return this.item},handler:function(t){var e=this,n=t.type,t=t.detail,i=t.percent,r=t.dir;gn.read(function(){var t=e.getCss(ro(n,r,i));gn.write(function(){return Ve(e.$el,t)});});}}]};function io(t){return c(t,"in")}function ro(t,e,n){return n/=2,io(t)?e<0?1-n:n:e<0?n:1-n}var oo,wi=X({},wi,{fade:{show:function(){return [{opacity:0,zIndex:0},{zIndex:-1}]},percent:function(t){return 1-Ve(t,"opacity")},translate:function(t){return [{opacity:1-t,zIndex:0},{zIndex:-1}]}},scale:{show:function(){return [{opacity:0,transform:Vr(1.5),zIndex:0},{zIndex:-1}]},percent:function(t){return 1-Ve(t,"opacity")},translate:function(t){return [{opacity:1-t,transform:Vr(1+.5*t),zIndex:0},{zIndex:-1}]}},pull:{show:function(t){return t<0?[{transform:Wr(30),zIndex:-1},{transform:Wr(),zIndex:0}]:[{transform:Wr(-100),zIndex:0},{transform:Wr(),zIndex:-1}]},percent:function(t,e,n){return n<0?1-Fr(e):Fr(t)},translate:function(t,e){return e<0?[{transform:Wr(30*t),zIndex:-1},{transform:Wr(-100*(1-t)),zIndex:0}]:[{transform:Wr(100*-t),zIndex:0},{transform:Wr(30*(1-t)),zIndex:-1}]}},push:{show:function(t){return t<0?[{transform:Wr(100),zIndex:0},{transform:Wr(),zIndex:-1}]:[{transform:Wr(-30),zIndex:-1},{transform:Wr(),zIndex:0}]},percent:function(t,e,n){return 0<n?1-Fr(e):Fr(t)},translate:function(t,e){return e<0?[{transform:Wr(100*t),zIndex:0},{transform:Wr(-30*(1-t)),zIndex:-1}]:[{transform:Wr(-30*t),zIndex:-1},{transform:Wr(100*(1-t)),zIndex:0}]}}}),wi={mixins:[di,Gi,ur],props:{ratio:String,minHeight:Number,maxHeight:Number},data:{ratio:"16:9",minHeight:!1,maxHeight:!1,selList:".uk-slideshow-items",attrItem:"uk-slideshow-item",selNav:".uk-slideshow-nav",Animations:wi},update:{read:function(){var t=this.ratio.split(":").map(Number),e=t[0],t=(t=t[1])*this.list.offsetWidth/e||0;return this.minHeight&&(t=Math.max(this.minHeight,t)),this.maxHeight&&(t=Math.min(this.maxHeight,t)),{height:t-dn(this.list,"height","content-box")}},write:function(t){t=t.height;0<t&&Ve(this.list,"minHeight",t);},events:["resize"]}},he={mixins:[di,he],props:{group:String,threshold:Number,clsItem:String,clsPlaceholder:String,clsDrag:String,clsDragState:String,clsBase:String,clsNoDrag:String,clsEmpty:String,clsCustom:String,handle:String},data:{group:!1,threshold:5,clsItem:"uk-sortable-item",clsPlaceholder:"uk-sortable-placeholder",clsDrag:"uk-sortable-drag",clsDragState:"uk-drag",clsBase:"uk-sortable",clsNoDrag:"uk-sortable-nodrag",clsEmpty:"uk-sortable-empty",clsCustom:"",handle:!1,pos:{}},created:function(){var n=this;["init","start","move","end"].forEach(function(t){var e=n[t];n[t]=function(t){X(n.pos,re(t)),e(t);};});},events:{name:pt,passive:!1,handler:"init"},computed:{target:function(){return (this.$el.tBodies||[this.$el])[0]},items:function(){return Ut(this.target)},isEmpty:{get:function(){return P(this.items)},watch:function(t){He(this.target,this.clsEmpty,t);},immediate:!0},handles:{get:function(t,e){t=t.handle;return t?Me(t,e):this.items},watch:function(t,e){Ve(e,{touchAction:"",userSelect:""}),Ve(t,{touchAction:ft?"none":"",userSelect:"none"});},immediate:!0}},update:{write:function(){var t,e,n,i,r,o,s;this.drag&&Bt(this.placeholder)&&(t=(n=this.pos).x,e=n.y,s=(i=this.origin).offsetTop,r=i.offsetLeft,n=this.placeholder,Ve(this.drag,{top:e-s,left:t-r}),(i=this.getSortable(document.elementFromPoint(t,e)))&&((s=i.items).some(Ze.inProgress)||(o={x:t,y:e},r=(r=s)[y(r,function(t){return nt(o,t.getBoundingClientRect())})],(!s.length||r&&r!==n)&&(this.touched.add(i),i!==(s=this.getSortable(n))&&s.remove(n),i.insert(n,function(t,e,n,i,r){var o=Ut(t);if(!o.length)return;o=1===o.length;o&&we(t,n);t=function(i){return i.some(function(t,e){var n=t.getBoundingClientRect();return i.slice(e+1).some(function(t){t=t.getBoundingClientRect();return !so([n.left,n.right],[t.left,t.right])})})}(Ut(t));o&&ke(n);o=e.getBoundingClientRect();if(!t)return r<o.top+o.height/2?e:e.nextElementSibling;r=n.getBoundingClientRect(),n=so([o.top,o.bottom],[r.top,r.bottom]);return n&&i>o.left+o.width/2||!n&&r.top<o.top?e.nextElementSibling:e}(i.target,r,n,t,e))))));},events:["move"]},methods:{init:function(t){var e=t.target,n=t.button,i=t.defaultPrevented,r=this.items.filter(function(t){return Rt(e,t)})[0];!r||i||0<n||Wt(e)||Rt(e,"."+this.clsNoDrag)||this.handle&&!Rt(e,this.handle)||(t.preventDefault(),this.touched=new Set([this]),this.placeholder=r,this.origin=X({target:e,index:pe(r)},this.pos),Yt(document,mt,this.move),Yt(document,gt,this.end),this.threshold||this.start(t));},start:function(t){this.drag=function(t,e){t=we(t,e.outerHTML.replace(/(^<)(?:li|tr)|(?:li|tr)(\/>$)/g,"$1div$2"));return Ve(t,"margin","0","important"),Ve(t,X({boxSizing:"border-box",width:e.offsetWidth,height:e.offsetHeight},Ve(e,["paddingLeft","paddingRight","paddingTop","paddingBottom"]))),cn(t.firstElementChild,cn(e.firstElementChild)),t}(this.$container,this.placeholder);var e,n,i=this.placeholder.getBoundingClientRect(),r=i.left,i=i.top;X(this.origin,{offsetLeft:this.pos.x-r,offsetTop:this.pos.y-i}),De(this.drag,this.clsDrag,this.clsCustom),De(this.placeholder,this.clsPlaceholder),De(this.items,this.clsItem),De(document.documentElement,this.clsDragState),Kt(this.$el,"start",[this,this.placeholder]),e=this.pos,n=Date.now(),oo=setInterval(function(){var t=e.x,s=e.y;s+=window.pageYOffset;var a=.3*(Date.now()-n);n=Date.now(),Vn(document.elementFromPoint(t,e.y)).reverse().some(function(t){var e=t.scrollTop,n=t.scrollHeight,i=sn(Rn(t)),r=i.top,o=i.bottom,i=i.height;if(r<s&&s<r+35)e-=a;else {if(!(s<o&&o-35<s))return;e+=a;}if(0<e&&e<n-i)return jn(t,e),!0});},15),this.move(t);},move:function(t){this.drag?this.$emit("move"):(Math.abs(this.pos.x-this.origin.x)>this.threshold||Math.abs(this.pos.y-this.origin.y)>this.threshold)&&this.start(t);},end:function(){var t,i=this;Xt(document,mt,this.move),Xt(document,gt,this.end),Xt(window,"scroll",this.scroll),this.drag&&(clearInterval(oo),t=this.getSortable(this.placeholder),this===t?this.origin.index!==pe(this.placeholder)&&Kt(this.$el,"moved",[this,this.placeholder]):(Kt(t.$el,"added",[t,this.placeholder]),Kt(this.$el,"removed",[this,this.placeholder])),Kt(this.$el,"stop",[this,this.placeholder]),ke(this.drag),this.drag=null,this.touched.forEach(function(t){var e=t.clsPlaceholder,n=t.clsItem;return i.touched.forEach(function(t){return Ne(t.items,e,n)})}),this.touched=null,Ne(document.documentElement,this.clsDragState));},insert:function(t,e){var n,i=this;e&&(t===e||t===e.previousElementSibling)||(De(this.items,this.clsItem),n=function(){return e?be(e,t):we(i.target,t)},this.animation?this.animate(n):n());},remove:function(t){Rt(t,this.target)&&(this.animation?this.animate(function(){return ke(t)}):ke(t));},getSortable:function(t){do{var e=this.$getComponent(t,"sortable");if(e&&(e===this||!1!==this.group&&e.group===this.group))return e}while(t=Bt(t))}}};function so(t,e){return t[1]>e[0]&&e[1]>t[0]}wt={mixins:[hr,fi,yi],args:"title",props:{delay:Number,title:String},data:{pos:"top",title:"",delay:0,animation:["uk-animation-scale-up"],duration:100,cls:"uk-active",clsPos:"uk-tooltip"},beforeConnect:function(){var t;this._hasTitle=ot(this.$el,"title"),rt(this.$el,"title",""),this.updateAria(!1),function(t){return Wt(t)||zt(t,"a,button")||ot(t,"tabindex")}(t=this.$el)||rt(t,"tabindex","0");},disconnected:function(){this.hide(),rt(this.$el,"title",this._hasTitle?this.title:null);},methods:{show:function(){var e=this;!this.isToggled(this.tooltip)&&this.title&&(this._unbind=Gt(document,"show keydown",this.hide,!1,function(t){return "keydown"===t.type&&27===t.keyCode||"show"===t.type&&t.detail[0]!==e&&t.detail[0].$name===e.$name}),clearTimeout(this.showTimer),this.showTimer=setTimeout(this._show,this.delay));},hide:function(){var t=this;zt(this.$el,"input:focus")||(clearTimeout(this.showTimer),this.isToggled(this.tooltip)&&this.toggleElement(this.tooltip,!1,!1).then(function(){t.tooltip=ke(t.tooltip),t._unbind();}));},_show:function(){var n=this;this.tooltip=we(this.container,'<div class="'+this.clsPos+'"> <div class="'+this.clsPos+'-inner">'+this.title+"</div> </div>"),Yt(this.tooltip,"toggled",function(t,e){n.updateAria(e),e&&(n.positionAt(n.tooltip,n.$el),n.origin="y"===n.getAxis()?fn(n.dir)+"-"+n.align:n.align+"-"+fn(n.dir));}),this.toggleElement(this.tooltip,!0);},updateAria:function(t){rt(this.$el,"aria-expanded",t);}},events:((yi={focus:"show",blur:"hide"})[vt+" "+wt]=function(t){ie(t)||(t.type===vt?this.show():this.hide());},yi)};yi={props:{allow:String,clsDragover:String,concurrent:Number,maxSize:Number,method:String,mime:String,msgInvalidMime:String,msgInvalidName:String,msgInvalidSize:String,multiple:Boolean,name:String,params:Object,type:String,url:String},data:{allow:!1,clsDragover:"uk-dragover",concurrent:1,maxSize:0,method:"POST",mime:!1,msgInvalidMime:"Invalid File Type: %s",msgInvalidName:"Invalid File Name: %s",msgInvalidSize:"Invalid File Size: %s Kilobytes Max",multiple:!1,name:"files[]",params:{},type:"",url:"",abort:tt,beforeAll:tt,beforeSend:tt,complete:tt,completeAll:tt,error:tt,fail:tt,load:tt,loadEnd:tt,loadStart:tt,progress:tt},events:{change:function(t){zt(t.target,'input[type="file"]')&&(t.preventDefault(),t.target.files&&this.upload(t.target.files),t.target.value="");},drop:function(t){uo(t);t=t.dataTransfer;t&&t.files&&(Ne(this.$el,this.clsDragover),this.upload(t.files));},dragenter:function(t){uo(t);},dragover:function(t){uo(t),De(this.$el,this.clsDragover);},dragleave:function(t){uo(t),Ne(this.$el,this.clsDragover);}},methods:{upload:function(t){var i=this;if(t.length){Kt(this.$el,"upload",[t]);for(var e=0;e<t.length;e++){if(this.maxSize&&1e3*this.maxSize<t[e].size)return void this.fail(this.msgInvalidSize.replace("%s",this.maxSize));if(this.allow&&!ao(this.allow,t[e].name))return void this.fail(this.msgInvalidName.replace("%s",this.allow));if(this.mime&&!ao(this.mime,t[e].type))return void this.fail(this.msgInvalidMime.replace("%s",this.mime))}this.multiple||(t=[t[0]]),this.beforeAll(this,t);var r=function(t,e){for(var n=[],i=0;i<t.length;i+=e){for(var r=[],o=0;o<e;o++)r.push(t[i+o]);n.push(r);}return n}(t,this.concurrent),o=function(t){var e,n=new FormData;for(e in t.forEach(function(t){return n.append(i.name,t)}),i.params)n.append(e,i.params[e]);le(i.url,{data:n,method:i.method,responseType:i.type,beforeSend:function(t){var e=t.xhr;e.upload&&Yt(e.upload,"progress",i.progress),["loadStart","load","loadEnd","abort"].forEach(function(t){return Yt(e,t.toLowerCase(),i[t])}),i.beforeSend(t);}}).then(function(t){i.complete(t),r.length?o(r.shift()):i.completeAll(t);},function(t){return i.error(t)});};o(r.shift());}}}};function ao(t,e){return e.match(new RegExp("^"+t.replace(/\//g,"\\/").replace(/\*\*/g,"(\\/[^\\/]+)*").replace(/\*/g,"[^\\/]+").replace(/((?!\\))\?/g,"$1.")+"$","i"))}function uo(t){t.preventDefault(),t.stopPropagation();}return K(Object.freeze({__proto__:null,Countdown:At,Filter:Mi,Lightbox:Ui,LightboxPanel:Yr,Notification:qi,Parallax:Yi,Slider:Xi,SliderParallax:dr,Slideshow:wi,SlideshowParallax:dr,Sortable:he,Tooltip:wt,Upload:yi}),function(t,e){return Zn.component(e,t)}),Zn});
    });

    var uikitIcons_min = createCommonjsModule(function (module, exports) {
    /*! UIkit 3.6.3 | https://www.getuikit.com | (c) 2014 - 2020 YOOtheme | MIT License */

    !function(t,i){module.exports=i();}(commonjsGlobal,function(){function i(t){i.installed||t.icon.add({"500px":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M9.624,11.866c-0.141,0.132,0.479,0.658,0.662,0.418c0.051-0.046,0.607-0.61,0.662-0.664c0,0,0.738,0.719,0.814,0.719 c0.1,0,0.207-0.055,0.322-0.17c0.27-0.269,0.135-0.416,0.066-0.495l-0.631-0.616l0.658-0.668c0.146-0.156,0.021-0.314-0.1-0.449 c-0.182-0.18-0.359-0.226-0.471-0.125l-0.656,0.654l-0.654-0.654c-0.033-0.034-0.08-0.045-0.124-0.045 c-0.079,0-0.191,0.068-0.307,0.181c-0.202,0.202-0.247,0.351-0.133,0.462l0.665,0.665L9.624,11.866z"/><path d="M11.066,2.884c-1.061,0-2.185,0.248-3.011,0.604c-0.087,0.034-0.141,0.106-0.15,0.205C7.893,3.784,7.919,3.909,7.982,4.066 c0.05,0.136,0.187,0.474,0.452,0.372c0.844-0.326,1.779-0.507,2.633-0.507c0.963,0,1.9,0.191,2.781,0.564 c0.695,0.292,1.357,0.719,2.078,1.34c0.051,0.044,0.105,0.068,0.164,0.068c0.143,0,0.273-0.137,0.389-0.271 c0.191-0.214,0.324-0.395,0.135-0.575c-0.686-0.654-1.436-1.138-2.363-1.533C13.24,3.097,12.168,2.884,11.066,2.884z"/><path d="M16.43,15.747c-0.092-0.028-0.242,0.05-0.309,0.119l0,0c-0.652,0.652-1.42,1.169-2.268,1.521 c-0.877,0.371-1.814,0.551-2.779,0.551c-0.961,0-1.896-0.189-2.775-0.564c-0.848-0.36-1.612-0.879-2.268-1.53 c-0.682-0.688-1.196-1.455-1.529-2.268c-0.325-0.799-0.471-1.643-0.471-1.643c-0.045-0.24-0.258-0.249-0.567-0.203 c-0.128,0.021-0.519,0.079-0.483,0.36v0.01c0.105,0.644,0.289,1.284,0.545,1.895c0.417,0.969,1.002,1.849,1.756,2.604 c0.757,0.754,1.636,1.34,2.604,1.757C8.901,18.785,9.97,19,11.088,19c1.104,0,2.186-0.215,3.188-0.645 c1.838-0.896,2.604-1.757,2.604-1.757c0.182-0.204,0.227-0.317-0.1-0.643C16.779,15.956,16.525,15.774,16.43,15.747z"/><path d="M5.633,13.287c0.293,0.71,0.723,1.341,1.262,1.882c0.54,0.54,1.172,0.971,1.882,1.264c0.731,0.303,1.509,0.461,2.298,0.461 c0.801,0,1.578-0.158,2.297-0.461c0.711-0.293,1.344-0.724,1.883-1.264c0.543-0.541,0.971-1.172,1.264-1.882 c0.314-0.721,0.463-1.5,0.463-2.298c0-0.79-0.148-1.569-0.463-2.289c-0.293-0.699-0.721-1.329-1.264-1.881 c-0.539-0.541-1.172-0.959-1.867-1.263c-0.721-0.303-1.5-0.461-2.299-0.461c-0.802,0-1.613,0.159-2.322,0.461 c-0.577,0.25-1.544,0.867-2.119,1.454v0.012V2.108h8.16C15.1,2.104,15.1,1.69,15.1,1.552C15.1,1.417,15.1,1,14.809,1H5.915 C5.676,1,5.527,1.192,5.527,1.384v6.84c0,0.214,0.273,0.372,0.529,0.428c0.5,0.105,0.614-0.056,0.737-0.224l0,0 c0.18-0.273,0.776-0.884,0.787-0.894c0.901-0.905,2.117-1.408,3.416-1.408c1.285,0,2.5,0.501,3.412,1.408 c0.914,0.914,1.408,2.122,1.408,3.405c0,1.288-0.508,2.496-1.408,3.405c-0.9,0.896-2.152,1.406-3.438,1.406 c-0.877,0-1.711-0.229-2.433-0.671v-4.158c0-0.553,0.237-1.151,0.643-1.614c0.462-0.519,1.094-0.799,1.782-0.799 c0.664,0,1.293,0.253,1.758,0.715c0.459,0.459,0.709,1.071,0.709,1.723c0,1.385-1.094,2.468-2.488,2.468 c-0.273,0-0.769-0.121-0.781-0.125c-0.281-0.087-0.405,0.306-0.438,0.436c-0.159,0.496,0.079,0.585,0.123,0.607 c0.452,0.137,0.743,0.157,1.129,0.157c1.973,0,3.572-1.6,3.572-3.57c0-1.964-1.6-3.552-3.572-3.552c-0.97,0-1.872,0.36-2.546,1.038 c-0.656,0.631-1.027,1.487-1.027,2.322v3.438v-0.011c-0.372-0.42-0.732-1.041-0.981-1.682c-0.102-0.248-0.315-0.202-0.607-0.113 c-0.135,0.035-0.519,0.157-0.44,0.439C5.372,12.799,5.577,13.164,5.633,13.287z"/></svg>',album:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="2" width="10" height="1"/><rect x="3" y="4" width="14" height="1"/><rect fill="none" stroke="#000" x="1.5" y="6.5" width="17" height="11"/></svg>',"arrow-down":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="10.5,16.08 5.63,10.66 6.37,10 10.5,14.58 14.63,10 15.37,10.66"/><line fill="none" stroke="#000" x1="10.5" y1="4" x2="10.5" y2="15"/></svg>',"arrow-left":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" points="10 14 5 9.5 10 5"/><line fill="none" stroke="#000" x1="16" y1="9.5" x2="5" y2="9.52"/></svg>',"arrow-right":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" points="10 5 15 9.5 10 14"/><line fill="none" stroke="#000" x1="4" y1="9.5" x2="15" y2="9.5"/></svg>',"arrow-up":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="10.5,4 15.37,9.4 14.63,10.08 10.5,5.49 6.37,10.08 5.63,9.4"/><line fill="none" stroke="#000" x1="10.5" y1="16" x2="10.5" y2="5"/></svg>',ban:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="10" cy="10" r="9"/><line fill="none" stroke="#000" stroke-width="1.1" x1="4" y1="3.5" x2="16" y2="16.5"/></svg>',behance:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M9.5,10.6c-0.4-0.5-0.9-0.9-1.6-1.1c1.7-1,2.2-3.2,0.7-4.7C7.8,4,6.3,4,5.2,4C3.5,4,1.7,4,0,4v12c1.7,0,3.4,0,5.2,0 c1,0,2.1,0,3.1-0.5C10.2,14.6,10.5,12.3,9.5,10.6L9.5,10.6z M5.6,6.1c1.8,0,1.8,2.7-0.1,2.7c-1,0-2,0-2.9,0V6.1H5.6z M2.6,13.8v-3.1 c1.1,0,2.1,0,3.2,0c2.1,0,2.1,3.2,0.1,3.2L2.6,13.8z"/><path d="M19.9,10.9C19.7,9.2,18.7,7.6,17,7c-4.2-1.3-7.3,3.4-5.3,7.1c0.9,1.7,2.8,2.3,4.7,2.1c1.7-0.2,2.9-1.3,3.4-2.9h-2.2 c-0.4,1.3-2.4,1.5-3.5,0.6c-0.4-0.4-0.6-1.1-0.6-1.7H20C20,11.7,19.9,10.9,19.9,10.9z M13.5,10.6c0-1.6,2.3-2.7,3.5-1.4 c0.4,0.4,0.5,0.9,0.6,1.4H13.5L13.5,10.6z"/><rect x="13" y="4" width="5" height="1.4"/></svg>',bell:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.1" d="M17,15.5 L3,15.5 C2.99,14.61 3.79,13.34 4.1,12.51 C4.58,11.3 4.72,10.35 5.19,7.01 C5.54,4.53 5.89,3.2 7.28,2.16 C8.13,1.56 9.37,1.5 9.81,1.5 L9.96,1.5 C9.96,1.5 11.62,1.41 12.67,2.17 C14.08,3.2 14.42,4.54 14.77,7.02 C15.26,10.35 15.4,11.31 15.87,12.52 C16.2,13.34 17.01,14.61 17,15.5 L17,15.5 Z"/><path fill="none" stroke="#000" d="M12.39,16 C12.39,17.37 11.35,18.43 9.91,18.43 C8.48,18.43 7.42,17.37 7.42,16"/></svg>',bold:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M5,15.3 C5.66,15.3 5.9,15 5.9,14.53 L5.9,5.5 C5.9,4.92 5.56,4.7 5,4.7 L5,4 L8.95,4 C12.6,4 13.7,5.37 13.7,6.9 C13.7,7.87 13.14,9.17 10.86,9.59 L10.86,9.7 C13.25,9.86 14.29,11.28 14.3,12.54 C14.3,14.47 12.94,16 9,16 L5,16 L5,15.3 Z M9,9.3 C11.19,9.3 11.8,8.5 11.85,7 C11.85,5.65 11.3,4.8 9,4.8 L7.67,4.8 L7.67,9.3 L9,9.3 Z M9.185,15.22 C11.97,15 12.39,14 12.4,12.58 C12.4,11.15 11.39,10 9,10 L7.67,10 L7.67,15 L9.18,15 Z"/></svg>',bolt:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M4.74,20 L7.73,12 L3,12 L15.43,1 L12.32,9 L17.02,9 L4.74,20 L4.74,20 L4.74,20 Z M9.18,11 L7.1,16.39 L14.47,10 L10.86,10 L12.99,4.67 L5.61,11 L9.18,11 L9.18,11 L9.18,11 Z"/></svg>',bookmark:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon fill="none" stroke="#000" points="5.5 1.5 15.5 1.5 15.5 17.5 10.5 12.5 5.5 17.5"/></svg>',calendar:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M 2,3 2,17 18,17 18,3 2,3 Z M 17,16 3,16 3,8 17,8 17,16 Z M 17,7 3,7 3,4 17,4 17,7 Z"/><rect width="1" height="3" x="6" y="2"/><rect width="1" height="3" x="13" y="2"/></svg>',camera:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="10" cy="10.8" r="3.8"/><path fill="none" stroke="#000" d="M1,4.5 C0.7,4.5 0.5,4.7 0.5,5 L0.5,17 C0.5,17.3 0.7,17.5 1,17.5 L19,17.5 C19.3,17.5 19.5,17.3 19.5,17 L19.5,5 C19.5,4.7 19.3,4.5 19,4.5 L13.5,4.5 L13.5,2.9 C13.5,2.6 13.3,2.5 13,2.5 L7,2.5 C6.7,2.5 6.5,2.6 6.5,2.9 L6.5,4.5 L1,4.5 L1,4.5 Z"/></svg>',cart:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="7.3" cy="17.3" r="1.4"/><circle cx="13.3" cy="17.3" r="1.4"/><polyline fill="none" stroke="#000" points="0 2 3.2 4 5.3 12.5 16 12.5 18 6.5 8 6.5"/></svg>',check:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.1" points="4,10 8,15 17,4"/></svg>',"chevron-double-left":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.03" points="10 14 6 10 10 6"/><polyline fill="none" stroke="#000" stroke-width="1.03" points="14 14 10 10 14 6"/></svg>',"chevron-double-right":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.03" points="10 6 14 10 10 14"/><polyline fill="none" stroke="#000" stroke-width="1.03" points="6 6 10 10 6 14"/></svg>',"chevron-down":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.03" points="16 7 10 13 4 7"/></svg>',"chevron-left":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.03" points="13 16 7 10 13 4"/></svg>',"chevron-right":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.03" points="7 4 13 10 7 16"/></svg>',"chevron-up":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.03" points="4 13 10 7 16 13"/></svg>',clock:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="10" cy="10" r="9"/><rect x="9" y="4" width="1" height="7"/><path fill="none" stroke="#000" stroke-width="1.1" d="M13.018,14.197 L9.445,10.625"/></svg>',close:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.06" d="M16,16 L4,4"/><path fill="none" stroke="#000" stroke-width="1.06" d="M16,4 L4,16"/></svg>',"cloud-download":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.1" d="M6.5,14.61 L3.75,14.61 C1.96,14.61 0.5,13.17 0.5,11.39 C0.5,9.76 1.72,8.41 3.3,8.2 C3.38,5.31 5.75,3 8.68,3 C11.19,3 13.31,4.71 13.89,7.02 C14.39,6.8 14.93,6.68 15.5,6.68 C17.71,6.68 19.5,8.45 19.5,10.64 C19.5,12.83 17.71,14.6 15.5,14.6 L12.5,14.6"/><polyline fill="none" stroke="#000" points="11.75 16 9.5 18.25 7.25 16"/><path fill="none" stroke="#000" d="M9.5,18 L9.5,9.5"/></svg>',"cloud-upload":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.1" d="M6.5,14.61 L3.75,14.61 C1.96,14.61 0.5,13.17 0.5,11.39 C0.5,9.76 1.72,8.41 3.31,8.2 C3.38,5.31 5.75,3 8.68,3 C11.19,3 13.31,4.71 13.89,7.02 C14.39,6.8 14.93,6.68 15.5,6.68 C17.71,6.68 19.5,8.45 19.5,10.64 C19.5,12.83 17.71,14.6 15.5,14.6 L12.5,14.6"/><polyline fill="none" stroke="#000" points="7.25 11.75 9.5 9.5 11.75 11.75"/><path fill="none" stroke="#000" d="M9.5,18 L9.5,9.5"/></svg>',code:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" stroke-width="1.01" points="13,4 19,10 13,16"/><polyline fill="none" stroke="#000" stroke-width="1.01" points="7,4 1,10 7,16"/></svg>',cog:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" cx="9.997" cy="10" r="3.31"/><path fill="none" stroke="#000" d="M18.488,12.285 L16.205,16.237 C15.322,15.496 14.185,15.281 13.303,15.791 C12.428,16.289 12.047,17.373 12.246,18.5 L7.735,18.5 C7.938,17.374 7.553,16.299 6.684,15.791 C5.801,15.27 4.655,15.492 3.773,16.237 L1.5,12.285 C2.573,11.871 3.317,10.999 3.317,9.991 C3.305,8.98 2.573,8.121 1.5,7.716 L3.765,3.784 C4.645,4.516 5.794,4.738 6.687,4.232 C7.555,3.722 7.939,2.637 7.735,1.5 L12.263,1.5 C12.072,2.637 12.441,3.71 13.314,4.22 C14.206,4.73 15.343,4.516 16.225,3.794 L18.487,7.714 C17.404,8.117 16.661,8.988 16.67,10.009 C16.672,11.018 17.415,11.88 18.488,12.285 L18.488,12.285 Z"/></svg>',comment:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M6,18.71 L6,14 L1,14 L1,1 L19,1 L19,14 L10.71,14 L6,18.71 L6,18.71 Z M2,13 L7,13 L7,16.29 L10.29,13 L18,13 L18,2 L2,2 L2,13 L2,13 Z"/></svg>',commenting:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon fill="none" stroke="#000" points="1.5,1.5 18.5,1.5 18.5,13.5 10.5,13.5 6.5,17.5 6.5,13.5 1.5,13.5"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="14" cy="8" r="1"/></svg>',comments:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" points="2 0.5 19.5 0.5 19.5 13"/><path d="M5,19.71 L5,15 L0,15 L0,2 L18,2 L18,15 L9.71,15 L5,19.71 L5,19.71 L5,19.71 Z M1,14 L6,14 L6,17.29 L9.29,14 L17,14 L17,3 L1,3 L1,14 L1,14 L1,14 Z"/></svg>',copy:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect fill="none" stroke="#000" x="3.5" y="2.5" width="12" height="16"/><polyline fill="none" stroke="#000" points="5 0.5 17.5 0.5 17.5 17"/></svg>',"credit-card":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect fill="none" stroke="#000" x="1.5" y="4.5" width="17" height="12"/><rect x="1" y="7" width="18" height="3"/></svg>',database:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><ellipse fill="none" stroke="#000" cx="10" cy="4.64" rx="7.5" ry="3.14"/><path fill="none" stroke="#000" d="M17.5,8.11 C17.5,9.85 14.14,11.25 10,11.25 C5.86,11.25 2.5,9.84 2.5,8.11"/><path fill="none" stroke="#000" d="M17.5,11.25 C17.5,12.99 14.14,14.39 10,14.39 C5.86,14.39 2.5,12.98 2.5,11.25"/><path fill="none" stroke="#000" d="M17.49,4.64 L17.5,14.36 C17.5,16.1 14.14,17.5 10,17.5 C5.86,17.5 2.5,16.09 2.5,14.36 L2.5,4.64"/></svg>',desktop:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="15" width="1" height="2"/><rect x="11" y="15" width="1" height="2"/><rect x="5" y="16" width="10" height="1"/><rect fill="none" stroke="#000" x="1.5" y="3.5" width="17" height="11"/></svg>',download:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" points="14,10 9.5,14.5 5,10"/><rect x="3" y="17" width="13" height="1"/><line fill="none" stroke="#000" x1="9.5" y1="13.91" x2="9.5" y2="3"/></svg>',dribbble:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.4" d="M1.3,8.9c0,0,5,0.1,8.6-1c1.4-0.4,2.6-0.9,4-1.9 c1.4-1.1,2.5-2.5,2.5-2.5"/><path fill="none" stroke="#000" stroke-width="1.4" d="M3.9,16.6c0,0,1.7-2.8,3.5-4.2 c1.8-1.3,4-2,5.7-2.2C16,10,19,10.6,19,10.6"/><path fill="none" stroke="#000" stroke-width="1.4" d="M6.9,1.6c0,0,3.3,4.6,4.2,6.8 c0.4,0.9,1.3,3.1,1.9,5.2c0.6,2,0.9,4.4,0.9,4.4"/><circle fill="none" stroke="#000" stroke-width="1.4" cx="10" cy="10" r="9"/></svg>',etsy:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path d="M8,4.26C8,4.07,8,4,8.31,4h4.46c.79,0,1.22.67,1.53,1.91l.25,1h.76c.14-2.82.26-4,.26-4S13.65,3,12.52,3H6.81L3.75,2.92v.84l1,.2c.73.11.9.27,1,1,0,0,.06,2,.06,5.17s-.06,5.14-.06,5.14c0,.59-.23.81-1,.94l-1,.2v.84l3.06-.1h5.11c1.15,0,3.82.1,3.82.1,0-.7.45-3.88.51-4.22h-.73l-.76,1.69a2.25,2.25,0,0,1-2.45,1.47H9.4c-1,0-1.44-.4-1.44-1.24V10.44s2.16,0,2.86.06c.55,0,.85.19,1.06,1l.23,1H13L12.9,9.94,13,7.41h-.85l-.28,1.13c-.16.74-.28.84-1,1-1,.1-2.89.09-2.89.09Z"/></svg>',expand:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="13 2 18 2 18 7 17 7 17 3 13 3"/><polygon points="2 13 3 13 3 17 7 17 7 18 2 18"/><path fill="none" stroke="#000" stroke-width="1.1" d="M11,9 L17,3"/><path fill="none" stroke="#000" stroke-width="1.1" d="M3,17 L9,11"/></svg>',facebook:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M11,10h2.6l0.4-3H11V5.3c0-0.9,0.2-1.5,1.5-1.5H14V1.1c-0.3,0-1-0.1-2.1-0.1C9.6,1,8,2.4,8,5v2H5.5v3H8v8h3V10z"/></svg>',"file-edit":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" d="M18.65,1.68 C18.41,1.45 18.109,1.33 17.81,1.33 C17.499,1.33 17.209,1.45 16.98,1.68 L8.92,9.76 L8,12.33 L10.55,11.41 L18.651,3.34 C19.12,2.87 19.12,2.15 18.65,1.68 L18.65,1.68 L18.65,1.68 Z"/><polyline fill="none" stroke="#000" points="16.5 8.482 16.5 18.5 3.5 18.5 3.5 1.5 14.211 1.5"/></svg>',"file-pdf":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect fill="none" stroke="#000" width="13" height="17" x="3.5" y="1.5"/><path d="M14.65 11.67c-.48.3-1.37-.19-1.79-.37a4.65 4.65 0 0 1 1.49.06c.35.1.36.28.3.31zm-6.3.06l.43-.79a14.7 14.7 0 0 0 .75-1.64 5.48 5.48 0 0 0 1.25 1.55l.2.15a16.36 16.36 0 0 0-2.63.73zM9.5 5.32c.2 0 .32.5.32.97a1.99 1.99 0 0 1-.23 1.04 5.05 5.05 0 0 1-.17-1.3s0-.71.08-.71zm-3.9 9a4.35 4.35 0 0 1 1.21-1.46l.24-.22a4.35 4.35 0 0 1-1.46 1.68zm9.23-3.3a2.05 2.05 0 0 0-1.32-.3 11.07 11.07 0 0 0-1.58.11 4.09 4.09 0 0 1-.74-.5 5.39 5.39 0 0 1-1.32-2.06 10.37 10.37 0 0 0 .28-2.62 1.83 1.83 0 0 0-.07-.25.57.57 0 0 0-.52-.4H9.4a.59.59 0 0 0-.6.38 6.95 6.95 0 0 0 .37 3.14c-.26.63-1 2.12-1 2.12-.3.58-.57 1.08-.82 1.5l-.8.44A3.11 3.11 0 0 0 5 14.16a.39.39 0 0 0 .15.42l.24.13c1.15.56 2.28-1.74 2.66-2.42a23.1 23.1 0 0 1 3.59-.85 4.56 4.56 0 0 0 2.91.8.5.5 0 0 0 .3-.21 1.1 1.1 0 0 0 .12-.75.84.84 0 0 0-.14-.25z"/></svg>',"file-text":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect fill="none" stroke="#000" width="13" height="17" x="3.5" y="1.5"/><line fill="none" stroke="#000" x1="6" x2="12" y1="12.5" y2="12.5"/><line fill="none" stroke="#000" x1="6" x2="14" y1="8.5" y2="8.5"/><line fill="none" stroke="#000" x1="6" x2="14" y1="6.5" y2="6.5"/><line fill="none" stroke="#000" x1="6" x2="14" y1="10.5" y2="10.5"/></svg>',file:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect fill="none" stroke="#000" x="3.5" y="1.5" width="13" height="17"/></svg>',flickr:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="5.5" cy="9.5" r="3.5"/><circle cx="14.5" cy="9.5" r="3.5"/></svg>',folder:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon fill="none" stroke="#000" points="9.5 5.5 8.5 3.5 1.5 3.5 1.5 16.5 18.5 16.5 18.5 5.5"/></svg>',forward:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2.47,13.11 C4.02,10.02 6.27,7.85 9.04,6.61 C9.48,6.41 10.27,6.13 11,5.91 L11,2 L18.89,9 L11,16 L11,12.13 C9.25,12.47 7.58,13.19 6.02,14.25 C3.03,16.28 1.63,18.54 1.63,18.54 C1.63,18.54 1.38,15.28 2.47,13.11 L2.47,13.11 Z M5.3,13.53 C6.92,12.4 9.04,11.4 12,10.92 L12,13.63 L17.36,9 L12,4.25 L12,6.8 C11.71,6.86 10.86,7.02 9.67,7.49 C6.79,8.65 4.58,10.96 3.49,13.08 C3.18,13.7 2.68,14.87 2.49,16 C3.28,15.05 4.4,14.15 5.3,13.53 L5.3,13.53 Z"/></svg>',foursquare:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15.23,2 C15.96,2 16.4,2.41 16.5,2.86 C16.57,3.15 16.56,3.44 16.51,3.73 C16.46,4.04 14.86,11.72 14.75,12.03 C14.56,12.56 14.16,12.82 13.61,12.83 C13.03,12.84 11.09,12.51 10.69,13 C10.38,13.38 7.79,16.39 6.81,17.53 C6.61,17.76 6.4,17.96 6.08,17.99 C5.68,18.04 5.29,17.87 5.17,17.45 C5.12,17.28 5.1,17.09 5.1,16.91 C5.1,12.4 4.86,7.81 5.11,3.31 C5.17,2.5 5.81,2.12 6.53,2 L15.23,2 L15.23,2 Z M9.76,11.42 C9.94,11.19 10.17,11.1 10.45,11.1 L12.86,11.1 C13.12,11.1 13.31,10.94 13.36,10.69 C13.37,10.64 13.62,9.41 13.74,8.83 C13.81,8.52 13.53,8.28 13.27,8.28 C12.35,8.29 11.42,8.28 10.5,8.28 C9.84,8.28 9.83,7.69 9.82,7.21 C9.8,6.85 10.13,6.55 10.5,6.55 C11.59,6.56 12.67,6.55 13.76,6.55 C14.03,6.55 14.23,6.4 14.28,6.14 C14.34,5.87 14.67,4.29 14.67,4.29 C14.67,4.29 14.82,3.74 14.19,3.74 L7.34,3.74 C7,3.75 6.84,4.02 6.84,4.33 C6.84,7.58 6.85,14.95 6.85,14.99 C6.87,15 8.89,12.51 9.76,11.42 L9.76,11.42 Z"/></svg>',future:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline points="19 2 18 2 18 6 14 6 14 7 19 7 19 2"/><path fill="none" stroke="#000" stroke-width="1.1" d="M18,6.548 C16.709,3.29 13.354,1 9.6,1 C4.6,1 0.6,5 0.6,10 C0.6,15 4.6,19 9.6,19 C14.6,19 18.6,15 18.6,10"/><rect x="9" y="4" width="1" height="7"/><path d="M13.018,14.197 L9.445,10.625" fill="none" stroke="#000" stroke-width="1.1"/></svg>',"git-branch":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.2" cx="7" cy="3" r="2"/><circle fill="none" stroke="#000" stroke-width="1.2" cx="14" cy="6" r="2"/><circle fill="none" stroke="#000" stroke-width="1.2" cx="7" cy="17" r="2"/><path fill="none" stroke="#000" stroke-width="2" d="M14,8 C14,10.41 12.43,10.87 10.56,11.25 C9.09,11.54 7,12.06 7,15 L7,5"/></svg>',"git-fork":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.2" cx="5.79" cy="2.79" r="1.79"/><circle fill="none" stroke="#000" stroke-width="1.2" cx="14.19" cy="2.79" r="1.79"/><circle fill="none" stroke="#000" stroke-width="1.2" cx="10.03" cy="16.79" r="1.79"/><path fill="none" stroke="#000" stroke-width="2" d="M5.79,4.57 L5.79,6.56 C5.79,9.19 10.03,10.22 10.03,13.31 C10.03,14.86 10.04,14.55 10.04,14.55 C10.04,14.37 10.04,14.86 10.04,13.31 C10.04,10.22 14.2,9.19 14.2,6.56 L14.2,4.57"/></svg>',"github-alt":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10,0.5 C4.75,0.5 0.5,4.76 0.5,10.01 C0.5,15.26 4.75,19.51 10,19.51 C15.24,19.51 19.5,15.26 19.5,10.01 C19.5,4.76 15.25,0.5 10,0.5 L10,0.5 Z M12.81,17.69 C12.81,17.69 12.81,17.7 12.79,17.69 C12.47,17.75 12.35,17.59 12.35,17.36 L12.35,16.17 C12.35,15.45 12.09,14.92 11.58,14.56 C12.2,14.51 12.77,14.39 13.26,14.21 C13.87,13.98 14.36,13.69 14.74,13.29 C15.42,12.59 15.76,11.55 15.76,10.17 C15.76,9.25 15.45,8.46 14.83,7.8 C15.1,7.08 15.07,6.29 14.75,5.44 L14.51,5.42 C14.34,5.4 14.06,5.46 13.67,5.61 C13.25,5.78 12.79,6.03 12.31,6.35 C11.55,6.16 10.81,6.05 10.09,6.05 C9.36,6.05 8.61,6.15 7.88,6.35 C7.28,5.96 6.75,5.68 6.26,5.54 C6.07,5.47 5.9,5.44 5.78,5.44 L5.42,5.44 C5.06,6.29 5.04,7.08 5.32,7.8 C4.7,8.46 4.4,9.25 4.4,10.17 C4.4,11.94 4.96,13.16 6.08,13.84 C6.53,14.13 7.05,14.32 7.69,14.43 C8.03,14.5 8.32,14.54 8.55,14.55 C8.07,14.89 7.82,15.42 7.82,16.16 L7.82,17.51 C7.8,17.69 7.7,17.8 7.51,17.8 C4.21,16.74 1.82,13.65 1.82,10.01 C1.82,5.5 5.49,1.83 10,1.83 C14.5,1.83 18.17,5.5 18.17,10.01 C18.18,13.53 15.94,16.54 12.81,17.69 L12.81,17.69 Z"/></svg>',github:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10,1 C5.03,1 1,5.03 1,10 C1,13.98 3.58,17.35 7.16,18.54 C7.61,18.62 7.77,18.34 7.77,18.11 C7.77,17.9 7.76,17.33 7.76,16.58 C5.26,17.12 4.73,15.37 4.73,15.37 C4.32,14.33 3.73,14.05 3.73,14.05 C2.91,13.5 3.79,13.5 3.79,13.5 C4.69,13.56 5.17,14.43 5.17,14.43 C5.97,15.8 7.28,15.41 7.79,15.18 C7.87,14.6 8.1,14.2 8.36,13.98 C6.36,13.75 4.26,12.98 4.26,9.53 C4.26,8.55 4.61,7.74 5.19,7.11 C5.1,6.88 4.79,5.97 5.28,4.73 C5.28,4.73 6.04,4.49 7.75,5.65 C8.47,5.45 9.24,5.35 10,5.35 C10.76,5.35 11.53,5.45 12.25,5.65 C13.97,4.48 14.72,4.73 14.72,4.73 C15.21,5.97 14.9,6.88 14.81,7.11 C15.39,7.74 15.73,8.54 15.73,9.53 C15.73,12.99 13.63,13.75 11.62,13.97 C11.94,14.25 12.23,14.8 12.23,15.64 C12.23,16.84 12.22,17.81 12.22,18.11 C12.22,18.35 12.38,18.63 12.84,18.54 C16.42,17.35 19,13.98 19,10 C19,5.03 14.97,1 10,1 L10,1 Z"/></svg>',gitter:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="1" width="1.531" height="11.471"/><rect x="7.324" y="4.059" width="1.529" height="15.294"/><rect x="11.148" y="4.059" width="1.527" height="15.294"/><rect x="14.971" y="4.059" width="1.529" height="8.412"/></svg>',"google-plus":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M12.9,9c0,2.7-0.6,5-3.2,6.3c-3.7,1.8-8.1,0.2-9.4-3.6C-1.1,7.6,1.9,3.3,6.1,3c1.7-0.1,3.2,0.3,4.6,1.3 c0.1,0.1,0.3,0.2,0.4,0.4c-0.5,0.5-1.2,1-1.7,1.6c-1-0.8-2.1-1.1-3.5-0.9C5,5.6,4.2,6,3.6,6.7c-1.3,1.3-1.5,3.4-0.5,5 c1,1.7,2.6,2.3,4.6,1.9c1.4-0.3,2.4-1.2,2.6-2.6H6.9V9H12.9z"/><polygon points="20,9 20,11 18,11 18,13 16,13 16,11 14,11 14,9 16,9 16,7 18,7 18,9"/></svg>',google:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.86,9.09 C18.46,12.12 17.14,16.05 13.81,17.56 C9.45,19.53 4.13,17.68 2.47,12.87 C0.68,7.68 4.22,2.42 9.5,2.03 C11.57,1.88 13.42,2.37 15.05,3.65 C15.22,3.78 15.37,3.93 15.61,4.14 C14.9,4.81 14.23,5.45 13.5,6.14 C12.27,5.08 10.84,4.72 9.28,4.98 C8.12,5.17 7.16,5.76 6.37,6.63 C4.88,8.27 4.62,10.86 5.76,12.82 C6.95,14.87 9.17,15.8 11.57,15.25 C13.27,14.87 14.76,13.33 14.89,11.75 L10.51,11.75 L10.51,9.09 L17.86,9.09 L17.86,9.09 Z"/></svg>',grid:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="3" height="3"/><rect x="8" y="2" width="3" height="3"/><rect x="14" y="2" width="3" height="3"/><rect x="2" y="8" width="3" height="3"/><rect x="8" y="8" width="3" height="3"/><rect x="14" y="8" width="3" height="3"/><rect x="2" y="14" width="3" height="3"/><rect x="8" y="14" width="3" height="3"/><rect x="14" y="14" width="3" height="3"/></svg>',happy:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="13" cy="7" r="1"/><circle cx="7" cy="7" r="1"/><circle fill="none" stroke="#000" cx="10" cy="10" r="8.5"/><path fill="none" stroke="#000" d="M14.6,11.4 C13.9,13.3 12.1,14.5 10,14.5 C7.9,14.5 6.1,13.3 5.4,11.4"/></svg>',hashtag:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15.431,8 L15.661,7 L12.911,7 L13.831,3 L12.901,3 L11.98,7 L9.29,7 L10.21,3 L9.281,3 L8.361,7 L5.23,7 L5,8 L8.13,8 L7.21,12 L4.23,12 L4,13 L6.98,13 L6.061,17 L6.991,17 L7.911,13 L10.601,13 L9.681,17 L10.611,17 L11.531,13 L14.431,13 L14.661,12 L11.76,12 L12.681,8 L15.431,8 Z M10.831,12 L8.141,12 L9.061,8 L11.75,8 L10.831,12 Z"/></svg>',heart:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.03" d="M10,4 C10,4 8.1,2 5.74,2 C3.38,2 1,3.55 1,6.73 C1,8.84 2.67,10.44 2.67,10.44 L10,18 L17.33,10.44 C17.33,10.44 19,8.84 19,6.73 C19,3.55 16.62,2 14.26,2 C11.9,2 10,4 10,4 L10,4 Z"/></svg>',history:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="#000" points="1 2 2 2 2 6 6 6 6 7 1 7 1 2"/><path fill="none" stroke="#000" stroke-width="1.1" d="M2.1,6.548 C3.391,3.29 6.746,1 10.5,1 C15.5,1 19.5,5 19.5,10 C19.5,15 15.5,19 10.5,19 C5.5,19 1.5,15 1.5,10"/><rect x="9" y="4" width="1" height="7"/><path fill="none" stroke="#000" stroke-width="1.1" d="M13.018,14.197 L9.445,10.625"/></svg>',home:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="18.65 11.35 10 2.71 1.35 11.35 0.65 10.65 10 1.29 19.35 10.65"/><polygon points="15 4 18 4 18 7 17 7 17 5 15 5"/><polygon points="3 11 4 11 4 18 7 18 7 12 12 12 12 18 16 18 16 11 17 11 17 19 11 19 11 13 8 13 8 19 3 19"/></svg>',image:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="16.1" cy="6.1" r="1.1"/><rect fill="none" stroke="#000" x=".5" y="2.5" width="19" height="15"/><polyline fill="none" stroke="#000" stroke-width="1.01" points="4,13 8,9 13,14"/><polyline fill="none" stroke="#000" stroke-width="1.01" points="11,12 12.5,10.5 16,14"/></svg>',info:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M12.13,11.59 C11.97,12.84 10.35,14.12 9.1,14.16 C6.17,14.2 9.89,9.46 8.74,8.37 C9.3,8.16 10.62,7.83 10.62,8.81 C10.62,9.63 10.12,10.55 9.88,11.32 C8.66,15.16 12.13,11.15 12.14,11.18 C12.16,11.21 12.16,11.35 12.13,11.59 C12.08,11.95 12.16,11.35 12.13,11.59 L12.13,11.59 Z M11.56,5.67 C11.56,6.67 9.36,7.15 9.36,6.03 C9.36,5 11.56,4.54 11.56,5.67 L11.56,5.67 Z"/><circle fill="none" stroke="#000" stroke-width="1.1" cx="10" cy="10" r="9"/></svg>',instagram:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M13.55,1H6.46C3.45,1,1,3.44,1,6.44v7.12c0,3,2.45,5.44,5.46,5.44h7.08c3.02,0,5.46-2.44,5.46-5.44V6.44 C19.01,3.44,16.56,1,13.55,1z M17.5,14c0,1.93-1.57,3.5-3.5,3.5H6c-1.93,0-3.5-1.57-3.5-3.5V6c0-1.93,1.57-3.5,3.5-3.5h8 c1.93,0,3.5,1.57,3.5,3.5V14z"/><circle cx="14.87" cy="5.26" r="1.09"/><path d="M10.03,5.45c-2.55,0-4.63,2.06-4.63,4.6c0,2.55,2.07,4.61,4.63,4.61c2.56,0,4.63-2.061,4.63-4.61 C14.65,7.51,12.58,5.45,10.03,5.45L10.03,5.45L10.03,5.45z M10.08,13c-1.66,0-3-1.34-3-2.99c0-1.65,1.34-2.99,3-2.99s3,1.34,3,2.99 C13.08,11.66,11.74,13,10.08,13L10.08,13L10.08,13z"/></svg>',italic:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M12.63,5.48 L10.15,14.52 C10,15.08 10.37,15.25 11.92,15.3 L11.72,16 L6,16 L6.2,15.31 C7.78,15.26 8.19,15.09 8.34,14.53 L10.82,5.49 C10.97,4.92 10.63,4.76 9.09,4.71 L9.28,4 L15,4 L14.81,4.69 C13.23,4.75 12.78,4.91 12.63,5.48 L12.63,5.48 Z"/></svg>',joomla:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M7.8,13.4l1.7-1.7L5.9,8c-0.6-0.5-0.6-1.5,0-2c0.6-0.6,1.4-0.6,2,0l1.7-1.7c-1-1-2.3-1.3-3.6-1C5.8,2.2,4.8,1.4,3.7,1.4 c-1.3,0-2.3,1-2.3,2.3c0,1.1,0.8,2,1.8,2.3c-0.4,1.3-0.1,2.8,1,3.8L7.8,13.4L7.8,13.4z"/><path d="M10.2,4.3c1-1,2.5-1.4,3.8-1c0.2-1.1,1.1-2,2.3-2c1.3,0,2.3,1,2.3,2.3c0,1.2-0.9,2.2-2,2.3c0.4,1.3,0,2.8-1,3.8L13.9,8 c0.6-0.5,0.6-1.5,0-2c-0.5-0.6-1.5-0.6-2,0L8.2,9.7L6.5,8"/><path d="M14.1,16.8c-1.3,0.4-2.8,0.1-3.8-1l1.7-1.7c0.6,0.6,1.5,0.6,2,0c0.5-0.6,0.6-1.5,0-2l-3.7-3.7L12,6.7l3.7,3.7 c1,1,1.3,2.4,1,3.6c1.1,0.2,2,1.1,2,2.3c0,1.3-1,2.3-2.3,2.3C15.2,18.6,14.3,17.8,14.1,16.8"/><path d="M13.2,12.2l-3.7,3.7c-1,1-2.4,1.3-3.6,1c-0.2,1-1.2,1.8-2.2,1.8c-1.3,0-2.3-1-2.3-2.3c0-1.1,0.8-2,1.8-2.3 c-0.3-1.3,0-2.7,1-3.7l1.7,1.7c-0.6,0.6-0.6,1.5,0,2c0.6,0.6,1.4,0.6,2,0l3.7-3.7"/></svg>',laptop:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect y="16" width="20" height="1"/><rect fill="none" stroke="#000" x="2.5" y="4.5" width="15" height="10"/></svg>',lifesaver:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10,0.5 C4.76,0.5 0.5,4.76 0.5,10 C0.5,15.24 4.76,19.5 10,19.5 C15.24,19.5 19.5,15.24 19.5,10 C19.5,4.76 15.24,0.5 10,0.5 L10,0.5 Z M10,1.5 C11.49,1.5 12.89,1.88 14.11,2.56 L11.85,4.82 C11.27,4.61 10.65,4.5 10,4.5 C9.21,4.5 8.47,4.67 7.79,4.96 L5.58,2.75 C6.87,1.95 8.38,1.5 10,1.5 L10,1.5 Z M4.96,7.8 C4.67,8.48 4.5,9.21 4.5,10 C4.5,10.65 4.61,11.27 4.83,11.85 L2.56,14.11 C1.88,12.89 1.5,11.49 1.5,10 C1.5,8.38 1.95,6.87 2.75,5.58 L4.96,7.79 L4.96,7.8 L4.96,7.8 Z M10,18.5 C8.25,18.5 6.62,17.97 5.27,17.06 L7.46,14.87 C8.22,15.27 9.08,15.5 10,15.5 C10.79,15.5 11.53,15.33 12.21,15.04 L14.42,17.25 C13.13,18.05 11.62,18.5 10,18.5 L10,18.5 Z M10,14.5 C7.52,14.5 5.5,12.48 5.5,10 C5.5,7.52 7.52,5.5 10,5.5 C12.48,5.5 14.5,7.52 14.5,10 C14.5,12.48 12.48,14.5 10,14.5 L10,14.5 Z M15.04,12.21 C15.33,11.53 15.5,10.79 15.5,10 C15.5,9.08 15.27,8.22 14.87,7.46 L17.06,5.27 C17.97,6.62 18.5,8.25 18.5,10 C18.5,11.62 18.05,13.13 17.25,14.42 L15.04,12.21 L15.04,12.21 Z"/></svg>',link:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.1" d="M10.625,12.375 L7.525,15.475 C6.825,16.175 5.925,16.175 5.225,15.475 L4.525,14.775 C3.825,14.074 3.825,13.175 4.525,12.475 L7.625,9.375"/><path fill="none" stroke="#000" stroke-width="1.1" d="M9.325,7.375 L12.425,4.275 C13.125,3.575 14.025,3.575 14.724,4.275 L15.425,4.975 C16.125,5.675 16.125,6.575 15.425,7.275 L12.325,10.375"/><path fill="none" stroke="#000" stroke-width="1.1" d="M7.925,11.875 L11.925,7.975"/></svg>',linkedin:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M5.77,17.89 L5.77,7.17 L2.21,7.17 L2.21,17.89 L5.77,17.89 L5.77,17.89 Z M3.99,5.71 C5.23,5.71 6.01,4.89 6.01,3.86 C5.99,2.8 5.24,2 4.02,2 C2.8,2 2,2.8 2,3.85 C2,4.88 2.77,5.7 3.97,5.7 L3.99,5.7 L3.99,5.71 L3.99,5.71 Z"/><path d="M7.75,17.89 L11.31,17.89 L11.31,11.9 C11.31,11.58 11.33,11.26 11.43,11.03 C11.69,10.39 12.27,9.73 13.26,9.73 C14.55,9.73 15.06,10.71 15.06,12.15 L15.06,17.89 L18.62,17.89 L18.62,11.74 C18.62,8.45 16.86,6.92 14.52,6.92 C12.6,6.92 11.75,7.99 11.28,8.73 L11.3,8.73 L11.3,7.17 L7.75,7.17 C7.79,8.17 7.75,17.89 7.75,17.89 L7.75,17.89 L7.75,17.89 Z"/></svg>',list:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="12" height="1"/><rect x="6" y="9" width="12" height="1"/><rect x="6" y="14" width="12" height="1"/><rect x="2" y="4" width="2" height="1"/><rect x="2" y="9" width="2" height="1"/><rect x="2" y="14" width="2" height="1"/></svg>',location:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.01" d="M10,0.5 C6.41,0.5 3.5,3.39 3.5,6.98 C3.5,11.83 10,19 10,19 C10,19 16.5,11.83 16.5,6.98 C16.5,3.39 13.59,0.5 10,0.5 L10,0.5 Z"/><circle fill="none" stroke="#000" cx="10" cy="6.8" r="2.3"/></svg>',lock:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect fill="none" stroke="#000" height="10" width="13" y="8.5" x="3.5"/><path fill="none" stroke="#000" d="M6.5,8 L6.5,4.88 C6.5,3.01 8.07,1.5 10,1.5 C11.93,1.5 13.5,3.01 13.5,4.88 L13.5,8"/></svg>',mail:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" points="1.4,6.5 10,11 18.6,6.5"/><path d="M 1,4 1,16 19,16 19,4 1,4 Z M 18,15 2,15 2,5 18,5 18,15 Z"/></svg>',menu:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="16" height="1"/><rect x="2" y="9" width="16" height="1"/><rect x="2" y="14" width="16" height="1"/></svg>',microphone:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><line fill="none" stroke="#000" x1="10" x2="10" y1="16.44" y2="18.5"/><line fill="none" stroke="#000" x1="7" x2="13" y1="18.5" y2="18.5"/><path fill="none" stroke="#000" stroke-width="1.1" d="M13.5 4.89v5.87a3.5 3.5 0 0 1-7 0V4.89a3.5 3.5 0 0 1 7 0z"/><path fill="none" stroke="#000" stroke-width="1.1" d="M15.5 10.36V11a5.5 5.5 0 0 1-11 0v-.6"/></svg>',"minus-circle":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="9.5" cy="9.5" r="9"/><line fill="none" stroke="#000" x1="5" y1="9.5" x2="14" y2="9.5"/></svg>',minus:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect height="1" width="18" y="9" x="1"/></svg>',"more-vertical":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="3" r="2"/><circle cx="10" cy="10" r="2"/><circle cx="10" cy="17" r="2"/></svg>',more:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="3" cy="10" r="2"/><circle cx="10" cy="10" r="2"/><circle cx="17" cy="10" r="2"/></svg>',move:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="4,5 1,5 1,9 2,9 2,6 4,6"/><polygon points="1,16 2,16 2,18 4,18 4,19 1,19"/><polygon points="14,16 14,19 11,19 11,18 13,18 13,16"/><rect fill="none" stroke="#000" x="5.5" y="1.5" width="13" height="13"/><rect x="1" y="11" width="1" height="3"/><rect x="6" y="18" width="3" height="1"/></svg>',nut:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon fill="none" stroke="#000" points="2.5,5.7 10,1.3 17.5,5.7 17.5,14.3 10,18.7 2.5,14.3"/><circle fill="none" stroke="#000" cx="10" cy="10" r="3.5"/></svg>',pagekit:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="3,1 17,1 17,16 10,16 10,13 14,13 14,4 6,4 6,16 10,16 10,19 3,19"/></svg>',"paint-bucket":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.21,1 L0,11.21 L8.1,19.31 L18.31,9.1 L10.21,1 L10.21,1 Z M16.89,9.1 L15,11 L1.7,11 L10.21,2.42 L16.89,9.1 Z"/><path fill="none" stroke="#000" stroke-width="1.1" d="M6.42,2.33 L11.7,7.61"/><path d="M18.49,12 C18.49,12 20,14.06 20,15.36 C20,16.28 19.24,17 18.49,17 L18.49,17 C17.74,17 17,16.28 17,15.36 C17,14.06 18.49,12 18.49,12 L18.49,12 Z"/></svg>',pencil:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" d="M17.25,6.01 L7.12,16.1 L3.82,17.2 L5.02,13.9 L15.12,3.88 C15.71,3.29 16.66,3.29 17.25,3.88 C17.83,4.47 17.83,5.42 17.25,6.01 L17.25,6.01 Z"/><path fill="none" stroke="#000" d="M15.98,7.268 L13.851,5.148"/></svg>',"phone-landscape":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" d="M17,5.5 C17.8,5.5 18.5,6.2 18.5,7 L18.5,14 C18.5,14.8 17.8,15.5 17,15.5 L3,15.5 C2.2,15.5 1.5,14.8 1.5,14 L1.5,7 C1.5,6.2 2.2,5.5 3,5.5 L17,5.5 L17,5.5 L17,5.5 Z"/><circle cx="3.8" cy="10.5" r=".8"/></svg>',phone:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" d="M15.5,17 C15.5,17.8 14.8,18.5 14,18.5 L7,18.5 C6.2,18.5 5.5,17.8 5.5,17 L5.5,3 C5.5,2.2 6.2,1.5 7,1.5 L14,1.5 C14.8,1.5 15.5,2.2 15.5,3 L15.5,17 L15.5,17 L15.5,17 Z"/><circle cx="10.5" cy="16.5" r=".8"/></svg>',pinterest:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.21,1 C5.5,1 3,4.16 3,7.61 C3,9.21 3.85,11.2 5.22,11.84 C5.43,11.94 5.54,11.89 5.58,11.69 C5.62,11.54 5.8,10.8 5.88,10.45 C5.91,10.34 5.89,10.24 5.8,10.14 C5.36,9.59 5,8.58 5,7.65 C5,5.24 6.82,2.91 9.93,2.91 C12.61,2.91 14.49,4.74 14.49,7.35 C14.49,10.3 13,12.35 11.06,12.35 C9.99,12.35 9.19,11.47 9.44,10.38 C9.75,9.08 10.35,7.68 10.35,6.75 C10.35,5.91 9.9,5.21 8.97,5.21 C7.87,5.21 6.99,6.34 6.99,7.86 C6.99,8.83 7.32,9.48 7.32,9.48 C7.32,9.48 6.24,14.06 6.04,14.91 C5.7,16.35 6.08,18.7 6.12,18.9 C6.14,19.01 6.26,19.05 6.33,18.95 C6.44,18.81 7.74,16.85 8.11,15.44 C8.24,14.93 8.79,12.84 8.79,12.84 C9.15,13.52 10.19,14.09 11.29,14.09 C14.58,14.09 16.96,11.06 16.96,7.3 C16.94,3.7 14,1 10.21,1"/></svg>',"play-circle":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon fill="none" stroke="#000" stroke-width="1.1" points="8.5 7 13.5 10 8.5 13"/><circle fill="none" stroke="#000" stroke-width="1.1" cx="10" cy="10" r="9"/></svg>',play:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon fill="none" stroke="#000" points="6.5,5 14.5,10 6.5,15"/></svg>',"plus-circle":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="9.5" cy="9.5" r="9"/><line fill="none" stroke="#000" x1="9.5" y1="5" x2="9.5" y2="14"/><line fill="none" stroke="#000" x1="5" y1="9.5" x2="14" y2="9.5"/></svg>',plus:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="1" width="1" height="17"/><rect x="1" y="9" width="17" height="1"/></svg>',print:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" points="4.5 13.5 1.5 13.5 1.5 6.5 18.5 6.5 18.5 13.5 15.5 13.5"/><polyline fill="none" stroke="#000" points="15.5 6.5 15.5 2.5 4.5 2.5 4.5 6.5"/><rect fill="none" stroke="#000" width="11" height="6" x="4.5" y="11.5"/><rect width="8" height="1" x="6" y="13"/><rect width="8" height="1" x="6" y="15"/></svg>',pull:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="6.85,8 9.5,10.6 12.15,8 12.85,8.7 9.5,12 6.15,8.7"/><line fill="none" stroke="#000" x1="9.5" y1="11" x2="9.5" y2="2"/><polyline fill="none" stroke="#000" points="6,5.5 3.5,5.5 3.5,18.5 15.5,18.5 15.5,5.5 13,5.5"/></svg>',push:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="12.15,4 9.5,1.4 6.85,4 6.15,3.3 9.5,0 12.85,3.3"/><line fill="none" stroke="#000" x1="9.5" y1="10" x2="9.5" y2="1"/><polyline fill="none" stroke="#000" points="6 5.5 3.5 5.5 3.5 18.5 15.5 18.5 15.5 5.5 13 5.5"/></svg>',question:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="10" cy="10" r="9"/><circle cx="10.44" cy="14.42" r="1.05"/><path fill="none" stroke="#000" stroke-width="1.2" d="M8.17,7.79 C8.17,4.75 12.72,4.73 12.72,7.72 C12.72,8.67 11.81,9.15 11.23,9.75 C10.75,10.24 10.51,10.73 10.45,11.4 C10.44,11.53 10.43,11.64 10.43,11.75"/></svg>',"quote-right":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.27,7.79 C17.27,9.45 16.97,10.43 15.99,12.02 C14.98,13.64 13,15.23 11.56,15.97 L11.1,15.08 C12.34,14.2 13.14,13.51 14.02,11.82 C14.27,11.34 14.41,10.92 14.49,10.54 C14.3,10.58 14.09,10.6 13.88,10.6 C12.06,10.6 10.59,9.12 10.59,7.3 C10.59,5.48 12.06,4 13.88,4 C15.39,4 16.67,5.02 17.05,6.42 C17.19,6.82 17.27,7.27 17.27,7.79 L17.27,7.79 Z"/><path d="M8.68,7.79 C8.68,9.45 8.38,10.43 7.4,12.02 C6.39,13.64 4.41,15.23 2.97,15.97 L2.51,15.08 C3.75,14.2 4.55,13.51 5.43,11.82 C5.68,11.34 5.82,10.92 5.9,10.54 C5.71,10.58 5.5,10.6 5.29,10.6 C3.47,10.6 2,9.12 2,7.3 C2,5.48 3.47,4 5.29,4 C6.8,4 8.08,5.02 8.46,6.42 C8.6,6.82 8.68,7.27 8.68,7.79 L8.68,7.79 Z"/></svg>',receiver:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.01" d="M6.189,13.611C8.134,15.525 11.097,18.239 13.867,18.257C16.47,18.275 18.2,16.241 18.2,16.241L14.509,12.551L11.539,13.639L6.189,8.29L7.313,5.355L3.76,1.8C3.76,1.8 1.732,3.537 1.7,6.092C1.667,8.809 4.347,11.738 6.189,13.611"/></svg>',reddit:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M19 9.05a2.56 2.56 0 0 0-2.56-2.56 2.59 2.59 0 0 0-1.88.82 10.63 10.63 0 0 0-4.14-1v-.08c.58-1.62 1.58-3.89 2.7-4.1.38-.08.77.12 1.19.57a1.15 1.15 0 0 0-.06.37 1.48 1.48 0 1 0 1.51-1.45 1.43 1.43 0 0 0-.76.19A2.29 2.29 0 0 0 12.91 1c-2.11.43-3.39 4.38-3.63 5.19 0 0 0 .11-.06.11a10.65 10.65 0 0 0-3.75 1A2.56 2.56 0 0 0 1 9.05a2.42 2.42 0 0 0 .72 1.76A5.18 5.18 0 0 0 1.24 13c0 3.66 3.92 6.64 8.73 6.64s8.74-3 8.74-6.64a5.23 5.23 0 0 0-.46-2.13A2.58 2.58 0 0 0 19 9.05zm-16.88 0a1.44 1.44 0 0 1 2.27-1.19 7.68 7.68 0 0 0-2.07 1.91 1.33 1.33 0 0 1-.2-.72zM10 18.4c-4.17 0-7.55-2.4-7.55-5.4S5.83 7.53 10 7.53 17.5 10 17.5 13s-3.38 5.4-7.5 5.4zm7.69-8.61a7.62 7.62 0 0 0-2.09-1.91 1.41 1.41 0 0 1 .84-.28 1.47 1.47 0 0 1 1.44 1.45 1.34 1.34 0 0 1-.21.72z"/><path d="M6.69 12.58a1.39 1.39 0 1 1 1.39-1.39 1.38 1.38 0 0 1-1.38 1.39z"/><path d="M14.26 11.2a1.39 1.39 0 1 1-1.39-1.39 1.39 1.39 0 0 1 1.39 1.39z"/><path d="M13.09 14.88a.54.54 0 0 1-.09.77 5.3 5.3 0 0 1-3.26 1.19 5.61 5.61 0 0 1-3.4-1.22.55.55 0 1 1 .73-.83 4.09 4.09 0 0 0 5.25 0 .56.56 0 0 1 .77.09z"/></svg>',refresh:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.1" d="M17.08,11.15 C17.09,11.31 17.1,11.47 17.1,11.64 C17.1,15.53 13.94,18.69 10.05,18.69 C6.16,18.68 3,15.53 3,11.63 C3,7.74 6.16,4.58 10.05,4.58 C10.9,4.58 11.71,4.73 12.46,5"/><polyline fill="none" stroke="#000" points="9.9 2 12.79 4.89 9.79 7.9"/></svg>',reply:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.7,13.11 C16.12,10.02 13.84,7.85 11.02,6.61 C10.57,6.41 9.75,6.13 9,5.91 L9,2 L1,9 L9,16 L9,12.13 C10.78,12.47 12.5,13.19 14.09,14.25 C17.13,16.28 18.56,18.54 18.56,18.54 C18.56,18.54 18.81,15.28 17.7,13.11 L17.7,13.11 Z M14.82,13.53 C13.17,12.4 11.01,11.4 8,10.92 L8,13.63 L2.55,9 L8,4.25 L8,6.8 C8.3,6.86 9.16,7.02 10.37,7.49 C13.3,8.65 15.54,10.96 16.65,13.08 C16.97,13.7 17.48,14.86 17.68,16 C16.87,15.05 15.73,14.15 14.82,13.53 L14.82,13.53 Z"/></svg>',rss:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="3.12" cy="16.8" r="1.85"/><path fill="none" stroke="#000" stroke-width="1.1" d="M1.5,8.2 C1.78,8.18 2.06,8.16 2.35,8.16 C7.57,8.16 11.81,12.37 11.81,17.57 C11.81,17.89 11.79,18.19 11.76,18.5"/><path fill="none" stroke="#000" stroke-width="1.1" d="M1.5,2.52 C1.78,2.51 2.06,2.5 2.35,2.5 C10.72,2.5 17.5,9.24 17.5,17.57 C17.5,17.89 17.49,18.19 17.47,18.5"/></svg>',search:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="9" cy="9" r="7"/><path fill="none" stroke="#000" stroke-width="1.1" d="M14,14 L18,18 L14,14 Z"/></svg>',server:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="1" height="2"/><rect x="5" y="3" width="1" height="2"/><rect x="7" y="3" width="1" height="2"/><rect x="16" y="3" width="1" height="1"/><rect x="16" y="10" width="1" height="1"/><circle fill="none" stroke="#000" cx="9.9" cy="17.4" r="1.4"/><rect x="3" y="10" width="1" height="2"/><rect x="5" y="10" width="1" height="2"/><rect x="9.5" y="14" width="1" height="2"/><rect x="3" y="17" width="6" height="1"/><rect x="11" y="17" width="6" height="1"/><rect fill="none" stroke="#000" x="1.5" y="1.5" width="17" height="5"/><rect fill="none" stroke="#000" x="1.5" y="8.5" width="17" height="5"/></svg>',settings:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><ellipse fill="none" stroke="#000" cx="6.11" cy="3.55" rx="2.11" ry="2.15"/><ellipse fill="none" stroke="#000" cx="6.11" cy="15.55" rx="2.11" ry="2.15"/><circle fill="none" stroke="#000" cx="13.15" cy="9.55" r="2.15"/><rect x="1" y="3" width="3" height="1"/><rect x="10" y="3" width="8" height="1"/><rect x="1" y="9" width="8" height="1"/><rect x="15" y="9" width="3" height="1"/><rect x="1" y="15" width="3" height="1"/><rect x="10" y="15" width="8" height="1"/></svg>',shrink:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="11 4 12 4 12 8 16 8 16 9 11 9"/><polygon points="4 11 9 11 9 16 8 16 8 12 4 12"/><path fill="none" stroke="#000" stroke-width="1.1" d="M12,8 L18,2"/><path fill="none" stroke="#000" stroke-width="1.1" d="M2,18 L8,12"/></svg>',"sign-in":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="7 2 17 2 17 17 7 17 7 16 16 16 16 3 7 3"/><polygon points="9.1 13.4 8.5 12.8 11.28 10 4 10 4 9 11.28 9 8.5 6.2 9.1 5.62 13 9.5"/></svg>',"sign-out":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="13.1 13.4 12.5 12.8 15.28 10 8 10 8 9 15.28 9 12.5 6.2 13.1 5.62 17 9.5"/><polygon points="13 2 3 2 3 17 13 17 13 16 4 16 4 3 13 3"/></svg>',social:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><line fill="none" stroke="#000" stroke-width="1.1" x1="13.4" y1="14" x2="6.3" y2="10.7"/><line fill="none" stroke="#000" stroke-width="1.1" x1="13.5" y1="5.5" x2="6.5" y2="8.8"/><circle fill="none" stroke="#000" stroke-width="1.1" cx="15.5" cy="4.6" r="2.3"/><circle fill="none" stroke="#000" stroke-width="1.1" cx="15.5" cy="14.8" r="2.3"/><circle fill="none" stroke="#000" stroke-width="1.1" cx="4.5" cy="9.8" r="2.3"/></svg>',soundcloud:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.2,9.4c-0.4,0-0.8,0.1-1.101,0.2c-0.199-2.5-2.399-4.5-5-4.5c-0.6,0-1.2,0.1-1.7,0.3C9.2,5.5,9.1,5.6,9.1,5.6V15h8 c1.601,0,2.801-1.2,2.801-2.8C20,10.7,18.7,9.4,17.2,9.4L17.2,9.4z"/><rect x="6" y="6.5" width="1.5" height="8.5"/><rect x="3" y="8" width="1.5" height="7"/><rect y="10" width="1.5" height="5"/></svg>',star:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon fill="none" stroke="#000" stroke-width="1.01" points="10 2 12.63 7.27 18.5 8.12 14.25 12.22 15.25 18 10 15.27 4.75 18 5.75 12.22 1.5 8.12 7.37 7.27"/></svg>',strikethrough:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M6,13.02 L6.65,13.02 C7.64,15.16 8.86,16.12 10.41,16.12 C12.22,16.12 12.92,14.93 12.92,13.89 C12.92,12.55 11.99,12.03 9.74,11.23 C8.05,10.64 6.23,10.11 6.23,7.83 C6.23,5.5 8.09,4.09 10.4,4.09 C11.44,4.09 12.13,4.31 12.72,4.54 L13.33,4 L13.81,4 L13.81,7.59 L13.16,7.59 C12.55,5.88 11.52,4.89 10.07,4.89 C8.84,4.89 7.89,5.69 7.89,7.03 C7.89,8.29 8.89,8.78 10.88,9.45 C12.57,10.03 14.38,10.6 14.38,12.91 C14.38,14.75 13.27,16.93 10.18,16.93 C9.18,16.93 8.17,16.69 7.46,16.39 L6.52,17 L6,17 L6,13.02 L6,13.02 Z"/><rect x="3" y="10" width="15" height="1"/></svg>',table:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="18" height="1"/><rect x="1" y="7" width="18" height="1"/><rect x="1" y="11" width="18" height="1"/><rect x="1" y="15" width="18" height="1"/></svg>',"tablet-landscape":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" d="M1.5,5 C1.5,4.2 2.2,3.5 3,3.5 L17,3.5 C17.8,3.5 18.5,4.2 18.5,5 L18.5,16 C18.5,16.8 17.8,17.5 17,17.5 L3,17.5 C2.2,17.5 1.5,16.8 1.5,16 L1.5,5 L1.5,5 L1.5,5 Z"/><circle cx="3.7" cy="10.5" r=".8"/></svg>',tablet:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" d="M5,18.5 C4.2,18.5 3.5,17.8 3.5,17 L3.5,3 C3.5,2.2 4.2,1.5 5,1.5 L16,1.5 C16.8,1.5 17.5,2.2 17.5,3 L17.5,17 C17.5,17.8 16.8,18.5 16,18.5 L5,18.5 L5,18.5 L5,18.5 Z"/><circle cx="10.5" cy="16.3" r=".8"/></svg>',tag:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" stroke-width="1.1" d="M17.5,3.71 L17.5,7.72 C17.5,7.96 17.4,8.2 17.21,8.39 L8.39,17.2 C7.99,17.6 7.33,17.6 6.93,17.2 L2.8,13.07 C2.4,12.67 2.4,12.01 2.8,11.61 L11.61,2.8 C11.81,2.6 12.08,2.5 12.34,2.5 L16.19,2.5 C16.52,2.5 16.86,2.63 17.11,2.88 C17.35,3.11 17.48,3.4 17.5,3.71 L17.5,3.71 Z"/><circle cx="14" cy="6" r="1"/></svg>',thumbnails:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect fill="none" stroke="#000" x="3.5" y="3.5" width="5" height="5"/><rect fill="none" stroke="#000" x="11.5" y="3.5" width="5" height="5"/><rect fill="none" stroke="#000" x="11.5" y="11.5" width="5" height="5"/><rect fill="none" stroke="#000" x="3.5" y="11.5" width="5" height="5"/></svg>',trash:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" points="6.5 3 6.5 1.5 13.5 1.5 13.5 3"/><polyline fill="none" stroke="#000" points="4.5 4 4.5 18.5 15.5 18.5 15.5 4"/><rect x="8" y="7" width="1" height="9"/><rect x="11" y="7" width="1" height="9"/><rect x="2" y="3" width="16" height="1"/></svg>',"triangle-down":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="5 7 15 7 10 12"/></svg>',"triangle-left":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="12 5 7 10 12 15"/></svg>',"triangle-right":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="8 5 13 10 8 15"/></svg>',"triangle-up":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="5 13 10 8 15 13"/></svg>',tripadvisor:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M19.021,7.866C19.256,6.862,20,5.854,20,5.854h-3.346C14.781,4.641,12.504,4,9.98,4C7.363,4,4.999,4.651,3.135,5.876H0\tc0,0,0.738,0.987,0.976,1.988c-0.611,0.837-0.973,1.852-0.973,2.964c0,2.763,2.249,5.009,5.011,5.009\tc1.576,0,2.976-0.737,3.901-1.879l1.063,1.599l1.075-1.615c0.475,0.611,1.1,1.111,1.838,1.451c1.213,0.547,2.574,0.612,3.825,0.15\tc2.589-0.963,3.913-3.852,2.964-6.439c-0.175-0.463-0.4-0.876-0.675-1.238H19.021z M16.38,14.594\tc-1.002,0.371-2.088,0.328-3.06-0.119c-0.688-0.317-1.252-0.817-1.657-1.438c-0.164-0.25-0.313-0.52-0.417-0.811\tc-0.124-0.328-0.186-0.668-0.217-1.014c-0.063-0.689,0.037-1.396,0.339-2.043c0.448-0.971,1.251-1.71,2.25-2.079\tc2.075-0.765,4.375,0.3,5.14,2.366c0.762,2.066-0.301,4.37-2.363,5.134L16.38,14.594L16.38,14.594z M8.322,13.066\tc-0.72,1.059-1.935,1.76-3.309,1.76c-2.207,0-4.001-1.797-4.001-3.996c0-2.203,1.795-4.002,4.001-4.002\tc2.204,0,3.999,1.8,3.999,4.002c0,0.137-0.024,0.261-0.04,0.396c-0.067,0.678-0.284,1.313-0.648,1.853v-0.013H8.322z M2.472,10.775\tc0,1.367,1.112,2.479,2.476,2.479c1.363,0,2.472-1.11,2.472-2.479c0-1.359-1.11-2.468-2.472-2.468\tC3.584,8.306,2.473,9.416,2.472,10.775L2.472,10.775z M12.514,10.775c0,1.367,1.104,2.479,2.471,2.479\tc1.363,0,2.474-1.108,2.474-2.479c0-1.359-1.11-2.468-2.474-2.468c-1.364,0-2.477,1.109-2.477,2.468H12.514z M3.324,10.775\tc0-0.893,0.726-1.618,1.614-1.618c0.889,0,1.625,0.727,1.625,1.618c0,0.898-0.725,1.627-1.625,1.627\tc-0.901,0-1.625-0.729-1.625-1.627H3.324z M13.354,10.775c0-0.893,0.726-1.618,1.627-1.618c0.886,0,1.61,0.727,1.61,1.618\tc0,0.898-0.726,1.627-1.626,1.627s-1.625-0.729-1.625-1.627H13.354z M9.977,4.875c1.798,0,3.425,0.324,4.849,0.968\tc-0.535,0.015-1.061,0.108-1.586,0.3c-1.264,0.463-2.264,1.388-2.815,2.604c-0.262,0.551-0.398,1.133-0.448,1.72\tC9.79,7.905,7.677,5.873,5.076,5.82C6.501,5.208,8.153,4.875,9.94,4.875H9.977z"/></svg>',tumblr:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M6.885,8.598c0,0,0,3.393,0,4.996c0,0.282,0,0.66,0.094,0.942c0.377,1.509,1.131,2.545,2.545,3.11 c1.319,0.472,2.356,0.472,3.676,0c0.565-0.188,1.132-0.659,1.132-0.659l-0.849-2.263c0,0-1.036,0.378-1.603,0.283 c-0.565-0.094-1.226-0.66-1.226-1.508c0-1.603,0-4.902,0-4.902h2.828V5.771h-2.828V2H8.205c0,0-0.094,0.66-0.188,0.942 C7.828,3.791,7.262,4.733,6.603,5.394C5.848,6.147,5,6.43,5,6.43v2.168H6.885z"/></svg>',tv:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="16" width="6" height="1"/><rect fill="none" stroke="#000" x=".5" y="3.5" width="19" height="11"/></svg>',twitter:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M19,4.74 C18.339,5.029 17.626,5.229 16.881,5.32 C17.644,4.86 18.227,4.139 18.503,3.28 C17.79,3.7 17.001,4.009 16.159,4.17 C15.485,3.45 14.526,3 13.464,3 C11.423,3 9.771,4.66 9.771,6.7 C9.771,6.99 9.804,7.269 9.868,7.539 C6.795,7.38 4.076,5.919 2.254,3.679 C1.936,4.219 1.754,4.86 1.754,5.539 C1.754,6.82 2.405,7.95 3.397,8.61 C2.79,8.589 2.22,8.429 1.723,8.149 L1.723,8.189 C1.723,9.978 2.997,11.478 4.686,11.82 C4.376,11.899 4.049,11.939 3.713,11.939 C3.475,11.939 3.245,11.919 3.018,11.88 C3.49,13.349 4.852,14.419 6.469,14.449 C5.205,15.429 3.612,16.019 1.882,16.019 C1.583,16.019 1.29,16.009 1,15.969 C2.635,17.019 4.576,17.629 6.662,17.629 C13.454,17.629 17.17,12 17.17,7.129 C17.17,6.969 17.166,6.809 17.157,6.649 C17.879,6.129 18.504,5.478 19,4.74"/></svg>',uikit:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="14.4,3.1 11.3,5.1 15,7.3 15,12.9 10,15.7 5,12.9 5,8.5 2,6.8 2,14.8 9.9,19.5 18,14.8 18,5.3"/><polygon points="9.8,4.2 6.7,2.4 9.8,0.4 12.9,2.3"/></svg>',unlock:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect fill="none" stroke="#000" x="3.5" y="8.5" width="13" height="10"/><path fill="none" stroke="#000" d="M6.5,8.5 L6.5,4.9 C6.5,3 8.1,1.5 10,1.5 C11.9,1.5 13.5,3 13.5,4.9"/></svg>',upload:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polyline fill="none" stroke="#000" points="5 8 9.5 3.5 14 8"/><rect x="3" y="17" width="13" height="1"/><line fill="none" stroke="#000" x1="9.5" y1="15" x2="9.5" y2="4"/></svg>',user:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="9.9" cy="6.4" r="4.4"/><path fill="none" stroke="#000" stroke-width="1.1" d="M1.5,19 C2.3,14.5 5.8,11.2 10,11.2 C14.2,11.2 17.7,14.6 18.5,19.2"/></svg>',users:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle fill="none" stroke="#000" stroke-width="1.1" cx="7.7" cy="8.6" r="3.5"/><path fill="none" stroke="#000" stroke-width="1.1" d="M1,18.1 C1.7,14.6 4.4,12.1 7.6,12.1 C10.9,12.1 13.7,14.8 14.3,18.3"/><path fill="none" stroke="#000" stroke-width="1.1" d="M11.4,4 C12.8,2.4 15.4,2.8 16.3,4.7 C17.2,6.6 15.7,8.9 13.6,8.9 C16.5,8.9 18.8,11.3 19.2,14.1"/></svg>',"video-camera":'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon fill="none" stroke="#000" points="17.5 6.9 17.5 13.1 13.5 10.4 13.5 14.5 2.5 14.5 2.5 5.5 13.5 5.5 13.5 9.6 17.5 6.9"/></svg>',vimeo:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2.065,7.59C1.84,7.367,1.654,7.082,1.468,6.838c-0.332-0.42-0.137-0.411,0.274-0.772c1.026-0.91,2.004-1.896,3.127-2.688 c1.017-0.713,2.365-1.173,3.286-0.039c0.849,1.045,0.869,2.629,1.084,3.891c0.215,1.309,0.421,2.648,0.88,3.901 c0.127,0.352,0.37,1.018,0.81,1.074c0.567,0.078,1.145-0.917,1.408-1.289c0.684-0.987,1.611-2.317,1.494-3.587 c-0.115-1.349-1.572-1.095-2.482-0.773c0.146-1.514,1.555-3.216,2.912-3.792c1.439-0.597,3.579-0.587,4.302,1.036 c0.772,1.759,0.078,3.802-0.763,5.396c-0.918,1.731-2.1,3.333-3.363,4.829c-1.114,1.329-2.432,2.787-4.093,3.422 c-1.897,0.723-3.021-0.686-3.667-2.318c-0.705-1.777-1.056-3.771-1.565-5.621C4.898,8.726,4.644,7.836,4.136,7.191 C3.473,6.358,2.72,7.141,2.065,7.59C1.977,7.502,2.115,7.551,2.065,7.59L2.065,7.59z"/></svg>',warning:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="14" r="1"/><circle fill="none" stroke="#000" stroke-width="1.1" cx="10" cy="10" r="9"/><path d="M10.97,7.72 C10.85,9.54 10.56,11.29 10.56,11.29 C10.51,11.87 10.27,12 9.99,12 C9.69,12 9.49,11.87 9.43,11.29 C9.43,11.29 9.16,9.54 9.03,7.72 C8.96,6.54 9.03,6 9.03,6 C9.03,5.45 9.46,5.02 9.99,5 C10.53,5.01 10.97,5.44 10.97,6 C10.97,6 11.04,6.54 10.97,7.72 L10.97,7.72 Z"/></svg>',whatsapp:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M16.7,3.3c-1.8-1.8-4.1-2.8-6.7-2.8c-5.2,0-9.4,4.2-9.4,9.4c0,1.7,0.4,3.3,1.3,4.7l-1.3,4.9l5-1.3c1.4,0.8,2.9,1.2,4.5,1.2 l0,0l0,0c5.2,0,9.4-4.2,9.4-9.4C19.5,7.4,18.5,5,16.7,3.3 M10.1,17.7L10.1,17.7c-1.4,0-2.8-0.4-4-1.1l-0.3-0.2l-3,0.8l0.8-2.9 l-0.2-0.3c-0.8-1.2-1.2-2.7-1.2-4.2c0-4.3,3.5-7.8,7.8-7.8c2.1,0,4.1,0.8,5.5,2.3c1.5,1.5,2.3,3.4,2.3,5.5 C17.9,14.2,14.4,17.7,10.1,17.7 M14.4,11.9c-0.2-0.1-1.4-0.7-1.6-0.8c-0.2-0.1-0.4-0.1-0.5,0.1c-0.2,0.2-0.6,0.8-0.8,0.9 c-0.1,0.2-0.3,0.2-0.5,0.1c-0.2-0.1-1-0.4-1.9-1.2c-0.7-0.6-1.2-1.4-1.3-1.6c-0.1-0.2,0-0.4,0.1-0.5C8,8.8,8.1,8.7,8.2,8.5 c0.1-0.1,0.2-0.2,0.2-0.4c0.1-0.2,0-0.3,0-0.4C8.4,7.6,7.9,6.5,7.7,6C7.5,5.5,7.3,5.6,7.2,5.6c-0.1,0-0.3,0-0.4,0 c-0.2,0-0.4,0.1-0.6,0.3c-0.2,0.2-0.8,0.8-0.8,2c0,1.2,0.8,2.3,1,2.4c0.1,0.2,1.7,2.5,4,3.5c0.6,0.2,1,0.4,1.3,0.5 c0.6,0.2,1.1,0.2,1.5,0.1c0.5-0.1,1.4-0.6,1.6-1.1c0.2-0.5,0.2-1,0.1-1.1C14.8,12.1,14.6,12,14.4,11.9"/></svg>',wordpress:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10,0.5c-5.2,0-9.5,4.3-9.5,9.5s4.3,9.5,9.5,9.5c5.2,0,9.5-4.3,9.5-9.5S15.2,0.5,10,0.5L10,0.5L10,0.5z M15.6,3.9h-0.1 c-0.8,0-1.4,0.7-1.4,1.5c0,0.7,0.4,1.3,0.8,1.9c0.3,0.6,0.7,1.3,0.7,2.3c0,0.7-0.3,1.5-0.6,2.7L14.1,15l-3-8.9 c0.5,0,0.9-0.1,0.9-0.1C12.5,6,12.5,5.3,12,5.4c0,0-1.3,0.1-2.2,0.1C9,5.5,7.7,5.4,7.7,5.4C7.2,5.3,7.2,6,7.6,6c0,0,0.4,0.1,0.9,0.1 l1.3,3.5L8,15L5,6.1C5.5,6.1,5.9,6,5.9,6C6.4,6,6.3,5.3,5.9,5.4c0,0-1.3,0.1-2.2,0.1c-0.2,0-0.3,0-0.5,0c1.5-2.2,4-3.7,6.9-3.7 C12.2,1.7,14.1,2.6,15.6,3.9L15.6,3.9L15.6,3.9z M2.5,6.6l3.9,10.8c-2.7-1.3-4.6-4.2-4.6-7.4C1.8,8.8,2,7.6,2.5,6.6L2.5,6.6L2.5,6.6 z M10.2,10.7l2.5,6.9c0,0,0,0.1,0.1,0.1C11.9,18,11,18.2,10,18.2c-0.8,0-1.6-0.1-2.3-0.3L10.2,10.7L10.2,10.7L10.2,10.7z M14.2,17.1 l2.5-7.3c0.5-1.2,0.6-2.1,0.6-2.9c0-0.3,0-0.6-0.1-0.8c0.6,1.2,1,2.5,1,4C18.3,13,16.6,15.7,14.2,17.1L14.2,17.1L14.2,17.1z"/></svg>',world:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="#000" d="M1,10.5 L19,10.5"/><path fill="none" stroke="#000" d="M2.35,15.5 L17.65,15.5"/><path fill="none" stroke="#000" d="M2.35,5.5 L17.523,5.5"/><path fill="none" stroke="#000" d="M10,19.46 L9.98,19.46 C7.31,17.33 5.61,14.141 5.61,10.58 C5.61,7.02 7.33,3.83 10,1.7 C10.01,1.7 9.99,1.7 10,1.7 L10,1.7 C12.67,3.83 14.4,7.02 14.4,10.58 C14.4,14.141 12.67,17.33 10,19.46 L10,19.46 L10,19.46 L10,19.46 Z"/><circle fill="none" stroke="#000" cx="10" cy="10.5" r="9"/></svg>',xing:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M4.4,4.56 C4.24,4.56 4.11,4.61 4.05,4.72 C3.98,4.83 3.99,4.97 4.07,5.12 L5.82,8.16 L5.82,8.17 L3.06,13.04 C2.99,13.18 2.99,13.33 3.06,13.44 C3.12,13.55 3.24,13.62 3.4,13.62 L6,13.62 C6.39,13.62 6.57,13.36 6.71,13.12 C6.71,13.12 9.41,8.35 9.51,8.16 C9.49,8.14 7.72,5.04 7.72,5.04 C7.58,4.81 7.39,4.56 6.99,4.56 L4.4,4.56 L4.4,4.56 Z"/><path d="M15.3,1 C14.91,1 14.74,1.25 14.6,1.5 C14.6,1.5 9.01,11.42 8.82,11.74 C8.83,11.76 12.51,18.51 12.51,18.51 C12.64,18.74 12.84,19 13.23,19 L15.82,19 C15.98,19 16.1,18.94 16.16,18.83 C16.23,18.72 16.23,18.57 16.16,18.43 L12.5,11.74 L12.5,11.72 L18.25,1.56 C18.32,1.42 18.32,1.27 18.25,1.16 C18.21,1.06 18.08,1 17.93,1 L15.3,1 L15.3,1 Z"/></svg>',yelp:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.175,14.971c-0.112,0.77-1.686,2.767-2.406,3.054c-0.246,0.1-0.487,0.076-0.675-0.069\tc-0.122-0.096-2.446-3.859-2.446-3.859c-0.194-0.293-0.157-0.682,0.083-0.978c0.234-0.284,0.581-0.393,0.881-0.276\tc0.016,0.01,4.21,1.394,4.332,1.482c0.178,0.148,0.263,0.379,0.225,0.646L17.175,14.971L17.175,14.971z M11.464,10.789\tc-0.203-0.307-0.199-0.666,0.009-0.916c0,0,2.625-3.574,2.745-3.657c0.203-0.135,0.452-0.141,0.69-0.025\tc0.691,0.335,2.085,2.405,2.167,3.199v0.027c0.024,0.271-0.082,0.491-0.273,0.623c-0.132,0.083-4.43,1.155-4.43,1.155\tc-0.322,0.096-0.68-0.06-0.882-0.381L11.464,10.789z M9.475,9.563C9.32,9.609,8.848,9.757,8.269,8.817c0,0-3.916-6.16-4.007-6.351\tc-0.057-0.212,0.011-0.455,0.202-0.65C5.047,1.211,8.21,0.327,9.037,0.529c0.27,0.069,0.457,0.238,0.522,0.479\tc0.047,0.266,0.433,5.982,0.488,7.264C10.098,9.368,9.629,9.517,9.475,9.563z M9.927,19.066c-0.083,0.225-0.273,0.373-0.54,0.421\tc-0.762,0.13-3.15-0.751-3.647-1.342c-0.096-0.131-0.155-0.262-0.167-0.394c-0.011-0.095,0-0.189,0.036-0.272\tc0.061-0.155,2.917-3.538,2.917-3.538c0.214-0.272,0.595-0.355,0.952-0.213c0.345,0.13,0.56,0.428,0.536,0.749\tC10.014,14.479,9.977,18.923,9.927,19.066z M3.495,13.912c-0.235-0.009-0.444-0.148-0.568-0.382c-0.089-0.17-0.151-0.453-0.19-0.794\tC2.63,11.701,2.761,10.144,3.07,9.648c0.145-0.226,0.357-0.345,0.592-0.336c0.154,0,4.255,1.667,4.255,1.667\tc0.321,0.118,0.521,0.453,0.5,0.833c-0.023,0.37-0.236,0.655-0.551,0.738L3.495,13.912z"/></svg>',youtube:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15,4.1c1,0.1,2.3,0,3,0.8c0.8,0.8,0.9,2.1,0.9,3.1C19,9.2,19,10.9,19,12c-0.1,1.1,0,2.4-0.5,3.4c-0.5,1.1-1.4,1.5-2.5,1.6 c-1.2,0.1-8.6,0.1-11,0c-1.1-0.1-2.4-0.1-3.2-1c-0.7-0.8-0.7-2-0.8-3C1,11.8,1,10.1,1,8.9c0-1.1,0-2.4,0.5-3.4C2,4.5,3,4.3,4.1,4.2 C5.3,4.1,12.6,4,15,4.1z M8,7.5v6l5.5-3L8,7.5z"/></svg>'});}return "undefined"!=typeof window&&window.UIkit&&window.UIkit.use(i),i});
    });

    /* src/App.svelte generated by Svelte v3.31.0 */
    const file = "src/App.svelte";

    // (405:1) {:else}
    function create_else_block_1(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "should not show";
    			add_location(p, file, 405, 2, 9192);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(405:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (290:38) 
    function create_if_block_1(ctx) {
    	let form;
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let label0;
    	let input0;
    	let input0_value_value;
    	let t2;
    	let t3;
    	let label1;
    	let input1;
    	let input1_value_value;
    	let t4;
    	let t5;
    	let div4;
    	let label2;
    	let t7;
    	let div3;
    	let input2;
    	let t8;
    	let div6;
    	let label3;
    	let t10;
    	let div5;
    	let input3;
    	let t11;
    	let div8;
    	let label4;
    	let t13;
    	let div7;
    	let input4;
    	let t14;
    	let if_block_anchor;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*avaliableCash*/ ctx[5] && /*pricePerShareShares*/ ctx[6] && /*avaliableCash*/ ctx[5] >= /*minValueShares*/ ctx[11].finalPrice.value) return create_if_block_2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			form = element("form");
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "Buy / Sell:";
    			t1 = space();
    			div1 = element("div");
    			label0 = element("label");
    			input0 = element("input");
    			t2 = text("\n\t\t\t\t\t\tBuy");
    			t3 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t4 = text("\n\t\t\t\t\t\tSell");
    			t5 = space();
    			div4 = element("div");
    			label2 = element("label");
    			label2.textContent = "Avaliable\n\t\t\t\t\tcash:";
    			t7 = space();
    			div3 = element("div");
    			input2 = element("input");
    			t8 = space();
    			div6 = element("div");
    			label3 = element("label");
    			label3.textContent = "Price\n\t\t\t\t\tper share:";
    			t10 = space();
    			div5 = element("div");
    			input3 = element("input");
    			t11 = space();
    			div8 = element("div");
    			label4 = element("label");
    			label4.textContent = "Broker commission (%):";
    			t13 = space();
    			div7 = element("div");
    			input4 = element("input");
    			t14 = space();
    			if_block.c();
    			if_block_anchor = empty();
    			attr_dev(div0, "class", "uk-form-label");
    			add_location(div0, file, 292, 4, 6586);
    			attr_dev(input0, "class", "uk-radio");
    			attr_dev(input0, "type", "radio");
    			input0.__value = input0_value_value = "buy";
    			input0.value = input0.__value;
    			/*$$binding_groups*/ ctx[13][2].push(input0);
    			add_location(input0, file, 295, 6, 6707);
    			add_location(label0, file, 294, 5, 6693);
    			attr_dev(input1, "class", "uk-radio");
    			attr_dev(input1, "type", "radio");
    			input1.__value = input1_value_value = "sell";
    			input1.value = input1.__value;
    			/*$$binding_groups*/ ctx[13][2].push(input1);
    			add_location(input1, file, 303, 6, 6861);
    			add_location(label1, file, 302, 5, 6847);
    			attr_dev(div1, "class", "uk-form-controls uk-form-controls-text");
    			add_location(div1, file, 293, 4, 6635);
    			attr_dev(div2, "class", "uk-margin");
    			add_location(div2, file, 291, 3, 6558);
    			attr_dev(label2, "class", "uk-form-label");
    			attr_dev(label2, "for", "cash-avaliable");
    			add_location(label2, file, 313, 4, 7045);
    			attr_dev(input2, "class", "uk-input");
    			attr_dev(input2, "id", "cash-avaliable");
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "step", "0.01");
    			attr_dev(input2, "min", "0");
    			add_location(input2, file, 316, 5, 7164);
    			attr_dev(div3, "class", "uk-form-controls");
    			add_location(div3, file, 315, 4, 7128);
    			attr_dev(div4, "class", "uk-margin");
    			add_location(div4, file, 312, 3, 7017);
    			attr_dev(label3, "class", "uk-form-label");
    			attr_dev(label3, "for", "price-per-share-price");
    			add_location(label3, file, 327, 4, 7361);
    			attr_dev(input3, "class", "uk-input");
    			attr_dev(input3, "id", "price-per-share-price");
    			attr_dev(input3, "type", "number");
    			attr_dev(input3, "min", "0");
    			attr_dev(input3, "step", "0.01");
    			add_location(input3, file, 330, 5, 7488);
    			attr_dev(div5, "class", "uk-form-controls");
    			add_location(div5, file, 329, 4, 7452);
    			attr_dev(div6, "class", "uk-margin");
    			add_location(div6, file, 326, 3, 7333);
    			attr_dev(label4, "class", "uk-form-label");
    			attr_dev(label4, "for", "commission-percent-price");
    			add_location(label4, file, 341, 4, 7698);
    			attr_dev(input4, "class", "uk-input");
    			attr_dev(input4, "id", "commission-percent-price");
    			attr_dev(input4, "type", "number");
    			attr_dev(input4, "min", "0");
    			attr_dev(input4, "step", "0.01");
    			add_location(input4, file, 344, 5, 7835);
    			attr_dev(div7, "class", "uk-form-controls");
    			add_location(div7, file, 343, 4, 7799);
    			attr_dev(div8, "class", "uk-margin");
    			add_location(div8, file, 340, 3, 7670);
    			attr_dev(form, "class", "uk-form-horizontal");
    			add_location(form, file, 290, 2, 6521);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, label0);
    			append_dev(label0, input0);
    			input0.checked = input0.__value === /*buyOrSellShares*/ ctx[4];
    			append_dev(label0, t2);
    			append_dev(div1, t3);
    			append_dev(div1, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*buyOrSellShares*/ ctx[4];
    			append_dev(label1, t4);
    			append_dev(form, t5);
    			append_dev(form, div4);
    			append_dev(div4, label2);
    			append_dev(div4, t7);
    			append_dev(div4, div3);
    			append_dev(div3, input2);
    			set_input_value(input2, /*avaliableCash*/ ctx[5]);
    			append_dev(form, t8);
    			append_dev(form, div6);
    			append_dev(div6, label3);
    			append_dev(div6, t10);
    			append_dev(div6, div5);
    			append_dev(div5, input3);
    			set_input_value(input3, /*pricePerShareShares*/ ctx[6]);
    			append_dev(form, t11);
    			append_dev(form, div8);
    			append_dev(div8, label4);
    			append_dev(div8, t13);
    			append_dev(div8, div7);
    			append_dev(div7, input4);
    			set_input_value(input4, /*commissionPercentShares*/ ctx[7]);
    			insert_dev(target, t14, anchor);
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_handler_2*/ ctx[20]),
    					listen_dev(input1, "change", /*input1_change_handler_2*/ ctx[21]),
    					listen_dev(input2, "input", /*input2_input_handler_1*/ ctx[22]),
    					listen_dev(input3, "input", /*input3_input_handler_1*/ ctx[23]),
    					listen_dev(input4, "input", /*input4_input_handler_1*/ ctx[24])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*buyOrSellShares*/ 16) {
    				input0.checked = input0.__value === /*buyOrSellShares*/ ctx[4];
    			}

    			if (dirty & /*buyOrSellShares*/ 16) {
    				input1.checked = input1.__value === /*buyOrSellShares*/ ctx[4];
    			}

    			if (dirty & /*avaliableCash*/ 32 && to_number(input2.value) !== /*avaliableCash*/ ctx[5]) {
    				set_input_value(input2, /*avaliableCash*/ ctx[5]);
    			}

    			if (dirty & /*pricePerShareShares*/ 64 && to_number(input3.value) !== /*pricePerShareShares*/ ctx[6]) {
    				set_input_value(input3, /*pricePerShareShares*/ ctx[6]);
    			}

    			if (dirty & /*commissionPercentShares*/ 128 && to_number(input4.value) !== /*commissionPercentShares*/ ctx[7]) {
    				set_input_value(input4, /*commissionPercentShares*/ ctx[7]);
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			/*$$binding_groups*/ ctx[13][2].splice(/*$$binding_groups*/ ctx[13][2].indexOf(input0), 1);
    			/*$$binding_groups*/ ctx[13][2].splice(/*$$binding_groups*/ ctx[13][2].indexOf(input1), 1);
    			if (detaching) detach_dev(t14);
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(290:38) ",
    		ctx
    	});

    	return block;
    }

    // (195:1) {#if sharesOrPrice === 'price'}
    function create_if_block(ctx) {
    	let form;
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let label0;
    	let input0;
    	let input0_value_value;
    	let t2;
    	let t3;
    	let label1;
    	let input1;
    	let input1_value_value;
    	let t4;
    	let t5;
    	let div4;
    	let label2;
    	let t7;
    	let div3;
    	let input2;
    	let t8;
    	let div6;
    	let label3;
    	let t10;
    	let div5;
    	let input3;
    	let t11;
    	let div8;
    	let label4;
    	let t13;
    	let div7;
    	let input4;
    	let t14;
    	let table;
    	let tr0;
    	let td0;
    	let t16;
    	let td1;
    	let t17_value = /*priceDisplay*/ ctx[9].grossPrice.format() + "";
    	let t17;
    	let t18;
    	let tr1;
    	let td2;
    	let t20;
    	let td3;
    	let t21_value = /*priceDisplay*/ ctx[9].finalCommission.format() + "";
    	let t21;
    	let t22;
    	let tr2;
    	let td4;
    	let t24;
    	let td5;
    	let t25_value = /*priceDisplay*/ ctx[9].cess.format() + "";
    	let t25;
    	let t26;
    	let tr3;
    	let td6;
    	let t28;
    	let td7;
    	let t29_value = /*priceDisplay*/ ctx[9].trade.format() + "";
    	let t29;
    	let t30;
    	let tr4;
    	let td8;
    	let t32;
    	let td9;
    	let t33_value = /*priceDisplay*/ ctx[9].gct.format() + "";
    	let t33;
    	let t34;
    	let tr5;
    	let td10;
    	let t36;
    	let td11;
    	let t37_value = /*priceDisplay*/ ctx[9].totalFees.format() + "";
    	let t37;
    	let t38;
    	let tr6;
    	let td12;
    	let t40;
    	let td13;
    	let t41_value = /*priceDisplay*/ ctx[9].finalPrice.format() + "";
    	let t41;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "Buy / Sell:";
    			t1 = space();
    			div1 = element("div");
    			label0 = element("label");
    			input0 = element("input");
    			t2 = text("\n\t\t\t\t\t\tBuy");
    			t3 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t4 = text("\n\t\t\t\t\t\tSell");
    			t5 = space();
    			div4 = element("div");
    			label2 = element("label");
    			label2.textContent = "Number of\n\t\t\t\t\tshares:";
    			t7 = space();
    			div3 = element("div");
    			input2 = element("input");
    			t8 = space();
    			div6 = element("div");
    			label3 = element("label");
    			label3.textContent = "Price\n\t\t\t\t\tper share:";
    			t10 = space();
    			div5 = element("div");
    			input3 = element("input");
    			t11 = space();
    			div8 = element("div");
    			label4 = element("label");
    			label4.textContent = "Broker commission (%):";
    			t13 = space();
    			div7 = element("div");
    			input4 = element("input");
    			t14 = space();
    			table = element("table");
    			tr0 = element("tr");
    			td0 = element("td");
    			td0.textContent = "Gross price";
    			t16 = space();
    			td1 = element("td");
    			t17 = text(t17_value);
    			t18 = space();
    			tr1 = element("tr");
    			td2 = element("td");
    			td2.textContent = "Commission";
    			t20 = space();
    			td3 = element("td");
    			t21 = text(t21_value);
    			t22 = space();
    			tr2 = element("tr");
    			td4 = element("td");
    			td4.textContent = "Cess fee";
    			t24 = space();
    			td5 = element("td");
    			t25 = text(t25_value);
    			t26 = space();
    			tr3 = element("tr");
    			td6 = element("td");
    			td6.textContent = "Trade fee";
    			t28 = space();
    			td7 = element("td");
    			t29 = text(t29_value);
    			t30 = space();
    			tr4 = element("tr");
    			td8 = element("td");
    			td8.textContent = "GCT tax";
    			t32 = space();
    			td9 = element("td");
    			t33 = text(t33_value);
    			t34 = space();
    			tr5 = element("tr");
    			td10 = element("td");
    			td10.textContent = "Total fees";
    			t36 = space();
    			td11 = element("td");
    			t37 = text(t37_value);
    			t38 = space();
    			tr6 = element("tr");
    			td12 = element("td");
    			td12.textContent = "Final price";
    			t40 = space();
    			td13 = element("td");
    			t41 = text(t41_value);
    			attr_dev(div0, "class", "uk-form-label");
    			add_location(div0, file, 197, 4, 4419);
    			attr_dev(input0, "class", "uk-radio");
    			attr_dev(input0, "type", "radio");
    			input0.__value = input0_value_value = "buy";
    			input0.value = input0.__value;
    			/*$$binding_groups*/ ctx[13][1].push(input0);
    			add_location(input0, file, 200, 6, 4540);
    			add_location(label0, file, 199, 5, 4526);
    			attr_dev(input1, "class", "uk-radio");
    			attr_dev(input1, "type", "radio");
    			input1.__value = input1_value_value = "sell";
    			input1.value = input1.__value;
    			/*$$binding_groups*/ ctx[13][1].push(input1);
    			add_location(input1, file, 208, 6, 4688);
    			add_location(label1, file, 207, 5, 4674);
    			attr_dev(div1, "class", "uk-form-controls uk-form-controls-text");
    			add_location(div1, file, 198, 4, 4468);
    			attr_dev(div2, "class", "uk-margin");
    			add_location(div2, file, 196, 3, 4391);
    			attr_dev(label2, "class", "uk-form-label");
    			attr_dev(label2, "for", "num-of-shares");
    			add_location(label2, file, 218, 4, 4866);
    			attr_dev(input2, "class", "uk-input");
    			attr_dev(input2, "id", "num-of-shares");
    			attr_dev(input2, "type", "number");
    			attr_dev(input2, "min", "0");
    			add_location(input2, file, 221, 5, 4986);
    			attr_dev(div3, "class", "uk-form-controls");
    			add_location(div3, file, 220, 4, 4950);
    			attr_dev(div4, "class", "uk-margin");
    			add_location(div4, file, 217, 3, 4838);
    			attr_dev(label3, "class", "uk-form-label");
    			attr_dev(label3, "for", "price-per-share-price");
    			add_location(label3, file, 231, 4, 5162);
    			attr_dev(input3, "class", "uk-input");
    			attr_dev(input3, "id", "price-per-share-price");
    			attr_dev(input3, "type", "number");
    			attr_dev(input3, "min", "0");
    			attr_dev(input3, "step", "0.01");
    			add_location(input3, file, 234, 5, 5289);
    			attr_dev(div5, "class", "uk-form-controls");
    			add_location(div5, file, 233, 4, 5253);
    			attr_dev(div6, "class", "uk-margin");
    			add_location(div6, file, 230, 3, 5134);
    			attr_dev(label4, "class", "uk-form-label");
    			attr_dev(label4, "for", "commission-percent-price");
    			add_location(label4, file, 245, 4, 5493);
    			attr_dev(input4, "class", "uk-input");
    			attr_dev(input4, "id", "commission-percent-price");
    			attr_dev(input4, "type", "number");
    			attr_dev(input4, "min", "0");
    			attr_dev(input4, "step", "0.01");
    			add_location(input4, file, 248, 5, 5630);
    			attr_dev(div7, "class", "uk-form-controls");
    			add_location(div7, file, 247, 4, 5594);
    			attr_dev(div8, "class", "uk-margin");
    			add_location(div8, file, 244, 3, 5465);
    			attr_dev(form, "class", "uk-form-horizontal");
    			add_location(form, file, 195, 2, 4354);
    			add_location(td0, file, 261, 4, 5876);
    			add_location(td1, file, 262, 4, 5901);
    			add_location(tr0, file, 260, 3, 5867);
    			add_location(td2, file, 265, 4, 5966);
    			add_location(td3, file, 266, 4, 5990);
    			add_location(tr1, file, 264, 3, 5957);
    			add_location(td4, file, 269, 4, 6060);
    			add_location(td5, file, 270, 4, 6082);
    			add_location(tr2, file, 268, 3, 6051);
    			add_location(td6, file, 273, 4, 6141);
    			add_location(td7, file, 274, 4, 6164);
    			add_location(tr3, file, 272, 3, 6132);
    			add_location(td8, file, 277, 4, 6224);
    			add_location(td9, file, 278, 4, 6245);
    			add_location(tr4, file, 276, 3, 6215);
    			add_location(td10, file, 281, 4, 6303);
    			add_location(td11, file, 282, 4, 6327);
    			add_location(tr5, file, 280, 3, 6294);
    			add_location(td12, file, 285, 4, 6391);
    			add_location(td13, file, 286, 4, 6416);
    			add_location(tr6, file, 284, 3, 6382);
    			attr_dev(table, "class", "uk-table uk-table-divider");
    			add_location(table, file, 259, 2, 5822);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, label0);
    			append_dev(label0, input0);
    			input0.checked = input0.__value === /*buyOrSell*/ ctx[0];
    			append_dev(label0, t2);
    			append_dev(div1, t3);
    			append_dev(div1, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*buyOrSell*/ ctx[0];
    			append_dev(label1, t4);
    			append_dev(form, t5);
    			append_dev(form, div4);
    			append_dev(div4, label2);
    			append_dev(div4, t7);
    			append_dev(div4, div3);
    			append_dev(div3, input2);
    			set_input_value(input2, /*numOfShares*/ ctx[1]);
    			append_dev(form, t8);
    			append_dev(form, div6);
    			append_dev(div6, label3);
    			append_dev(div6, t10);
    			append_dev(div6, div5);
    			append_dev(div5, input3);
    			set_input_value(input3, /*pricePerShare*/ ctx[2]);
    			append_dev(form, t11);
    			append_dev(form, div8);
    			append_dev(div8, label4);
    			append_dev(div8, t13);
    			append_dev(div8, div7);
    			append_dev(div7, input4);
    			set_input_value(input4, /*commissionPercent*/ ctx[3]);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, table, anchor);
    			append_dev(table, tr0);
    			append_dev(tr0, td0);
    			append_dev(tr0, t16);
    			append_dev(tr0, td1);
    			append_dev(td1, t17);
    			append_dev(table, t18);
    			append_dev(table, tr1);
    			append_dev(tr1, td2);
    			append_dev(tr1, t20);
    			append_dev(tr1, td3);
    			append_dev(td3, t21);
    			append_dev(table, t22);
    			append_dev(table, tr2);
    			append_dev(tr2, td4);
    			append_dev(tr2, t24);
    			append_dev(tr2, td5);
    			append_dev(td5, t25);
    			append_dev(table, t26);
    			append_dev(table, tr3);
    			append_dev(tr3, td6);
    			append_dev(tr3, t28);
    			append_dev(tr3, td7);
    			append_dev(td7, t29);
    			append_dev(table, t30);
    			append_dev(table, tr4);
    			append_dev(tr4, td8);
    			append_dev(tr4, t32);
    			append_dev(tr4, td9);
    			append_dev(td9, t33);
    			append_dev(table, t34);
    			append_dev(table, tr5);
    			append_dev(tr5, td10);
    			append_dev(tr5, t36);
    			append_dev(tr5, td11);
    			append_dev(td11, t37);
    			append_dev(table, t38);
    			append_dev(table, tr6);
    			append_dev(tr6, td12);
    			append_dev(tr6, t40);
    			append_dev(tr6, td13);
    			append_dev(td13, t41);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_handler_1*/ ctx[15]),
    					listen_dev(input1, "change", /*input1_change_handler_1*/ ctx[16]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[17]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[18]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[19])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*buyOrSell*/ 1) {
    				input0.checked = input0.__value === /*buyOrSell*/ ctx[0];
    			}

    			if (dirty & /*buyOrSell*/ 1) {
    				input1.checked = input1.__value === /*buyOrSell*/ ctx[0];
    			}

    			if (dirty & /*numOfShares*/ 2 && to_number(input2.value) !== /*numOfShares*/ ctx[1]) {
    				set_input_value(input2, /*numOfShares*/ ctx[1]);
    			}

    			if (dirty & /*pricePerShare*/ 4 && to_number(input3.value) !== /*pricePerShare*/ ctx[2]) {
    				set_input_value(input3, /*pricePerShare*/ ctx[2]);
    			}

    			if (dirty & /*commissionPercent*/ 8 && to_number(input4.value) !== /*commissionPercent*/ ctx[3]) {
    				set_input_value(input4, /*commissionPercent*/ ctx[3]);
    			}

    			if (dirty & /*priceDisplay*/ 512 && t17_value !== (t17_value = /*priceDisplay*/ ctx[9].grossPrice.format() + "")) set_data_dev(t17, t17_value);
    			if (dirty & /*priceDisplay*/ 512 && t21_value !== (t21_value = /*priceDisplay*/ ctx[9].finalCommission.format() + "")) set_data_dev(t21, t21_value);
    			if (dirty & /*priceDisplay*/ 512 && t25_value !== (t25_value = /*priceDisplay*/ ctx[9].cess.format() + "")) set_data_dev(t25, t25_value);
    			if (dirty & /*priceDisplay*/ 512 && t29_value !== (t29_value = /*priceDisplay*/ ctx[9].trade.format() + "")) set_data_dev(t29, t29_value);
    			if (dirty & /*priceDisplay*/ 512 && t33_value !== (t33_value = /*priceDisplay*/ ctx[9].gct.format() + "")) set_data_dev(t33, t33_value);
    			if (dirty & /*priceDisplay*/ 512 && t37_value !== (t37_value = /*priceDisplay*/ ctx[9].totalFees.format() + "")) set_data_dev(t37, t37_value);
    			if (dirty & /*priceDisplay*/ 512 && t41_value !== (t41_value = /*priceDisplay*/ ctx[9].finalPrice.format() + "")) set_data_dev(t41, t41_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			/*$$binding_groups*/ ctx[13][1].splice(/*$$binding_groups*/ ctx[13][1].indexOf(input0), 1);
    			/*$$binding_groups*/ ctx[13][1].splice(/*$$binding_groups*/ ctx[13][1].indexOf(input1), 1);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(table);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(195:1) {#if sharesOrPrice === 'price'}",
    		ctx
    	});

    	return block;
    }

    // (395:2) {:else}
    function create_else_block(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*minValueShares*/ ctx[11].finalPrice.format() + "";
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let t6;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("Not enough cash.\n\t\t\t\t");
    			t1 = text(t1_value);
    			t2 = text("\n\t\t\t\tis needed to ");
    			t3 = text(/*buyOrSellShares*/ ctx[4]);
    			t4 = space();
    			t5 = text(minShares);
    			t6 = text("\n\t\t\t\tshare.");
    			add_location(p, file, 396, 3, 9037);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			append_dev(p, t2);
    			append_dev(p, t3);
    			append_dev(p, t4);
    			append_dev(p, t5);
    			append_dev(p, t6);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*minValueShares*/ 2048 && t1_value !== (t1_value = /*minValueShares*/ ctx[11].finalPrice.format() + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*buyOrSellShares*/ 16) set_data_dev(t3, /*buyOrSellShares*/ ctx[4]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(395:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (356:2) {#if avaliableCash && pricePerShareShares && avaliableCash >= minValueShares.finalPrice.value}
    function create_if_block_2(ctx) {
    	let table;
    	let tr0;
    	let td0;
    	let t1;
    	let td1;
    	let t2_value = new Intl.NumberFormat("en-JM").format(/*sharesDisplay*/ ctx[10].sharesNum) + "";
    	let t2;
    	let t3;
    	let tr1;
    	let td2;
    	let t5;
    	let td3;
    	let t6_value = /*sharesDisplay*/ ctx[10].grossPrice.format() + "";
    	let t6;
    	let t7;
    	let tr2;
    	let td4;
    	let t9;
    	let td5;
    	let t10_value = /*sharesDisplay*/ ctx[10].finalCommission.format() + "";
    	let t10;
    	let t11;
    	let tr3;
    	let td6;
    	let t13;
    	let td7;
    	let t14_value = /*sharesDisplay*/ ctx[10].cess.format() + "";
    	let t14;
    	let t15;
    	let tr4;
    	let td8;
    	let t17;
    	let td9;
    	let t18_value = /*sharesDisplay*/ ctx[10].trade.format() + "";
    	let t18;
    	let t19;
    	let tr5;
    	let td10;
    	let t21;
    	let td11;
    	let t22_value = /*sharesDisplay*/ ctx[10].gct.format() + "";
    	let t22;
    	let t23;
    	let tr6;
    	let td12;
    	let t25;
    	let td13;
    	let t26_value = /*sharesDisplay*/ ctx[10].totalFees.format() + "";
    	let t26;
    	let t27;
    	let tr7;
    	let td14;
    	let t29;
    	let td15;
    	let t30_value = /*sharesDisplay*/ ctx[10].finalPrice.format() + "";
    	let t30;

    	const block = {
    		c: function create() {
    			table = element("table");
    			tr0 = element("tr");
    			td0 = element("td");
    			td0.textContent = "Number of shares";
    			t1 = space();
    			td1 = element("td");
    			t2 = text(t2_value);
    			t3 = space();
    			tr1 = element("tr");
    			td2 = element("td");
    			td2.textContent = "Gross price";
    			t5 = space();
    			td3 = element("td");
    			t6 = text(t6_value);
    			t7 = space();
    			tr2 = element("tr");
    			td4 = element("td");
    			td4.textContent = "Commission";
    			t9 = space();
    			td5 = element("td");
    			t10 = text(t10_value);
    			t11 = space();
    			tr3 = element("tr");
    			td6 = element("td");
    			td6.textContent = "Cess fee";
    			t13 = space();
    			td7 = element("td");
    			t14 = text(t14_value);
    			t15 = space();
    			tr4 = element("tr");
    			td8 = element("td");
    			td8.textContent = "Trade fee";
    			t17 = space();
    			td9 = element("td");
    			t18 = text(t18_value);
    			t19 = space();
    			tr5 = element("tr");
    			td10 = element("td");
    			td10.textContent = "GCT tax";
    			t21 = space();
    			td11 = element("td");
    			t22 = text(t22_value);
    			t23 = space();
    			tr6 = element("tr");
    			td12 = element("td");
    			td12.textContent = "Total fees";
    			t25 = space();
    			td13 = element("td");
    			t26 = text(t26_value);
    			t27 = space();
    			tr7 = element("tr");
    			td14 = element("td");
    			td14.textContent = "Final price";
    			t29 = space();
    			td15 = element("td");
    			t30 = text(t30_value);
    			add_location(td0, file, 359, 5, 8213);
    			add_location(td1, file, 360, 5, 8244);
    			add_location(tr0, file, 358, 4, 8203);
    			add_location(td2, file, 366, 5, 8356);
    			add_location(td3, file, 367, 5, 8382);
    			add_location(tr1, file, 365, 4, 8346);
    			add_location(td4, file, 370, 5, 8451);
    			add_location(td5, file, 371, 5, 8476);
    			add_location(tr2, file, 369, 4, 8441);
    			add_location(td6, file, 374, 5, 8550);
    			add_location(td7, file, 375, 5, 8573);
    			add_location(tr3, file, 373, 4, 8540);
    			add_location(td8, file, 378, 5, 8636);
    			add_location(td9, file, 379, 5, 8660);
    			add_location(tr4, file, 377, 4, 8626);
    			add_location(td10, file, 382, 5, 8724);
    			add_location(td11, file, 383, 5, 8746);
    			add_location(tr5, file, 381, 4, 8714);
    			add_location(td12, file, 386, 5, 8808);
    			add_location(td13, file, 387, 5, 8833);
    			add_location(tr6, file, 385, 4, 8798);
    			add_location(td14, file, 390, 5, 8901);
    			add_location(td15, file, 391, 5, 8927);
    			add_location(tr7, file, 389, 4, 8891);
    			attr_dev(table, "class", "uk-table  uk-table-divider");
    			add_location(table, file, 357, 3, 8156);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, table, anchor);
    			append_dev(table, tr0);
    			append_dev(tr0, td0);
    			append_dev(tr0, t1);
    			append_dev(tr0, td1);
    			append_dev(td1, t2);
    			append_dev(table, t3);
    			append_dev(table, tr1);
    			append_dev(tr1, td2);
    			append_dev(tr1, t5);
    			append_dev(tr1, td3);
    			append_dev(td3, t6);
    			append_dev(table, t7);
    			append_dev(table, tr2);
    			append_dev(tr2, td4);
    			append_dev(tr2, t9);
    			append_dev(tr2, td5);
    			append_dev(td5, t10);
    			append_dev(table, t11);
    			append_dev(table, tr3);
    			append_dev(tr3, td6);
    			append_dev(tr3, t13);
    			append_dev(tr3, td7);
    			append_dev(td7, t14);
    			append_dev(table, t15);
    			append_dev(table, tr4);
    			append_dev(tr4, td8);
    			append_dev(tr4, t17);
    			append_dev(tr4, td9);
    			append_dev(td9, t18);
    			append_dev(table, t19);
    			append_dev(table, tr5);
    			append_dev(tr5, td10);
    			append_dev(tr5, t21);
    			append_dev(tr5, td11);
    			append_dev(td11, t22);
    			append_dev(table, t23);
    			append_dev(table, tr6);
    			append_dev(tr6, td12);
    			append_dev(tr6, t25);
    			append_dev(tr6, td13);
    			append_dev(td13, t26);
    			append_dev(table, t27);
    			append_dev(table, tr7);
    			append_dev(tr7, td14);
    			append_dev(tr7, t29);
    			append_dev(tr7, td15);
    			append_dev(td15, t30);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*sharesDisplay*/ 1024 && t2_value !== (t2_value = new Intl.NumberFormat("en-JM").format(/*sharesDisplay*/ ctx[10].sharesNum) + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*sharesDisplay*/ 1024 && t6_value !== (t6_value = /*sharesDisplay*/ ctx[10].grossPrice.format() + "")) set_data_dev(t6, t6_value);
    			if (dirty & /*sharesDisplay*/ 1024 && t10_value !== (t10_value = /*sharesDisplay*/ ctx[10].finalCommission.format() + "")) set_data_dev(t10, t10_value);
    			if (dirty & /*sharesDisplay*/ 1024 && t14_value !== (t14_value = /*sharesDisplay*/ ctx[10].cess.format() + "")) set_data_dev(t14, t14_value);
    			if (dirty & /*sharesDisplay*/ 1024 && t18_value !== (t18_value = /*sharesDisplay*/ ctx[10].trade.format() + "")) set_data_dev(t18, t18_value);
    			if (dirty & /*sharesDisplay*/ 1024 && t22_value !== (t22_value = /*sharesDisplay*/ ctx[10].gct.format() + "")) set_data_dev(t22, t22_value);
    			if (dirty & /*sharesDisplay*/ 1024 && t26_value !== (t26_value = /*sharesDisplay*/ ctx[10].totalFees.format() + "")) set_data_dev(t26, t26_value);
    			if (dirty & /*sharesDisplay*/ 1024 && t30_value !== (t30_value = /*sharesDisplay*/ ctx[10].finalPrice.format() + "")) set_data_dev(t30, t30_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(table);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(356:2) {#if avaliableCash && pricePerShareShares && avaliableCash >= minValueShares.finalPrice.value}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div3;
    	let form;
    	let div2;
    	let div0;
    	let t1;
    	let div1;
    	let label0;
    	let input0;
    	let input0_value_value;
    	let t2;
    	let t3;
    	let label1;
    	let input1;
    	let input1_value_value;
    	let t4;
    	let t5;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*sharesOrPrice*/ ctx[8] === "price") return create_if_block;
    		if (/*sharesOrPrice*/ ctx[8] === "shares") return create_if_block_1;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			form = element("form");
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "Price / Shares:";
    			t1 = space();
    			div1 = element("div");
    			label0 = element("label");
    			input0 = element("input");
    			t2 = text("\n\t\t\t\t\tPrice");
    			t3 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t4 = text("\n\t\t\t\t\tShares");
    			t5 = space();
    			if_block.c();
    			attr_dev(div0, "class", "uk-form-label");
    			add_location(div0, file, 170, 3, 3878);
    			attr_dev(input0, "class", "uk-radio");
    			attr_dev(input0, "type", "radio");
    			input0.__value = input0_value_value = "price";
    			input0.value = input0.__value;
    			/*$$binding_groups*/ ctx[13][0].push(input0);
    			add_location(input0, file, 175, 5, 4009);
    			add_location(label0, file, 174, 4, 3996);
    			attr_dev(input1, "class", "uk-radio");
    			attr_dev(input1, "type", "radio");
    			input1.__value = input1_value_value = "shares";
    			input1.value = input1.__value;
    			/*$$binding_groups*/ ctx[13][0].push(input1);
    			add_location(input1, file, 183, 5, 4157);
    			add_location(label1, file, 182, 4, 4144);
    			attr_dev(div1, "class", "uk-form-controls uk-form-controls-text");
    			add_location(div1, file, 173, 3, 3939);
    			attr_dev(div2, "class", "uk-margin");
    			add_location(div2, file, 169, 2, 3851);
    			attr_dev(form, "class", "uk-form-horizontal");
    			add_location(form, file, 168, 1, 3815);
    			attr_dev(div3, "class", "uk-container uk-container-large");
    			add_location(div3, file, 167, 0, 3768);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, form);
    			append_dev(form, div2);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, label0);
    			append_dev(label0, input0);
    			input0.checked = input0.__value === /*sharesOrPrice*/ ctx[8];
    			append_dev(label0, t2);
    			append_dev(div1, t3);
    			append_dev(div1, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*sharesOrPrice*/ ctx[8];
    			append_dev(label1, t4);
    			append_dev(div3, t5);
    			if_block.m(div3, null);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_handler*/ ctx[12]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*sharesOrPrice*/ 256) {
    				input0.checked = input0.__value === /*sharesOrPrice*/ ctx[8];
    			}

    			if (dirty & /*sharesOrPrice*/ 256) {
    				input1.checked = input1.__value === /*sharesOrPrice*/ ctx[8];
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div3, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input0), 1);
    			/*$$binding_groups*/ ctx[13][0].splice(/*$$binding_groups*/ ctx[13][0].indexOf(input1), 1);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const cess = 0.0033;
    const trade = 0;
    const gct = 0.15;
    const minShares = 1;

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

    	let buyOrSell = "buy",
    		sharesOrPrice = "price",
    		numOfShares,
    		pricePerShare,
    		commissionPercent = 2,
    		minComm = 0;

    	// variables when calculating # of shares
    	let buyOrSellShares = "buy",
    		avaliableCash,
    		pricePerShareShares,
    		commissionPercentShares = 2,
    		minCommShares = 0;

    	// find out how much money it cost to buy/sell a certain number of shares
    	let findPrice = function (
    		buyOrSell = "buy",
    	numOfShares = 0,
    	pricePerShare = 0,
    	commissionPercent,
    	minComm
    	) {
    		let grossPrice = currency_min(numOfShares).multiply(pricePerShare),
    			minCommission = currency_min(minComm),
    			commission = currency_min(commissionPercent, { precision: 6 }).divide(100),
    			tempCommission = currency_min(grossPrice.multiply(commission)),
    			finalCommission = currency_min(tempCommission.intValue < minCommission.intValue
    			? minCommission
    			: tempCommission),
    			cessFee = grossPrice.multiply(cess),
    			tradeFee = grossPrice.multiply(trade),
    			gctFee = finalCommission.add(cessFee).add(tradeFee).multiply(gct),
    			totalFees = gctFee.add(cessFee).add(tradeFee).add(finalCommission),
    			finalPrice = currency_min(0);

    		if (buyOrSell === "buy") {
    			finalPrice = grossPrice.add(totalFees);
    		} else if (buyOrSell === "sell") {
    			finalPrice = grossPrice.subtract(totalFees);
    		}

    		return {
    			grossPrice,
    			finalCommission,
    			cess: cessFee,
    			trade: tradeFee,
    			gct: gctFee,
    			totalFees,
    			finalPrice
    		};
    	};

    	// calculate number of shares that can be traded
    	let calcMaxShares = function (buyOrSell, avaliableCash, pricePerShare, commissionPercent, minComm) {
    		let cash = currency_min(avaliableCash),
    			tempMaxShares = pricePerShare
    			? Math.ceil(cash.divide(pricePerShare).value)
    			: currency_min(1),
    			maxShares = buyOrSell === "buy" ? tempMaxShares : tempMaxShares * 2,
    			ans = iterativeFunction(maxShares, minShares, buyOrSell, cash, pricePerShare, commissionPercent, minComm);

    		return ans;
    	};

    	// Iterative function to implement Binary Search
    	let iterativeFunction = function (
    		maxShares,
    	minShares,
    	buyOrSell,
    	cash,
    	pricePerShare,
    	commissionPercent,
    	minComm
    	) {
    		while (minShares <= maxShares) {
    			let mid = Math.floor((minShares + maxShares) / 2);
    			let midPrice1 = findPrice(buyOrSell, mid, pricePerShare, commissionPercent, minComm);
    			let midPrice2 = findPrice(buyOrSell, mid + 1, pricePerShare, commissionPercent, minComm);

    			if (midPrice1.finalPrice.intValue === cash.intValue) {
    				midPrice1.sharesNum = mid;
    				return midPrice1;
    			} else if (midPrice1.finalPrice.intValue < cash.intValue && midPrice2.finalPrice.intValue > cash.intValue) {
    				if (buyOrSell === "buy") {
    					midPrice1.sharesNum = mid;
    					return midPrice1;
    				} else {
    					midPrice2.sharesNum = mid + 1;
    					return midPrice2;
    				}
    			} else if (midPrice1.finalPrice.intValue > cash.intValue) maxShares = mid - 1; else minShares = mid + 1;
    		}

    		return false;
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[], [], []];

    	function input0_change_handler() {
    		sharesOrPrice = this.__value;
    		$$invalidate(8, sharesOrPrice);
    	}

    	function input1_change_handler() {
    		sharesOrPrice = this.__value;
    		$$invalidate(8, sharesOrPrice);
    	}

    	function input0_change_handler_1() {
    		buyOrSell = this.__value;
    		$$invalidate(0, buyOrSell);
    	}

    	function input1_change_handler_1() {
    		buyOrSell = this.__value;
    		$$invalidate(0, buyOrSell);
    	}

    	function input2_input_handler() {
    		numOfShares = to_number(this.value);
    		$$invalidate(1, numOfShares);
    	}

    	function input3_input_handler() {
    		pricePerShare = to_number(this.value);
    		$$invalidate(2, pricePerShare);
    	}

    	function input4_input_handler() {
    		commissionPercent = to_number(this.value);
    		$$invalidate(3, commissionPercent);
    	}

    	function input0_change_handler_2() {
    		buyOrSellShares = this.__value;
    		$$invalidate(4, buyOrSellShares);
    	}

    	function input1_change_handler_2() {
    		buyOrSellShares = this.__value;
    		$$invalidate(4, buyOrSellShares);
    	}

    	function input2_input_handler_1() {
    		avaliableCash = to_number(this.value);
    		$$invalidate(5, avaliableCash);
    	}

    	function input3_input_handler_1() {
    		pricePerShareShares = to_number(this.value);
    		$$invalidate(6, pricePerShareShares);
    	}

    	function input4_input_handler_1() {
    		commissionPercentShares = to_number(this.value);
    		$$invalidate(7, commissionPercentShares);
    	}

    	$$self.$capture_state = () => ({
    		currency: currency_min,
    		cess,
    		trade,
    		gct,
    		minShares,
    		buyOrSell,
    		sharesOrPrice,
    		numOfShares,
    		pricePerShare,
    		commissionPercent,
    		minComm,
    		buyOrSellShares,
    		avaliableCash,
    		pricePerShareShares,
    		commissionPercentShares,
    		minCommShares,
    		findPrice,
    		calcMaxShares,
    		iterativeFunction,
    		priceDisplay,
    		sharesDisplay,
    		minValueShares
    	});

    	$$self.$inject_state = $$props => {
    		if ("buyOrSell" in $$props) $$invalidate(0, buyOrSell = $$props.buyOrSell);
    		if ("sharesOrPrice" in $$props) $$invalidate(8, sharesOrPrice = $$props.sharesOrPrice);
    		if ("numOfShares" in $$props) $$invalidate(1, numOfShares = $$props.numOfShares);
    		if ("pricePerShare" in $$props) $$invalidate(2, pricePerShare = $$props.pricePerShare);
    		if ("commissionPercent" in $$props) $$invalidate(3, commissionPercent = $$props.commissionPercent);
    		if ("minComm" in $$props) $$invalidate(25, minComm = $$props.minComm);
    		if ("buyOrSellShares" in $$props) $$invalidate(4, buyOrSellShares = $$props.buyOrSellShares);
    		if ("avaliableCash" in $$props) $$invalidate(5, avaliableCash = $$props.avaliableCash);
    		if ("pricePerShareShares" in $$props) $$invalidate(6, pricePerShareShares = $$props.pricePerShareShares);
    		if ("commissionPercentShares" in $$props) $$invalidate(7, commissionPercentShares = $$props.commissionPercentShares);
    		if ("minCommShares" in $$props) $$invalidate(26, minCommShares = $$props.minCommShares);
    		if ("findPrice" in $$props) $$invalidate(27, findPrice = $$props.findPrice);
    		if ("calcMaxShares" in $$props) $$invalidate(28, calcMaxShares = $$props.calcMaxShares);
    		if ("iterativeFunction" in $$props) iterativeFunction = $$props.iterativeFunction;
    		if ("priceDisplay" in $$props) $$invalidate(9, priceDisplay = $$props.priceDisplay);
    		if ("sharesDisplay" in $$props) $$invalidate(10, sharesDisplay = $$props.sharesDisplay);
    		if ("minValueShares" in $$props) $$invalidate(11, minValueShares = $$props.minValueShares);
    	};

    	let priceDisplay;
    	let sharesDisplay;
    	let minValueShares;

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*buyOrSell, numOfShares, pricePerShare, commissionPercent*/ 15) {
    			 $$invalidate(9, priceDisplay = findPrice(buyOrSell, numOfShares, pricePerShare, commissionPercent, minComm));
    		}

    		if ($$self.$$.dirty & /*buyOrSellShares, avaliableCash, pricePerShareShares, commissionPercentShares*/ 240) {
    			 $$invalidate(10, sharesDisplay = calcMaxShares(buyOrSellShares, avaliableCash, pricePerShareShares, commissionPercentShares, minCommShares));
    		}

    		if ($$self.$$.dirty & /*buyOrSellShares, pricePerShareShares, commissionPercentShares*/ 208) {
    			 $$invalidate(11, minValueShares = findPrice(buyOrSellShares, minShares, pricePerShareShares, commissionPercentShares, minCommShares));
    		}
    	};

    	return [
    		buyOrSell,
    		numOfShares,
    		pricePerShare,
    		commissionPercent,
    		buyOrSellShares,
    		avaliableCash,
    		pricePerShareShares,
    		commissionPercentShares,
    		sharesOrPrice,
    		priceDisplay,
    		sharesDisplay,
    		minValueShares,
    		input0_change_handler,
    		$$binding_groups,
    		input1_change_handler,
    		input0_change_handler_1,
    		input1_change_handler_1,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input0_change_handler_2,
    		input1_change_handler_2,
    		input2_input_handler_1,
    		input3_input_handler_1,
    		input4_input_handler_1
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var app = new App({
    	target: document.getElementById('calculator')
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map

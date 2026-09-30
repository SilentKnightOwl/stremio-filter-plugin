/**
 * @name StreamFilter
 * @description Adds a filter bar with quick-toggle chips to the streams list on movie and episode pages.
 * @updateUrl https://raw.githubusercontent.com/SilentKnightOwl/stremio-filter-plugin/main/stream-filter.plugin.js
 * @version 0.3.0
 * @author SilentKnightOwl
 */

(function () {
    "use strict";

    // ---- Pure matching logic (no DOM; unit-tested under Node) ----

    // A term is a plain substring, or a RegExp for whole-word matching.
    const wholeWord = (w) => new RegExp("(^|[^a-z0-9])" + w + "($|[^a-z0-9])");

    // Escape regex metacharacters so user-typed whole-word terms can't throw or act as a pattern.
    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Chip definitions, data-driven. `terms` is a comma-separated string; a term prefixed
    // with `~` is matched as a whole word, everything else is a plain substring.
    // Chips in the same `group` are OR'd; different groups are AND'd.
    const DEFAULT_CHIPS = [
        { id: "4k",    label: "4K",    group: "res", terms: "2160p,4k,uhd" },
        { id: "1080p", label: "1080p", group: "res", terms: "1080p" },
        { id: "720p",  label: "720p",  group: "res", terms: "720p" },
        { id: "hdr",   label: "HDR",   group: "hdr", terms: "hdr,dolby vision,~dv" },
        { id: "dub",   label: "Dub",   group: "dub", terms: "dub,dual audio" },
        { id: "gb",    label: "\u{1F1EC}\u{1F1E7}", group: "gb", terms: "\u{1F1EC}\u{1F1E7}" },
    ];

    // One raw term -> a plain lowercased string, a whole-word RegExp, or null when empty.
    function compileTerm(raw) {
        const s = String(raw == null ? "" : raw).trim().toLowerCase();
        if (!s) return null;
        if (s.startsWith("~")) {
            const rest = s.slice(1).trim();
            if (!rest) return null;
            return wholeWord(escapeRegExp(rest));
        }
        return s;
    }

    // A comma-separated terms string -> a deduped array of compiled matchers.
    function compileTerms(str) {
        const out = [];
        const seen = new Set();
        for (const part of String(str == null ? "" : str).split(",")) {
            const term = compileTerm(part);
            if (term == null) continue;
            const sig = term instanceof RegExp ? "re:" + term.source : "s:" + term;
            if (seen.has(sig)) continue;
            seen.add(sig);
            out.push(term);
        }
        return out;
    }

    // Merge user settings over the defaults, returning the enabled chips in display order.
    function resolveChips(settings) {
        const s = settings && typeof settings === "object" ? settings : {};
        const result = [];
        for (const def of DEFAULT_CHIPS) {
            const enabledRaw = s["chip." + def.id + ".enabled"];
            const enabled = !(enabledRaw === false || enabledRaw === "false");
            if (!enabled) continue;

            const termsRaw = s["chip." + def.id + ".terms"];
            const chosen = typeof termsRaw === "string" && termsRaw.trim() ? termsRaw : def.terms;
            let terms = compileTerms(chosen);
            if (terms.length === 0) terms = compileTerms(def.terms);

            result.push({ id: def.id, label: def.label, group: def.group, terms });
        }
        return result;
    }

    // Settings schema: one toggle then one input per chip.
    function buildSchema() {
        const schema = [];
        for (const def of DEFAULT_CHIPS) {
            schema.push({
                key: "chip." + def.id + ".enabled",
                label: "Show " + def.label + " chip",
                type: "toggle",
                defaultValue: true,
            });
            schema.push({
                key: "chip." + def.id + ".terms",
                label: def.label + " terms",
                type: "input",
                defaultValue: def.terms,
                description: "Comma-separated. Prefix a term with ~ to match it as a whole word.",
            });
        }
        return schema;
    }

    const CHIPS = resolveChips(null);

    function parseQuery(query) {
        const include = [];
        const exclude = [];
        for (const token of String(query == null ? "" : query).toLowerCase().split(/\s+/)) {
            if (!token || token === "-") continue;
            if (token.startsWith("-")) exclude.push(token.slice(1));
            else include.push(token);
        }
        return { include, exclude };
    }

    const hasTerm = (text, term) => (term instanceof RegExp ? term.test(text) : text.includes(term));

    function matches(text, query, activeChipIds, chips = CHIPS) {
        const haystack = String(text == null ? "" : text).toLowerCase();
        const { include, exclude } = parseQuery(query);
        if (!include.every((w) => haystack.includes(w))) return false;
        if (exclude.some((w) => haystack.includes(w))) return false;

        const groups = new Map();
        for (const chip of chips) {
            if (!(activeChipIds || []).includes(chip.id)) continue;
            if (!groups.has(chip.group)) groups.set(chip.group, []);
            groups.get(chip.group).push(chip);
        }
        for (const group of groups.values()) {
            if (!group.some((c) => c.terms.some((t) => hasTerm(haystack, t)))) return false;
        }
        return true;
    }

    // ---- Routing: which show is the user looking at? ----
    // Live routes: #/metadetails/:type/:id/:videoId?  (#/detail/... is a legacy alias)
    //              #/player/:stream/:streamTransportUrl/:metaTransportUrl/:type/:id/:videoId?
    // The key is "type/id" (no videoId) so all episodes of a show share it.

    const decode = (s) => {
        try {
            return decodeURIComponent(s);
        } catch (_) {
            return s;
        }
    };

    const hashSegments = (hash) =>
        String(hash == null ? "" : hash)
            .replace(/^#\/?/, "")
            .split("?")[0]
            .split("/")
            .filter(Boolean);

    function showKeyFromHash(hash) {
        const seg = hashSegments(hash);
        let type;
        let id;
        if (seg[0] === "metadetails" || seg[0] === "detail") {
            [, type, id] = seg;
        } else if (seg[0] === "player") {
            [, , , , type, id] = seg;
        }
        return type && id ? decode(type) + "/" + decode(id) : null;
    }

    function isDetailHash(hash) {
        const first = hashSegments(hash)[0];
        return first === "metadetails" || first === "detail";
    }

    const Core = {
        CHIPS,
        DEFAULT_CHIPS,
        resolveChips,
        buildSchema,
        compileTerm,
        compileTerms,
        parseQuery,
        matches,
        showKeyFromHash,
        isDetailHash,
    };

    // Under Node (tests) export the pure logic and stop; no DOM there.
    if (typeof module !== "undefined" && module.exports) {
        module.exports = Core;
        return;
    }

    // ---- DOM layer (runs inside Stremio's web page) ----

    // Stremio's CSS class names are hashed (e.g. "stream-container-JPdah"), so match on the
    // stable prefix. If Stremio renames these, update here; the plugin will log a warning.
    const SEL = {
        list: '[class*="streams-list-container-"]',
        header: '[class*="select-choices-wrapper-"]',
        rows: '[class*="streams-container-"]',
        row: '[class*="stream-container-"]',
    };

    const CSS = `
#sf-bar{display:flex;flex-direction:column;gap:.6rem;flex:none;margin:.5rem 1rem 1rem}
#sf-bar .sf-row{display:flex;align-items:center;gap:1rem}
#sf-bar .sf-input{flex:1;min-width:0;height:2.6rem;padding:0 1.2rem;border:thin solid transparent;border-radius:var(--border-radius,2rem);background:var(--overlay-color);color:var(--primary-foreground-color);font-size:1rem;outline:none}
#sf-bar .sf-input:focus{border-color:var(--primary-foreground-color)}
#sf-bar .sf-input::placeholder{color:var(--primary-foreground-color);opacity:.4}
#sf-bar .sf-count{color:var(--primary-foreground-color);opacity:.6;font-size:.9rem;white-space:nowrap}
#sf-bar .sf-chips{display:flex;flex-wrap:wrap;gap:.5rem}
#sf-bar .sf-chip{padding:.3rem 1rem;border:thin solid var(--overlay-color);border-radius:2rem;background:var(--overlay-color);color:var(--primary-foreground-color);font-size:.95rem;cursor:pointer}
#sf-bar .sf-chip:hover{border-color:var(--primary-foreground-color)}
#sf-bar .sf-chip[aria-pressed="true"]{background:var(--primary-accent-color);border-color:var(--primary-accent-color)}
#sf-bar .sf-empty{color:var(--primary-foreground-color);opacity:.6;padding:.5rem 0}
#sf-bar[hidden],#sf-bar [hidden]{display:none!important}
[data-sf-hidden]{display:none!important}
`;

    const log = (level, msg) => {
        try {
            StremioEnhancedAPI.logger[level]("[StreamFilter] " + msg);
        } catch (_) {
            console[level === "info" ? "log" : level]("[StreamFilter] " + msg);
        }
    };

    // Filter state for the show currently being viewed. In memory only; reset when the
    // user moves to another title or leaves the detail/player pages.
    const state = { showKey: null, query: "", chips: new Set() };
    let chips = CHIPS;

    let bar = null;
    let input = null;
    let countEl = null;
    let emptyEl = null;
    let chipEls = new Map();
    let chipsEl = null;
    let debounceTimer = null;
    let warnedMissingHeader = false;

    function syncRoute() {
        const key = showKeyFromHash(location.hash);
        if (key === state.showKey) return;
        state.showKey = key;
        state.query = "";
        state.chips.clear();
        if (input) input.value = "";
        for (const el of chipEls.values()) el.setAttribute("aria-pressed", "false");
    }

    function renderChips() {
        if (!chipsEl) return;
        chipsEl.textContent = "";
        chipEls = new Map();
        for (const chip of chips) {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "sf-chip";
            b.textContent = chip.label;
            b.setAttribute("aria-pressed", String(state.chips.has(chip.id)));
            b.addEventListener("click", () => {
                if (state.chips.has(chip.id)) state.chips.delete(chip.id);
                else state.chips.add(chip.id);
                b.setAttribute("aria-pressed", String(state.chips.has(chip.id)));
                applyFilter();
            });
            chipEls.set(chip.id, b);
            chipsEl.append(b);
        }
        chipsEl.hidden = chips.length === 0;
    }

    function buildBar() {
        bar = document.createElement("div");
        bar.id = "sf-bar";

        const row = document.createElement("div");
        row.className = "sf-row";
        input = document.createElement("input");
        input.className = "sf-input";
        input.type = "text";
        input.placeholder = "Filter streams\u2026  e.g. 1080p -cam";
        input.spellcheck = false;
        input.autocomplete = "off";
        input.value = state.query;
        countEl = document.createElement("span");
        countEl.className = "sf-count";
        row.append(input, countEl);

        chipsEl = document.createElement("div");
        chipsEl.className = "sf-chips";
        renderChips();

        emptyEl = document.createElement("div");
        emptyEl.className = "sf-empty";
        emptyEl.textContent = "No streams match your filter.";
        emptyEl.hidden = true;

        bar.append(row, chipsEl, emptyEl);

        // Keep typing away from Stremio's global keyboard shortcuts (space, f, m, ...).
        for (const type of ["keydown", "keyup", "keypress"]) {
            input.addEventListener(type, (e) => e.stopPropagation());
        }
        input.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                input.value = "";
                state.query = "";
                applyFilter();
            }
        });
        input.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                state.query = input.value;
                applyFilter();
            }, 100);
        });
    }

    function mountBar(list) {
        if (bar && list.contains(bar)) return true;
        if (bar) bar.remove();
        buildBar();
        const header = list.querySelector(SEL.header);
        if (header) {
            header.insertAdjacentElement("afterend", bar);
        } else {
            if (!warnedMissingHeader) {
                warnedMissingHeader = true;
                log("warn", "streams header not found (Stremio markup changed?); placing bar at top of list");
            }
            list.insertBefore(bar, list.firstChild);
        }
        return true;
    }

    // The direct child of the streams container that holds this stream button.
    function rowWrapper(btn, container) {
        let el = btn;
        while (el.parentElement && el.parentElement !== container) el = el.parentElement;
        return el.parentElement === container ? el : btn;
    }

    function applyFilter() {
        try {
            syncRoute();
            if (!isDetailHash(location.hash)) return;
            const list = document.querySelector(SEL.list);
            if (!list) return;
            mountBar(list);

            const container = list.querySelector(SEL.rows);
            bar.hidden = !container;
            if (!container) return;

            const active = [...state.chips];
            let total = 0;
            let shown = 0;
            for (const btn of container.querySelectorAll(SEL.row)) {
                total++;
                // React reuses row elements for different streams, so re-evaluate every time.
                const text = (btn.textContent || "") + "\n" + (btn.getAttribute("title") || "");
                const ok = matches(text, state.query, active, chips);
                rowWrapper(btn, container).toggleAttribute("data-sf-hidden", !ok);
                if (ok) shown++;
            }

            const filtering = active.length > 0 || parseQuery(state.query).include.length + parseQuery(state.query).exclude.length > 0;
            const label = !total ? "" : filtering ? `showing ${shown} of ${total}` : `${total} streams`;
            if (countEl.textContent !== label) countEl.textContent = label;
            emptyEl.hidden = !(total > 0 && shown === 0);
        } catch (err) {
            log("error", "filter failed: " + (err && err.message));
        }
    }

    function applyResolved(settings) {
        chips = resolveChips(settings);
        const ids = new Set(chips.map((c) => c.id));
        for (const id of [...state.chips]) if (!ids.has(id)) state.chips.delete(id);
        renderChips();
        applyFilter();
    }

    async function readSettings() {
        const schema = buildSchema();
        const values = await Promise.all(
            schema.map((item) => StremioEnhancedAPI.getSetting(item.key).catch(() => null))
        );
        const settings = {};
        schema.forEach((item, i) => {
            settings[item.key] = values[i];
        });
        return settings;
    }

    function sanitizeSaved(settings) {
        const s = settings && typeof settings === "object" ? settings : {};
        for (const item of buildSchema()) {
            if (item.type !== "input") continue;
            const value = s[item.key];
            if (typeof value === "string" && /["<>]/.test(value)) {
                StremioEnhancedAPI.saveSetting(item.key, value.replace(/["<>]/g, "")).catch(() => {});
            }
        }
    }

    async function bootstrap() {
        if (typeof StremioEnhancedAPI === "undefined") {
            start();
            return;
        }
        try {
            try {
                await StremioEnhancedAPI.registerSettings(buildSchema());
            } catch (err) {
                log("info", "settings schema already registered: " + (err && err.message));
            }
            chips = resolveChips(await readSettings());
            try {
                StremioEnhancedAPI.onSettingsSaved((settings) => {
                    applyResolved(settings);
                    sanitizeSaved(settings);
                });
            } catch (err) {
                log("error", "failed to subscribe to settings: " + (err && err.message));
            }
        } catch (err) {
            log("error", "settings bootstrap failed: " + (err && err.message));
        }
        start();
    }

    function start() {
        // Clean up a previous copy (plugin reload without a page reload).
        if (window.__streamFilterObserver) window.__streamFilterObserver.disconnect();
        document.getElementById("sf-style")?.remove();
        document.getElementById("sf-bar")?.remove();

        const style = document.createElement("style");
        style.id = "sf-style";
        style.textContent = CSS;
        document.head.append(style);

        // Observer callbacks run as microtasks, before paint, so rows never flash unfiltered.
        // applyFilter only changes attributes (not observed) and text inside the bar
        // (ignored below), so it cannot retrigger itself indefinitely.
        const observer = new MutationObserver((mutations) => {
            if (!isDetailHash(location.hash)) return;
            if (bar && mutations.every((m) => bar.contains(m.target))) return;
            applyFilter();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        window.__streamFilterObserver = observer;

        window.addEventListener("hashchange", applyFilter);

        applyFilter();
        log("info", "loaded");
    }

    if (document.body) bootstrap();
    else document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
})();

/**
 * @name StreamFilter
 * @description Adds a filter bar with quick-toggle chips to the streams list on movie and episode pages.
 * @updateUrl https://raw.githubusercontent.com/SilentKnightOwl/stremio-filter-plugin/main/stream-filter.plugin.js
 * @version 0.1.0
 * @author SilentKnightOwl
 */

(function () {
    "use strict";

    // ---- Pure matching logic (no DOM; unit-tested under Node) ----

    // A term is a plain substring, or a RegExp for whole-word matching.
    const wholeWord = (w) => new RegExp("(^|[^a-z0-9])" + w + "($|[^a-z0-9])");

    // Chips in the same `group` are OR'd; different groups are AND'd.
    const CHIPS = [
        { id: "4k", label: "4K", group: "res", terms: ["2160p", "4k", "uhd"] },
        { id: "1080p", label: "1080p", group: "res", terms: ["1080p"] },
        { id: "hdr", label: "HDR", group: "hdr", terms: ["hdr", "dolby vision", wholeWord("dv")] },
        { id: "dub", label: "Dub", group: "dub", terms: ["dub", "dual audio"] },
        { id: "gb", label: "\u{1F1EC}\u{1F1E7}", group: "gb", terms: ["\u{1F1EC}\u{1F1E7}"] },
    ];

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

    function matches(text, query, activeChipIds) {
        const haystack = String(text == null ? "" : text).toLowerCase();
        const { include, exclude } = parseQuery(query);
        if (!include.every((w) => haystack.includes(w))) return false;
        if (exclude.some((w) => haystack.includes(w))) return false;

        const groups = new Map();
        for (const chip of CHIPS) {
            if (!(activeChipIds || []).includes(chip.id)) continue;
            if (!groups.has(chip.group)) groups.set(chip.group, []);
            groups.get(chip.group).push(chip);
        }
        for (const chips of groups.values()) {
            if (!chips.some((c) => c.terms.some((t) => hasTerm(haystack, t)))) return false;
        }
        return true;
    }

    const Core = { CHIPS, parseQuery, matches };

    // Under Node (tests) export the pure logic and stop; no DOM there.
    if (typeof module !== "undefined" && module.exports) {
        module.exports = Core;
        return;
    }

    const log = (msg) => {
        try {
            StremioEnhancedAPI.logger.info("[StreamFilter] " + msg);
        } catch (_) {
            console.log("[StreamFilter] " + msg);
        }
    };

    log("loaded");
})();

/**
 * @name StreamFilter
 * @description Adds a filter bar with quick-toggle chips to the streams list on movie and episode pages.
 * @updateUrl https://raw.githubusercontent.com/SilentKnightOwl/stremio-filter-plugin/main/stream-filter.plugin.js
 * @version 0.1.0
 * @author SilentKnightOwl
 */

(function () {
    "use strict";

    const Core = {};

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

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { showKeyFromHash, isDetailHash } = require("../stream-filter.plugin.js");

test("showKeyFromHash: metadetails movie and series", () => {
    assert.equal(showKeyFromHash("#/metadetails/movie/tt0133093"), "movie/tt0133093");
    assert.equal(showKeyFromHash("#/metadetails/series/tt0903747"), "series/tt0903747");
});

test("showKeyFromHash: episode videoId does not change the key", () => {
    const a = showKeyFromHash("#/metadetails/series/tt0903747/tt0903747%3A1%3A1");
    const b = showKeyFromHash("#/metadetails/series/tt0903747/tt0903747%3A1%3A2");
    assert.equal(a, "series/tt0903747");
    assert.equal(a, b);
});

test("showKeyFromHash: decodes percent-encoded ids (anime ids contain ':')", () => {
    assert.equal(showKeyFromHash("#/metadetails/series/kitsu%3A12345/kitsu%3A12345%3A3"), "series/kitsu:12345");
});

test("showKeyFromHash: player route yields the same key as its detail page", () => {
    const player = "#/player/abc123/http%3A%2F%2Fx.test%2Fmanifest.json/http%3A%2F%2Fy.test%2Fmanifest.json/series/tt0903747/tt0903747%3A1%3A2";
    assert.equal(showKeyFromHash(player), "series/tt0903747");
    assert.equal(showKeyFromHash(player), showKeyFromHash("#/metadetails/series/tt0903747/tt0903747%3A1%3A1"));
});

test("showKeyFromHash: legacy #/detail alias", () => {
    assert.equal(showKeyFromHash("#/detail/series/tt1/tt1%3A1%3A1"), "series/tt1");
});

test("showKeyFromHash: query string and trailing slash are ignored", () => {
    assert.equal(showKeyFromHash("#/metadetails/series/tt1/tt1%3A1%3A1?foo=bar"), "series/tt1");
    assert.equal(showKeyFromHash("#/metadetails/movie/tt1/"), "movie/tt1");
});

test("showKeyFromHash: non-show routes and junk give null", () => {
    for (const h of ["", "#", "#/", "#/board", "#/discover/x/movie/top", "#/settings", "#/metadetails", "#/metadetails/movie", undefined, null]) {
        assert.equal(showKeyFromHash(h), null, String(h));
    }
});

test("showKeyFromHash: player route without meta info gives null", () => {
    assert.equal(showKeyFromHash("#/player/abc123"), null);
    assert.equal(showKeyFromHash("#/player/abc123/http%3A%2F%2Fx.test"), null);
});

test("showKeyFromHash: malformed percent-encoding does not throw", () => {
    assert.equal(showKeyFromHash("#/metadetails/movie/%E0%A4%A"), "movie/%E0%A4%A");
});

test("isDetailHash: only the detail page, not the player", () => {
    assert.equal(isDetailHash("#/metadetails/series/tt1/tt1%3A1%3A1"), true);
    assert.equal(isDetailHash("#/detail/movie/tt1"), true);
    assert.equal(isDetailHash("#/player/a/b/c/series/tt1/tt1%3A1%3A1"), false);
    assert.equal(isDetailHash("#/board"), false);
    assert.equal(isDetailHash(""), false);
    assert.equal(isDetailHash(undefined), false);
});

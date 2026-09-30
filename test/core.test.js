"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseQuery, matches, CHIPS } = require("../stream-filter.plugin.js");

const S = {
    uhd: "Torrentio\n4K HDR\n[Group] Show S01E01 2160p WEB-DL HDR10 x265",
    fhd: "Torrentio\n1080p\n[Group] Show S01E01 1080p BluRay x264",
    dubbed: "Torrentio\n1080p\nShow S01E01 1080p English Dubbed",
    dual: "Torrentio\n1080p\nShow S01E01 1080p Dual Audio",
    multiSubs: "Torrentio\n1080p\nShow S01E01 1080p Multi Subs",
    flag: "Torrentio\n1080p\nShow S01E01 1080p 🇬🇧 / 🇯🇵",
    dvdrip: "Torrentio\n480p\nShow S01E01 DVDRip x264",
    dv: "Torrentio\n2160p\nShow S01E01 2160p DV HDR10 REMUX",
    dolby: "Torrentio\n2160p\nShow S01E01 2160p Dolby Vision REMUX",
    cam: "Torrentio\n480p\nMovie 2024 CAM x264",
};

test("parseQuery: empty, whitespace and lone dash produce no terms", () => {
    for (const q of ["", "   ", "-", " - ", undefined, null]) {
        assert.deepEqual(parseQuery(q), { include: [], exclude: [] });
    }
});

test("parseQuery: splits include and exclude, lowercases, collapses spaces", () => {
    assert.deepEqual(parseQuery("  1080P   -CAM  hevc -x264 "), {
        include: ["1080p", "hevc"],
        exclude: ["cam", "x264"],
    });
});

test("parseQuery: keeps emoji as plain text", () => {
    assert.deepEqual(parseQuery("🇬🇧 -🇯🇵"), { include: ["🇬🇧"], exclude: ["🇯🇵"] });
});

test("matches: empty query and no chips matches everything", () => {
    assert.equal(matches(S.uhd, "", []), true);
    assert.equal(matches("", "", []), true);
    assert.equal(matches(undefined, "", []), true);
});

test("matches: all include words must be present, case-insensitive, anywhere in text", () => {
    assert.equal(matches(S.uhd, "2160P hdr", []), true);
    assert.equal(matches(S.uhd, "2160p remux", []), false);
    assert.equal(matches(S.uhd, "web", []), true);
});

test("matches: any excluded word rejects the stream", () => {
    assert.equal(matches(S.cam, "-cam", []), false);
    assert.equal(matches(S.fhd, "-cam", []), true);
});

test("matches: include and exclude together", () => {
    assert.equal(matches(S.fhd, "1080p -hevc", []), true);
    assert.equal(matches(S.fhd, "1080p -x264", []), false);
    assert.equal(matches(S.dubbed, "1080p -x264", []), true);
});

test("matches: query with only exclusions works", () => {
    assert.equal(matches(S.fhd, "-2160p", []), true);
    assert.equal(matches(S.uhd, "-2160p", []), false);
});

test("matches: non-empty query against empty text", () => {
    assert.equal(matches("", "1080p", []), false);
    assert.equal(matches("", "-cam", []), true);
});

test("CHIPS: exposes the five chips in display order", () => {
    assert.deepEqual(CHIPS.map((c) => c.id), ["4k", "1080p", "hdr", "dub", "gb"]);
    assert.equal(CHIPS.find((c) => c.id === "gb").label, "🇬🇧");
});

test("chip 4k: 2160p, 4k and uhd", () => {
    assert.equal(matches(S.uhd, "", ["4k"]), true);
    assert.equal(matches("Show 4K remux", "", ["4k"]), true);
    assert.equal(matches("Show UHD", "", ["4k"]), true);
    assert.equal(matches(S.fhd, "", ["4k"]), false);
});

test("chip 1080p", () => {
    assert.equal(matches(S.fhd, "", ["1080p"]), true);
    assert.equal(matches(S.uhd, "", ["1080p"]), false);
});

test("chips 4k + 1080p are OR'd (same resolution group)", () => {
    const on = ["4k", "1080p"];
    assert.equal(matches(S.uhd, "", on), true);
    assert.equal(matches(S.fhd, "", on), true);
    assert.equal(matches(S.dvdrip, "", on), false);
});

test("chip hdr: hdr, dolby vision, and dv as a whole word only", () => {
    assert.equal(matches(S.uhd, "", ["hdr"]), true);
    assert.equal(matches(S.dv, "", ["hdr"]), true);
    assert.equal(matches(S.dolby, "", ["hdr"]), true);
    assert.equal(matches("Show 2160p DV.HDR10", "", ["hdr"]), true);
    assert.equal(matches(S.dvdrip, "", ["hdr"]), false);
    assert.equal(matches(S.fhd, "", ["hdr"]), false);
});

test("chip dub: dub, dubbed, dual audio; not 'multi subs'", () => {
    assert.equal(matches("Show DUB", "", ["dub"]), true);
    assert.equal(matches(S.dubbed, "", ["dub"]), true);
    assert.equal(matches(S.dual, "", ["dub"]), true);
    assert.equal(matches(S.multiSubs, "", ["dub"]), false);
    assert.equal(matches(S.fhd, "", ["dub"]), false);
});

test("chip gb: literal flag only", () => {
    assert.equal(matches(S.flag, "", ["gb"]), true);
    assert.equal(matches(S.fhd, "", ["gb"]), false);
    assert.equal(matches("Show English", "", ["gb"]), false);
});

test("different chip groups are AND'd with each other", () => {
    assert.equal(matches(S.dv, "", ["4k", "hdr"]), true);
    assert.equal(matches(S.fhd, "", ["1080p", "hdr"]), false);
    assert.equal(matches(S.dubbed, "", ["1080p", "dub"]), true);
    assert.equal(matches(S.dubbed, "", ["1080p", "dub", "gb"]), false);
});

test("chips are AND'd with the typed text", () => {
    assert.equal(matches(S.dubbed, "english", ["dub"]), true);
    assert.equal(matches(S.dubbed, "spanish", ["dub"]), false);
    assert.equal(matches(S.dubbed, "-english", ["dub"]), false);
});

test("unknown chip ids are ignored", () => {
    assert.equal(matches(S.fhd, "", ["nope"]), true);
});

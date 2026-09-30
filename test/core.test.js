"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
    parseQuery,
    matches,
    CHIPS,
    DEFAULT_CHIPS,
    resolveChips,
    buildSchema,
    compileTerm,
    compileTerms,
} = require("../stream-filter.plugin.js");

const S = {
    uhd: "Torrentio\n4K HDR\n[Group] Show S01E01 2160p WEB-DL HDR10 x265",
    fhd: "Torrentio\n1080p\n[Group] Show S01E01 1080p BluRay x264",
    hd: "Torrentio\n720p\n[Group] Show S01E01 720p WEB-DL x264",
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

test("CHIPS: exposes the six chips in display order", () => {
    assert.deepEqual(CHIPS.map((c) => c.id), ["4k", "1080p", "720p", "hdr", "dub", "gb"]);
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

test("chip 720p", () => {
    assert.equal(matches(S.hd, "", ["720p"]), true);
    assert.equal(matches(S.fhd, "", ["720p"]), false);
    assert.equal(matches(S.uhd, "", ["720p"]), false);
});

test("chips 4k + 1080p + 720p are OR'd (same resolution group)", () => {
    const on = ["4k", "1080p", "720p"];
    assert.equal(matches(S.uhd, "", on), true);
    assert.equal(matches(S.fhd, "", on), true);
    assert.equal(matches(S.hd, "", on), true);
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

// ---- compileTerm / compileTerms ----

test("compileTerm: plain term is trimmed and lowercased", () => {
    assert.equal(compileTerm("1080P"), "1080p");
    assert.equal(compileTerm("  4K  "), "4k");
    assert.equal(compileTerm("Dolby Vision"), "dolby vision");
});

test("compileTerm: empty / whitespace-only / non-string gives null", () => {
    assert.equal(compileTerm(""), null);
    assert.equal(compileTerm("   "), null);
    assert.equal(compileTerm(), null);
    assert.equal(compileTerm(null), null);
});

test("compileTerm: ~term becomes a whole-word RegExp", () => {
    const re = compileTerm("~dv");
    assert.ok(re instanceof RegExp);
    // matches() lowercases the haystack before testing, so the pipeline matches "DV".
    assert.equal(matches("Show 2160p DV HDR10", "", ["hdr"]), true);
    assert.equal(re.test("a dv b"), true);
    assert.equal(re.test("show dv"), true);
    assert.equal(re.test("dvdrip"), false);
    assert.equal(re.test("dvdrip x264"), false);
});

test("compileTerm: ~ alone or ~ plus whitespace is null", () => {
    assert.equal(compileTerm("~"), null);
    assert.equal(compileTerm("~   "), null);
});

test("compileTerm: regex metacharacters in a ~ term are literal, not a pattern", () => {
    assert.doesNotThrow(() => compileTerm("~c++"));
    const cpp = compileTerm("~c++");
    assert.ok(cpp instanceof RegExp);
    assert.equal(cpp.test("a c++ b"), true);
    assert.equal(cpp.test("a cpp b"), false);

    const dot = compileTerm("~a.b");
    assert.equal(dot.test("a.b"), true);
    assert.equal(dot.test("axb"), false);

    assert.doesNotThrow(() => compileTerm("~("));
});

test("compileTerms: splits on commas, compiles each, drops empties, dedupes", () => {
    assert.deepEqual(compileTerms("2160p, 4K ,, ~dv"), ["2160p", "4k", compileTerm("~dv")]);
    assert.deepEqual(compileTerms(""), []);
    assert.deepEqual(compileTerms(",,,"), []);
    assert.deepEqual(compileTerms("4k,4k,4K"), ["4k"]);
});

// ---- resolveChips ----

const DEFAULT_IDS = ["4k", "1080p", "720p", "hdr", "dub", "gb"];

test("resolveChips: null and {} give the six enabled defaults in order", () => {
    for (const settings of [null, undefined, {}]) {
        const resolved = resolveChips(settings);
        assert.deepEqual(resolved.map((c) => c.id), DEFAULT_IDS);
        assert.equal(resolved.length, 6);
    }
});

test("resolveChips: enabled === false or 'false' hides a chip", () => {
    assert.deepEqual(resolveChips({ "chip.dub.enabled": false }).map((c) => c.id), [
        "4k", "1080p", "720p", "hdr", "gb",
    ]);
    assert.deepEqual(resolveChips({ "chip.gb.enabled": "false" }).map((c) => c.id), [
        "4k", "1080p", "720p", "hdr", "dub",
    ]);
});

test("resolveChips: missing / true / 'true' / garbage all stay enabled", () => {
    for (const value of [undefined, true, "true", 0, "nope", null]) {
        const resolved = resolveChips({ "chip.4k.enabled": value });
        assert.ok(resolved.some((c) => c.id === "4k"), "4k should stay enabled for " + JSON.stringify(value));
    }
});

test("resolveChips: custom terms override the default", () => {
    const resolved = resolveChips({ "chip.1080p.terms": "bluray,WEB" });
    const chip = resolved.find((c) => c.id === "1080p");
    assert.deepEqual(chip.terms, ["bluray", "web"]);
});

test("resolveChips: blank / whitespace / only-commas terms fall back to defaults", () => {
    const def = DEFAULT_CHIPS.find((c) => c.id === "4k").terms;
    for (const value of ["", "   ", ",,,", " , ,"]) {
        const chip = resolveChips({ "chip.4k.terms": value }).find((c) => c.id === "4k");
        assert.deepEqual(chip.terms, compileTerms(def));
    }
});

test("resolveChips: unknown keys are ignored", () => {
    const resolved = resolveChips({ "chip.nope.enabled": false, random: "x", "chip.4k.nope": "y" });
    assert.equal(resolved.length, 6);
    assert.deepEqual(resolved.map((c) => c.id), DEFAULT_IDS);
});

test("resolveChips(null) deep-equals the exported CHIPS", () => {
    assert.deepEqual(resolveChips(null), CHIPS);
});

test("resolveChips: a hidden chip excludes it entirely, custom terms included", () => {
    const resolved = resolveChips({ "chip.hdr.enabled": false, "chip.4k.terms": "uhd only" });
    assert.deepEqual(resolved.map((c) => c.id), ["4k", "1080p", "720p", "dub", "gb"]);
    assert.deepEqual(resolved.find((c) => c.id === "4k").terms, ["uhd only"]);
    assert.equal(resolved.some((c) => c.id === "hdr"), false);
});

// ---- buildSchema ----

test("buildSchema: 12 items with unique keys, toggle then input per chip", () => {
    const schema = buildSchema();
    assert.equal(schema.length, 12);

    const keys = schema.map((i) => i.key);
    assert.equal(new Set(keys).size, keys.length);

    const expected = [];
    for (const chip of DEFAULT_CHIPS) {
        expected.push("chip." + chip.id + ".enabled", "chip." + chip.id + ".terms");
    }
    assert.deepEqual(keys, expected);

    schema.forEach((item, i) => {
        assert.equal(item.type, i % 2 === 0 ? "toggle" : "input");
    });
});

test("buildSchema: every item passes the app's validator rules", () => {
    const isValidItem = (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof item.key === "string" &&
        item.key.length > 0 &&
        typeof item.label === "string" &&
        ["input", "toggle", "select"].includes(item.type) &&
        (item.description === undefined || typeof item.description === "string");

    for (const item of buildSchema()) {
        assert.ok(isValidItem(item), "invalid schema item: " + JSON.stringify(item));
    }
});

test("buildSchema: inputs carry the default terms string and a description", () => {
    const schema = buildSchema();
    for (const chip of DEFAULT_CHIPS) {
        const item = schema.find((i) => i.key === "chip." + chip.id + ".terms");
        assert.equal(item.defaultValue, chip.terms);
        assert.equal(typeof item.description, "string");
    }
});

// ---- matches with an explicit chips array ----

test("matches: the 4th argument supplies the chips to use", () => {
    const custom = [
        { id: "4k", label: "4K", group: "res", terms: ["customtoken"] },
    ];
    assert.equal(matches("This stream has a customtoken", "", ["4k"], custom), true);
    assert.equal(matches("This stream is 2160p", "", ["4k"], custom), false);
    // default chips still used when the 4th argument is omitted
    assert.equal(matches("This stream has a customtoken", "", ["4k"]), false);
    assert.equal(matches("This stream is 2160p", "", ["4k"]), true);
});

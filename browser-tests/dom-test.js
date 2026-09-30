const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const visible = () =>
  [...document.querySelectorAll('[class*="streams-container-"] > div')]
    .filter((w) => !w.hasAttribute("data-sf-hidden"))
    .map((w) => w.querySelector(".description-container-vW_De").textContent.replace(/\n.*/s, "").slice(0, 45));
const rec = (name, cond, extra) => results.push((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + extra : ""));
const type = async (v) => { const i = document.querySelector("#sf-bar .sf-input"); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); await sleep(300); };
const chip = async (label) => { [...document.querySelectorAll("#sf-bar .sf-chip")].find((c) => c.textContent === label).click(); await sleep(150); };
const count = () => document.querySelector("#sf-bar .sf-count").textContent;
const emptyShown = () => !document.querySelector("#sf-bar .sf-empty").hidden;
const inputVal = () => document.querySelector("#sf-bar .sf-input").value;
const chipsOn = () => [...document.querySelectorAll('#sf-bar .sf-chip[aria-pressed="true"]')].map((c) => c.textContent).join(",");

(async () => {
  try {
    await sleep(400);
    rec("bar mounted after header", document.querySelector(".select-choices-wrapper-xGzfs").nextElementSibling?.id === "sf-bar");
    rec("bar exactly once", document.querySelectorAll("#sf-bar").length === 1);
    rec("5 chips", document.querySelectorAll("#sf-bar .sf-chip").length === 5);
    rec("initial: all 6 visible, count", visible().length === 6 && count() === "6 streams", count());
    rec("install button untouched", !document.querySelector(".install-button-container-zz").hasAttribute("data-sf-hidden"));

    await type("1080p -x264");
    rec("text: 1080p -x264 -> 2 rows", visible().length === 2, JSON.stringify(visible()));
    rec("count shows 2 of 6", count() === "showing 2 of 6", count());

    await type("zzzz");
    rec("no match -> 0 rows + empty msg", visible().length === 0 && emptyShown());

    await type("");
    rec("cleared -> all back, no empty msg", visible().length === 6 && !emptyShown());

    await chip("1080p"); await chip("4K");
    rec("chips 1080p+4K (OR) -> 4 rows", visible().length === 4, JSON.stringify(visible()));
    await chip("HDR");
    rec("+HDR (AND) -> 1 row (2160p)", visible().length === 1 && /2160p/.test(visible()[0]), JSON.stringify(visible()));
    await chip("HDR"); await chip("4K");
    await chip("Dub");
    rec("1080p+Dub -> dubbed + dual audio (not Multi Subs)", visible().length === 2, JSON.stringify(visible()));
    await chip("Dub");
    await chip("\ud83c\uddec\ud83c\udde7");
    rec("1080p+flag -> 1 row", visible().length === 1, JSON.stringify(visible()));
    await chip("\ud83c\uddec\ud83c\udde7"); await chip("1080p");
    rec("all chips off -> 6 rows", visible().length === 6);

    // React reuses row elements: swap text of an existing row while a filter is active
    await type("cam");
    rec("filter cam -> 1 row", visible().length === 1);
    const first = document.querySelector('[class*="streams-container-"] > div .addon-name-tC8PX');
    const descs = document.querySelectorAll(".description-container-vW_De");
    descs[0].textContent = "Show CAM reused row";     // row 0 now matches
    descs[5].textContent = "Show something else";      // old match no longer matches
    await sleep(300);
    rec("row reuse re-evaluated by observer", visible().length === 1 && /reused/.test(document.querySelectorAll(".description-container-vW_De")[0].textContent) && !document.querySelectorAll('[class*="streams-container-"] > div')[0].hasAttribute("data-sf-hidden"), JSON.stringify(visible()));

    // Late-arriving addon rows
    const wrap = document.createElement("div");
    wrap.innerHTML = '<a class="stream-container-JPdah"><div class="description-container-vW_De">Other addon CAM 720p</div></a>';
    document.getElementById("sc").insertBefore(wrap, document.querySelector(".install-button-container-zz"));
    await sleep(300);
    rec("late row is filtered too", visible().length === 2 && count() === "showing 2 of 7", count());

    // Escape clears
    const i = document.querySelector("#sf-bar .sf-input");
    i.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(200);
    rec("Esc clears query", inputVal() === "" && visible().length === 7);

    // Key events must not reach document listeners
    let leaked = false;
    document.addEventListener("keydown", () => (leaked = true));
    i.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    rec("keydown does not bubble to document", leaked === false);

    // ---- per-show memory ----
    await type("1080p"); await chip("Dub");
    rec("setup: query+chip", inputVal() === "1080p" && chipsOn() === "Dub");

    location.hash = "#/metadetails/series/tt1/tt1%3A1%3A2"; await sleep(300);
    rec("next episode keeps filter", inputVal() === "1080p" && chipsOn() === "Dub" && visible().length === 2, inputVal() + "|" + chipsOn());

    location.hash = "#/player/abc/http%3A%2F%2Fx/http%3A%2F%2Fy/series/tt1/tt1%3A1%3A2"; await sleep(300);
    location.hash = "#/metadetails/series/tt1/tt1%3A1%3A2"; await sleep(300);
    rec("player -> back keeps filter", inputVal() === "1080p" && chipsOn() === "Dub");

    location.hash = "#/metadetails/series/tt2/tt2%3A1%3A1"; await sleep(300);
    rec("different show clears", inputVal() === "" && chipsOn() === "" && visible().length === 7, inputVal() + "|" + chipsOn());

    await type("1080p"); await chip("HDR");
    location.hash = "#/board"; await sleep(300);
    location.hash = "#/metadetails/series/tt2/tt2%3A1%3A1"; await sleep(300);
    rec("leaving to home then reopening clears", inputVal() === "" && chipsOn() === "" && visible().length === 7, inputVal() + "|" + chipsOn());

    // list remount (episode change in React unmounts/remounts list)
    await type("x264");
    const oldList = document.querySelector('[class*="streams-list-container-"]');
    const clone = oldList.cloneNode(true); clone.querySelector("#sf-bar")?.remove();
    oldList.replaceWith(clone); await sleep(300);
    rec("bar re-mounted on list remount, once", document.querySelectorAll("#sf-bar").length === 1 && inputVal() === "x264" && visible().length === 2, document.querySelectorAll("#sf-bar").length + "|" + inputVal() + "|" + visible().length);

    // no streams container (loading / error state) -> bar hidden, no crash
    document.querySelector('[class*="streams-container-"]').remove(); await sleep(300);
    rec("no streams container -> bar hidden", document.getElementById("sf-bar").hidden === true);
  } catch (e) {
    results.push("ERROR " + e.stack);
  }
  document.getElementById("out").textContent = "RESULTS\n" + results.join("\n") + "\nEND";
})();

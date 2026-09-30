# StreamFilter

A [Stremio Enhanced](https://github.com/REVENGE977/stremio-enhanced) plugin that adds a filter bar to the streams list. It shows up when you open a movie or episode, and it works on the streams from every addon, not just Torrentio.

- A text box above the list, with a "showing X of Y" count.
- Quick-toggle chips: **4K**, **1080p**, **720p**, **HDR**, **Dub**, **🇬🇧**.
- Your filter is kept while you move between episodes of the same show (or into the player and back). It is cleared when you open a different title or leave the show.

## Install

Clone the repo and link the plugin file into Stremio Enhanced's plugins folder:

```sh
git clone https://github.com/SilentKnightOwl/stremio-filter-plugin
cd stremio-filter-plugin
make install     # symlinks into ~/.config/stremio-enhanced/plugins/
```

Then in Stremio Enhanced go to Settings, scroll to Plugins and enable **StreamFilter**. Reload with `Ctrl+R`.

Because it is a symlink, `git pull` plus `Ctrl+R` is enough to update. `make uninstall` removes the link. The plugin lives in your config folder, so updating Stremio Enhanced itself does not touch it.

You can also copy `stream-filter.plugin.js` into the plugins folder by hand.

## Filter syntax

Type words into the box. Matching ignores case and looks anywhere in the stream's text (addon name, stream name and description).

| You type | Shows |
|---|---|
| `1080p` | streams containing `1080p` |
| `2160p hdr` | streams containing both words |
| `-cam` | everything except streams containing `cam` |
| `1080p -cam -hevc` | 1080p streams without `cam` or `hevc` |

`Esc` clears the box.

## Chips

| Chip | Matches (any of) |
|---|---|
| 4K | `2160p`, `4k`, `uhd` |
| 1080p | `1080p` |
| 720p | `720p` |
| HDR | `hdr` (so `hdr10` too), `dolby vision`, `dv` as a whole word (so `DVDRip` does not match) |
| Dub | `dub` (so `dubbed` too), `dual audio` |
| 🇬🇧 | the literal 🇬🇧 flag |

4K, 1080p and 720p are combined with OR, so turning on any of them shows streams matching any of the three. Every other chip, and the text box, must also match (AND). For example 1080p + Dub + `-x264` means a 1080p dub without x264.

`multi` is deliberately not part of Dub, because it also appears in "multi subs".

These are only the defaults. See Settings below to change them.

## Settings

Chips are configurable. Open Stremio Enhanced settings, go to the Enhanced section, then Plugins, turn **StreamFilter** on, and click the plugin's options button. Each chip has a show/hide toggle and a single-line field of comma-separated match terms. A term prefixed with `~` matches as a whole word, so `~dv` catches DV but not DVDRip. Plain terms match as substrings. Leave a terms field empty and the built-in default is used; the Chips table above lists those.

Changes show up on the open streams list immediately, with no reload.

Settings are saved to `stream-filter.plugin.json` in the plugins folder. The app's settings UI does not escape them, so the plugin strips `"`, `<` and `>` from term fields when saving.

If the plugin's set of setting fields changes, say after an update, restart Stremio Enhanced fully. `Ctrl+R` keeps the old fields registered in memory, so the new ones will not show up.

## If Stremio changes its layout

Stremio's CSS class names carry a hash (like `stream-container-JPdah`), so the plugin matches on the part before the hash. If a Stremio update renames those, the bar or the filtering stops working and a warning shows up in the DevTools console (`Ctrl+Shift+I`). Update the `SEL` constants near the top of the DOM section in `stream-filter.plugin.js`:

| Constant | Element |
|---|---|
| `list` | the whole streams panel |
| `header` | the row with the back button and addon dropdown (the bar goes right after it) |
| `rows` | the scrolling container that holds the stream rows |
| `row` | a single stream row |

## Development

```sh
npm test               # unit tests for matching and route logic (Node, no dependencies)
npm run test:browser   # DOM tests in headless Chromium against a fixture of Stremio's markup
```

The browser tests need `chromium` on your PATH (or `CHROMIUM=/path/to/browser`). The fixture in `browser-tests/fixture.html` copies the class names from Stremio's web build, so it will not notice a markup change by itself. Check the real app after a Stremio update.

## License

MIT

# Support index.html

## Bruce's Ask

I've temporarily copied in the spa-ssi project, to save on context switching.  I will remove it once this is fixed.

From a chat from [o2h-edge](../../o2h-edge/Chats/SampleStoreApp.md#claudes-implementation-notes-stage-1):

> 5. **spa-ssi serves its site map for `/demo/store/`,** not the directory's `index.html`. Defaulting to `index.html` would help.

Can you do this carefully?  I want to continue to support site maps just as they are, unless index.html exists, in which case render that file.  Please add your implementation notes below.

## Claude's Implementation Notes

**The change** is in `serve.js`, in the directory branch of `handleRequest` (about ten lines). When a request resolves to a directory and has its trailing slash, the server checks for `index.html` in that directory:
- **If it's there:** that file is served through the normal file path, so its `<!-- #include -->`s are processed. Relative includes resolve against that directory, exactly as when `…/index.html` is requested directly.
- **If not:** that directory's site map, exactly as before.

Nothing else changed:
- **Without the trailing slash** (`/demo/store`), you still get the 301 to `/demo/store/`, so relative links in the page work.
- **`/sitemap`** still lists the whole site.
- **The SPA fallback** is unchanged: a missing `.html` gets the root `index.html`, or the site map when there is none.

**Checked** against a scratch site (no root `index.html`; `withindex/` with one; `withindex/deeper/` and `noindex/` without):

| Request | Before | Now |
|---|---|---|
| `/withindex/` | site map | **`withindex/index.html`**, includes processed |
| `/withindex` | 301 → `/withindex/` | the same |
| `/withindex/deeper/`, `/noindex/` | that directory's site map | the same |
| `/`, `/sitemap` | the whole site map | the same |
| `/missing.html` | the whole site map (no root index) | the same |

And with an `index.html` added at the root:
- **`/`** now serves it, as your rule implies, where it used to show the site map;
- **`/sitemap`** still lists everything;
- **`/missing.html`** gets it (SPA mode, as before);
- **`/noindex/`** is still its own site map.

**What it changes in the workspace:** none of the workspace's serving roots (beGingerly, assign-gingerly, o2h, o2h-edge) has a root `index.html`, so their `/` is unchanged. Only spa-ssi's own root does, so serving spa-ssi itself now shows its `index.html` at `/`. `/demo/store/` in o2h-edge now opens the store.

**README:** the "Directory Listing support" section now says when a directory serves its `index.html`.

### A separate bug I found while testing (not fixed)

**A page with more than one include can lose one.** `processIncludes` loops `includeRegex.exec(html)` while it replaces matches **in that same string**. When a replacement is shorter than its `<!-- #include … -->` comment, the regex's `lastIndex` lands past the next include, which is then never processed.

In the test:
- `/shared.html` then `local.html`: only `shared` appeared;
- swapped: only `local` appeared;
- each alone: works.

This was already the case, and it happens whether the page is reached as `…/index.html` or through the new directory path.

**The fix** would be small: collect the matches first, then replace them, or rebuild the string as it goes. Should I fix it?

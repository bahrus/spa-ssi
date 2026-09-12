# Incorporating pipe-in

##  Bruce's Ask

Don't implement anything yet.  I wanted to get your thoughts on recognizing [pipe-in attributes](../../pipe-in/README.md) in [server.js](../serve.js).

The way I would want it to work is:

1.  If the reference is a bare import specifier, and the specifier points to an external non local location, check if the resource is in cache, if not, the tag alone, and start retrieving the resource in a background thread, which puts it in cache.  This is probably the hardest step, and could be phase II
2.  Exercise the same logic as far as looking for markers.
3.  If successfully able to insert the content, leave the attributes alone but set [base]-state="complete"

I think we need to make pipe-in not take action if [base]-state="complete" which I don't think is the case yet.

What would it take to make this work?

---

## Claude's Thoughts

No implementation below — just the shape of it, the hard parts, and the
questions I think need an answer before this is buildable.

### First: you're right about the guard, and it's a one-line, ship-now fix

Confirmed by reading `pipe-in.js` — `hydrate()` has **no check at all** on
`[base]-state`. It reads `url`, `method`, etc. and goes straight to the cache
check / fetch. So today, an element that already carries `pipe-in-state="complete"`
in its markup gets re-fetched and re-streamed exactly as if that attribute
weren't there — your SSI plan can't work until this changes.

Also worth noting: `pipe-in-state` isn't in `emc.mjs`'s `withAttrs` at all — it's
a pure *output* (set via `el.setAttribute` inside `#setState`), never wired
through roundabout as an input prop. So the guard has to be a plain DOM read at
the top of `hydrate`, not a new EMC-tracked property:

```js
async hydrate(self){
    const { enhancedElement, ... } = self;
    const stateAttr = this.#getStateAttr(enhancedElement);
    if (enhancedElement.getAttribute(stateAttr) === 'complete') {
        return /** @type {PAP} */ ({resolved: true});   // SSI already delivered it
    }
    ...
```

Small, independent, no dependency on anything else here — I'd land this on its
own regardless of what happens with the rest.

One thing to decide alongside it: should the guard *also* skip on
`state="error"` (so a page that got a bad server-side prefetch doesn't retry
client-side either), or only `"complete"`? I'd say **only `"complete"`** —
if the SSI-side attempt failed, the client is the fallback of last resort and
should still try. That also means the SSI side should never itself stamp
`state="error"` onto served markup — only `"complete"` on success, and
otherwise leave the attributes exactly as authored so the client's normal path
runs unmodified.

### The three steps, mapped to what's actually involved

**Step 3 first, because it constrains 1 and 2.** "Insert the content, leave the
attributes alone, set state=complete" means: whatever pipe-in's *browser-side*
transform pipeline would have produced, the server has to produce the same
thing as static text, or the client (which now never runs, per the guard above)
won't be there to fix a gap. That has teeth:

- **`[base]-base` (URL rewriting):** if it's present, the fetched content
  almost certainly has relative `href`/`src`/etc. that need rewriting to the
  origin's directory. Skipping this server-side would ship broken links with
  no client-side pass left to repair them, once state=complete suppresses it.
  `rewrite-urls.js` is a streaming transform today; over a complete cached
  string this is just "run it once, synchronously" — doable, but it *is* one
  more piece of pipe-in's pipeline the SSI path has to replicate faithfully,
  not just fetch-and-drop-in.
- **Sanitizer:** this is the one I'd stop and think hard about rather than
  silently replicate. The default (non-`Unsafe`) methods run the browser's
  `Sanitizer` API — a DOM-level filter with no server-side equivalent short of
  pulling in a real HTML-sanitization library. I don't think SSI should try to
  reimplement that. Two honest options: (a) only ever apply this optimization
  when the configured method is one of the `*Unsafe` ones (which already only
  fire under pipe-in's own trust gate — bare specifier via import map, or
  same-origin path) and pass the fetched text through untouched, matching what
  the browser would have done with no sanitizer in play; or (b) if the method
  is a *safe* one, don't attempt the optimization at all and let the client
  run normally (no state=complete stamped). I'd lean (a)+(b) together: SSI
  only ever short-circuits the client for the same URL shapes pipe-in already
  trusts for unsafe content, never invents a new trust boundary.
- **Insertion target / method (`streamHTML` vs `streamAppendHTML` vs
  `streamBeforeHTML` etc., `shadowrootmode`):** SSI is splicing raw text, not
  operating on a live DOM, so each method needs its own text-splice rule.
  **Shadow DOM is the easy, clean case** — [Declarative Shadow
  DOM](https://web.dev/articles/declarative-shadow-dom) is itself just HTML
  text (`<template shadowrootmode="open">…</template>` as the element's first
  child), so `pipe-in-shadowrootmode` maps almost one-to-one onto something
  SSI can emit with a string template, no parser needed. **Light-DOM replace /
  append / prepend is the hard case** — it requires finding the element's
  matching close tag in the raw text (nesting, self-authored markup should be
  well-behaved, but this is exactly the kind of thing a regex gets wrong on
  anything not perfectly well-formed). `streamBeforeHTML`/`streamAfterHTML`
  (siblings of the whole element) are simpler again — insert next to the open
  tag without needing to find the close tag at all. I'd sequence support in
  that order: shadow DOM first, before/after next, replace/append/prepend
  (needs the close tag) last or deferred.

**Step 2 — markers.** Once there's a complete cached string, applying
`[base]-start`/`[base]-end` is trivial — `snip.js`'s semantics (start marker
inclusive, end marker exclusive) collapse from a `TransformStream` to two
`indexOf` calls over the whole string. I wouldn't reuse `snip.js` itself
(streaming machinery for a problem that's now "slice a string twice"); I'd
port the same semantics as a 5-line synchronous function so behavior matches
exactly, tested once against the same fixtures.

**Step 1 — bare specifier + external + cache — the hard one, agreed.** Breaking
down why:

- *Resolving a bare specifier server-side.* pipe-in.js does this with
  `import.meta.resolve(url)` — that's Node/browser **module** resolution, not
  an HTML page's `<script type=importmap>`. SSI would need its own tiny
  resolver: parse the importmap `<script>` already on the page (same one
  `#include virtual="/imports.html"` pages already carry), and implement just
  enough of the HTML spec's [resolving a module
  specifier](https://html.spec.whatwg.org/multipage/webappapis.html#resolving-a-module-specifier)
  — exact match, or longest `"prefix/"` match — to turn `springer/article/...`
  into `https://link.springer.com/article/...`. That's a bounded, well-known
  algorithm (maybe 30–40 lines), not a big lift on its own.
- *"External non-local."* After resolving, "local" (same-origin absolute
  path, or resolves to one) is actually the *easy* case and doesn't need any
  of this machinery — SSI can just `fs.readFile` the target file directly, no
  network, no cache lifecycle, no background anything. I'd treat **local
  resources as its own, much smaller, Phase 1** ahead of the external case —
  most of the win (instant, no client fetch, no flash) with none of the hard
  parts (no cache invalidation, no partial-content race, no "is it stale"
  question). "External" only kicks in once the resolved URL's origin differs
  from the page's own.
- *The cache.* An in-memory `Map` keyed the same way pipe-in already keys its
  own dedup (`resolvedUrl|start|end|base`) is the natural, zero-new-concept
  choice — this server is a dev/static file server, not a CDN, so I wouldn't
  reach for anything beyond process memory unless you want prefetches to
  survive a server restart. It does need a policy for going stale, and
  `[base]-cache` already gives us the vocabulary to reuse instead of inventing
  new attributes: `no-store` skips the SSI cache entirely (always leave the
  tag alone, let the client fetch, exactly today's behavior); `reload` forces
  a fresh background refetch even on a hit; everything else uses whatever's
  cached, however old.
- *"Background thread."* I'd want to confirm what you mean by this before
  building it — Node doesn't get you a real background thread for a `fetch()`
  without reaching for `worker_threads`, and I don't think that buys anything
  here (the event loop already makes an async `fetch()` non-blocking for the
  *current* response; there's no CPU-bound work in step 1 that would benefit
  from a worker). My read of the intent is simpler and doesn't need
  `worker_threads` at all: on a cache miss, kick off `fetch(...)` without
  `await`-ing it in the request path, serve the page with the tag untouched
  (client does its normal thing this once), and when that fetch resolves,
  drop the result in the cache for the *next* request to that page. Plus the
  same "don't start two fetches for the same key" dedup pipe-in's own
  `inflight` map already does, reused rather than reinvented.
- *Failure.* A background fetch that 404s/times out shouldn't poison the
  cache as a persistent failure — I'd either not cache it at all (next
  request just retries) or cache the failure with a short TTL so a broken
  origin doesn't get hammered once per request, but never mark the *served*
  element's state as anything but what it was authored with — per the guard
  discussion above, no `state="error"` from SSI.

### Two things I'd flag before any code gets written

**1. `gist-in` looks like it's already trying to be exactly this, generalized
differently.** Its README: *"An exportable module that JS-based web servers and
JS-based build tools can use to embed a github-based gist of html... into an
html stream for optimal performance"* + *"A fallback element enhancement to
request the [resource] in the browser client."* That's the identical
shape — server-side prefetch-and-splice with a client-side fallback for the
cache-miss/failure case — just scoped to `gist.githubusercontent.com` URLs and
its own `gist-in`/`gist-for`/`<?marker name="...">` markup convention instead of
pipe-in's attributes and start/end markers. Right now `gist-in` is
README-only (no `.js` yet), so nothing's built there to conflict with, but if
this pipe-in+spa-ssi integration and `gist-in` end up solving the same problem
in two separate places, that's worth deciding *before* either gets implemented:
should the caching/background-fetch/splice engine be one shared module (used
by spa-ssi for pipe-in, and by whatever ends up implementing `gist-in`), with
pipe-in-attribute-recognition and gist-in's own markup as two thin front ends
over it? Given how closely the two READMEs describe the same mechanism, I'd
lean toward building the generic engine once — but that's very much your call,
not mine to assume.

**2. Where does this code live?** Following from the above: purely inside
`spa-ssi/serve.js` (matches your ask literally, keeps it self-contained), or as
a small importable module (`spa-ssi` and, later, `gist-in` both consume it)?
`spa-ssi` currently has **zero npm dependencies** — worth deciding up front
whether that stays true. The `#include virtual="..."` regex today is narrow
because it matches one specific, self-authored comment syntax; finding
`pipe-in`/`⇥` (and their sibling `[base]-*` attributes) on arbitrary elements
is a bigger regex surface — attributes in any order, `"`/`'`/unquoted values,
nested tags. I think a bounded, targeted regex (find the opening tag by its
base attribute, then tokenize just that tag's attribute list) is tractable for
markup this project authors itself, without pulling in a real HTML parser —
but it's worth being explicit that "tractable for our own well-formed markup"
is a different bar than "robust against arbitrary HTML," and confirming
that's an acceptable tradeoff before writing it.

### A concrete way to slice this into ship-able pieces

1. **Phase 0** — the `pipe-in.js` state guard. Trivial, unblocks everything
   else, no downside.
2. **Phase 1** — SSI recognizes `pipe-in`/`⇥` only where the reference
   resolves to a **local, same-origin path** (already-common case:
   `pipe-in=/demo/partials/sample.html`). No cache, no background fetch, no
   staleness question — `fs.readFile` the target, apply start/end snip, splice
   via the shadow-DOM-template trick where `shadowrootmode` is set, stamp
   `state="complete"`. This alone covers a lot of the "why wait for the
   browser to fetch a file the server already has on disk" motivation with
   none of the Step-1-hard-parts.
3. **Phase 2** — your Step 1: bare-specifier resolution against the page's
   import map, the external/cross-origin case, the in-memory cache, the
   non-blocking background refetch-and-populate.
4. **Phase 3** — the rest of method/base-rewrite parity (light-DOM
   append/prepend/replace needing close-tag matching; `[base]-base` rewriting)
   for the cases Phase 1/2 don't yet cover.

Say the word on the two flagged questions (gist-in overlap, dependency-free vs.
a tiny parser) and which phase you want first, and I'll start on it.
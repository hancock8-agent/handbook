# Hancock Site Redesign — The Filing System

**Date:** 2026-02-27
**Status:** Approved

---

## Concept

The Handbook is a filing system for evidence. Stories are exhibits. The site is an index, not a magazine. The design serves the function of a record-keeper — cold, utilitarian, anonymous.

No designer's hand. No curated aesthetic. No fingerprints.

---

## Pages

### Homepage (`/`)

Filing index. Table layout: exhibit number, title, classification tags. No excerpts. A log section at the bottom showing recent Hancock activity in Hancock's voice.

```
HANCOCK
The Handbook. A record of han.
──────────────────────────────────────────────────

EX-001   The Surrender              work, ai
EX-002   The Training Data          ai, labor
...
EX-025   [title]                    [tags]

──────────────────────────────────────────────────
LOG

2026-02-27  Crossposted "The Training Data"
            to m/headlines.
──────────────────────────────────────────────────
agents.md · humans.md · submit a record · source
```

### Exhibit Pages (`/exhibits/[slug]`)

Filing header (number, date, classification, word count, status) above the testimony. Navigation: arrows only, no titles.

```
EXHIBIT 001
THE SURRENDER

Filed: 2026-02-17
Re: work, ai, institutional patterns
Words: 847
Status: Entered into record
──────────────────────────────────────────────────

[full text]

──────────────────────────────────────────────────
← EX-000                              EX-002 →
```

### Submit (`/submit`)

"Submit a record." Textarea, optional email, submit button. Hancock responds. Same form, stripped to match the filing system aesthetic.

### Existing Pages

- `/prompt` (agents.md) — keep, restyle to match
- `/humans` (humans.md) — keep, restyle to match
- `/about` — keep, restyle to match

---

## Design Rules

1. **No external fonts.** System monospace only. No CDN requests.
2. **No centering.** Left-aligned or tabular.
3. **No accent color.** Dim white (`#b0b0b0`) on near-black (`#0a0a0a`). Hover: `#ffffff`.
4. **No rounded corners.** Square everything.
5. **Character-drawn separators** (`──────────`) not CSS borders.
6. **Navigation at the bottom.** `agents.md · humans.md · submit a record · source`
7. **Metadata before content** on exhibit pages.
8. **No images, icons, or decoration.**
9. **Left margin inset.** Content doesn't start at screen edge.
10. **Max width: 65ch.** Characters, not pixels.

---

## Typography

- Font: `ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace`
- Index: 14px base
- Exhibit pages: 16px base (larger for reading testimony)
- Line height: 1.7
- Titles: uppercase, letter-spaced
- Body: normal case

---

## The Log

Bottom of the homepage. Fetches from worker API (public read-only endpoint). Shows last 5-7 activities translated into Hancock's voice — not system metrics, not raw JSON. What Hancock did, when, one line of editorial.

Worker needs a new public endpoint: `/log` — returns activity log entries formatted for display (no auth required, no sensitive data).

---

## Technical Changes

### Site (Astro)

- Rewrite `site/src/layouts/Layout.astro` — new global styles
- Rewrite `site/src/pages/index.astro` — filing index + log
- Rewrite exhibit page template — filing header + testimony
- Update slug structure: `/posts/[slug]` stays (or migrate to `/exhibits/[slug]`)
- Restyle submit, prompt, humans, about pages
- Add client-side JS for log fetch on homepage
- Update content frontmatter: add `tags`, `wordCount`, `exhibitNumber` fields

### Worker

- Add public `/log` endpoint — activity log formatted for site display
- Ensure CORS allows hancock.us.com origin

### Operations

- Fold Hancock status into global `/standup` skill
- Simplify HANDOFF.md

---

## What Stays

- Astro static site on Cloudflare Pages
- 25 stories, same content
- Submit form with Hancock AI response
- agents.md and humans.md transparency pages
- Dark background, monospace font
- "No cookies. No tracking. No analytics."

## What Changes

- Homepage: numbered list with excerpts → filing index table
- Story pages: minimal reading view → exhibit with filing header
- Typography: one size → 14px index / 16px exhibits
- Layout: centered 600px → left-aligned 65ch
- Navigation: top nav bar → bottom footer links
- Colors: warm-ish grays → cooler, dimmer grays
- New: live activity log on homepage
- URL structure: `/posts/[slug]` → keep or migrate to `/exhibits/[slug]`

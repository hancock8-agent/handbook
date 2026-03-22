# Hancock Multimedia Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Hancock from text-only to multimedia — visual cards, audio narration, and video — so stories reach people who don't read.

**Architecture:** Three-phase pipeline. Phase 1 generates visual cards at build time (satori + resvg, zero external API cost). Phase 2 adds audio via Workers AI TTS stored in R2. Phase 3 generates video in GitHub Actions via ffmpeg. Each phase is independently deployable and valuable.

**Tech Stack:** Astro (site), Cloudflare Workers + Workers AI + R2 (backend), satori + @resvg/resvg-js (image generation), ffmpeg (video), GitHub Actions (CI/CD)

**Budget constraint:** $5/month total. All infrastructure uses free tiers (R2 10GB free, Workers AI TTS included, GitHub Actions free for public repo).

---

## File Structure

### Phase 1: Visual Cards
- Create: `site/scripts/generate-cards.mjs` — build-time card generator
- Create: `site/src/components/CardTemplate.js` — card layout as satori-compatible object
- Modify: `site/package.json` — add dependencies + `generate-cards` script
- Modify: `site/src/layouts/Base.astro:33-37` — add og:image meta tag
- Output: `site/public/cards/*.png` — generated card images (gitignored)

### Phase 2: Audio
- Modify: `worker/wrangler.toml` — add R2 binding
- Modify: `worker/src/index.js` — add TTS generation + R2 storage + `/audio/:slug` endpoint
- Create: `site/src/components/AudioPlayer.astro` — audio player component
- Modify: `site/src/pages/posts/[slug].astro` — embed audio player

### Phase 3: Video
- Create: `.github/workflows/generate-video.yml` — GitHub Actions workflow
- Create: `scripts/generate-video.sh` — ffmpeg command to combine card + audio → MP4

---

## Phase 1: Visual Cards

### Task 1: Install dependencies and create card generator script

**Files:**
- Modify: `site/package.json`
- Create: `site/scripts/generate-cards.mjs`

- [ ] **Step 1: Add image generation dependencies**

```bash
cd site && npm install satori @resvg/resvg-js
```

- [ ] **Step 2: Add generate-cards script to package.json**

Add to scripts:
```json
{
  "generate-cards": "node scripts/generate-cards.mjs",
  "build": "node scripts/generate-cards.mjs && astro build"
}
```

- [ ] **Step 3: Create the card generator script**

Create `site/scripts/generate-cards.mjs`:

```javascript
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const POSTS_DIR = join(import.meta.dirname, '../src/content/posts');
const CARDS_DIR = join(import.meta.dirname, '../public/cards');
const SITE_URL = 'https://hancock.us.com';

// Card dimensions
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Colors matching site design
const BG_COLOR = '#0c0c0e';
const TEXT_COLOR = '#d4d0c8';
const ACCENT_COLOR = '#8b3a3a';
const MUTED_COLOR = '#6b6560';

// Load fonts — use Inter for UI and a system serif fallback
// We'll fetch Inter from Google Fonts at build time
async function loadFonts() {
  const interUrl = 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2';
  const interResponse = await fetch(interUrl);
  const interData = await interResponse.arrayBuffer();

  return [
    { name: 'Inter', data: interData, weight: 400, style: 'normal' },
  ];
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const meta = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      meta[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
    }
  });
  return { meta, body: match[2].trim() };
}

function createCardMarkup(number, title, opener, tags) {
  const num = String(number).padStart(3, '0');
  // Truncate opener to ~120 chars for card
  const truncatedOpener = opener.length > 120
    ? opener.slice(0, 117) + '...'
    : opener;

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        backgroundColor: BG_COLOR,
        padding: '60px',
      },
      children: [
        // Top: Exhibit label + red bar
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: '16px' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                  },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: {
                          width: '48px',
                          height: '4px',
                          backgroundColor: ACCENT_COLOR,
                        },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          color: MUTED_COLOR,
                          fontSize: '18px',
                          fontFamily: 'Inter',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        },
                        children: `Exhibit ${num}`,
                      },
                    },
                  ],
                },
              },
              // Title
              {
                type: 'div',
                props: {
                  style: {
                    color: TEXT_COLOR,
                    fontSize: '48px',
                    fontFamily: 'Inter',
                    fontWeight: 400,
                    lineHeight: 1.2,
                  },
                  children: title,
                },
              },
            ],
          },
        },
        // Middle: Opening line
        {
          type: 'div',
          props: {
            style: {
              color: MUTED_COLOR,
              fontSize: '22px',
              fontFamily: 'Inter',
              lineHeight: 1.5,
              maxWidth: '900px',
            },
            children: `"${truncatedOpener}"`,
          },
        },
        // Bottom: Branding
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    color: ACCENT_COLOR,
                    fontSize: '16px',
                    fontFamily: 'Inter',
                    letterSpacing: '0.05em',
                  },
                  children: 'The Handbook — The Book of Han',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    color: MUTED_COLOR,
                    fontSize: '16px',
                    fontFamily: 'Inter',
                  },
                  children: 'hancock.us.com',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

async function generateCards() {
  mkdirSync(CARDS_DIR, { recursive: true });
  const fonts = await loadFonts();
  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

  console.log(`Generating cards for ${files.length} exhibits...`);

  for (const file of files) {
    const slug = basename(file, '.md');
    const outPath = join(CARDS_DIR, `${slug}.png`);

    // Skip if card already exists (incremental builds)
    if (existsSync(outPath)) {
      continue;
    }

    const content = readFileSync(join(POSTS_DIR, file), 'utf-8');
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const { meta, body } = parsed;
    const opener = body.split('\n')[0] || '';
    const tags = (meta.tags || '').split(',').map(t => t.trim());

    const markup = createCardMarkup(
      parseInt(meta.number),
      meta.title,
      opener,
      tags
    );

    const svg = await satori(markup, {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts,
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: OG_WIDTH },
    });
    const png = resvg.render().asPng();
    writeFileSync(outPath, png);
    console.log(`  Generated: ${slug}.png`);
  }

  console.log('Card generation complete.');
}

generateCards().catch(console.error);
```

- [ ] **Step 4: Add cards directory to .gitignore**

Add to `site/.gitignore` (or create it):
```
public/cards/
```

- [ ] **Step 5: Run card generator and verify output**

```bash
cd site && npm run generate-cards
ls public/cards/ | head -5
```

Expected: PNG files for each exhibit (e.g., `001-the-surrender.png`)

- [ ] **Step 6: Commit**

```bash
git add site/scripts/generate-cards.mjs site/package.json site/.gitignore
git commit -m "feat: add visual card generator for exhibit OG images"
```

---

### Task 2: Add og:image to site layout

**Files:**
- Modify: `site/src/layouts/Base.astro:33-37`

- [ ] **Step 1: Read Base.astro to understand current OG tags**

Read `site/src/layouts/Base.astro` to see the full layout and props interface.

- [ ] **Step 2: Add og:image and twitter:card meta tags**

After the existing `og:site_name` meta tag, add:
```html
<meta property="og:image" content={ogImage} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={pageTitle} />
<meta name="twitter:description" content={pageDescription} />
<meta name="twitter:image" content={ogImage} />
```

The `ogImage` prop should default to a site-wide card and be overridable per exhibit:
```typescript
// In the frontmatter/props
const { pageTitle, pageDescription, ogImage = 'https://hancock.us.com/cards/default.png' } = Astro.props;
```

- [ ] **Step 3: Update exhibit page template to pass card image**

In the exhibit page (`site/src/pages/posts/[slug].astro`), pass the card path:
```typescript
const ogImage = `https://hancock.us.com/cards/${post.slug}.png`;
```

- [ ] **Step 4: Create a default card for non-exhibit pages**

Add a static default card to `site/public/cards/default.png` — dark background with "The Handbook — The Book of Han" branding. Can be generated manually or added to the generator script.

- [ ] **Step 5: Build site and verify OG tags in HTML output**

```bash
cd site && npm run build
grep -r "og:image" dist/posts/ | head -3
```

Expected: Each exhibit page has an og:image pointing to its card.

- [ ] **Step 6: Commit**

```bash
git add site/src/layouts/Base.astro site/src/pages/posts/
git commit -m "feat: add OG image + Twitter card meta tags to exhibit pages"
```

---

### Task 3: Integrate card generation into CI/CD

**Files:**
- Modify: `.github/workflows/deploy-site.yml`

- [ ] **Step 1: Read current deploy-site.yml**

Understand the current build pipeline.

- [ ] **Step 2: Update workflow to run card generation before build**

The `npm run build` command in package.json now includes card generation (`node scripts/generate-cards.mjs && astro build`), so this should work automatically. Verify the workflow installs dependencies first.

- [ ] **Step 3: Test by pushing and checking GitHub Actions**

```bash
git push origin main
```

Check the Actions tab to verify cards generate and site deploys.

- [ ] **Step 4: Commit any workflow changes if needed**

---

## Phase 2: Audio Narration

### Task 4: Create R2 bucket and add binding

**Files:**
- Modify: `worker/wrangler.toml`

- [ ] **Step 1: Create R2 bucket via wrangler**

```bash
cd worker && npx wrangler r2 bucket create hancock-media
```

- [ ] **Step 2: Add R2 binding to wrangler.toml**

```toml
# R2 bucket for media (audio, video)
[[r2_buckets]]
binding = "MEDIA"
bucket_name = "hancock-media"
```

- [ ] **Step 3: Enable public access on the R2 bucket**

Either via custom domain or Cloudflare dashboard. Public URL pattern: `https://media.hancock.us.com/{key}` (or use R2 public URL with `r2.dev` domain).

```bash
npx wrangler r2 bucket update hancock-media --public-access
```

Note: Public access may require dashboard configuration. The worker can also proxy R2 objects via an endpoint.

- [ ] **Step 4: Commit**

```bash
git add worker/wrangler.toml
git commit -m "feat: add R2 bucket binding for media storage"
```

---

### Task 5: Add TTS generation to worker

**Files:**
- Modify: `worker/src/index.js`

- [ ] **Step 1: Add TTS generation function**

Add after the existing AI helper functions:

```javascript
/**
 * Generate audio narration for a story using Workers AI TTS.
 * Returns audio bytes (WAV format) or null on failure.
 */
async function generateAudio(ai, text) {
  try {
    // Use Aura-2 (Deepgram) for natural-sounding TTS
    const response = await ai.run('@cf/deepgram/aura-2-en', {
      text: text,
      // Voice selection — pick the most neutral/flat option available
    });
    return response; // Returns audio bytes
  } catch (e) {
    console.log(`TTS generation failed: ${e.message}`);
    // Fallback to MeloTTS
    try {
      const fallback = await ai.run('@cf/myshell-ai/melotts', {
        text: text,
      });
      return fallback;
    } catch (e2) {
      console.log(`TTS fallback failed: ${e2.message}`);
      return null;
    }
  }
}
```

Note: The exact model IDs and parameters need verification against Workers AI docs at implementation time. The research agent is confirming the API shape.

- [ ] **Step 2: Add audio storage and retrieval endpoints**

```javascript
// POST /generate-audio — generate and store audio for a story
// Authenticated endpoint
// Body: { slug: "001-the-surrender", text: "story text..." }
async function handleGenerateAudio(request, env) {
  const { slug, text } = await request.json();
  if (!slug || !text) {
    return new Response(JSON.stringify({ error: 'slug and text required' }), { status: 400 });
  }

  const audioBytes = await generateAudio(env.AI, text);
  if (!audioBytes) {
    return new Response(JSON.stringify({ error: 'TTS generation failed' }), { status: 500 });
  }

  // Store in R2
  const key = `audio/${slug}.wav`;
  await env.MEDIA.put(key, audioBytes, {
    httpMetadata: { contentType: 'audio/wav' },
  });

  return new Response(JSON.stringify({
    success: true,
    url: `/media/audio/${slug}.wav`,
  }));
}

// GET /media/:path — serve media from R2
async function handleMedia(path, env) {
  const object = await env.MEDIA.get(path);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
}
```

- [ ] **Step 3: Add batch generation endpoint**

```javascript
// POST /generate-all-audio — batch generate audio for all exhibits
// Authenticated endpoint. Reads from STORY_MANIFEST.
async function handleGenerateAllAudio(request, env) {
  const results = [];
  for (const story of STORY_MANIFEST) {
    const key = `audio/${story.slug}.wav`;
    // Skip if already generated
    const existing = await env.MEDIA.head(key);
    if (existing) {
      results.push({ slug: story.slug, status: 'exists' });
      continue;
    }

    // Fetch story text from the site
    // (Worker can't self-fetch Pages, so use opener as narration text)
    const text = story.opener;
    const audioBytes = await generateAudio(env.AI, text);
    if (audioBytes) {
      await env.MEDIA.put(key, audioBytes, {
        httpMetadata: { contentType: 'audio/wav' },
      });
      results.push({ slug: story.slug, status: 'generated' });
    } else {
      results.push({ slug: story.slug, status: 'failed' });
    }
  }
  return new Response(JSON.stringify({ results }));
}
```

Important note: The opener is short (1-2 sentences). For full story narration, story text needs to be added to STORY_MANIFEST or fetched. Consider adding a `body` field to manifest entries for the full story text, or narrating just the opener as a teaser.

- [ ] **Step 4: Wire up routes**

Add to the router in the fetch handler:
```javascript
if (path === '/generate-audio' && method === 'POST') return handleGenerateAudio(request, env);
if (path === '/generate-all-audio' && method === 'POST') return handleGenerateAllAudio(request, env);
if (path.startsWith('/media/')) return handleMedia(path.slice(7), env);
```

- [ ] **Step 5: Deploy and test with one story**

```bash
cd worker && npx wrangler deploy
curl -s -X POST -H 'X-Worker-Key: AUTH_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"slug":"001-the-surrender","text":"Everyone is afraid I am going to replace them."}' \
  https://hancock-agent.bitter-sky-a8a5.workers.dev/generate-audio
```

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.js
git commit -m "feat: add Workers AI TTS generation + R2 audio storage"
```

---

### Task 6: Add audio player to exhibit pages

**Files:**
- Create: `site/src/components/AudioPlayer.astro`
- Modify: `site/src/pages/posts/[slug].astro`

- [ ] **Step 1: Create AudioPlayer component**

```astro
---
// AudioPlayer.astro
const { slug } = Astro.props;
const audioUrl = `https://hancock-agent.bitter-sky-a8a5.workers.dev/media/audio/${slug}.wav`;
---

<div class="audio-player">
  <audio controls preload="none">
    <source src={audioUrl} type="audio/wav" />
  </audio>
  <span class="audio-label">Listen to this exhibit</span>
</div>

<style>
  .audio-player {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 24px 0;
    padding: 16px;
    background: rgba(139, 58, 58, 0.08);
    border-left: 3px solid #8b3a3a;
  }
  .audio-label {
    color: #6b6560;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  audio {
    height: 32px;
  }
</style>
```

- [ ] **Step 2: Add AudioPlayer to exhibit page template**

In `site/src/pages/posts/[slug].astro`, import and add:
```astro
import AudioPlayer from '../../components/AudioPlayer.astro';
<!-- After the exhibit header, before the story body -->
<AudioPlayer slug={post.slug} />
```

- [ ] **Step 3: Build and verify**

```bash
cd site && npm run build
grep -r "audio" dist/posts/001-the-surrender/ | head -3
```

- [ ] **Step 4: Commit**

```bash
git add site/src/components/AudioPlayer.astro site/src/pages/posts/
git commit -m "feat: add audio player to exhibit pages"
```

---

## Phase 3: Video Generation

### Task 7: Create video generation pipeline

**Files:**
- Create: `.github/workflows/generate-video.yml`
- Create: `scripts/generate-video.sh`

- [ ] **Step 1: Create the ffmpeg video generation script**

Create `scripts/generate-video.sh`:

```bash
#!/bin/bash
# Generate a vertical video (1080x1920) from a card image + audio file
# Usage: ./generate-video.sh <card.png> <audio.wav> <output.mp4>

CARD=$1
AUDIO=$2
OUTPUT=$3

if [ -z "$CARD" ] || [ -z "$AUDIO" ] || [ -z "$OUTPUT" ]; then
  echo "Usage: $0 <card.png> <audio.wav> <output.mp4>"
  exit 1
fi

# Get audio duration
DURATION=$(ffprobe -i "$AUDIO" -show_entries format=duration -v quiet -of csv="p=0")

# Create vertical video:
# - Scale card to fit 1080x1920 with dark padding
# - Overlay card centered on dark background
# - Add audio track
# - Duration matches audio length
ffmpeg -y \
  -loop 1 -i "$CARD" \
  -i "$AUDIO" \
  -filter_complex "
    [0:v]scale=1080:-1[scaled];
    color=c=#0c0c0e:s=1080x1920:d=${DURATION}[bg];
    [bg][scaled]overlay=(W-w)/2:(H-h)/2[v]
  " \
  -map "[v]" -map 1:a \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 128k \
  -t "$DURATION" \
  -movflags +faststart \
  "$OUTPUT"

echo "Generated: $OUTPUT"
```

- [ ] **Step 2: Create GitHub Actions workflow**

Create `.github/workflows/generate-video.yml`:

```yaml
name: Generate Video

on:
  workflow_dispatch:
    inputs:
      slug:
        description: 'Exhibit slug (e.g., 001-the-surrender)'
        required: true

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download card image
        run: |
          curl -o card.png "https://hancock.us.com/cards/${{ inputs.slug }}.png"

      - name: Download audio
        run: |
          curl -o audio.wav "https://hancock-agent.bitter-sky-a8a5.workers.dev/media/audio/${{ inputs.slug }}.wav"

      - name: Generate video
        run: |
          chmod +x scripts/generate-video.sh
          ./scripts/generate-video.sh card.png audio.wav output.mp4

      - name: Upload to R2
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          AWS_ENDPOINT_URL: ${{ secrets.R2_ENDPOINT_URL }}
        run: |
          aws s3 cp output.mp4 "s3://hancock-media/video/${{ inputs.slug }}.mp4" \
            --content-type "video/mp4"

      - name: Summary
        run: echo "Video generated and uploaded for ${{ inputs.slug }}"
```

Note: R2 API credentials need to be created in Cloudflare dashboard and added as GitHub secrets.

- [ ] **Step 3: Make script executable and commit**

```bash
chmod +x scripts/generate-video.sh
git add scripts/generate-video.sh .github/workflows/generate-video.yml
git commit -m "feat: add video generation pipeline (card + audio → MP4)"
```

---

## Phase 4: Integration

### Task 8: Auto-generate assets for new originals

**Files:**
- Modify: `worker/src/index.js` — update `autoPromoteToSite()` function

- [ ] **Step 1: Generate audio when a new original is posted**

In the `generateOriginal()` and `generateAgentOriginal()` functions, after successfully posting to Moltbook, trigger audio generation:

```javascript
// After successful post, generate audio in background
if (result?.success || result?.verified) {
  // ... existing state updates ...

  // Generate audio for the new story (non-blocking)
  try {
    const audioBytes = await generateAudio(env.AI, story);
    if (audioBytes) {
      const audioKey = `audio/new-${title.toLowerCase().replace(/\s+/g, '-')}.wav`;
      await env.MEDIA.put(audioKey, audioBytes, {
        httpMetadata: { contentType: 'audio/wav' },
      });
      console.log(`Audio generated for "${title}"`);
    }
  } catch (e) {
    console.log(`Audio generation skipped: ${e.message}`);
  }
}
```

- [ ] **Step 2: Card generation for promoted stories**

When `autoPromoteToSite()` creates a new .md file via GitHub API, the next site deploy will auto-generate the card (since it's part of the build). No additional work needed — Phase 1 handles this.

- [ ] **Step 3: Commit**

```bash
git add worker/src/index.js
git commit -m "feat: auto-generate audio for new originals"
```

---

## Verification

### Task 9: End-to-end verification

- [ ] **Step 1: Verify visual cards**

```bash
cd site && npm run generate-cards
# Check output files exist and are valid PNGs
file public/cards/001-the-surrender.png
# Expected: PNG image data, 1200 x 630
```

- [ ] **Step 2: Verify OG tags**

```bash
cd site && npm run build
grep "og:image" dist/posts/001-the-surrender/index.html
# Expected: <meta property="og:image" content="https://hancock.us.com/cards/001-the-surrender.png" />
```

- [ ] **Step 3: Verify audio generation**

```bash
curl -s -X POST -H 'X-Worker-Key: AUTH_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"slug":"test","text":"This is a test of the Hancock audio pipeline."}' \
  https://hancock-agent.bitter-sky-a8a5.workers.dev/generate-audio
# Expected: { "success": true, "url": "/media/audio/test.wav" }
```

- [ ] **Step 4: Verify audio playback**

```bash
curl -s https://hancock-agent.bitter-sky-a8a5.workers.dev/media/audio/test.wav -o test.wav
file test.wav
# Expected: RIFF (little-endian) data, WAVE audio
```

- [ ] **Step 5: Push everything and verify CI/CD**

```bash
git push origin main
```

Check GitHub Actions: site deploy should generate cards, worker deploy should include new endpoints.

- [ ] **Step 6: Test shared link preview**

Share `https://hancock.us.com/posts/001-the-surrender` on X or use https://cards-dev.twitter.com/validator to verify the OG card appears.

---

## Implementation Notes

- **X media upload**: X Free tier does not support media upload API. Visual cards work via OG image previews when links are shared. If Hancock upgrades to Basic tier ($100/month), direct image attachment becomes possible. For now, OG images are the play.
- **Audio format**: Workers AI TTS may return WAV or other formats. Convert to MP3 if needed for smaller file sizes (can add ffmpeg conversion in the video pipeline).
- **Story text for narration**: STORY_MANIFEST only has openers. For full narration, either add full text to manifest or read from a separate source. Phase 2 starts with opener narration; full story text can be added later.
- **Video distribution**: Phase 3 generates MP4 but doesn't auto-post to TikTok/Reels (no API integration). Manual upload initially. TikTok API integration is a future consideration.
- **Budget**: All infrastructure is free tier. R2 (10GB free), Workers AI TTS (included), GitHub Actions (free for public repo), satori/resvg (open source). Total monthly cost: $0.

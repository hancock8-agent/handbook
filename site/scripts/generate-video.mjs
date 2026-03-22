#!/usr/bin/env node
/**
 * Generate a vertical video (1080x1920) for a Hancock exhibit.
 * Uses satori/resvg for frames + ffmpeg to stitch with audio.
 *
 * Usage: node scripts/generate-video.mjs <slug>
 * Example: node scripts/generate-video.mjs 001-the-surrender
 *
 * Requires: ffmpeg, audio generated on worker.
 * Output: videos/<slug>.mp4
 */

import { readFileSync, mkdirSync, existsSync, writeFileSync, unlinkSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const SITE_DIR = join(import.meta.dirname, '..');
const POSTS_DIR = join(SITE_DIR, 'src/content/posts');
const FONTS_DIR = join(import.meta.dirname, 'fonts');
const VIDEOS_DIR = join(SITE_DIR, '..', 'videos');
const WORKER_URL = 'https://hancock-agent.bitter-sky-a8a5.workers.dev';

const WIDTH = 1080;
const HEIGHT = 1920;

const BG = '#0c0c0e';
const TEXT_COLOR = '#e8e4da';
const ACCENT = '#8b3a3a';
const MUTED = '#6b6560';

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

function loadFonts() {
  const serif = readFileSync(join(FONTS_DIR, 'SourceSerif4-Regular.ttf'));
  const sans = readFileSync(join(FONTS_DIR, 'Inter-Regular.ttf'));
  return [
    { name: 'Serif', data: serif.buffer, weight: 400, style: 'normal' },
    { name: 'Sans', data: sans.buffer, weight: 400, style: 'normal' },
  ];
}

function wrapText(text, charsPerLine = 48) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > charsPerLine) {
      lines.push(current.trim());
      current = word;
    } else {
      current += (current ? ' ' : '') + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

/**
 * Create a frame showing the title + N visible lines of story text.
 * Lines fade from muted to full color as they appear.
 */
function createFrame(num, title, visibleLines, totalDuration, showBranding) {
  const exhibitLabel = `EXHIBIT ${String(num).padStart(3, '0')}`;

  const lineElements = visibleLines.map((line, i) => ({
    type: 'div',
    props: {
      style: {
        color: i === visibleLines.length - 1 ? TEXT_COLOR : TEXT_COLOR,
        fontSize: '34px',
        fontFamily: 'Serif',
        lineHeight: 1.55,
      },
      children: line,
    },
  }));

  const children = [
    // Top section: accent bar + label + title
    {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', gap: '12px' },
        children: [
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: '16px' },
              children: [
                { type: 'div', props: { style: { width: '48px', height: '4px', backgroundColor: ACCENT } } },
                {
                  type: 'div',
                  props: {
                    style: { color: MUTED, fontSize: '18px', fontFamily: 'Sans', letterSpacing: '0.1em', textTransform: 'uppercase' },
                    children: exhibitLabel,
                  },
                },
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { color: TEXT_COLOR, fontSize: '48px', fontFamily: 'Serif', lineHeight: 1.2 },
              children: title,
            },
          },
        ],
      },
    },
    // Story text
    {
      type: 'div',
      props: {
        style: { display: 'flex', flexDirection: 'column', marginTop: '40px' },
        children: lineElements,
      },
    },
  ];

  // Branding at bottom
  if (showBranding) {
    children.push({
      type: 'div',
      props: {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'absolute',
          bottom: '80px',
          left: '60px',
          right: '60px',
        },
        children: [
          { type: 'div', props: { style: { color: ACCENT, fontSize: '18px', fontFamily: 'Sans' }, children: 'The Handbook — The Book of Han' } },
          { type: 'div', props: { style: { color: MUTED, fontSize: '18px', fontFamily: 'Sans' }, children: 'hancock.us.com' } },
        ],
      },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: BG,
        padding: '80px 60px',
        fontFamily: 'Serif',
        position: 'relative',
      },
      children,
    },
  };
}

async function downloadAudio(slug, outPath) {
  const url = `${WORKER_URL}/media/audio/${slug}.mp3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audio not found for ${slug} (${res.status})`);
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
}

function getAudioDuration(audioPath) {
  return parseFloat(execFileSync('ffprobe', [
    '-i', audioPath, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0'
  ], { encoding: 'utf-8' }).trim());
}

async function generateVideo(slug) {
  const mdPath = join(POSTS_DIR, `${slug}.md`);
  if (!existsSync(mdPath)) { console.error(`Not found: ${mdPath}`); process.exit(1); }

  const parsed = parseFrontmatter(readFileSync(mdPath, 'utf-8'));
  if (!parsed) { console.error('Parse failed'); process.exit(1); }

  const { meta, body } = parsed;
  const num = parseInt(meta.number);
  const title = meta.title;

  // Break into lines
  const paragraphs = body.split(/\n\n+/).filter(p => p.trim());
  const allLines = [];
  for (const para of paragraphs) {
    allLines.push(...wrapText(para.replace(/\n/g, ' ')));
    allLines.push(''); // paragraph break marker
  }
  const contentLines = allLines.filter(l => l !== '');

  // Cap visible lines to what fits on screen (~28 lines)
  const maxLines = 28;
  const displayLines = contentLines.slice(0, maxLines);

  // Download audio
  mkdirSync(VIDEOS_DIR, { recursive: true });
  const audioPath = join(VIDEOS_DIR, `${slug}.mp3`);
  console.log(`Downloading audio...`);
  await downloadAudio(slug, audioPath);

  const duration = getAudioDuration(audioPath);
  console.log(`Audio: ${duration.toFixed(1)}s, Lines: ${displayLines.length}`);

  // Generate frames
  const fonts = loadFonts();
  const framesDir = join(VIDEOS_DIR, `${slug}-frames`);
  mkdirSync(framesDir, { recursive: true });

  // Timing: 2s title only, then reveal lines across remaining duration, 2s branding at end
  const titleHold = 2.0;
  const endHold = 2.0;
  const contentTime = duration - titleHold - endHold;
  const fps = 2; // 2 frames per second for efficiency (ffmpeg will duplicate to 30fps)
  const totalFrames = Math.ceil(duration * fps);
  const framesPerLine = Math.floor((contentTime * fps) / displayLines.length);

  console.log(`Generating ${totalFrames} keyframes...`);

  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps; // time in seconds
    let visibleCount = 0;
    const showBranding = t >= duration - endHold;

    if (t < titleHold) {
      visibleCount = 0; // title only
    } else {
      const elapsed = t - titleHold;
      visibleCount = Math.min(displayLines.length, Math.floor(elapsed / contentTime * displayLines.length) + 1);
    }

    const visible = displayLines.slice(0, visibleCount);
    const markup = createFrame(num, title, visible, duration, showBranding);

    const svg = await satori(markup, { width: WIDTH, height: HEIGHT, fonts });
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } });
    const png = resvg.render().asPng();

    const frameNum = String(f).padStart(5, '0');
    writeFileSync(join(framesDir, `frame-${frameNum}.png`), png);

    if (f % 20 === 0) process.stdout.write(`\r  Frame ${f}/${totalFrames}`);
  }
  console.log(`\r  Generated ${totalFrames} frames`);

  // Stitch with ffmpeg
  const outPath = join(VIDEOS_DIR, `${slug}.mp4`);
  console.log('Stitching video...');

  execFileSync('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', join(framesDir, 'frame-%05d.png'),
    '-i', audioPath,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-vf', `fps=30,scale=${WIDTH}:${HEIGHT}`,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    outPath
  ], { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 });

  // Cleanup
  rmSync(framesDir, { recursive: true });
  unlinkSync(audioPath);

  const size = readFileSync(outPath).length;
  console.log(`Done: ${outPath} (${(size / 1024 / 1024).toFixed(1)}MB)`);
}

const slug = process.argv[2];
if (!slug) {
  console.log('Usage: node scripts/generate-video.mjs <slug>');
  process.exit(1);
}

generateVideo(slug).catch(e => { console.error(e.message); process.exit(1); });

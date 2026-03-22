#!/usr/bin/env node
/**
 * Render a Hancock exhibit video using Remotion.
 *
 * Usage: node render.mjs <slug> [--with-image]
 * Example: node render.mjs 001-the-surrender
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, getCompositions } from '@remotion/renderer';

const POSTS_DIR = join(import.meta.dirname, '../site/src/content/posts');
const OUTPUT_DIR = join(import.meta.dirname, '../videos');
const WORKER_URL = 'https://hancock-agent.bitter-sky-a8a5.workers.dev';

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

async function downloadAudio(slug, outDir) {
  const url = `${WORKER_URL}/media/audio/${slug}.mp3`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audio not found: ${slug} (${res.status})`);
  const outPath = join(outDir, `${slug}.mp3`);
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  return outPath;
}

function getAudioDuration(path) {
  return parseFloat(execFileSync('ffprobe', [
    '-i', path, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv=p=0'
  ], { encoding: 'utf-8' }).trim());
}

async function main() {
  const slug = process.argv[2];
  const withImage = process.argv.includes('--with-image');

  if (!slug) {
    console.log('Usage: node render.mjs <slug> [--with-image]');
    process.exit(1);
  }

  // Read story
  const mdPath = join(POSTS_DIR, `${slug}.md`);
  if (!existsSync(mdPath)) { console.error(`Not found: ${mdPath}`); process.exit(1); }

  const parsed = parseFrontmatter(readFileSync(mdPath, 'utf-8'));
  if (!parsed) { console.error('Parse failed'); process.exit(1); }

  const { meta, body } = parsed;

  // Download audio
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const tmpDir = join(OUTPUT_DIR, '.tmp');
  mkdirSync(tmpDir, { recursive: true });

  console.log('Downloading audio...');
  const audioPath = await downloadAudio(slug, tmpDir);
  const duration = getAudioDuration(audioPath);
  const durationInFrames = Math.ceil(duration * 30);
  console.log(`Duration: ${duration.toFixed(1)}s (${durationInFrames} frames)`);

  // Bundle the Remotion project
  console.log('Bundling...');
  const bundleLocation = await bundle({
    entryPoint: join(import.meta.dirname, 'src/index.js'),
    webpackOverride: (config) => config,
  });

  // Get composition — use remote audio URL (Remotion can't access local files)
  const remoteAudioUrl = `${WORKER_URL}/media/audio/${slug}.mp3`;
  const comps = await getCompositions(bundleLocation, {
    inputProps: {
      number: parseInt(meta.number),
      title: meta.title,
      body,
      audioUrl: remoteAudioUrl,
      imageUrl: null,
    },
  });

  const comp = comps.find(c => c.id === 'HancockExhibit');
  if (!comp) { console.error('Composition not found'); process.exit(1); }

  // Render
  const outPath = join(OUTPUT_DIR, `${slug}.mp4`);
  console.log('Rendering...');

  await renderMedia({
    composition: { ...comp, durationInFrames },
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outPath,
    inputProps: {
      number: parseInt(meta.number),
      title: meta.title,
      body,
      audioUrl: remoteAudioUrl,
      imageUrl: null,
    },
  });

  console.log(`Done: ${outPath}`);
  const size = readFileSync(outPath).length;
  console.log(`Size: ${(size / 1024 / 1024).toFixed(1)}MB`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });

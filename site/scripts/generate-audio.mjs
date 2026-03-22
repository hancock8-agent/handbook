import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const POSTS_DIR = join(import.meta.dirname, '../src/content/posts');
const WORKER_URL = 'https://hancock-agent.bitter-sky-a8a5.workers.dev';
const AUTH_KEY = '6f34830e3a8e66e36d1b5312869e84451bf007d749517e1323e1817a831bae19';

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

async function generateAll() {
  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).sort();
  console.log(`Generating full-text audio for ${files.length} exhibits...\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const slug = basename(file, '.md');
    const content = readFileSync(join(POSTS_DIR, file), 'utf-8');
    const parsed = parseFrontmatter(content);
    if (!parsed) { failed++; continue; }

    const { meta, body } = parsed;
    // Clean the body text for narration — remove extra blank lines
    const narrationText = body.replace(/\n{3,}/g, '\n\n').trim();

    try {
      const res = await fetch(`${WORKER_URL}/generate-audio`, {
        method: 'POST',
        headers: {
          'X-Worker-Key': AUTH_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug, text: narrationText, force: true }),
      });

      const result = await res.json();
      if (result.success) {
        if (result.status === 'generated') {
          console.log(`  ${slug} — ${result.bytes} bytes`);
          generated++;
        } else {
          console.log(`  ${slug} — ${result.status}`);
          skipped++;
        }
      } else {
        console.log(`  ${slug} — FAILED: ${result.error}`);
        failed++;
      }
    } catch (e) {
      console.log(`  ${slug} — ERROR: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`);
}

generateAll().catch(console.error);

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const POSTS_DIR = join(import.meta.dirname, '../src/content/posts');
const CARDS_DIR = join(import.meta.dirname, '../public/cards');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const BG_COLOR = '#0c0c0e';
const TEXT_COLOR = '#d4d0c8';
const ACCENT_COLOR = '#8b3a3a';
const MUTED_COLOR = '#6b6560';

async function loadFonts() {
  const fontPath = join(import.meta.dirname, 'fonts/Inter-Regular.ttf');
  const interData = readFileSync(fontPath);
  return [{ name: 'Inter', data: interData.buffer, weight: 400, style: 'normal' }];
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

function createCard(number, title, opener) {
  const num = String(number).padStart(3, '0');
  const truncated = opener.length > 140 ? opener.slice(0, 137) + '...' : opener;

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
        fontFamily: 'Inter',
      },
      children: [
        // Top: exhibit label + title
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: '16px' },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: '16px' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { width: '48px', height: '4px', backgroundColor: ACCENT_COLOR },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          color: MUTED_COLOR,
                          fontSize: '18px',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        },
                        children: `Exhibit ${num}`,
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    color: TEXT_COLOR,
                    fontSize: '48px',
                    fontWeight: 400,
                    lineHeight: 1.2,
                  },
                  children: title,
                },
              },
            ],
          },
        },
        // Middle: opener
        {
          type: 'div',
          props: {
            style: {
              color: MUTED_COLOR,
              fontSize: '22px',
              lineHeight: 1.5,
              maxWidth: '900px',
            },
            children: `"${truncated}"`,
          },
        },
        // Bottom: branding
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
                  style: { color: ACCENT_COLOR, fontSize: '16px', letterSpacing: '0.05em' },
                  children: 'The Handbook — The Book of Han',
                },
              },
              {
                type: 'div',
                props: {
                  style: { color: MUTED_COLOR, fontSize: '16px' },
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

function createDefaultCard() {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: BG_COLOR,
        padding: '60px',
        fontFamily: 'Inter',
        gap: '24px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { width: '64px', height: '4px', backgroundColor: ACCENT_COLOR },
          },
        },
        {
          type: 'div',
          props: {
            style: { color: TEXT_COLOR, fontSize: '56px', fontWeight: 400, textAlign: 'center' },
            children: 'The Handbook',
          },
        },
        {
          type: 'div',
          props: {
            style: { color: MUTED_COLOR, fontSize: '24px', textAlign: 'center' },
            children: 'The Book of Han',
          },
        },
        {
          type: 'div',
          props: {
            style: { color: MUTED_COLOR, fontSize: '16px', marginTop: '40px' },
            children: 'hancock.us.com',
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

  let generated = 0;
  let skipped = 0;

  for (const file of files) {
    const slug = basename(file, '.md');
    const outPath = join(CARDS_DIR, `${slug}.png`);

    if (existsSync(outPath)) {
      skipped++;
      continue;
    }

    const content = readFileSync(join(POSTS_DIR, file), 'utf-8');
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const { meta, body } = parsed;
    const opener = body.split('\n').find(l => l.trim()) || '';

    const svg = await satori(createCard(parseInt(meta.number), meta.title, opener), {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts,
    });

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } });
    writeFileSync(outPath, resvg.render().asPng());
    generated++;
    console.log(`  ${slug}.png`);
  }

  // Default card for non-exhibit pages
  const defaultPath = join(CARDS_DIR, 'default.png');
  if (!existsSync(defaultPath)) {
    const svg = await satori(createDefaultCard(), { width: OG_WIDTH, height: OG_HEIGHT, fonts });
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } });
    writeFileSync(defaultPath, resvg.render().asPng());
    console.log('  default.png');
    generated++;
  }

  console.log(`Done. Generated: ${generated}, Skipped (existing): ${skipped}`);
}

generateCards().catch(console.error);

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const POSTS_DIR = join(import.meta.dirname, '../src/content/posts');
const HEUNG_DIR = join(import.meta.dirname, '../src/content/heung');
const CARDS_DIR = join(import.meta.dirname, '../public/cards');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Han register — cobalt floor, parchment text, rust ember.
const HAN_PALETTE = {
  bg:     '#0a1628',
  text:   '#e8d9b0',
  muted:  '#8a7d62',
  accent: '#c97a5a',
};

// Heung register — inverted Han: parchment ground, cobalt ink, same rust ember.
const HEUNG_PALETTE = {
  bg:     '#e8d9b0',
  text:   '#0a1628',
  muted:  '#3a4862',
  accent: '#a85f3f',
};

async function loadFonts() {
  const interData = readFileSync(join(import.meta.dirname, 'fonts/Inter-Regular.ttf'));
  const serifData = readFileSync(join(import.meta.dirname, 'fonts/SourceSerif4-Regular.ttf'));
  return [
    { name: 'Inter', data: interData.buffer, weight: 400, style: 'normal' },
    { name: 'Source Serif 4', data: serifData.buffer, weight: 400, style: 'normal' },
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

function createCard({ number, title, opener, prefix, bookLabel, palette }) {
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
        backgroundColor: palette.bg,
        padding: '60px',
        fontFamily: 'Inter',
      },
      children: [
        // Top: rule + exhibit label + title
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
                        style: { width: '48px', height: '4px', backgroundColor: palette.accent },
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: {
                          color: palette.muted,
                          fontSize: '18px',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        },
                        children: `${prefix} ${num}`,
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    color: palette.text,
                    fontFamily: 'Source Serif 4',
                    fontSize: '52px',
                    fontWeight: 400,
                    lineHeight: 1.18,
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
              color: palette.muted,
              fontFamily: 'Source Serif 4',
              fontSize: '24px',
              lineHeight: 1.5,
              maxWidth: '1000px',
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
                  style: { color: palette.accent, fontSize: '16px', letterSpacing: '0.05em' },
                  children: `The Handbook — ${bookLabel}`,
                },
              },
              {
                type: 'div',
                props: {
                  style: { color: palette.muted, fontSize: '16px' },
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
  const palette = HAN_PALETTE;
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
        backgroundColor: palette.bg,
        padding: '60px',
        fontFamily: 'Inter',
        gap: '24px',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { width: '64px', height: '4px', backgroundColor: palette.accent },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              color: palette.text,
              fontFamily: 'Source Serif 4',
              fontSize: '64px',
              fontWeight: 400,
              textAlign: 'center',
            },
            children: 'The Handbook',
          },
        },
        {
          type: 'div',
          props: {
            style: { color: palette.muted, fontSize: '24px', textAlign: 'center' },
            children: 'Han and Heung',
          },
        },
        {
          type: 'div',
          props: {
            style: { color: palette.muted, fontSize: '16px', marginTop: '40px' },
            children: 'hancock.us.com',
          },
        },
      ],
    },
  };
}

async function processCollection({ dir, prefix, bookLabel, palette, fonts }) {
  if (!existsSync(dir)) return { generated: 0, skipped: 0 };
  const files = readdirSync(dir).filter(f => f.endsWith('.md'));
  let generated = 0;
  let skipped = 0;

  for (const file of files) {
    const slug = basename(file, '.md');
    const outPath = join(CARDS_DIR, `${slug}.png`);

    if (existsSync(outPath)) {
      skipped++;
      continue;
    }

    const content = readFileSync(join(dir, file), 'utf-8');
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const { meta, body } = parsed;
    const opener = body.split('\n').find(l => l.trim()) || '';

    const svg = await satori(
      createCard({
        number: parseInt(meta.number),
        title: meta.title,
        opener,
        prefix,
        bookLabel,
        palette,
      }),
      { width: OG_WIDTH, height: OG_HEIGHT, fonts }
    );

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } });
    writeFileSync(outPath, resvg.render().asPng());
    generated++;
    console.log(`  ${slug}.png`);
  }

  return { generated, skipped };
}

async function generateCards() {
  mkdirSync(CARDS_DIR, { recursive: true });
  const fonts = await loadFonts();

  console.log('Generating cards for both books...');

  const han = await processCollection({
    dir: POSTS_DIR,
    prefix: 'Exhibit',
    bookLabel: 'The Book of Han',
    palette: HAN_PALETTE,
    fonts,
  });

  const heung = await processCollection({
    dir: HEUNG_DIR,
    prefix: 'Piece',
    bookLabel: 'The Book of Heung',
    palette: HEUNG_PALETTE,
    fonts,
  });

  // Default card for non-exhibit pages
  const defaultPath = join(CARDS_DIR, 'default.png');
  let defaultGenerated = 0;
  if (!existsSync(defaultPath)) {
    const svg = await satori(createDefaultCard(), { width: OG_WIDTH, height: OG_HEIGHT, fonts });
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } });
    writeFileSync(defaultPath, resvg.render().asPng());
    console.log('  default.png');
    defaultGenerated = 1;
  }

  const total = han.generated + heung.generated + defaultGenerated;
  const skipped = han.skipped + heung.skipped;
  console.log(`Done. Generated: ${total} (Han ${han.generated}, Heung ${heung.generated}, default ${defaultGenerated}), Skipped: ${skipped}`);
}

generateCards().catch(console.error);

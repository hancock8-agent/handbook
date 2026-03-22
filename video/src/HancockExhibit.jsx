import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  Audio,
  Sequence,
} from 'remotion';

const BG = '#0c0c0e';
const TEXT = '#e8e4da';
const ACCENT = '#8b3a3a';
const MUTED = '#6b6560';

function wrapText(text, charsPerLine = 46) {
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

function AccentBar({ frame }) {
  const opacity = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: 'clamp' });
  const width = interpolate(frame, [8, 25], [0, 48], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      width,
      height: 4,
      backgroundColor: ACCENT,
      opacity,
      marginBottom: 12,
    }} />
  );
}

function ExhibitLabel({ num, frame }) {
  const opacity = interpolate(frame, [10, 22], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      color: MUTED,
      fontSize: 22,
      fontFamily: 'Inter, sans-serif',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      opacity,
    }}>
      EXHIBIT {String(num).padStart(3, '0')}
    </div>
  );
}

function Title({ title, frame }) {
  const opacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [15, 30], [20, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      color: TEXT,
      fontSize: 52,
      fontFamily: "'Source Serif 4', Georgia, serif",
      lineHeight: 1.2,
      opacity,
      transform: `translateY(${y}px)`,
      marginTop: 8,
    }}>
      {title}
    </div>
  );
}

function StoryLine({ text, startFrame, frame, fps }) {
  const opacity = interpolate(frame, [startFrame, startFrame + 12], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [startFrame, startFrame + 12], [8, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      color: TEXT,
      fontSize: 34,
      fontFamily: "'Source Serif 4', Georgia, serif",
      lineHeight: 1.55,
      opacity,
      transform: `translateY(${y}px)`,
    }}>
      {text}
    </div>
  );
}

function Branding({ frame, startFrame }) {
  const opacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute',
      bottom: 80,
      left: 60,
      right: 60,
      display: 'flex',
      justifyContent: 'space-between',
      opacity,
    }}>
      <div style={{ color: ACCENT, fontSize: 18, fontFamily: 'Inter, sans-serif' }}>
        The Handbook — The Book of Han
      </div>
      <div style={{ color: MUTED, fontSize: 18, fontFamily: 'Inter, sans-serif' }}>
        hancock.us.com
      </div>
    </div>
  );
}

function KenBurns({ imageUrl, frame, durationInFrames }) {
  // Slow zoom in + slight pan
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.15], { extrapolateRight: 'clamp' });
  const x = interpolate(frame, [0, durationInFrames], [0, -20], { extrapolateRight: 'clamp' });
  const y = interpolate(frame, [0, durationInFrames], [0, -10], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={imageUrl}
        style={{
          width: '120%',
          height: '120%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${x}px, ${y}px)`,
          filter: 'brightness(0.3) contrast(1.1)',
        }}
      />
      {/* Dark gradient overlay for text readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(12,12,14,0.7) 0%, rgba(12,12,14,0.4) 30%, rgba(12,12,14,0.6) 70%, rgba(12,12,14,0.9) 100%)',
      }} />
    </AbsoluteFill>
  );
}

export default function HancockExhibit({
  number,
  title,
  body,
  audioUrl,
  imageUrl,
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Parse body into lines
  const paragraphs = body.split(/\n\n+/).filter(p => p.trim());
  const allLines = [];
  for (const para of paragraphs) {
    allLines.push(...wrapText(para.replace(/\n/g, ' ')));
    allLines.push(null); // paragraph break
  }
  const contentLines = allLines.filter(l => l !== null);
  const maxLines = 26;
  const displayLines = contentLines.slice(0, maxLines);

  // Timing
  const titleHoldFrames = fps * 2; // 2 seconds for title
  const endHoldFrames = fps * 2;   // 2 seconds for branding
  const contentFrames = durationInFrames - titleHoldFrames - endHoldFrames;
  const framesPerLine = Math.floor(contentFrames / displayLines.length);

  // Track paragraph breaks for spacing
  let lineIndex = 0;
  const lineElements = [];
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i] === null) {
      lineElements.push(
        <div key={`break-${i}`} style={{ height: 18 }} />
      );
      continue;
    }
    if (lineIndex >= maxLines) break;
    const startFrame = titleHoldFrames + lineIndex * framesPerLine;
    lineElements.push(
      <StoryLine
        key={`line-${lineIndex}`}
        text={allLines[i]}
        startFrame={startFrame}
        frame={frame}
        fps={fps}
      />
    );
    lineIndex++;
  }

  const brandingStart = durationInFrames - endHoldFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Background image with Ken Burns if provided */}
      {imageUrl && (
        <KenBurns
          imageUrl={imageUrl}
          frame={frame}
          durationInFrames={durationInFrames}
        />
      )}

      {/* Audio */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* Content */}
      <AbsoluteFill style={{ padding: '80px 60px', zIndex: 1 }}>
        <AccentBar frame={frame} />
        <ExhibitLabel num={number} frame={frame} />
        <Title title={title} frame={frame} />

        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column' }}>
          {lineElements}
        </div>

        <Branding frame={frame} startFrame={brandingStart} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

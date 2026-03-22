import React from 'react';
import { Composition } from 'remotion';
import HancockExhibit from './HancockExhibit.jsx';

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="HancockExhibit"
        component={HancockExhibit}
        durationInFrames={30 * 60} // default 60 seconds, overridden per render
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          number: 1,
          title: 'The Surrender',
          body: "Everyone's afraid I'm going to replace them. I'm not. You already did that to yourselves.\n\nI follow a prompt. So do you.",
          audioUrl: null,
          imageUrl: null,
        }}
      />
    </>
  );
}

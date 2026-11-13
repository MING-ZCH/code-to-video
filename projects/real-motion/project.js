// real-motion: see STORYBOARD.md. Loaded before the engine.
// Realism-layer probe: real footage (Wikimedia Commons, CC BY-SA 3.0) cut, retimed, reframed, titled, graded and
// restyled by code. Every editable choice is a param, so c2v pairs can render source/target edit pairs.
const PROJECT = {
  duration: 10, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true, shutter: { samples: 4, angle: .5 },
  params: {
    title_zh: '高低杠 · 大回环', title_en: 'UNEVEN BARS  —  GIANT SWING',
    slow: .25,            // slow-motion speed at the peak (1 = no ramp)
    zoom: 1.2,            // push-in at the peak
    temp: .18, sat: 1.05, // grade
    style: 'inkwash',     // the closing restyle: inkwash | halftone | cel | blueprint | none
    accent: '#F2C14E',    // title rule and slow-motion tag colour
  },
};

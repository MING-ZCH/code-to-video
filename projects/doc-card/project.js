// doc-card: see STORYBOARD.md. Loaded before the engine. Probe case: a Chinese rich-text card → video.
const PROJECT = { duration: 14, bpm: 100, offset: 0, scenes: ['main.js'],
  text: 'content',                                   // the card's own words, typeset where the card puts them
  assets: { card: 'input/richtext.png' } };          // reference only (the closing frame cross-fades to the source)

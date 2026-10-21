// doc-poster: see STORYBOARD.md. Loaded before the engine. Probe case: a paper poster (PDF) → video.
const PROJECT = { duration: 14, bpm: 100, offset: 0, scenes: ['main.js'],
  text: 'content',                                  // text-native input: the poster's own words appear where it shows them
  assets: { poster: 'input/poster.png' } };          // page 1 of input/poster.pdf at 200 dpi (c2v ingest), 3200×2000

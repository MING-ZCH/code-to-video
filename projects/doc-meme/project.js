// doc-meme: see STORYBOARD.md. Loaded before the engine. Probe case: a two-caption meme → video.
const PROJECT = { duration: 10, bpm: 96, offset: 0, scenes: ['main.js'],
  text: 'content',                                        // the meme's captions are its content
  assets: { pic: 'input/meme-clean.png' } };              // the meme's picture without its captions (c2v ingest, inpainted)

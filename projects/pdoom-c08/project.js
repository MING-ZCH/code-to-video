// pdoom-c08: case A — PDoomVideo's "chorus 4" (song 123.5–140.5 s) regenerated from lyrics + audio only, with the c2v skills.
// bpm/offset set by hand from the full-song analysis (88 BPM, first beat 0.185 s → 0.094 s into this slice): the 17 s excerpt
// alone locks to a syncopated subdivision (0.305 s), as the brief warns. Lyric bar on: it's an MV, like the original.
const PROJECT = {
  duration: 17, bpm: 88, offset: .094, scenes: ['main.js'], audio: 'projects/pdoom-c08/assets/audio.wav',
  karaoke: { lines: [[0, 2.4, "I'm upping my P(doom)"], [2.5, 4.4, 'Just as foretold by Loom'], [4.5, 6.4, 'From masked pre-training days'],
                     [6.5, 8.4, 'To recursive self-upgrade'], [8.5, 11.9, "What did Ilya see? We'll never know."], [13.9, 17, 'Was it all for show?']] },
};

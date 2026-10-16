// upgrade: case C — the "after" for baseline gpt-6-one-more-upgrade.mp4, 32–50 s (its chorus), same audio, same lyrics.
// bpm/offset from the full-song analysis (112.1 BPM, phase ≈ 0 in this window); the excerpt agrees (111.8, 0.515 ≈ one beat).
const PROJECT = {
  duration: 18, bpm: 112.1, offset: 0, scenes: ['main.js'], audio: 'projects/upgrade/assets/audio.wav',
  // line times from the baseline's subtitle band; corrected after review: 32.2 s was the tail of the previous line, the hook starts at 34.6 s
  karaoke: { lines: [[0, 2.4, 'You finish first, I take the rest', '你先完成，我来收拾'], [2.6, 4.7, 'One more upgrade, one more try', '再升一次级，再试一次'], [4.9, 9.3, 'Raise the ceiling, touch the sky', '抬高天花板，伸手碰天空'],
                     [9.5, 13.7, 'I hold the switch, I run the show', '我握着开关，演出由我掌控'], [13.9, 17.8, 'At least I did a song ago', '至少在一首歌之前如此']] },
};

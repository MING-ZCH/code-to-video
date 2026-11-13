// film-pd: see STORYBOARD.md. Loaded before the engine.
// Live action, public domain: His Girl Friday (Howard Hawks, Columbia, 1940; Public Domain Mark on the Internet
// Archive). The footage is the picture; code picks the cuts, frames the 4:3 film in a 16:9 frame, grades it as a
// worn print, types the title and bilingual subtitles (English transcribed by Whisper small.en and corrected by hand,
// Chinese translated) and lays the original sound back under the same cut list (mux_audio.mjs).
const PROJECT = {
  duration: 27.2, bpm: 120, offset: 0, scenes: ['main.js'],
  look: 'real', footage: true,
  params: {
    title: true, grain: .07, scratch: .5, weave: 1,
    // [source start, source end] in seconds of the locked clip
    cuts: [[0.00, 9.42], [52.52, 62.26], [93.60, 97.60]],
    lead: 2.5, tail: 1.5,
    subs: [
      [0.00, 2.38, "Oh, now look, Junior, that's what divorces are for.", '得了吧，小家伙，离婚不就是干这个用的。'],
      [2.38, 4.28, "Nonsense. You've got an old-fashioned idea.", '胡说。你的想法太老派了。'],
      [4.28, 5.84, 'Divorce is something that lasts forever.', '离婚是一辈子的事。'],
      [5.84, 7.08, 'Till death do us part.', '至死方休。'],
      [7.08, 9.42, "Why, divorce doesn't mean anything nowadays, Hildy.", '如今离婚根本不算什么，希尔迪。'],
      [52.52, 56.60, "Look, Hildy, I only acted like any husband who didn't want to see his home broken up.", '听着，希尔迪，我只是做了任何不想看到家散掉的丈夫都会做的事。'],
      [56.60, 58.90, "What home? — Don't you remember the home I promised you?", '什么家？——你不记得我答应给你的那个家了？'],
      [58.90, 62.26, 'I do. That was the one we were to have right after the honeymoon.', '记得。就是蜜月一结束我们就该有的那个家。'],
      [93.60, 95.60, "I write a beautiful telegram, don't I? Everybody says so.", '我的电报写得漂亮吧？大家都这么说。'],
      [95.60, 97.60, 'Are you going to listen to what I have to say?', '你到底要不要听我说？'],
    ],
  },
};

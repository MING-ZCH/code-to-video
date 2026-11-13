# film-pd: storyboard

Logline: a 1940 screwball comedy re-cut by code: title, three exchanges about divorce and a promised home, bilingual
subtitles, original sound.

Source: His Girl Friday (Howard Hawks, Columbia, 1940), Internet Archive item HisGirlFriday1940_201808, Public Domain
Mark 1.0. Only 150 s were cut out of the 2.2 GB file (ffmpeg seeking over HTTP range requests); 100 s are locked.

Shots (cut list in project.js `cuts`; subtitles keyed to source time in `subs`):
  title  0.00–2.50   type on black, grain and flicker
  A      2.50–11.92  source 0.00–9.42  "that's what divorces are for" … "Till death do us part"
  B      11.92–21.66 source 52.52–62.26 "What home?"
  C      21.66–25.66 source 93.60–97.60 "I write a beautiful telegram, don't I?"
  credit 25.66–27.16 source and method

English lines: Whisper small.en (transcript_whisper_small_en.json), corrected by hand ("hill the" → "Hildy");
Chinese: translation. Sound: scripts/dev/mux_cuts_audio.mjs lays the original audio under the same cut list.

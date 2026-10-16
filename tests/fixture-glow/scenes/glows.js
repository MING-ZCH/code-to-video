(() => {
  function many(t, lt, dur) {
    boilSeed('bg'); paint(rectPts(-60, -60, W + 120, H + 120), { wash: PAL.night, ink: null });
    for (let i = 0; i < 60; i++) glow(200 + (i % 12) * 140, 200 + Math.floor(i / 12) * 160, 120 + 60 * hash(i), i % 2 ? '#9FF2E6' : '#FFE7A0', .8);
    if (lt < .2) flash(1 - lt / .2); if (lt > dur - .2) flash(seg(lt, dur - .2, dur));   // transitions (keeps check quiet)
  }
  shots([[0, many]]);
})();

// styles.js: a test loop, one second per shader style over the same painted frame (render.mjs --loop=styles --sheet=0.5,1.5,…).
(() => {
  const NAMES = ['none', 'cave', 'inkwash', 'blueprint', 'halftone', 'pixel', 'crt', 'cel', 'thermal', 'stained'];
  LOOPS.styles = t => {
    const i = Math.min(NAMES.length - 1, Math.floor(t));
    boilSeed('bg'); paint(rectPts(-60, -60, W + 120, H + 120), { wash: '#F2C59B', ink: null });
    boilSeed('hill'); paint(ellPts(W / 2, H * 1.05, W * .8, H * .45, 30, 4), { wash: '#7C9A5E', ink: PAL.ink, sw: 1 });
    boilSeed('sun'); paint(ellPts(W * .78, H * .25, 90, 90, 24, 1), { wash: '#FFE6B0', ink: PAL.ink, sw: .8 });
    clawd(W * .42, H * .82, 34, feel('happy', t));
    if (NAMES[i] !== 'none') stylize(NAMES[i], { t, k: 1, r: 12 });
  };
  LOOPS.styles.len = NAMES.length;
  LOOPS.styles.names = NAMES;
})();

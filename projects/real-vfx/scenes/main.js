// main.js: the rendered layer is the shot; the composite adds what a camera and a mixer would. See STORYBOARD.md.
(() => {
  const M = ASSET_META[P('layer')], BLAST = (M.params.blast_frame - 1) / M.fps;   // the same frame the simulation ignites on

  function main(t, lt, dur) {
    const a = t - BLAST, k = a > 0 ? Math.exp(-a * 3.2) : 0, s = P('shake');
    // rotation-only shake: for small angles it moves every depth equally, so CG and the HDRI plate stay locked together
    const rot = s * k * (.006 * Math.sin(a * 41) + .003 * Math.sin(a * 67 + 1.3)), jx = s * k * 14 * Math.sin(a * 53 + .4), jy = s * k * 10 * Math.sin(a * 47 + 2.1);
    camBegin(960 + jx, 540 + jy, 1.04 + .02 * k * s, rot);
    footage(P('layer'), t, 0, 0, W, H);
    camEnd();
    grade({ t, filmic: .2, contrast: 1.05, sat: 1.04, temp: P('temp'), exposure: P('flash') * (a > 0 ? .9 * Math.exp(-a * 9) : 0),
      bloom: .5, bloomThr: .62, halation: .3, ca: 1.0 + 2.5 * k, vignette: .4, grain: .045, letterbox: .055,
      fade: Math.max(1 - ease(seg(lt, 0, .35)), ease(seg(lt, dur - .4, dur))) });
  }
  sound([{ at: BLAST, kind: 'boom', dur: 2.4 }, { at: BLAST + .03, kind: 'rumble', dur: 2.3, gain: .55 }, { at: BLAST + .45, kind: 'thud', gain: .25 }, { at: BLAST + .7, kind: 'thud', gain: .18 }]);
  shots([[0, main]]);
})();

// main.js: two path-traced character layers, cut together with a dissolve, graded, with small captions. See STORYBOARD.md.
(() => {
  const ROBOT_END = 6.0, X = .5;                              // robot layer is 6 s; 0.5 s cross-dissolve into the dancer
  const EN = '"Avenir Next", "Helvetica Neue", Arial, sans-serif', ZH = '"PingFang SC", "Hiragino Sans GB", sans-serif';
  const finish = (t, fade) => grade({ t, filmic: .2, contrast: 1.03, sat: 1.02, bloom: .25, bloomThr: .8, halation: .12, vignette: .35, grain: .035, letterbox: .055, fade });
  function cap(zh, en, a) {
    if (!P('caption') || a <= .01) return;
    textBlock(zh, 96, 900, { size: 30, weight: 600, font: ZH, color: '#F6F1E7', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.6)', glowR: 12 });
    textBlock(en, 96, 944, { size: 20, weight: 500, font: EN, color: '#E2DBCF', alpha: a, screen: true }); Object.assign(LETTERS.at(-1), { glow: 'rgba(0,0,0,.6)', glowR: 12 });
  }

  function robot(t, lt, dur) {
    footage(P('robot'), lt, 0, 0, W, H);
    // transition: cross-dissolve into the dancer layer over the last X seconds
    if (lt > dur - X) footage(P('dancer'), lt - (dur - X), 0, 0, W, H, { alpha: ease(seg(lt, dur - X, dur)) });
    finish(t, 1 - ease(seg(lt, 0, .4)));
    cap('拟人角色 · 桌面玩具机器人', 'Anthropomorphic toy · path-traced, NLA-blended actions', ease(seg(lt, .6, 1.1)) * (1 - ease(seg(lt, 3.6, 4.1))));
  }
  function dancer(t, lt, dur) {
    // transition: out with a fade to black over the last 0.5 s (grade fade)
    footage(P('dancer'), lt + X, 0, 0, W, H);
    finish(t, ease(seg(lt, dur - .5, dur)));
    cap('动作捕捉驱动的 3D 人物 · 桑巴', 'Mocap-driven 3D dancer · samba', ease(seg(lt, .4, .9)) * (1 - ease(seg(lt, 3.0, 3.5))));
  }
  shots([[0, robot], [ROBOT_END, dancer]]);
})();

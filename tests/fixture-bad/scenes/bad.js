(() => {
  let counter = 0;                                   // outer mutable state
  function a(t, lt, dur) {
    counter += 1;                                    // E: state between frames
    const r = Math.random();                         // E: Math.random
    const now = Date.now();                          // E: wall clock
    rect(10, 10, 100, 100);                          // W: plain p5 shape
    fill('#fff');                                    // W: plain fill
    rotateY(.3);                                     // W: 3D
    letter('GAME OVER', 960, 540, 80, '#fff');       // I/W: lettering
    // Math.random() in a comment must NOT be flagged
  }
  function b(t, lt, dur) { paint(rectPts(0, 0, W, H), { wash: PAL.sky, ink: null }); }
  shots([[0, a], [.6, b], [1.4, a], [9.5, b]]);    // a 0.6 s shot, a 8.1 s shot, no transitions anywhere
  sound([{ at: 20, kind: 'boom' }]);                 // W: outside the duration
})();

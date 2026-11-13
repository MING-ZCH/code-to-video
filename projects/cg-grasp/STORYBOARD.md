# cg-grasp: storyboard

Logline: the cup is real enough; whether the shot reads as real depends on where the fingers stop.

World: Poly Haven kiara_interior HDRI, wooden_table_02 and tea_set_01 (CC0 scans); Rocketbox Sports_Female_02 (MIT),
photo skin with subsurface scattering, seated (shoulders 0.25 lower than standing), right hand only in frame.

Shots:
  A  0.00–6.00  close-up of the right hand reaching (0–1.6 s), moving in (1.6–2.3 s), closing (2.3–2.9 s), lifting the
                cup 14 cm toward the body (2.9–4.4 s), holding (4.4–6 s); the camera rises with the cup
     reads: 0.30–2.40  caption naming the grip variant

Variants (`layer`): grasp_solved (contact solver, default) · grasp_naive (fixed grip angles). Same wrist path, palm
orientation and timing. measure() in blender/grasp.py: hand-in-cup depth, penetrating vertices, fingertip gaps,
cup-table gap.

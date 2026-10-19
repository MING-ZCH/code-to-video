## 改了什么 / What

## 为什么 / Why

## 验证 / Checks
- [ ] `npm test`
- [ ] 动了 engine/lib/bin/mcp：`node tests/run.mjs --soft-gl`、`node tests/replay.mjs --soft-gl`、`C2V_SOFT_GL=1 node tests/mcp-smoke.mjs`
- [ ] 动了引擎绘制：受影响项目 `node bin/c2v.mjs selftest <name>` 通过
- [ ] 视觉改动：附前后 sheet / strip
- [ ] 动了 skills：`dist/*.skill` 已重新打包
- [ ] 没有提交媒体文件（MP4 / WAV / out/）

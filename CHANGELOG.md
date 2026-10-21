# Changelog

## v0.2.0 — 2026-10-21

**文档类输入：meme 图、学术论文 poster（PDF）、富文本图 → video**

- `lib/layout.py`（Tesseract + OpenCV，不用模型），由 `c2v ingest` 自动调用。它输出：
  - OCR 文字行；
  - 按阅读顺序排列的区块；
  - 文档类型 poster / card / meme；
  - 自动判定的中英文语言；
  - meme 的字幕层与去字底图。
- PDF 输入：第 1 页按 200 dpi 栅格化，并保留内嵌文字。
- `engine/doc.js`：`plate()` 绘制原图素材；`textBlock()` 排版文字，支持中文、逐字打出；`marker()` 绘制荧光笔效果；`PROJECT.assets` 声明素材。
- `PROJECT.text = 'content'`：文字原生的输入里，规则 2 改为“只展示原文的字”。
- `reads` R6 支持 `focus({ group })`，解决群组目标被自身成员“遮挡”的误报。
- `scripts/dev/text-recall.py`：成片原文 OCR 召回。
- 3 个原型 `doc-poster` / `doc-card` / `doc-meme`：check、reads、selftest 均通过，召回 12/12、9/9、3/4。报告见 `docs/doc-inputs.md`。
- 回归：新增文档类型判定测试，原有测试全部通过；7/7 回放仍被捕获。

## v0.1.0 — 2026-10-16

首个版本：P0–P5 全部完成，外加 RSI 第 1 轮（详见 docs/history/：PLAN.md、RSI-round-1.md、research_log.md）。

**引擎**
- 基于 ClaudeAnimationBase 的 p5.js 2.3.3 + p5.brush 2.2.3 水彩引擎，每帧是 t 的纯函数，selftest 逐字节确定。
- 媒介：brush / flat / shader：`stylize` 提供 9 种风格，`shade` 提供 4 种特效。
- 纯 JS 程序化声音 `sound()`；歌词条（支持 CJK）。
- 镜头与转场：`shots()`、`whipPan` / `iris` / `brushWipe` / `flash`。
- RSI-1 新增：
  - `focus()` / `focusClawd()` 读点声明；
  - `clawdHand('near' | 'lead' | 'L' | 'R')`；
  - `sit`、`emotions({ fresh })`；
  - `clawd({ lite })` / `lite()` / `skipped()` 成本杠杆；
  - 确定性程序化 `glow()`。

**CLI（`bin/c2v.mjs`）**
- new / ingest：输入可以是歌词、脚本、图像、音频、视频。
- check / reads / cost / sheet / seams / review / selftest / render / metrics / report / deliver / audio。
- `reads` 规则：R1 过小、R2 出画、R3 跨切点连续性、R4 跳切、R6 遮挡。`cost` 提供 R5。

**MCP**：`mcp/c2v-mcp.mjs`，11 个工具，stdio JSON-RPC。

**Skills**：code-to-video、c2v-storyboard、c2v-build、c2v-review、c2v-deliver、c2v-orchestrate（`dist/*.skill`）。

**作品**：umbrella、pdoom-c08、bench、upgrade、whale、p1-media、night、flood、keys。成片在 Release 附件中；除 bench 外，均为 VM brush scale 0.5 预览。

**测试**
- `tests/run.mjs` 全部通过。
- `tests/replay.mjs`：7/7 历史失败被捕获。
- `tests/mcp-smoke.mjs` 通过。

**已知限制**
- scale 1 GPU 终渲尚未在 Mac 上跑：运行 `bash scripts/mac-final.sh`。
- umbrella、whale 的成片早于 reads 修复，终渲时会重出。
- 像素切点检测会把闪白、光圈计为切点，自家作品的镜头长度以 `check.json` 为准。
- 对比度/显著性、拿错手等问题仍需人工看图核验。

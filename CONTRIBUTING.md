# Contributing

*English summary: run `npm test` (and the Chrome tests if you touched engine/lib), keep frames pure functions of t, add a replay to `tests/replay.mjs` when you turn a visual-review catch into a rule, never commit media.*

## 开发环境

Node ≥ 20、ffmpeg，以及 Chrome/Chromium（或用 `CHROME_PATH` 指定路径）。无 GPU 的 Linux 先运行一次 `scripts/vm-setup.sh`，之后给命令加 `--soft-gl`。

```bash
npm ci
npm test                          # 快速测试，不启动 Chrome
node tests/run.mjs --soft-gl      # 完整测试
node tests/replay.mjs --soft-gl   # 历史失败回放：必须全部捕获
C2V_SOFT_GL=1 node tests/mcp-smoke.mjs
```

CI（`.github/workflows/ci.yml`）在每次 push / PR 时跑上面全部测试。

## 约定

- **确定性**：每帧都是 t 的纯函数，禁止 `Math.random`、`Date.now` 等。改了 `engine/` 后，对受影响的项目跑 `node bin/c2v.mjs selftest <name>`（scale 1），确认逐字节一致。
- **场景作者不改 `engine/`**：私有 helper 写在场景自己的 IIFE 里。引擎改动要附带测试或 fixture。
- **核验流程**：`check` 0 error → `reads` 的每条警告都已修复或说明 → 看 sheet / strip（见 `skills/c2v-review`）。
- **把肉眼发现变成规则**：新增 `reads` / `check` 规则时，同时在 `tests/replay.mjs` 加一个回放，并确认已完成的项目没有新的误报。
- **媒体不入 git**：MP4、WAV、渲染帧（`out/`）都不提交，成片作为 Release 附件发布（`scripts/release-assets.sh`）。核验用的小图放在 `reports/`。
- **注释写在完整语句之后**：行内注释吞掉过 `]);`，`tests/run.mjs` 会对每个引擎、lib、bin 文件做语法检查。
- **Skills**：改了 `skills/*/SKILL.md` 后要重新打包 `dist/*.skill`（zip，目录名即 skill 名）。

## 提交

- 一个主题一个分支，一个 PR。
- 提交信息写清楚改了什么和为什么。涉及视觉的改动附上前后 sheet。
- 新作品按 `projects/<name>/` 的结构提交：`project.js`、`STORYBOARD.md`、`scenes/`、`input/`。

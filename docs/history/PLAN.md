# Code-to-Video 分阶段实施计划

> 归档说明（2026-10-16）：本文件是 P0–P5 的阶段计划，已全部完成，保留作为过程记录；当前用法见根目录 README。文件已从根目录移到 `docs/history/`，第 1 节中的仓库结构图是当时的布局。
>
> **状态（2026-10-15）**：P0–P5 全部完成，均按 Leo 授权自验收并合并 main，证据见 `docs/history/research_log.md` 与 `deliver/index.html`。最终验收归 Leo。待办：Mac GPU 上的 scale 1 终渲；案例 A 盲测；案例 B 原图。

> 来源：飞书《Code-to-Video：纯代码生成视频》（全文转存见 `docs/history/source-design.md`），参考仓库 JohnHeibel/ClaudeAnimationBase（MIT）与 JohnHeibel/PDoomVideo，Leo 2026-10-14 的四项决定。
> 状态标注约定：**已验证** = 有可复现产物/日志；**待定** = 未跑；**失败** = 跑过不达标；**已验收** = Leo 确认。每阶段分 4 个 gate：技术构建 → 视觉审查 → 阶段验收（Leo）→ 合并 main。

## 0. 目标与边界

- 全程不调用任何视频/图像生成模型。画面（及可选声音）全部由代码逐帧确定性生成：帧 = f(t)，无跨帧状态、无 `Math.random()`。
- 设计文档的 6 项产出与阶段对应：

| 设计文档产出 | 落在 | 形态 |
|---|---|---|
| 1 可复用绘制引擎 + 规则文档 | P1 | `engine/*.js` + `ANIMATION_GUIDE.md` |
| 2 CLI/脚本入口 | P2 | `bin/c2v.mjs`（new / check / sheet / strip / crop / render / report） |
| 3 可复用绘制 skills | P3 | `skills/c2v-*`（SKILL.md + 示例 + 失败处理），可打包 `.skill` |
| 4 成片与对比交付包 | P4–P5 | 每个项目 `deliver/`：源码、抽帧证据、MP4、STORYBOARD、核验记录、HTML |
| 5 渲染管线 | P0（打通）→ P2（加固） | `render.mjs`：sheet/strip/crop/stills/clip/frames 并行续渲/encode |
| 6 泛化性 | P5 | 跨输入（文本/图像/视频）测试矩阵与结论 |

- 执行环境（Leo 2026-10-14 更正）：构建与生成测试都在本地 Mac（Chrome + Metal）完成。Claude 把代码直接写进工作区，每阶段给一条核验脚本（如 `scripts/p0-check.sh`），Leo 本地运行，结果写入 `reports/<phase>/`，Claude 读日志和抽帧图核验。VM 路径（`scripts/vm-*.sh`，SwiftShader 实测 13–25 s/帧、单次调用上限约 3 分钟）只作兜底。

## 1. 仓库结构（P0 建立，后续阶段只增不改）

```
code-to-video/
  PLAN.md  README.md  research_log.md  NOTICE.md
  docs/            source-design.md、baselines.md、各阶段报告
  engine/          core.js clawd.js timeline.js sheets.js loader.js（共享，只读契约）
  projects/<name>/ project.js（PROJECT + 场景文件列表）STORYBOARD.md scenes/ assets/ out/(忽略)
  studio.html      ?project=<name>&t=2.5&loop=emotions
  render.mjs       --project=<name>，其余参数同 ClaudeAnimationBase
  scripts/         p0-check.sh 等每阶段核验脚本；vm-*.sh 兜底
  reports/<phase>/ 核验日志、抽帧图、指标 JSON（MP4 不入 git）
  bin/ skills/ cases/                     （P2/P3/P4 加入）
  *.mp4            3 个 before 基线 MP4，原位保留不移动（不入 git）
```

多项目隔离：每个输入一个 `projects/<name>/`，共享引擎只读，契合文档的「严格文件边界」与并行 agent 协作。

## 2. 阶段

### P0 基建与基线 — 分支 `phase/p0-infra`
- 仓库：git init，MP4/frames/out 进 `.gitignore`；`NOTICE.md` 记录 ClaudeAnimationBase MIT 来源。
- 引擎基底：vendor ClaudeAnimationBase 到 `engine/`，加多项目 loader；字体改为本地 npm 包（去掉 Google Fonts 外网依赖，保证离线确定性）。
- 渲染管线：Mac 用系统 Chrome（Metal）；VM 兜底用 playwright chromium-headless-shell + `--soft-gl`。
- 冒烟（`scripts/p0-check.sh`，Mac 本地）：demo 项目 selftest / sheet / strip / crop / 2 s frames→encode，记录 ms/帧；`--selftest` 同一 t 渲 3 路逐字节比对（确定性）。
- 基线：3 个 before MP4 的 contact sheet 与指标（时长、镜头数、平均镜头长、有字幕/文字帧占比），写 `docs/baselines.md`。
- PDoomVideo 原仓库参照（决定①前半）：VM 渲每章 3 帧 contact sheet；整片终渲命令交给 Leo 在 Mac 跑。
- **验收**：`p0-check.sh` 在 Mac 上全部 STATUS ok；确定性比对通过；基线报告完成。

### P1 引擎与规则文档 — `phase/p1-engine`
- `ANIMATION_GUIDE.md` 项目版：保留原三目标、七规则、动画原则与 API；补入 PDoomVideo 经验（章节文件边界、歌词压拍、并行 subagent 分工），以及从 3 个基线归纳的「AI 味」失败条目（字幕常驻、标签牌、扁平矢量塑料感等）。
- 媒介可插拔（对应两个案例的两种画面实现）：`brush`（p5.brush 水彩，默认）、`flat`（无 fill 的低成本笔触，供无 GPU 机器）、`shader`（每风格一个 fragment shader，供梗图多风格段落）。
- 程序化声音（「瘫坐长椅」案例需要）：代码合成音频，OfflineAudioContext → WAV，同样是 t 的确定性函数，可锁 bpm。
- 引擎自检：`window.selfTest()`（帧确定性、NaN 几何守卫、ms/帧预算）。
- **验收**：每种媒介各有 3–5 s 示例，确定性通过；`brush` 在 Mac 上 ≤1.5 s/帧（VM 只报软渲染数）。

### P2 CLI 与核验工具 — `phase/p2-cli`
- `bin/c2v.mjs`：`new <name> --from=<lyrics.lrc|script.md|image|video>`、`check`、`sheet [--auto]`（按 SHOTS 自动取每镜头首/中/尾帧）、`strip`、`crop`、`render`（frames 并行续渲 + encode）、`report`。
- 输入解析：LRC/带时间戳歌词 → 节拍与段落表；剧本 → 镜头候选；图像 → 复制为参考并生成参考卡；视频 → ffmpeg 场景切分 + 关键帧 contact sheet + 音频抽取/bpm 估计。
- `check` 静态规则（可机检的部分）：`Math.random`、`letter()/sfx()` 用量、`rotateY/WEBGL 3D`、裸 p5 形状（`rect/ellipse/fill(`）、缺转场的接缝、镜头时长分布（1.4–4 s 区间占比）。
- **验收**：在 demo 与 1 个新项目上，全部子命令跑通、输出与手工命令一致。

### P3 绘制 skills — `phase/p3-skills`
- `c2v-storyboard`（输入 → STORYBOARD：logline/world/motif/arc/shots+reads）、`c2v-build`（逐镜头实现，先关键姿势后运动）、`c2v-review`（sheet/strip/crop + 八项检查，带记录模板）、`c2v-deliver`（终渲命令、交付包、HTML）、`c2v-orchestrate`（长片按章节拆给并行 subagent，文件边界与上报规则）。
- 每个 skill 附可运行示例、常见失败与处理、跨输入验证证据。
- **验收**：用 skills 从零做一个 10–15 s 短片，全流程留痕。

### P4 案例验证 — `phase/p4-cases`
- **A. PDoomVideo**（决定①后半）：只给歌词与音频，用我们的 skills 重生成 1–2 章（候选：「实验室」1.5–23 s、「合唱 4：红色警报」123.5–137.4 s），与原章并排对比：规则检查、ms/帧、contact sheet、镜头节奏。
- **B. 瘫坐长椅原子弹爆炸**：梗图 → 约 40 s 多风格 shader 段落 + 代码合成声音。需要 Leo 提供梗图原图（飞书附件在 VM 里下载不到）。
- **C. before → after**（决定③）：从基线 MP4 抽音频与歌词，重做其中一首的 1 段（候选 gpt-6-one-more-upgrade），同一输入做 before/after 对照。
- **验收**：每个案例有交付包；对照结论附指标与 contact sheet 证据，不只给结论。

### P5 交付包与泛化 — `phase/p5-delivery`
- HTML 对比交付页：每个案例的 before/after、抽帧证据、规则检查分、ms/帧、核验记录。
- 泛化矩阵：文本（剧本）、图像（关键图）、视频（片段改编）各至少 1 个 10–15 s 新输入，记录一次通过率、修正轮数、主要失败类型，每个失败归因回 guide/引擎/skill 的改动（RSI 闭环）。
- **验收**：Leo 最终验收。

## 3. 风险与对策
- 核验回路依赖 Leo 本地运行：每阶段把所有检查合并成一条脚本，一次跑完，减少往返。
- 无独显时水彩 fill 偏慢：保留 `flat` 媒介兜底，render-log 记录每次 ms/帧。
- 外部资源：字体与依赖本地化；飞书附件（原片、梗图）需 Leo 提供到 `baselines/` 或 `cases/*/input/`。
- 版权：ClaudeAnimationBase 为 MIT，保留 LICENSE 与 NOTICE；PDoomVideo 仓库未带 LICENSE 文件，只作参照，不复制其章节代码进本仓库。

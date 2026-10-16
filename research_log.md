# Research log

状态：已验证 / 失败 / 待定 / 已验收。环境写明（Mac 本地 or VM 兜底）。

## 2026-10-14 · P0 基建（分支 `phase/p0-infra`）

**构建（已完成，待 Leo 本地核验）**
- 设计文档从飞书 SSR 全量转存 → `docs/source-design.md`（197 块，has_more=False）。
- vendor ClaudeAnimationBase @0ac8bf2（MIT）到 `engine/`；多项目布局 `projects/<name>/project.js`；`studio.html?project=` 加载器；字体改本地 `@fontsource/permanent-marker`（去掉 Google Fonts 外网依赖）。
- `render.mjs` 新增：`--project`、`--selftest`（3 路逐字节比对）、`render-log.jsonl`、Playwright headless-shell 探测、encode 支持非 0 起始帧并拒绝有洞的帧序列。

**VM 兜底环境的冒烟结果（已验证，仅供参照，不作为验收证据）**
- 环境：aarch64 VM，SwiftShader（Vulkan 1.3 / LLVM 10）。
- selftest t=0.3/4.0/10.6：A、A 再渲、B 乱序三路 PNG sha1 全一致 → 确定性通过。
- ms/帧：简单帧 83–89 ms；水彩 fill 帧 12.9–25.6 s。frames 6.5–7.0 s（12 帧）→ encode 得 1920×1080、24 fps、12 帧，与预期一致。
- 发现并修复：上游 `--encode` 默认从 f00000 读，`--range` 不从 0 起时会失败 → 加 `-start_number` 与缺帧检查。

**基线（已验证）**：`scripts/video_metrics.py` → `docs/baselines.md`。镜头中位 4.3/13.1/11.6 s，1.4–4 s 区间占比 36/0/16%，近静止 46/40/16%，字幕出现率 83/63/75%（字幕检测重新校准过一次：160×90 下全错为 0，改 640×360 后与目检一致）。

**PDoomVideo 参照（已验证）**：`render.mjs --studio=` 渲 13 帧，见 `reports/p0/pdoom-ref/`。参照原片自带卡拉 OK 歌词条，修正了基线报告里「字幕即失败」的说法。

**Gate**：技术构建 ✅ · 视觉审查 ✅（demo sheet/strip、PDoom 参照帧均目检）· 阶段验收：按 Leo 授权自验收 ✅ · 合并 main ✅。
**Mac 本地复核（可选，待定）**：`bash scripts/p0-check.sh` 给出 Metal 下 ms/帧，作为 P1 预算（≤1.5 s/帧）的基准。

## 2026-10-14 · P1 引擎（分支 `phase/p1-engine`，Leo 授权自验收）

全部在 VM（SwiftShader）测得；证据图在 `reports/p1/`。

| 项 | 结果 | 状态 |
|---|---|---|
| 预览缩放 `--scale=0.5` | demo 6 帧 sheet 106 s → 64 s；水彩重帧 13–25 s → 4–11 s；sheet 尺寸下目检无差 | 已验证 |
| `flat` 媒介 | demo 6 帧 9 s（brush 106 s，约 12×）；selftest 4 时刻通过 | 已验证 |
| shader 风格 ×9 | cave/inkwash/blueprint/halftone/pixel/crt/cel/thermal/stained 全部编译、方向正确（`styles.jpg`）；selftest 3 时刻通过 | 已验证 |
| shader 生成器 | explosion（加墨边与内部余火后见 `boom2.jpg`）、shockwave；与 brush 层、角色前后关系正确 | 已验证（观感 P4 再打磨） |
| 确定性（混合 brush+shader+歌词条） | scale 1 下 t=0.3/2.05/3.6/4.4 三路一致；scale 0.5 下最后一列 1–14 px ±1 差异 → 定性为放大采样伪影，selftest 加提示 | 已验证 |
| 程序化声音 | 初版 Web Audio：`BiquadFilterNode` 两次渲染字节不同（逐 voice 消融定位）→ 改纯 JS 逐样本合成 + 自写滤波与限幅；跨页面、跨进程 sha 一致（ec681df6b3ad）；峰值 0.72、无削波 | 已验证 |
| 音画同步 | boom 事件 2.60 s，音频 onset 2.60 s，闪光首帧 2.625 s（≤1 帧） | 已验证 |
| 歌词条叠加层 | 渲染正常；loop 中误显示 → 已修；VM 无 CJK 字体，中文行为豆腐块（Mac 有 PingFang） | 已验证 / 中文行待 Mac 复核 |
| ANIMATION_GUIDE 项目版 | 中文导读 + Part 2（媒介、声音、歌词条、并行章节、预览预算、基线失败条目） | 已完成 |

问题与修复：按钮道具被身体遮挡（接触不读）→ 改位置与尺寸，crop 复核手臂触到按钮；GLSL `transpose` 与反向 `smoothstep` → 改写。

## 2026-10-15 · P2 CLI 与核验工具（分支 `phase/p2-cli`，Leo 授权自验收）

| 项 | 结果 | 状态 |
|---|---|---|
| `c2v` 子命令 | new / ingest / check / sheet / seams / review / selftest / render / metrics / report / audio 全部在 VM 跑通；p1-media 全流程 render（144 帧 flat+0.5，3 worker，309 ms/帧）→ synth → encode → metrics → report.html | 已验证 |
| 节拍分析 | pdoom.mp3：88.0 BPM、首拍 0.185 s（参照 0.21 s，误差 25 ms < 1 帧），置信 high。迭代过程：自相关→132（3/2 误判）；单极点分频→100.4（低频带漏中频）；FFT 包络与 Python 逐帧一致但候选集缺 88 → 改为 60–200 全扫 on/off-beat 对比度。短片段（20 s）相位会锁到切分音位置 → brief 中提示 | 已验证（短片段相位：已知局限） |
| 片段 vs 全曲 | gpt-6 片段 24 s 与全曲同为 112.1 BPM；修复对比度除零（off-beat≈0 时 1.5M） | 已验证 |
| 视频指标 JS 版 | 与 P0 Python 版在两个基线上逐项相同 | 已验证 |
| `check` | fixture 中的 3 类确定性错误、3 类媒介警告、5 个接缝、镜头过短/过长、声音越界、无分镜全部报出；注释里的关键词不误报；有 error 时退出码 1 | 已验证 |
| 接缝检查改进 | 首版只看“镜头里有没有转场调用”，p1-media 因只有 iris-in 被误放过；seam strip 目检发现 2.5 s 是硬切 → 改为逐接缝判定（前镜 OUT / 后镜 IN / 注释），并把 p1-media 改为闪光切 + 情绪连续（strip 复核） | 已验证 |
| ingest | lyrics(LRC/SRT)、script（中英混合读时估计 1.4–4 s）、image（尺寸+确定性 k-means 调色板+参考图）、audio、video（切点、关键帧总表、音频抽取与节拍） | 已验证 |
| 回归测试 | `node tests/run.mjs`：14 项全部通过 | 已验证 |
| 脚手架 | `c2v new` 生成的项目 check 0 error、selftest 通过 | 已验证 |

## 2026-10-15 · P3 绘制 skills（分支 `phase/p3-skills`，Leo 授权自验收）

- 6 个 skill：`code-to-video`（入口/路由）、`c2v-storyboard`、`c2v-build`、`c2v-review`、`c2v-deliver`、`c2v-orchestrate`；打包为 `dist/*.skill`。每个含步骤、格式、失败与处理表、证据指针。
- **验收短片 `projects/umbrella`（14 s，文本输入 `tests/inputs/script.md`，同时是 P5 泛化矩阵的「文本」样本）**，严格按 skills 走：ingest（6 beats/20.7 s 估计）→ storyboard（合并为 4 镜头，每镜头 1 个 EVENT）→ build → check（0/0/0）→ 5 轮 review → selftest → render → report。
- review 共发现并修复 12 个问题（详见 `reports/p3/umbrella/REVIEW.md`）：核心创意（叶子当伞）首轮不可读、道具跨切点消失/凭空出现、近似景别的 cut on action 变跳切、反应盖住原因、溅水滴像牙齿、角色悬空 ×2、蝴蝶过小、雨穿过遮蔽、按钮式漏改导致场景加载失败。
- 工具缺陷：场景加载失败时 `c2v check` 崩溃而非报错 → 修复 + 回归测试（现 15 项全过）。
- 渲染：VM brush scale 0.5，336 帧，3 worker，约 5 s/帧（有效），10 批断点续渲；selftest scale 1 三时刻一致；音频 onset 与画面常数一致（2.30 / 7.80 / 8.55 / 12.30 s），峰值 0.47。
- 指标口径发现：像素突变式切点检测会漏掉动作连续的转场（whip、cut on action），并把擦除/光圈拆成两次突变；本片代码层 4 镜头 100% 落在 1.4–4 s，像素指标给出中位 0.5 s。结论：自家成片以 `check.json` 为准，像素指标只用于与无源码视频对比，并注明。
- 待定：Mac GPU 上 scale 1 brush 终渲（命令 `node bin/c2v.mjs render umbrella --workers=4`）。

## 2026-10-15 · P4 案例验证（分支 `phase/p4-cases`，Leo 授权自验收）

| 案例 | 输入 | 产出 | review | 关键证据 | 结论 |
|---|---|---|---|---|---|
| A `pdoom-c08` | PDoomVideo 合唱 4 音频切片 + 6 行歌词 | 17 s，6 镜头，brush 0.5，原曲音轨 | 4 轮 / 9 处修复 | `docs/case-A-pdoom.md`、`reports/p4/caseA/compare.jpg` | 结构、读点、转场达标；画面密度与角色丰富度明显不如原作（原章 841 行 vs 213 行，双角色 vs 单角色）。**非盲测**：规划前读过飞书对该章的概括 |
| B `bench` | 梗图文字描述（原图不可得） | 24 s，6 风格 shader，代码合成配乐 63 事件，scale 1 终渲 | 4 轮 / 6 处修复 | `docs/case-B-bench-meme.md` | 一风格一 shader 成立；音画同步到常数；字幕检测器在 halftone/pixel 纹理上误报 0.33 |
| C `upgrade` | 基线同段音频 + 同 4 行歌词 | 18 s，4 镜头，brush 0.5 | 4 轮 / 7 处修复 | `docs/case-C-before-after.md`、`reports/p4/caseC/` | 同口径：近静止 20.5% → 0.9%，运动量 2.33 → 5.35，画内文字 多处 → 0；场景设计密度不如基线 |

工具链在 P4 中的修复：ingest 多输入合并 brief；encode 读取 PROJECT.audio；`whipPan()` 进引擎；stained 风格可调 cell；VM 加 CJK 字体（文泉驿微米黑）；歌词首行时间误判（字幕带变化属于上一行）→ 只重渲受影响 118 帧。

## 2026-10-15 · P5 交付包与泛化（分支 `phase/p5-delivery`，Leo 授权自验收）

- 图像输入泛化测试 `projects/whale`（9 s）：输入只有一张关键帧（deepseek 基线 108 s），ingest 给出尺寸、确定性 k-means 调色板与参考图；故事板把这张图当「一个瞬间」，拍它之前、之中、之后。新角色（鲸鱼、操作员的手）用套件画笔画。首次 check 0/0/0，2 轮 review，1 处修复（挥手读成再次拍按钮），selftest 通过，brush 0.5 渲染，代码音效 17 个事件。
- 交付页 `deliver/index.html`（`node bin/c2v.mjs deliver`）：读取每个项目自己的 check.json、metrics.json、render-log，以及 `deliver/cases.json` 中手工记录的 review 统计；图片以 data URL 内嵌，视频以相对链接引用。章节依次为：案例、before/after、三个基线、泛化矩阵、失败类型→回流位置、工具链、待办。
- 泛化矩阵（6 部作品）：输入为文本 / 音频+歌词 ×2 / 梗图描述 / 图像 / 测试；首次 check 全部 0 error；22 轮 review 共发现 39 个问题。主要失败类型：关键创意在 sheet 尺度不可读、跨切点连续性、镜头与读点相悖、接触与绘制顺序、因果/节拍时序、风格吞细节、工具链缺陷。每一类都回流到 skills 或 lib/tests 里。
- 回归测试 15 项全过（`reports/p5/tests.txt`）；6 个项目 check 全部 0/0/0。
- **待定（Leo 本地）**：各 brush 项目在 Mac GPU 上的 scale 1 终渲（bench 已在 VM 完成 scale 1）；案例 A 的盲测重跑；案例 B 原图入库与对比。

## 2026-10-16 · RSI 第 1 轮（分支 `rsi/round-1`，Leo 授权自验收）

- 来源：上一轮 6 部作品中靠肉眼发现的 39 个问题。其中 77% 可归入可机检或可由引擎助手消除的类别（详见 `docs/RSI-round-1.md` §1）。
- 新工具：
  - `focus()` 声明 + `c2v reads`：R1 过小、R2 出画、R3 跨切点连续性、R4 跳切、R6 被角色遮挡（R6 是本轮 keys 新增）；
  - `c2v cost`（R5，配合 `skipped()`）；
  - `clawdHand('lead')`、`sit`、`emotions({fresh})`、`clawd({lite})`；
  - 确定性 `glow()`（程序化 shader）；
  - MCP 服务 `mcp/c2v-mcp.mjs`（11 个工具）。
- 回放套件：7/7 历史失败被捕获。8 个已完成项目上 reads 0 误报（改进记录在文档 §4.1）。
- 3 个新案例（night 歌词+音频、flood 单图、keys 中文脚本）：
  - 平均工具先捕获 1.3 个、仍需肉眼 3.7 个，平均 2.3 轮 review、4.7 处修复；上一轮为 0 / 6.5 / 3.7 / 6.5。
  - 3 个案例全部通过 selftest。
  - night 与基线同口径对比：近静止 52.4% → 15.9%，运动量 2.99 → 6.91。
- 局限：
  - 样本小，且新案例更短、更简单；
  - 规则与案例出自同一 agent，不是盲测；
  - 对比度/显著性、拿错手、切点前缺少动作、布景边缘露出，仍只能靠肉眼；
  - 像素切点检测会把闪白和光圈算作切点。
- 待定（Leo 本地）：`bash scripts/mac-final.sh` 做 scale 1 GPU 终渲（现已包含 night/flood/keys）。umbrella 和 whale 在 reads 修复后视频已过期，终渲时会一并重出。

# Before 基线：3 个早期尝试（决定③）

来源：工作区根目录 3 个 MP4（Leo 之前的尝试，原位保留，不入 git）。指标由 `scripts/video_metrics.py` 计算（ffmpeg + numpy，可复现），原始数据在 `reports/p0/baselines/metrics.json`，抽帧总览（每 6 s 一帧）在 `reports/p0/baselines/*-sheet.jpg`。

## 指标

| 指标 | deepseek-4-1-flash-under-the-water | gpt-6-one-more-upgrade | gpt-6-the-last-one | 规则期望 |
|---|---|---|---|---|
| 时长 / 规格 | 216.4 s · 1280×720 · 24 fps | 158.4 s · 1280×720 · 24 fps | 252.0 s · 1920×1080 · 24 fps | — |
| 硬切/快速变化数（下限） | 32 | 8 | 18 | 每镜头一次 |
| 镜头长度 均值 / 中位 | 6.6 / 4.3 s | 17.6 / 13.1 s | 13.3 / 11.6 s | 1.4–4 s |
| 落在 1.4–4 s 的镜头占比 | 36% | 0% | 16% | 大多数 |
| 近静止步占比（1/12 s 内几乎不变） | 46% | 40% | 16% | ≈0（「无静止帧」） |
| 平均运动量（0–255 均差） | 2.8 | 1.9 | 3.6 | 越高越活 |
| 底部字幕出现率（1 fps 采样） | 83% | 63% | 75% | Base 规则 0%；PDoomVideo 原片有歌词条 |

口径说明（避免夸大）：
- 「硬切数」只计逐帧变化尖峰，渐变转场与连续运镜会漏计，所以是**下限**，镜头长度因此是**上限**。
- 「近静止」阈值是 160×90 灰度下均差 < 0.6，纸纹沸腾（boil）在这个尺度上通常会超过阈值，因此它衡量的是画面是否真的在动。
- 字幕检测是启发式，用三片校准过（有字幕行的行边缘密度 0.18–0.45，无字幕 < 0.07）。字幕以外的画内文字（标签、牌子、标题卡）没有计入，见下方目检。

## 目检（人工，基于抽帧总览）

- **文字过多（规则 2）**：三片都有常驻双语卡拉 OK 字幕。需要区分：PDoomVideo 原片自己也有底部卡拉 OK 歌词条（P0 参照抽帧 `reports/p0/pdoom-ref/chapters.jpg` 可见），所以歌词条本身不算偏离参照作品，偏离的是 ClaudeAnimationBase「歌词不上屏」的更严格规则；项目里歌词条作为可选叠加层处理（P1）。真正的问题在画内：大量标签与牌子，例如 `WHY?`、`SCORE 42`、`ACCESS CONTROL OFFICE`、`PERMISSIONS`、`PUBLIC REVIEW`、`过载`、`62%`、`99.7`，以及章节标题卡（`05 / MAKE SOME FRIENDS` 等）。guide 把「用牌子复述剧情」列为经典失败，而这里是主要叙事手段。
- **媒介是扁平矢量（规则 1）**：几何矩形、均匀描边、渐变与发光，没有笔触、没有沸腾线条，接近 guide 说的「2000s Flash」观感。
- **角色太小、表演少（规则 5）**：人物多数只占画面高度的 1/10 左右，情绪主要靠道具和字幕表达。
- **镜头长、节奏平（规则 4）**：中位镜头 4–13 s，远超 1.4–4 s；同一场景内多为元素依次出现、等字幕走完。
- **做得好的部分**：每首歌有统一世界观与配色；有角色母题（deepseek 的鲸鱼、gpt-6 两片的结形 logo 角色）；片尾呼应片头（deepseek 的屏幕亮点 → 片尾）；每段歌词都有对应画面。

## 对后续阶段的约束

- P1 guide 的 common failures 增补：画内标签牌、章节标题卡、扁平矢量与渐变、镜头 > 6 s、角色 u < 12 的长段落。歌词条改为引擎提供的可选叠加层（默认关，MV 可开），与画内文字分开计量。

## PDoomVideo 原仓库参照（决定①前半）

- VM 软渲染，每章 1 帧：`reports/p0/pdoom-ref/chapters.jpg`（0.8, 12, 30, 48, 66, 84, 102, 116, 130, 148 s）与补帧 `sheet_c.jpg`（66.6, 130.6, 131.5 s）。
- 软渲染 ms/帧：222 ms–37.5 s，中位约 22 s。整片 3758 帧在 VM 不可行；Mac 终渲命令（先在 PDoomVideo checkout 里 `npm i`）：`cd ~/Desktop/code-to-video && node render.mjs --studio=<checkout>/studio.html --out-dir=out/pdoom --frames --range=0:156.6 --workers=4`，再 `node render.mjs --studio=<checkout>/studio.html --out-dir=out/pdoom --encode --audio=<checkout>/assets/pdoom.mp3`。
- 66.0 s 与 130.0 s 恰在镜头起点时只有纸面（推断为转场首帧，0.6 s 后正常），不是渲染故障。
- 与基线对照的直观差异：笔触水彩与沸腾线、角色大（chorus 中 Clawd 占画高约 40%）、画内文字只剩少数拟声词（ZOOM!）与 P(doom) 道具，镜头密度远高于基线。
- P2 `check` 把上表指标作为机检项；P4-C 的 after 版本用同一脚本、同一口径对比。

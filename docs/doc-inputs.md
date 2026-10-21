# 文档类输入 → video：meme 图、学术论文 poster、富文本图

> 结论（2026-10-21，VM 实测）：**能实现。** 三类输入各做了一个可运行的原型，都已渲染成片，并通过 check、reads、selftest 和成片文字召回检查。实现方式是在现有管线上补齐四块能力：读懂版面、把原图当素材、以文字为内容的规则、成片文字核验。没有引入任何生成模型。
> 局限：三个样例都是合成的单页输入，且与工具出自同一 agent。真实的多页论文、手机截图和低清 meme 还没测过，见第 5 节。

## 1. 第一性原理：这类输入和歌词、剧本有什么不同

此前的输入（歌词、剧本、一张关键帧）只提供“事”，画面要从零画起。文档类输入有三点不同：

1. **文字就是内容。** 原规则 2（“画面里不放字”）对它不成立：poster 的标题、数字和 meme 的两句字幕，正是观众要读的东西。
2. **版面就是分镜。** 阅读顺序（标题 → 栏 1 → 栏 2 → 栏 3）天然给出镜头顺序，区块框天然给出机位。
3. **原图本身可用。** poster 的图表、meme 的图片可以直接作为素材，不必重画。

所以要补的是四件事：读懂版面、把原图放进画面、文字既能排版又能核验、规则区分“文字是内容”和“文字在解释画面”。

## 2. 外部参照（arXiv 检索，2026-10）

| 工作 | 做什么 | 与本项目的关系 |
|---|---|---|
| Paper2Video / PaperTalker（arXiv 2510.05096） | 论文 → 学术报告视频：幻灯片 + 字幕 + TTS + 数字人；101 篇的 benchmark，PresentQuiz 等指标 | 同为 paper → video，但它的成片是幻灯片加真人讲解，用了 TTS 和数字人生成模型。本项目走动画路线，零模型 |
| Preacher（arXiv 2508.09632，ICCV 2025） | 论文 → 视频摘要，自顶向下拆解，再自底向上生成片段 | 片段生成依赖视频生成模型；它的“关键场景 + 渐进 CoT 规划”和本项目“读点 → 镜头”的思路一致 |
| Code2Video（arXiv 2510.01174） | Planner / Coder / Critic 三个 agent 写 Manim 代码生成教学视频；VLM 当 critic 修版面；TeachQuiz 指标 | 最接近的“代码即视频”路线。它用 VLM 看版面，本项目用 `reads` 的确定性规则加肉眼核验 |
| Paper2Poster / PosterAgent（arXiv 2505.21497） | 论文 → poster：Parser 资产库、二叉树版面、Painter-Commenter 回路；PaperQuiz | 方向相反（paper → poster）。它的“结构化资产库 + 阅读顺序”正是本项目 poster 输入要解析出来的东西 |
| ResearchStudio-Reel（arXiv 2607.04438） | 以 Claude Code skills 实现 paper → poster / 视频 / 博客，原生可编辑产物 + 交付检查 | 同为 skill 化、可编辑、可检查的交付路线 |
| MoVer（arXiv 2502.13372，SIGGRAPH 2025） | 一阶逻辑 DSL 校验 motion graphics 的时空属性，结果反馈给 LLM 迭代修正 | 与 `reads` 的“声明 → 机检 → 修”同构。它的谓词（方向、时序、相对位置）可以扩展本项目的 R 规则 |
| Code2Video-Compass（arXiv 2610.28416） | 代码生成视频 benchmark，覆盖 T2V / I2V / V2V 共 2104 题；最强的模型在构造、动画、状态依赖复杂度上升时也明显下滑 | 说明 I2V（图 → 代码视频）是公认的难点。本项目的三类输入都属于 I2V |

检索中没有找到专门做 “meme 图 → 动画视频”的工作（arXiv 标题检索 meme + video/animation 只命中仇恨检测类论文），这一类没有直接对标。

## 3. 实现：补了哪些能力

| 能力 | 位置 | 说明 |
|---|---|---|
| 版面解析 | `lib/layout.py`（Tesseract OCR + OpenCV），`c2v ingest` 自动调用 | 输出 OCR 行、区块（text / figure）、阅读顺序（全宽标题带优先，再按栏）、文档类型 **meme / poster / card / picture**。语言自动判定：页面或字幕层中 CJK 占比超过 20% 时用 chi_sim+eng，否则用 eng（chi_sim+eng 会吞掉英文词间空格）。meme 字幕层单独处理：先提取“白字 + 黑描边”掩膜，再做 OCR |
| PDF poster | `lib/ingest.mjs` | 第 1 页按 200 dpi 栅格化（pdftoppm），同时保留 PDF 内嵌文字（精确、无 OCR 误差），一并写进 brief |
| 去字底图 | `layout.py --clean`（meme 自动生成） | 把字幕字形与描边修补掉（Telea），得到可作素材的干净图片 |
| 原图素材 | `engine/doc.js` `plate()`，`PROJECT.assets` | 首帧前解码，在世界坐标中跟随相机；之后画的笔触叠在上面 |
| 排版文字 | `engine/doc.js` `textBlock()` / `marker()` / `DOC_FONT` | CJK 逐字换行、拉丁按词换行，`reveal` 逐字打出；荧光笔划过效果。字体用本机字体，帧在同一台机器上确定（selftest 已验证），跨机器不保证 |
| 规则 2 分流 | `PROJECT.text = 'content'` + `lib/check.mjs` | 文字原生的输入里，lettering 记为 info 而不是 warn。规则改写为：只展示原文展示的字，不添加解释画面的说明字 |
| 读点规则扩展 | `lib/reads.mjs` R6 + `focus({ group })` | 由角色组成的目标（如一群小 Clawd）不算被成员遮挡。doc-card 的 R6 抓到一处真实遮挡：Clawd 挡住了切点示例 |
| 成片文字核验 | `scripts/dev/text-recall.py` | 在每个读点时刻抽帧，用三种方式 OCR（原图 / 反色 / 白字掩膜），算出原文召回率。召回是**下限**，Tesseract 读不出的字人眼往往能读 |
| 回归 | `tests/run.mjs` | 新增“poster / card / meme 三类判定”测试；原有测试全部通过，7/7 回放仍被抓到，8 个旧项目 reads 0 误报 |

## 4. 三个原型的实测

输入由 `scripts/dev/make-probe-inputs.py` 合成，只用 matplotlib 与 PIL：一张 3 栏英文 poster（PDF），一张中文小红书式富文本卡（1080×1440），一张双字幕 meme（底图是 flood 基线的真实关键帧）。

| 项目 | 输入判定 | 做法 | 时长 / 镜头 | check | reads | selftest | 成片文字召回 | 渲染 |
|---|---|---|---|---|---|---|---|---|
| `doc-poster` | poster，3 栏，OCR 置信 94 | poster 本身当布景，相机按阅读顺序巡游；方法框和柱状图重建为可动画对象（数字从 0 计数上涨，“ours”把 Clawd 托起） | 14 s / 4 | 0 / 0 / 1 info | 0 | 通过 | **12/12** | brush 0.5，约 2.6 s/帧 |
| `doc-card` | card，9 行全识别，置信 89 | 卡片按原位置重新排版成活文字；每条技巧一个节拍：先打字，再由 Clawd 表演（计时器、气泡被戳破、两格切点对比），最后落 quote | 14 s / 4 | 0 / 0 / 1 info | 0（修复 1 处 R6 后） | 通过 | **9/9** | brush 0.5，约 2.6 s/帧 |
| `doc-meme` | meme，抽出 2 条字幕 | 沿用 meme 自身的“铺垫 → 转折”两拍：先特写平静的天空配字幕 1，再拉远揭示洪水，字幕 2 砸下；Clawd 是接需求的人，最后孤零零漂在水里 | 10 s / 3 | 0 / 0 / 0 | 0 | 通过 | 3/4（漏掉的 1 条人眼清晰可读，Tesseract 漏检） | brush 0.5，约 3.3 s/帧 |

核验过程中发现并修复的问题：

- **工具层**：
  - tesseract 4 的分辨率警告会混进 TSV，导致解析失败；
  - 自定义 tessdata 缺少 configs 目录，TSV 输出为空；
  - chi_sim+eng 吞掉英文空格；
  - meme 字幕在页面 OCR 下几乎读不出（置信 33），改为字幕层单独处理；
  - poster 的白字标题带被误判为 meme 字幕；
  - 召回工具的描边掩膜在视频压缩后失效。
- **场景层**：
  - 一处解构写法错误产生 NaN 坐标，p5.brush 报 OffscreenCanvas 错误，二分定位后修复；
  - Clawd 遮住了标题和切点示例；
  - 平移时露出了 poster 边缘；
  - meme 原图自带的烧录字幕带（来自基线视频）露出，用海面盖住；
  - CJK 字体把英文撇号排成全角。

## 5. 结论与边界

**能做的：**

- poster、富文本卡、meme 这三类单页文档输入，都能走通“解析 → 分镜 → 代码 → 核验 → 渲染”；
- 原文文字在成片中可读（OCR 召回 24/25，漏掉的 1 条人眼可读）；
- 成片保持确定性和可编辑性（改一个数字就重出一个镜头）。

**还不能保证的：**

1. **真实输入的质量。**
   - 拍照或低清 meme、手写体和艺术字会显著拉低 OCR，必须人工核对 brief（`brief.md` 已注明“OCR is a draft”）；
   - 多页论文需要先压缩成 poster 级别的结构，这一步本项目没做，可以接 Paper2Poster 类的上游。
2. **图表语义。** 柱状图数值靠 PDF 内嵌文字和颜色探测得到，再手工填进场景；任意图表的自动重建（坐标轴、图例、数据点）没做。
3. **meme 的笑点。** 版面和字幕能自动拿到，但“铺垫 → 转折”的笑点结构要靠写分镜的人或模型去理解。这是创作问题，工具解决不了。
4. **去字修补。** 被字幕盖住的区域靠修补“猜”出来，平涂和纹理上没问题，有细节的地方会糊。
5. **字体与确定性。** 同一台机器上逐字节一致；Mac（PingFang）和 Linux（Noto）之间字形不同。需要跨机器一致时，把 CJK 子集字体打包进仓库。

**下一步建议**（按投入产出排序）：

- 把 `text-recall` 接入 `c2v` 命令与 MCP，成为文档类输入的默认检查（R7：原文可读性）；
- `textBlock` 支持读取 OCR 框，自动对位原文位置；
- 图表的半自动重建：从 PDF 矢量层读出柱子和刻度；
- 找 3–5 个真实 poster 和 meme 做盲测。

## 6. 复现

```bash
python3 scripts/dev/make-probe-inputs.py projects/probe-img/input          # 合成三类输入（需要 CJK 字体）
node bin/c2v.mjs new doc-poster --from=projects/probe-img/input/poster.pdf  # ingest：版面、文字、类型 → input/brief.md
node bin/c2v.mjs check doc-poster && node bin/c2v.mjs reads doc-poster && node bin/c2v.mjs selftest doc-poster
node bin/c2v.mjs render doc-poster --workers=4
python3 scripts/dev/text-recall.py projects/doc-poster/out/video.mp4 projects/doc-poster/input/text-checks.json
```

依赖：tesseract（中文需 `tesseract-ocr-chi-sim`）、poppler-utils（pdftoppm / pdftotext）、python3 + opencv。

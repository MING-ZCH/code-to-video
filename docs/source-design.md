> 转存自飞书 wiki W4w3wM0CsiG1MYkXaGScexv2nSd（2026-10-14 抓取，SSR block_map 解析，197 块全量，has_more=False）。视频附件只保留文件名占位。

# Code-to-Video：纯代码生成视频
项目主要负责人
- 参考：PDoomVideo（I'm Upping My P(doom)） 与 ClaudeAnimationBase——均由 Claude Code 全程生成的 p5.js 手绘水彩动画仓库（后者是前者的可复用 starter kit），本项目拆解与复用对象

## 项目主要目标与定位
本项目现阶段的主要 Goal：不采用任何视频生成模型，由编码模型（如 Claude Opus 5.5 + Claude Code）直接编写可执行绘制代码来生成动画视频，并以 PDoomVideo、ClaudeAnimationBase 与「瘫坐长椅原子弹爆炸」动画为实验与验证案例，自我迭代 RSI 持续优化代码驱动视频绘制的管线、规则文档、构建脚本和视觉核验流程，形成可复用的通用能力。 每个案例的分镜、角色表演、节奏或运镜问题，都应尽可能转化为能服务其他输入的能力改进，并用实际生成结果验证。

主要使用方式：不调用视频生成模型（扩散模型/视频生成 API），由模型直接编写绘制代码（p5.js/p5.brush、shader 等），代码逐帧确定性渲染为成片；输入可以是歌词/剧本/论文（文本）、梗图/关键图（图像）和视频片段（视频）。 项目的长期使用重心是「代码即媒介」：画面（及可选声音）全部由代码生成，可复现、可审计、可局部修改。当前 PDoomVideo 等案例提供可观察的分镜、动作、节奏与逐帧参考，帮助发现和修正通用能力缺口。

场景：手绘水彩、shader 特效等多风格动画；音乐视频、叙事动画、梗图改编、产品演示动画及动态内容创作最能从中获益。这些任务依赖于分镜调度（blocking）、节奏控制（timing）与代码绘制能力，而不仅限于外观表现。

## 产出：纯代码生成管线与可复用能力

对标产物：PDoomVideo 的 studio.html + p5.brush 绘制管线与 render.mjs 渲染管线 及 ClaudeAnimationBase 的 ANIMATION_GUIDE + 角色引擎 starter kit。借鉴其「代码即画面」的确定性生成方式、逐镜头分镜与并行 agent 协作范式，在本项目沉淀通用的纯代码生成动画能力（全程不依赖任何视频生成模型）。
1. 可复用绘制引擎与规则文档。 对标 ClaudeAnimationBase：ANIMATION_GUIDE（三目标 Handmade/Alive/One piece、规则集、动画原则、工作流）+ 引擎代码（帧纯函数、paint 绘制 API、角色/情绪/视角/道具/转场系统、时序与运动 helper），从结构化需求（剧本/分镜/歌词/梗图）生成可运行场景代码，供执行模型稳定调用。
1. 对应的 CLI/脚本入口。 通过输入文件和显式参数调用相同构建、渲染与核验实现，便于批量运行与复现；命令名称与安装方式以最终实现为准。
1. 可复用绘制 skills。 组织 输入解析 → 分镜设计（STORYBOARD）→ 场景实现 → contact sheet 视觉核验 → 成片核验 → 修正与交付，附可运行示例、失败处理和跨输入验证证据。
1. 成片与对比交付包。 输出可编辑场景源码、抽帧证据（contact sheet/strip/crop）、成片 MP4、ANIMATION_GUIDE/STORYBOARD 式文档、核验记录和 HTML；用复刻实验验证能力，再通过真实输入测试复用性。
1. 渲染管线。 基于 render.mjs 的 headless Chrome + ffmpeg 管线：contact sheet/strip/crop 批量抽帧、stills、clip、断点续渲与编码，支撑多 worker 并行与逐帧视觉核验。
1. 泛化性。面向视频生成模型能力边界逼近。

通用绘制闭环：
歌词/剧本/梗图 → 分镜（STORYBOARD）→ 场景代码实现 → contact sheet 视觉核验 → 节奏/运镜/转场修正 → 渲染成片 → HTML 对比交付

确定性渲染机制（借鉴 PDoomVideo 与 ClaudeAnimationBase）：
- 确定性渲染：帧并行、乱序渲染 ⇒ 每个镜头必须是时间 t 的纯函数：无跨帧状态、无 Math.random()；用 hash(i) 做稳定随机、jit(a) 做手绘抖动（每 1/12 秒重播种，产生手绘“沸腾”线条）。
- 严格文件边界：每个章节只改自己的文件；共享文件只读，发现 bug 只上报不改——支撑并行 agent 互不冲突。
- 故事板规则：每镜头必须有事件发生、文字极简（信息靠画面与表演）、短镜头 1.4–4 s、大剪影、动作压拍（88 BPM，拍=0.682 s）。
- 视觉核验：contact sheet 批量抽帧检查（镜头首尾帧 + 中间帧、hit 附近逐 0.1 s、章节转场、卡拉OK遮挡），迭代到可读、生动、符合人设。
- 渲染预算：≤1.5–2.5 s/帧（ClaudeAnimationBase 目标 ≤1.5 s/帧）；fill 形状数百可行、数千不可行，优先少而大的图形。

## case 验证展示：
参考 PDoomVideo 的两代迭代与九章节分镜结构。
- 参考 case：PDoomVideo 第一代（legacy/）——Claude Opus 5.5 (Medium)，产物 flash-version.html / test-scenes.js，用于能力初探。
- 参考 case：PDoomVideo 第二代——Claude Opus 5.5，由 STORYBOARD.md（逐镜头分镜）+ ANIMATION_GUIDE.md（风格/代码契约）驱动并行 subagent 生成九章节，最终渲染 156.6 s 成片。

### 原视频展示
PDoomVideo 原片：Claude Pop - I'm Upping My P(Doom)（YouTube 原片，156.6 s）
完整原片视频（156.6 s，小红书搬运「手绘风MV - P(DOOM) by Opus5.5 震惊瘫坐」）：
[FILE PDoomVideo原片.mp4 video/mp4 1280x720 size=26220254]
[FILE video_使用 Claude opus 5..._0.mp4 video/mp4 1280x720 size=13849599]
「瘫坐长椅原子弹爆炸」动画（小红书，42 s）：Opus 5.5 把网络梗图做成动画，声音、画面全部代码生成，每个风格一个 shader；出处：小红书原帖。
[FILE 瘫坐长椅原子弹爆炸.mp4 video/mp4 0x0 size=11706364]

### 九章节分镜（156.6 s）
[TABLE keys=['type', 'parent_id', 'comments', 'revisions', 'locked', 'hidden', 'author', 'ai_extra', 'columns_id', 'rows_id', 'column_set', 'cell_set', 'header_row']]
| 章节 | 时间 | 场景与看点 |
| 幕启 | 0–1.5 | 红色幕布拉开，标题上幕，Clawd 从活板门冒出挥手 |
| 实验室 | 1.5–23 | 研究者与屏幕中的 Clawd：训练 loss 暴跌、角色反转、追逐戏 |
| 合唱 1：P(doom) 秀 | 23–38.5 | 舞台、打气筒与 P(doom) 仪表、火箭 FOOM、中国房间、蘑菇、修格斯、死神之眼 |
| 起飞 | 38.5–59 | 稳定训练跑步机 → 奇点黑洞 → 火箭滑板加速 → 原子重组 → Sydney 心形房间 |
| 合唱 2：更大的秀 | 59–73 | 竞技场、巴兹利斯克 BOOM、NVDA 登月、欧米加点、E30 FLOPs、保险库 |
| 过时 | 73–95.4 | MLP 神经网络舞蹈课、冯·诺依曼博物馆、左转漂移、睡着的云朵守卫、Gato 悬崖 |
| 合唱 3：回形针 | 95.4–109.4 | 回形针洪水、Killswitch 海滩、回形针地球、引线爆炸、爵士俱乐部 |
| 尺度 | 109.4–123.5 | Transformer 叠罗汉、服从训练、龙猫、安全栅栏、十万 GPU 数据中心、RLHF 失控 |
| 合唱 4：红色警报 | 123.5–137.4 | 红色警报、Loom 命运织机、掩码预训练闪回、递归自我升级、Ilya 之门与“一切皆为表演”反转 |
| 谢幕 | 140.5–156.6 | 全员谢幕、幕落，标题与“created by Claude Opus 5.5”收尾 |

## 方法总结：跨案例共性拆解
以 PDoomVideo 与「瘫坐长椅原子弹爆炸」动画两个案例横向拆解，并经 ClaudeAnimationBase（可复用基底）验证，提炼可复用方法：
[TABLE keys=['type', 'parent_id', 'comments', 'revisions', 'locked', 'hidden', 'author', 'ai_extra', 'columns_id', 'rows_id', 'column_set', 'cell_set', 'header_row']]
| 维度 | PDoomVideo | 瘫坐长椅原子弹爆炸 |
| 输入 | 歌词/音乐（AI 主题 MV，156.6 s） | 网络梗图（meme：瘫坐长椅原子弹爆炸） |
| 生成方式 | Claude Opus 5.5 + Claude Code 全自动 | Claude Opus 5.5 + Claude Code 全自动 |
| 画面实现 | p5.js + p5.brush 手绘水彩逐帧绘制 | 每风格一个 shader（洞穴壁画→源代码等） |
| 声音 | 外部歌曲 + 歌词节奏 | 声音代码生成 |
| 渲染 | headless Chrome 逐帧 + ffmpeg | 程序化渲染（约 16 小时） |
| 结构 | 九章节分镜、短镜头、动作压拍 | 同一意象的多风格/媒介段落 |
| 核验 | contact sheet 抽帧逐帧核验 | 逐风格画面核验 |
共性方法提炼：
1. 代码即媒介：画面（及可选声音）全部由代码生成，确定性可复现、可审计、可局部修改；
1. 输入类型扩展：驱动源可以是歌词/剧本（文本）或梗图/关键图（图像），先解析为分镜与视觉设计；
1. 风格抽象为可复用绘制能力：水彩（p5.brush）与 shader 都可封装为参数化绘制 skill，支持风格迁移与跨输入复用；
1. 分镜与节奏设计：短镜头（1.4–4 s）、每镜头必有事件、动作压拍、转场由动作承接；
1. 确定性渲染与核验闭环：纯函数渲染 + contact sheet 抽帧核验 + 迭代修正；
1. 成本与并发控制：逐帧渲染耗时数小时至十几小时，需渲染预算（≤2.5 s/帧）、多 worker 并行与断点续渲。

## 代码与方法分析：ClaudeAnimationBase（PDoomVideo 的可复用基底）
ClaudeAnimationBase 是 PDoomVideo 作者基于原 MV 代码与「模型做得好与不好」的分析开源的 starter kit（p5.js + p5.brush + Claude Opus 5.5）。它不是新作品，而是把 PDoomVideo 的经验固化为「规则文档 + 引擎代码 + 角色系统」的可复用基底：模型先写 STORYBOARD，再逐镜头构建、渲染 contact sheet 自查自己的工作，最后产出 out/video.mp4。全部测试视频用 Opus 5.5（xhigh reasoning）在 Claude Code 生成；reasoning 级别越高，场景越繁复、细节越多。

### 三个目标（一切规则服务于三目标）
1. Handmade（手作感）：看起来像人一帧帧手绘——笔触、沸腾墨线、扁平 2D、无文字。
1. Alive（生命力）：永远有东西在动、有事件在发生；脸是「表演」不是「跳变」，角色足够大才有情绪。
1. One piece（整体成片）：是一部短片而非片段堆砌——先规划再画，场景之间互相衔接。
其下是底线：观众必须能跟上；Timing（规则 4）是模型最容易搞错的一条。

### 七条规则（摘译）
1. 媒介是实的：一切用 p5.brush 的 paint()/inkLine() 绘制——笔触、扁平 2D、沸腾（boil）线条；禁用 3D 投影、rotateY 与纯 p5 形状；发光用 glow()（颜料混合：黄+蓝会变绿）。
1. 无文字：用画面与表演表达；Clawd 的反应是画的记号（!、?、zzz、汗滴、爱心、灯泡），绝不写字；「举着写有文字的牌子」是经典失败。
1. 每场景必须有事件：首帧到尾帧必须有变化；一次一个焦点动作；先因后果、给反应留时间；埋下的伏笔要 payoff。
1. 时序要建模观众：列出每镜头「观众需要读懂什么」（reads）并为每条计时；一次只给一个 read；快动作、慢意义；引导视线；镜头长度由 reads 决定，最后镜头收尾也要留时间。
1. Alive：无静止帧；情绪切换走 emotions()（预判+眯眼+take+过冲），绝不手工换眼睛/嘴；中景 u=20–28、特写 40–70；一切按拍点动（bpm 驱动 pulse/beatN）。
1. 转场 always：每个接缝都有转场（brush wipe、iris、whip pan、match cut、cut on action、相机贯穿）；镜头内的变化（情绪、转身）同样要过渡。
1. One piece：先写分镜再写代码。STORYBOARD 含 logline/world/motif/arc/shots+reads；一世界一主线、情绪弧贯穿全片、结尾呼应开头、银幕方向与运动连贯。

### 动画原则（对抗「代码机械感」）
代码让所有部位同时、同曲线、同幅度运动，所以机械。经典原则的落法：anticipation 预备动作（跳前下蹲）、squash & stretch 压扁拉伸保体积、slow in/out 缓入缓出（ease 曲线）、weight 重量感（重物启动慢、落地少弹）、arcs 弧线运动（arcPt）、overlapping action & follow-through 依次带动与跟随（spring/ring 收尾）、avoid twinning 避免孪生（双臂不同步、人群错相）、exaggeration 夸张（短片中「含蓄=看不见」）、strong key poses 强关键姿势（单帧也要可读）、show the thought 展示思考（眼睛先动：注意到→思考→行动）、secondary action 次级动作（帽子晃动等，不抢主戏）。

### 工作流与引擎
工作流四步：① STORYBOARD 先写分镜（格式含 logline/world/motif/arc/shots+reads，写完后逐条对照规则检查）→ ② Build 逐镜头构建（config.js 设 duration/bpm；新场景 IIFE + shots([...])；先摆关键姿势、check stills，再加运动）→ ③ Look at it 渲染自查（sheet 看整体形状、strip 看逐帧运动、crop 看脸部与接触细节；检查 read/timing/motion/boil/contacts/transitions/rules/colour 八项）→ ④ Render（--clip 直出 MP4 / --frames 并行续渲 / --encode 编码）。
引擎要点：帧是时间的纯函数（并行乱序渲染、无跨帧状态、无 Math.random()）；boilSeed(key) 为每个元素独立沸腾种子，避免一个动元素带偏后续全部元素；Clawd 角色系统：31 种情绪（feel/emotions）、5 个关键视角转面（front→q→side→qback→back）、帽子与道具钩子（draw/armL/armR）、18 种舞蹈（move/dancer）、emote 符号；音乐可选（bpm/offset 锁拍、pulse() 压拍、歌词不上屏）。common failures 清单即「AI 味」自查表：文字、静止、匀速、事件叠压、角色太小、脸跳变、机械运动、孪生同步、硬切、3D 旋转、塑料形状、脏发光、道具不接触手、每场景不同世界。

### 对本项目的方法增益
- 经验规则化：把模型做对/做错的经验写成 ANIMATION_GUIDE 契约文档（先于代码），让每次生成都站在同一方法论上；
- 核验证据化：sheet/strip/crop 三级抽帧 + 八项检查清单，用看得见的证据驱动迭代，而非凭感觉；
- 角色系统化：情绪/视角/道具/舞蹈做成可组合 API，新输入只需组合与调度，不必从零重画；
- 成本预算化：≤1.5 s/帧 预算；水彩 fill 是主要开销（无独显时建议模型换成其他媒介）；渲染日志打印 ms/帧；
- 与 PDoomVideo 的关系：PDoomVideo 是一个作品，ClaudeAnimationBase 是一套方法——本项目两者都要：先拆作品学表达，再建方法做复用。
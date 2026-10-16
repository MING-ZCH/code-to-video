# Code-to-Video

纯代码生成视频：不调用任何视频/图像生成模型，由编码模型写可执行绘制代码（p5.js + p5.brush 水彩、shader 风格化与特效、纯 JS 程序化声音）。每帧都是时间 t 的纯函数，在 headless Chrome 中逐帧确定性渲染，再由 ffmpeg 编码成片。

*Pure-code video generation: no video/image-generation models. A coding model writes drawing code; every frame is a pure function of t, rendered deterministically in headless Chrome and encoded with ffmpeg.*

- **交付总览**：[deliver/index.html](deliver/index.html)，含 9 部作品、before/after 和泛化矩阵。页面里的视频链接指向 `projects/*/out/video.mp4`，需先从 Release 下载成片（见下文）。
- **计划与过程**：[PLAN.md](PLAN.md)（P0–P5）、[docs/RSI-round-1.md](docs/RSI-round-1.md)（自我迭代第 1 轮）、[research_log.md](research_log.md)（实验记录），设计来源见 [docs/source-design.md](docs/source-design.md)。
- **Skills**：`skills/`（源文件）、`dist/*.skill`（打包）；**MCP**：`mcp/c2v-mcp.mjs`。

## 环境

- Node ≥ 20，ffmpeg，Chrome 或 Chromium（自动查找；也可用 `--chrome=<path>` 或环境变量 `CHROME_PATH` 指定）。
- Mac 或带 GPU 的机器用于终渲。无 GPU 的 Linux 先运行一次 `scripts/vm-setup.sh`，之后用 `scripts/vm-c2v.sh` / `scripts/vm-render.sh`（SwiftShader 软件 WebGL，水彩约数秒/帧）。

## 快速开始

```bash
npm install
node bin/c2v.mjs new my-film --from=song.mp3          # 或 lyrics.lrc / script.md / image.png / clip.mp4：解析成 input/brief.md
# 写 projects/my-film/STORYBOARD.md，再写 scenes/*.js；Chrome 打开 studio.html?project=my-film 拖时间轴
node bin/c2v.mjs check my-film                         # 规则机检（确定性、媒介、镜头时长、每个接缝的转场、分镜）
node bin/c2v.mjs reads my-film                         # 读点机检：R1 过小 · R2 出画 · R3 跨切点连续性 · R4 跳切 · R6 被角色遮挡
node bin/c2v.mjs cost my-film --scale=.5               # 每镜头渲染耗时，R5 慢镜头；--skip=a,b 量化部件开销
node bin/c2v.mjs review my-film --medium=flat          # check + 每镜头首/中/尾 sheet + 接缝 strip + REVIEW.md 清单
node bin/c2v.mjs selftest my-film                      # 确定性：镜头中点 3 路逐字节比对
node bin/c2v.mjs render my-film --workers=4            # 终渲：并行可续渲帧 → 程序化声音 → 编码 → 指标
node bin/c2v.mjs report my-film                        # out/report.html：成片、检查、指标、分镜、核验图、渲染日志
node bin/c2v.mjs metrics some.mp4                      # 任意视频的镜头/运动/字幕指标（与 docs/baselines.md 同口径）
node bin/c2v.mjs deliver                               # deliver/index.html：全部案例、before/after、泛化矩阵
```

底层渲染命令也可以直接用：`node render.mjs --project=<name> --sheet=… | --strip=… | --selftest=… | --frames | --encode | --synth`，加 `--scale=0.5` 出预览，或加 `--medium=flat` 快速打样。在 Chrome 打开 `studio.html?project=demo` 可以拖动时间轴预览，加 `&loop=emotions` / `&loop=views` 查看角色模型表。

## MCP

把 Code-to-Video 工具链暴露为 MCP 工具（stdio，无 SDK 依赖），共 11 个：c2v_projects / guide / new / check / reads / cost / sheet / strip / selftest / metrics / render。其中 `c2v_sheet` 和 `c2v_strip` 直接返回图片。

```json
"mcpServers": { "c2v": { "command": "node", "args": ["<repo>/mcp/c2v-mcp.mjs"] } }
```

无 GPU 时加环境变量 `C2V_SOFT_GL=1`。

## 测试

```bash
npm test                       # 快速：语法、解析器、音频、指标、fixtures（不启动 Chrome）
node tests/run.mjs [--soft-gl] # 完整：再加 check 违例 fixture、glow 确定性、语法错误 fixture
node tests/replay.mjs [--soft-gl]   # 失败回放：7 个历史问题注入已完成项目的副本，必须全部被 reads 捕获
C2V_SOFT_GL=1 node tests/mcp-smoke.mjs
```

部分用例依赖仓库外的文件（`~/tools/refs/PDoomVideo/assets/pdoom.mp3`、根目录基线 MP4），缺失时这些用例显示 SKIP，不会判为失败。

## Release 资产

成片、源音频等媒体文件不入 git（决定 ④），作为 GitHub Release 附件发布。在仓库根目录执行 `bash scripts/release-assets.sh <tag>`，会把这些文件收集到 `release/<tag>/`。

| 文件 | 内容 |
|---|---|
| `c2v-<project>.mp4` | 9 部作品的成片。除 bench 为 scale 1 外，均为 VM brush scale 0.5 预览；scale 1 终渲用 `bash scripts/mac-final.sh` |
| `c2v-input-audio.zip` | night / pdoom-c08 / upgrade 的源音频，在仓库根目录解压即可恢复 `projects/*/assets/audio.wav` |
| `c2v-skills.zip` | `dist/*.skill` |
| `SHA256SUMS` | 校验和 |

要让交付页里的视频链接可用，把 `c2v-<project>.mp4` 放回 `projects/<project>/out/video.mp4`：

```bash
gh release download v0.1.0 -D release/v0.1.0
for f in release/v0.1.0/c2v-*.mp4; do p=$(basename "$f" .mp4); p=${p#c2v-}; mkdir -p projects/$p/out; cp "$f" projects/$p/out/video.mp4; done
unzip -o release/v0.1.0/c2v-input-audio.zip
```

## 结构

| 路径 | 内容 |
|---|---|
| `engine/` | 共享引擎：core / clawd / timeline / sheets / shaders（stylize·shade）/ overlay（歌词条）/ audio（程序化声音）。场景作者只读 |
| `projects/<name>/` | 每个输入一个项目：`project.js`（PROJECT + 场景列表）、`scenes/`、`STORYBOARD.md`、`input/`、`assets/`、`out/`（不入 git） |
| `studio.html` | 渲染页与预览器，`?project=<name>` 选择项目 |
| `render.mjs` | sheet / strip / crop / stills / selftest / synth / clip / frames / encode，每次运行追加 `out/render-log.jsonl` |
| `bin/c2v.mjs` + `lib/` | CLI：new / ingest / check / reads / cost / sheet / seams / review / selftest / render / metrics / report / deliver / audio |
| `mcp/` | MCP 服务 |
| `tests/` | 回归测试、失败回放、MCP 冒烟、规则违例 fixture、样例输入 |
| `ANIMATION_GUIDE.md` | 规则、工作流与 API：上游原文 + 项目 Part 2（媒介、声音、歌词条、读点声明、并行章节、预算、失败条目） |
| `scripts/` | VM 安装与渲染包装、Mac 终渲 `mac-final.sh`、Release 资产 `release-assets.sh`、开发脚本 `dev/` |
| `docs/` | 设计来源、基线分析、案例报告、RSI 第 1 轮、模型表 |
| `skills/`、`dist/` | 6 个 c2v skills 源文件与 `.skill` 包 |
| `reports/`、`deliver/` | 各阶段核验证据；交付页 |

## 许可

MIT，见 [LICENSE](LICENSE)。`engine/` 等部分派生自 ClaudeAnimationBase（MIT，见 [LICENSE-ClaudeAnimationBase](LICENSE-ClaudeAnimationBase)），致谢与第三方依赖见 [NOTICE.md](NOTICE.md)。PDoomVideo 仅作参照，未复制其章节代码。

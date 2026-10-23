# SentenceVocab

句子式英语学习应用。以**句子**（而非单词）为基本单元过卡，生词在句中内联标注 IPA 音标和中文释义，适合从剧集、歌词、文章等真实语料里积累词汇。另支持**场景语库**（一张生活场景图对应多个物品，点选作答），用于积累日常生活物品词汇。

纯静态实现：无框架、无后端、无数据库，部署在 GitHub Pages 上，手机浏览器随时可用，进度通过 GitHub Gist 免费跨设备同步。

## 特性一览

- **一句话一张卡**：卡片是完整句子，附整句翻译与生词详情（词 / 音标 / 释义）
- **会 / 不会二分**：点「会」永久移出队列；点「不会」揭示答案后插回队列 10~20 位之后，直到你点会为止
- **多语库管理**：主页按语库收纳（剧集台词、雅思、歌词等），显示各自进度
- **反馈闭环**：学习时若发现生词标注有误，可进入反馈模式修正，之后一键把反馈应用回源文件
- **跨设备同步**：localStorage 主存储 + Gist 云备份，支持防旧进度误覆盖
- **零运行时依赖**：前端无任何 npm 包；测试工具链也是可拆卸的

## 快速开始

### 本地预览

```bash
python -m http.server 8765
# 打开 http://localhost:8765
```

### 部署到 GitHub Pages

1. 创建 GitHub 仓库，push 全部文件到 main 分支
2. 仓库 Settings → Pages → Source 选 main → Save
3. 访问 `https://<username>.github.io/<repo>/`，手机打开即可学习

## 目录结构

```
yasi/
├── index.html                  # 入口
├── css/style.css               # 样式（移动优先）
├── js/                         # 前端模块（全局对象方式，无构建）
│   ├── app.js                 # 主控制器：路由（主页/学习）、学习队列、反馈逻辑
│   ├── srs.js                 # 学习队列管理（会/不会二分 + 随机洗牌）
│   ├── dictionary.js          # 语库数据加载（index.json + 各语库 json）
│   ├── storage.js             # localStorage 封装（扁平键 + 白名单导出）
│   ├── ui.js                  # UI 渲染（卡片、生词详情、反馈编辑器）
│   └── gist.js                # GitHub Gist 云同步（push/pull/防覆盖）
├── scripts/                    # Node 工具脚本（运行环境：Node 18+）
│   ├── build.js               # 构建：data/txt/*.txt + data/scenes/*.json → data/json/*.json + index.json
│   ├── render-pins.js         # 场景坐标审查：把 draft 坐标画成 pin 合成到原图（Playwright 截图）
│   ├── fetch-discography.js   # 从 MusicBrainz 拉取歌手全部专辑/EP 曲目单
│   ├── fetch-azlyrics.js      # 下载歌词原文（AZLyrics + lyrics.ovh 降级，本地缓存）
│   ├── merge-sentences.js     # 合并多份例句文件，去重保序
│   ├── gen-audio.js           # 为语库句子生成朗读音频（Kokoro-82M，构建期）
│   ├── fetch-feedback.js      # 从 Gist 拉取用户反馈 → data/feedback.json
│   ├── apply-feedback.js      # 把反馈应用回 data/txt/*.txt（重新标注生词）
│   └── clear-gist-overrides.js# 清空 Gist 中已应用的反馈数据
├── data/
│   ├── index.json             # 语库索引（build.js 自动维护，场景库带 type: scene）
│   ├── txt/                   # 输入源：一句一行，生词内联标注（LLM 生成/人工编辑）
│   ├── scenes/                # 场景库源文件（*.json 定稿 / *.draft.json 坐标校对稿）
│   ├── images/                # 场景图（一张图一个场景，jpg/webp）
│   └── json/                  # 构建产物：App 只读这些文件
├── tests/                     # 测试（详见 tests/TESTS.json 汇总）
│   ├── unit/build.test.js     # build.js 解析逻辑单测（node:test，17 例）
│   ├── e2e/*.spec.js          # Playwright 端到端测试（29 例）
│   ├── e2e/static-server.js   # 测试用静态服务器（端口 8766）
│   └── TESTS.json             # 测试汇总：每个用例测了什么 + 环境说明
├── utils/                     # 字幕抓取工具（YouTube 字幕方案记录见 .codebuddy/commands/get-transcript.md）
│   └── annotate.html          # 场景热点校对页（dev 工具，拖拽微调坐标 / 导出正式 JSON）
├── .codebuddy/commands/       # 工作流命令文档（本 README 多处引用）
│   ├── gen-library.md        # 从任意文档生成语库
│   ├── fetch-lyrics.md       # 歌词语库管线
│   ├── apply-feedback.md     # 反馈闭环
│   └── get-transcript.md     # YouTube 字幕（已废弃的命令 + 可用方案记录）
├── playwright.config.js       # E2E 配置（含本地浏览器路径）
├── package.json               # 构建期/测试依赖（@playwright/test、kokoro-js 等），App 运行时零依赖
└── SPEC.md                    # 设计文档
```

## 制作新语库

把任意生词/句子文档交给 LLM，按规范生成 `data/txt/<名>.txt`（一句一行，生词内联标注、附整句翻译），
然后 `node scripts/build.js` 构建、`git push` 部署即可。
想给句子配朗读，再跑 `node scripts/gen-audio.js <语库id>`（Kokoro 合成，输出 `data/audios/<语库id>/<行号>.mp3`，增量生成）。

- 从任意文档生成语库：[.codebuddy/commands/gen-library.md](.codebuddy/commands/gen-library.md)
- 从歌手歌词批量产语库：[.codebuddy/commands/fetch-lyrics.md](.codebuddy/commands/fetch-lyrics.md)

## 学习功能

### 主页

- 语库列表（默认折叠，点击「📚 语库」展开），每项显示 `已会/总数` 和进度条（场景库量词为「张」）
- **单击**选中语库，**双击**直接进入学习
- 底部导航在学习/主页之间切换
- 设置区：听力模式开关（先听后看）、Gist Token 输入、同步到云端 / 从云端拉取

### 学习页

1. 未揭示状态：纯英文句子 + 朗读按钮 🔊 + 两个按钮
   - **会** → 认识，永久移出队列（进度 +1）
   - **不会** → 揭示答案
   - **听力模式**（主页设置开启）：未揭示时不显示句子只出声，进入每张卡自动播放，点 🔊 可重听，点「不会」才显示原文（揭示态与普通模式完全一致）
2. 揭示状态：句子 + 整句翻译 + 生词详情（词 / 音标 / 中文释义）+ 按钮
   - **下一张** → 不认识，当前卡插回队列第 10~20 位，循环出现直到点会
   - **反馈：标注有误？** → 进入反馈模式
3. 随机出题：每次进入语库，队列随机洗牌
4. 学完整个语库后显示完成页，可**重置进度**重新学（有确认弹窗）

### 反馈模式（标注纠错）

- 句中每个词变为可点击：点选/取消生词（多词短语如 `amp up` 整体切换）
- 两个预设问题标签可勾选：单词大小写或标点存在错误 / 缺乏语境难以体现生词意思
- **复原**：清空当前卡的所有人工修改，恢复原始标注
- **完成**：退出反馈模式，修改写入本地（之后可同步到 Gist）

### 场景语库（type: scene，看图点物）

以**一张场景图**为一张卡，**若干张图组成一个词库**（`data/scenes/<词库>.json` 的 `cards[]`，追加新图即扩容）。图上每个物品是一个热点，自主浏览学习，卡内唯一按钮「下一张」= 浏览完毕记「会」出队。

物品热点三种显示状态（`1 原图` / `2 原图+圆圈` / `3 原图+圆圈+英文caption`）：

- **单击**：状态 2↔3 自由切换
- **双击 / 长按**：该物品 → 状态 1（隐藏标记）
- **状态 1 不可单击恢复**，只能用卡内「整体显示」按钮：每次点击把所有物品强制设为同一状态，按 1→2→3→1 循环覆盖
- caption 位置由碰撞避让算法自动排版（右→左→上→下找空位，放不下取重叠最小处），窗口缩放时重排
- 进度/SRS/同步与句子语库完全共用

制作流程（AI 管线 + 校对页）：

1. AI 生成场景图（按物品词表出图，存 `data/images/<场景>/`，裁水印、压 jpg/webp）
2. 看图输出物品百分比坐标初稿 + 音标释义 → `data/scenes/<id>.draft.json`
3. `scripts/render-pins.js` 把坐标合成 pin 图自审修正（`node scripts/render-pins.js data/scenes/<id>.draft.json`）
4. 定稿为 `data/scenes/<id>.json`（含 `id/name/cardCount/cards[].items[{word,phonetic,meaning_cn,x,y}]`）
5. `node scripts/build.js` 会把场景库原样复制进 `data/json/` 并写入 index（`*.draft.json` 不发布）
6. 需要人工微调坐标时用 `utils/annotate.html?draft=data/scenes/<id>.draft.json`（需 http 服务）

物品词表示例：stove 炉灶、kettle 水壶、cutting board 砧板、paper towel 厨房纸巾……

### 反馈闭环工作流

手机上学习时的标注修正，可用脚本应用回 `data/txt/` 源文件并重新部署。
逐步命令与注意事项见 [.codebuddy/commands/apply-feedback.md](.codebuddy/commands/apply-feedback.md)。

## 数据格式

### 规范化 txt（`data/txt/`，一句一行）

`英文句子(生词标注) | 中文整句翻译`，标注语法详见 [.codebuddy/commands/gen-library.md](.codebuddy/commands/gen-library.md)。

### 语库 JSON（`data/json/<名>.json`，build.js 产物）

```json
{
  "version": "1.0",
  "cards": [
    {
      "id": 1,
      "text": "Sit in the vacant rear seat of the car",
      "keyWords": [
        { "word": "vacant", "phonetic": "/ˈveɪkənt/", "meaning_cn": "空的；空闲的" },
        { "word": "rear", "phonetic": "/rɪər/", "meaning_cn": "后部的" }
      ],
      "translation": "坐在汽车空着的后排座位上"
    }
  ],
  "cardCount": 1
}
```

`card.id` 即 txt 中的行号（1 起连续递增），反馈脚本靠它把修正写回对应行。

### 语库索引（`data/index.json`）

```json
{
  "libraries": [
    { "id": "alan-wake-2", "name": "Alan Wake 2", "cardCount": 235 }
  ]
}
```

### localStorage 结构（进度主存储）

所有键带 `sv_` 前缀，多语库数据归入单一总键、按语库 id 分组：

| 键 | 内容 |
|----|------|
| `sv_mastered` | `{ "<libId>": [已会卡片 id 数字数组] }` |
| `sv_stats` | `{ "<libId>": { streak, lastStudyDate, totalStudied, totalReviewed, dailyHistory } }` |
| `sv_overrides` | `{ "<libId>": { "<cardId>": { keyWords?, issues? } } }`（反馈修正） |
| `sv_current_library` | 当前选中的语库 id |
| `sv_updated_at` | 最后学习时间戳（毫秒），同步时判断新旧 |
| `sv_settings` | `{ gistToken, gistId, lastSyncAt }` |

同步上传时 `storage.js` 按白名单导出（以上键），其余键一律不上传；`gistToken` 永远不会写入云端（避免被 GitHub 扫描撤销）。

## 跨设备进度同步

进度默认存浏览器 localStorage（同设备同浏览器永久有效），通过 Gist 可跨设备同步：

1. 打开 https://github.com/settings/tokens 生成 Token，**只勾选 `gist` 权限**
2. App 主页填入 Token，点「同步到云端」（首次自动创建一个私有 Gist 存 `progress.json`）
3. 换设备填同一 Token，点「从云端拉取」

同步语义：

- **push 是整体覆盖**：以本机 localStorage 快照整体替换云端 `progress.json`，不是字段合并
- **防误覆盖**：push 前比较云端与本地的 `sv_updated_at` 时间戳，云端更新时会提示确认；首页也会提示「远程有更新的进度，建议先拉取」
- 时间戳由每次点「会/不会」时刷新，比的是「谁最后学的」，非「谁学得多」

不配 Token 也能正常用，只是进度不跨设备。

## 测试

```bash
npm install        # 安装 @playwright/test（仅测试需要，App 运行零依赖）
npm test           # 单测 + E2E 全量
npm run test:unit  # 仅单测（node:test 内置运行器，~0.1s）
npm run test:e2e   # 仅 E2E（Playwright，~5s）
```

| 层 | 文件 | 内容 |
|----|------|------|
| 单元测试 | `tests/unit/build.test.js` | build.js 解析逻辑：标注提取（单词+词组 N; 前缀）、翻译分割、id 递增等 17 例 |
| E2E | `tests/e2e/home.spec.js` | 主页：语库列表、进度、选中交互（5 例） |
| E2E | `tests/e2e/nav.spec.js` | 底部导航切换、未选语库空状态（2 例） |
| E2E | `tests/e2e/study.spec.js` | 学习核心：会/不会、mastered 持久化、刷新保留（5 例） |
| E2E | `tests/e2e/study-features.spec.js` | 语库区折叠、翻译与生词详情渲染、插队 10~20 位（3 例） |
| E2E | `tests/e2e/feedback-reset.spec.js` | 反馈复原（词组/单词）、问题标签 toggle（3 例） |
| E2E | `tests/e2e/scene.spec.js` | 场景语库：量词「张」、点选作答/误点计数、全对记会、看答案与下一张（4 例） |
| E2E | `tests/e2e/completion.spec.js` | 学完状态与重置进度的 confirm 弹窗（1 例） |

每个用例的详细说明与维护约定见 **`tests/TESTS.json`**（新增/修改测试时请同步更新该文件）。

### 浏览器环境说明

`playwright.config.js` 将 `PLAYWRIGHT_BROWSERS_PATH` 指向本地浏览器目录 `E:\pw-browsers`（chromium-1243），无需执行 `npx playwright install`。

**版本匹配约束**：`@playwright/test` 版本必须与本地浏览器 revision 匹配——`1.63.0 ↔ chromium-1243`（1.64.x 需要 1248，会失败）。升级 playwright 时需同步更新本地浏览器目录，或改用 `npx playwright install` 并移除该环境变量。`package-lock.json` 锁定了 1.63.0，请保留在仓库中。

调试时可用 `npx playwright test --headed`（弹出真实浏览器窗口）或 `--ui`（单步执行 + 每步快照）。

## 技术栈与设计决策

- **前端**：纯 HTML/CSS/JS（ES6+），全局对象模块，`<script>` 直载，零运行时依赖、零构建步骤，GitHub Pages 原生托管
- **数据管线**：LLM 负责智能工作（造句、生词识别、音标释义、翻译），`build.js` 负责机械工作（正则解析、去重、编号），两者通过人类可读的 `data/txt/` 中间文件衔接——txt 可人工审核和修改
- **学习机制**：会/不会二分 + 掌握即移除（mastered 数组），比完整 SM-2 简单且匹配「过句子」的用法；「不会」的卡片插回 10~20 位之后形成短期重复
- **存储**：localStorage 主存储（离线可用），Gist 做云端备份；同步是覆盖语义 + 时间戳防误覆盖，不做字段级合并
- **音标与释义**：全部预填在 JSON 中（LLM 生成），App 运行时不调任何外部 API，完全离线可用

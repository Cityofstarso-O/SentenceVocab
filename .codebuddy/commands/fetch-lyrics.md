# fetch-lyrics [歌手名]

为指定歌手批量抓取歌词到本地 txt，并挑出生词/短语所在句子，生成「一句一行」的例句文件。

**不要用 `web_fetch` 逐首抓歌词**：它每次都要把整页 HTML 交给模型推理，一首歌十几秒，几十首要一小时以上。
统一走脚本 `scripts/fetch-azlyrics.js`：直接下载原始响应 + 本地正则解析，53 首约 2 分钟。

## 流程

### 1. 建立歌单（临时文件，放 tmp 下，不要放 data/）

歌单、原始响应缓存、逐首歌词都属于过程产物，统一放在 `tmp/`：

- 歌单：`tmp/lyrics-lists/<歌手-slug>.json`（已有：`zach-bryan.json`、`lorde.json`；The Weeknd 的清单内置在脚本里）
- 原始响应缓存：`tmp/html/`
- 逐首歌词：`tmp/artists/<歌手-slug>/`

```json
[
  { "file": "royals", "title": "Royals", "album": "Pure Heroine (2013)" }
]
```

字段说明：

- `file`：输出文件名（小写连字符）
- `title`：歌名（用于 lyrics.ovh 查询，必须和官方写法一致）
- `album`：写入文件头的专辑信息
- `artist`：AZLyrics 歌手 slug（合作曲目才需要，默认由 `--artist` 推导）
- `ovhArtist` / `ovhTitle`：lyrics.ovh 查询用的歌手/歌名（合作曲目才需要）

### 1.5 要「全部专辑的全部歌」时：用 MusicBrainz 拉权威曲目表

不要凭记忆手敲曲目表。用 `scripts/fetch-discography.js` 拉取并直接产出歌单 JSON：

```bash
node scripts/fetch-discography.js --artist "Lorde"     --out tmp/lyrics-lists/lorde.json
node scripts/fetch-discography.js --artist "Zach Bryan" --out tmp/lyrics-lists/zach-bryan.json
```

- 参数：`--types`（默认 `Album,EP`，需要的话加 `Single,Live`）、`--skip`（跳过标题含指定词的曲目）、`--mbid`（直接给 MusicBrainz 歌手 ID）
- 已按「最多 1 req/s」限速并带退避重试（MusicBrainz 会返回 503/429）
- 产出按发行时间排序、跨专辑去重，可直接喂给 `fetch-azlyrics.js`

### 2. 抓取

```bash
node scripts/fetch-azlyrics.js --list tmp/lyrics-lists/lorde.json --artist "Lorde" --out tmp/artists/lorde
```

歌单很大时（上百首）加 `--source ovh` 跳过 AZLyrics（该站反爬，必然失败），可省掉一半请求。

常用参数：

| 参数 | 说明 |
|---|---|
| `--list <file>` | 歌单 JSON（不给则用脚本内置的 The Weeknd 清单） |
| `--artist <name>` | 歌单里未单独指定时的歌手名 |
| `--out <dir>` | 输出目录，默认 `tmp/auto`（不会覆盖已有文件） |
| `<关键字>` | 只跑歌名/文件名包含关键字的歌曲，便于调试 |
| `--force` | 忽略缓存重新下载 |
| `--source azlyrics\|ovh\|auto` | 指定数据源，默认 auto（AZLyrics 失败自动回退 lyrics.ovh） |

脚本会为每首歌打印 `[来源: xxx]`，并在开头汇总各来源命中数。

### 3. 挑例句

逐个读取输出目录下的 txt，挑出含生词或地道短语的句子，写入工作区根目录 `<歌手-slug>-lyrics.txt`：

- 一句一行，不加序号、不加歌名、不加翻译
- 同一句不重复收录
- 优先选完整、语境清晰的句子；过于粗俗或含种族/性别侮辱词的句子跳过

**筛选标准（面向 IELTS 6.5 水平）：只挑「不常见」的词/短语**

- 剔除整句都是高频词、看一眼就懂的句子
  - 反例：`Nobody got me feeling this way`、`I don't know why I run away`、`You can call me queen bee`（queen bee 除外）
- 保留：B2 以上词汇、熟词僻义、固定搭配、俚语/习语
  - 例：`acquainted`、`complacent`、`articulate`、`oblivious`、`riveting`、`unforgiving`、`nihilist`、`aftermath`、`apocalypse`、`indifference`、`frail`、`weep`、`gussied up`
  - 例：`a far cry`、`go hand in hand`、`moth to a flame`、`meet in the middle`、`put up a fight`、`call someone's bluff`、`rue the day`、`get by`、`here to stay`、`in the flesh`、`cut my teeth on`
- 拿不准时：**宁可删掉**，例句贵在精

**歌单很大时（几十到上百首）**：不要一个人读完所有文件，按专辑拆成若干批，分发子 agent 并行处理，
每批写入 `tmp/sentences/<歌手>-<序号>.txt`，最后用 `scripts/merge-sentences.js` 合并去重：

```bash
node scripts/merge-sentences.js --out lorde-lyrics.txt \
     --inputs lorde-lyrics.txt,tmp/sentences/lorde-1.txt,tmp/sentences/lorde-2.txt,tmp/sentences/lorde-3.txt
```

给子 agent 的提示词里要带上完整筛选标准（见上），并说明：跳过 acoustic/重复版本、跳过非英文曲目、每首 2–6 句。

参考产出：`the-weeknd-lyrics.txt`、`zach-bryan-lyrics.txt`、`lorde-lyrics.txt`。

### 4. 汇报

必须包含三部分：

1. **数据来源**（重点）：每首歌来自 AZLyrics 还是 lyrics.ovh，以及各来源命中数量；有失败歌曲要说明原因
2. 输出目录与逐首歌词的行数
3. 例句文件路径与行数，以及本次筛掉了多少「过简单」的句子

## 数据源说明

1. **AZLyrics 原始 HTML**（首选）：歌词集中在 `<div class="lyricsh">` 后那个无 class 的 `<div>` 内，`<br>` 换行。
   脚本用版权注释 `<!-- Usage of azlyrics.com content ... -->` 定位块起点，截到 `</div>`，再 `<br>`→换行、剥标签、解实体。
   **该站有反爬**：脚本直连会返回 "AZLyrics - request for access"。若已用浏览器通过一次验证，
   把 Cookie 放进环境变量 `AZLYRICS_COOKIE` 后即可走通这条链路。
2. **lyrics.ovh JSON API**（回退，当前主力）：`https://api.lyrics.ovh/v1/<artist>/<title>`，无需 key、无反爬，返回纯文本歌词。

## 约束

- 只摘录歌词片段用于学习，不整站镜像、不重分发
- 临时产物一律放 `tmp/`，不写进 `data/`（`data/` 只放正式语料）
- 不要执行任何 git 操作

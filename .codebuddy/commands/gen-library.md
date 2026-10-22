# gen-library

从任意文档生成 SentenceVocab 语库。

## 输入

用户提供一个文档路径（.md/.txt/笔记等），文档中记录了想学的英语生词或句子。

## 流程

### 1. 确定语库名

- 取原文档文件名（不含扩展名）
- 转小写，空格和特殊符号替换为 `-`（连字符）
- 示例：`My IELTS Notes.md` → `my-ielts-notes`

### 2. 生成规范化 txt

读取用户文档，逐行处理，生成 `data/txt/<语库名>.txt`。

**格式规则：**

```
英文句子(生词标注) | 中文整句翻译
```

- 生词紧跟 `(N;/IPA音标;中文释义)` 内联标注，无空格；N = 关键词词数，单词固定写 `1;`
  - 示例：`vacant(1;/ˈveɪkənt/;空的；空闲的)`
- **词组标注**：在音标前加数字，表示关键词由几个词组成（数字写在 `(`/音标之间，格式 `(N;/IPA/;释义)`）
  - 示例：`rue the day(3;/ruː ðə deɪ/;悔不当初)`、`stumbled on(2;/ˈstʌmbld ɑːn/;偶然发现)`
  - 单词标注不写数字（缺省视为 1），旧格式完全兼容
  - 括号必须紧跟关键词的**最后一个词**（中间不能有空格/标点），build.js 会向前取 N 个词作为关键词
- ` | ` 分隔英文句子和中文整句翻译
- 每行一个句子，一行一句
- 注意：IPA 和释义里不要出现半角右括号 `)`（会被当作标注结束）；中文释义内的括号用全角 `（）`

**处理规则：**

| 原文档情况 | 处理方式 |
|-----------|---------|
| 已是完整英文句子 | 直接标注生词 + 生成翻译 |
| 单个孤立单词 | 为它造一句简短自然的例句 |
| 一行多个无关单词 | 拆成多行，每个词各造一句 |
| 一行多个词组（如 `exclaim,beverage,dwelling`） | 每个词单独造句，各一行 |

**生词标注规则：**

- 只标注真正需要学习的生词（如 vacant, rear, attorney）
- 常见基础词不标注（如 the, is, in, of, car, seat）
- 一词多义取句中语境的含义
- 词形变化标注原形（exclaimed → 标注 exclaim 的音标释义，句子保留原形）

**示例：**

原文档：
```
sit in the vacant rear seat of the car
scarce
exclaim,beverage,dwelling
```

生成 `data/txt/my-vocab.txt`：
```
sit in the vacant(/ˈveɪkənt/;空的；空闲的) rear(/rɪər/;后部的) seat of the car | 坐在汽车空着的后排座位上
water is scarce(/skers/;稀缺的) in the desert | 沙漠里水很稀缺
she exclaimed(/ɪkˈskleɪm/;惊呼；大声说) in surprise when she saw the gift | 她看到礼物时惊呼起来
what beverage(/ˈbevərɪdʒ/;饮料) would you like with your meal | 您用餐想喝什么饮料
the ancient dwelling(/ˈdwelɪŋ/;住所) was carved into the cliff | 古老的住所凿在悬崖上
```

### 3. 构建并上传

```bash
# 构建所有 txt → json
node scripts/build.js

# （可选）生成朗读音频 → data/audios/<语库名>/<行号>.mp3
node scripts/gen-audio.js <语库名>

# 上传
git add data
git commit -m "add: <语库名> library"
git push
```

脚本会：
- 扫描 `data/txt/*.txt`
- 为每个 txt 生成 `data/json/<语库名>.json`
- 更新 `data/index.json`（自动追加新语库）

### 4. 验证

构建完成后输出类似：
```
✅ my-vocab: 5 句
📦 共 3 个语库
```

push 到 GitHub 后手机刷新主页即可看到新语库，双击开始学习。

## 注意

- 语库名只允许小写字母、数字、连字符
- 不要手动编辑 `data/json/` 下的文件，它们是 build.js 生成的
- 如需修改语库内容，改 `data/txt/` 下的 txt 后重新 `node scripts/build.js`
- 句子首字母大写由 build.js 自动处理，txt 中不用管
- 音频按 `card.id`（txt 行号）与句子一一对应：若在 txt 中间插入/删除了行，需重新生成该库音频（`node scripts/gen-audio.js <语库名> --force`，或删掉受影响行号之后的旧 mp3 再增量跑）

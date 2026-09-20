# SentenceVocab

句子式英语学习应用 — 以句子为基本单元过卡，生词内联标注音标和中文释义。

## 快速开始

### 本地预览

```bash
python -m http.server 8765
```

打开浏览器访问 `http://localhost:8765`

### 部署到 GitHub Pages

1. 创建 GitHub 仓库
2. push 所有文件到 main 分支
3. Settings → Pages → Source: main → Save
4. 访问 `https://<username>.github.io/<repo>/`

## 核心流程：从文档到语库

完整流程分三步：**LLM 生成规范 txt → build.js 构建 JSON → push 到 GitHub**。

### 步骤 1：LLM 生成规范化 txt

你手头有任何格式的文档（`.md`、`.txt`、笔记等），里面记录了你想学的生词或句子。把这个文档丢给大语言模型，让它生成规范化中间文件。

**你需要告诉 LLM：**

```
请读取 [文档路径]，按以下规则生成规范化 txt 文件到 data/txt/：

1. 文件名：用原文档名，转为小写，空格和特殊符号替换为 -（连字符）
   例如：My IELTS Notes.md → my-ielts-notes.txt
2. 每行一个句子，格式：
   英文句子(生词标注) | 中文整句翻译
3. 生词紧跟 (IPA音标;中文释义) 内联标注，无空格
   例如：sit in the vacant(/ˈveɪkənt/;空的；空闲的) rear(/rɪər/;后部的) seat of the car | 坐在汽车空着的后排座位上
4. 如果原文档中一行是单个孤立单词，请为它造一句简短自然的例句
5. 如果一行有多个无关单词，拆成多行，每个词一行各造一句
6. 句子首字母大写（build.js 会处理，txt 中可不操心）
7. 只标注真正需要学习的生词，常见基础词（the/is/in/of 等）不标注
8. 不需要额外格式，纯文本，一行一句
```

**示例：**

原始文档 `my-vocab.md`：
```
sit in the vacant rear seat of the car
scarce
exclaim,beverage,dwelling
```

LLM 生成 `data/txt/my-vocab.txt`：
```
sit in the vacant(/ˈveɪkənt/;空的；空闲的) rear(/rɪər/;后部的) seat of the car | 坐在汽车空着的后排座位上
water is scarce(/skers/;稀缺的) in the desert | 沙漠里水很稀缺
she exclaimed(/ɪkˈskleɪm/;惊呼；大声说) in surprise when she saw the gift | 她看到礼物时惊呼起来
what beverage(/ˈbevərɪdʒ/;饮料) would you like with your meal | 您用餐想喝什么饮料
the ancient dwelling(/ˈdwelɪŋ/;住所) was carved into the cliff | 古老的住所凿在悬崖上
```

### 步骤 2：构建 JSON

```bash
node scripts/build.js
```

脚本自动扫描 `data/txt/*.txt`，为每个 txt 生成对应 JSON 到 `data/json/`，并更新 `data/index.json` 语库索引。

构建产物：
```
data/json/my-vocab.json     # 句子卡片数据
data/index.json             # 更新后的语库索引（自动追加新语库）
```

### 步骤 3：上传 GitHub

```bash
git add .
git commit -m "add: my-vocab library"
git push
```

GitHub Pages 自动部署，手机刷新即可看到新语库。

### 完整流程图

```
任意文档 (md/txt/笔记)
    │
    │  你告诉 LLM 文档路径 + 上述规则
    ↓
LLM 生成 → data/txt/your-library-name.txt
    │
    │  node scripts/build.js
    ↓
data/json/your-library-name.json + data/index.json
    │
    │  git push
    ↓
GitHub Pages → 手机打开 → 主页看到新语库 → 双击开始学习
```

## 文件结构

```
yasi/
├── index.html                  # 入口
├── css/style.css               # 样式
├── js/
│   ├── app.js                 # 主控制器（主页 + 学习）
│   ├── srs.js                 # SM-2 间隔重复 + 随机出题
│   ├── dictionary.js          # 语库加载
│   ├── storage.js             # localStorage 封装（按语库隔离）
│   ├── ui.js                  # UI 渲染
│   └── gist.js                # GitHub Gist 云同步
├── scripts/
│   └── build.js               # 构建脚本：txt → json + index
├── data/
│   ├── index.json             # 语库索引
│   ├── txt/                   # 输入源（LLM 生成的规范化文件）
│   │   ├── snl-interview-collection.txt
│   │   └── when-i-learn-ielts.txt
│   └── json/                  # 构建产物（App 读取）
│       ├── snl-interview-collection.json
│       └── when-i-learn-ielts.json
└── SPEC.md                    # 设计文档
```

## 学习流程

1. **主页**：看到所有语库列表，每个语库显示进度条
2. **单击**语库选中，**双击**直接跳转学习
3. **学习页**：
   - 显示英文句子（纯文本，无标注）
   - 两个按钮：**不会** / **会**
   - 点「会」→ 认识，下一张
   - 点「不会」→ 揭示：中文翻译 + 生词音标释义
   - 看完后点「下一张」→ 不认识，下一张
4. **语库学完**：显示完成页面，可重置进度重新学
5. **随机出题**：同一语库内每次进入卡片顺序随机打乱

## 数据格式

### 规范化 txt 格式（data/txt/）

```
sit in the vacant(/ˈveɪkənt/;空的；空闲的) rear(/rɪər/;后部的) seat of the car | 坐在汽车空着的后排座位上
```

| 元素 | 格式 | 示例 |
|------|------|------|
| 生词标注 | `word(音标;中文释义)` 紧跟词后 | `vacant(/ˈveɪkənt/;空的)` |
| 句子翻译 | ` \| ` 分隔 | ` \| 坐在汽车空着的后排座位上` |

### 语库 JSON 格式（data/json/）

```json
{
  "version": "1.0",
  "cards": [
    {
      "id": 1,
      "text": "Sit in the vacant rear seat of the car",
      "keyWords": [
        {"word": "vacant", "phonetic": "/ˈveɪkənt/", "meaning_cn": "空的；空闲的"},
        {"word": "rear", "phonetic": "/rɪər/", "meaning_cn": "后部的"}
      ],
      "translation": "坐在汽车空着的后排座位上"
    }
  ],
  "cardCount": 1
}
```

### index.json 格式（data/）

```json
{
  "libraries": [
    {"id": "when-i-learn-ielts", "name": "When I Learn Ielts", "cardCount": 92},
    {"id": "snl-interview-collection", "name": "Snl Interview Collection", "cardCount": 266}
  ]
}
```

## 跨设备进度同步

进度默认存在浏览器 localStorage，换设备不同步。通过 GitHub Gist 可免费同步：

1. 打开 https://github.com/settings/tokens
2. 生成 Token，只勾选 `gist` 权限
3. App 主页填入 Token
4. 每次学完点「同步到云端」，换设备点「从云端拉取」

不配 Token 也能正常用，只是进度不跨设备。

## 技术栈

- 纯 HTML/CSS/JS，无框架，无构建工具
- GitHub Pages 静态托管
- SM-2 间隔重复算法（Anki 同款）
- localStorage 按语库隔离存储进度
- GitHub Gist API 跨设备同步

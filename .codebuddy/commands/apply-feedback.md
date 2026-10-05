# apply-feedback

从 GitHub Gist 拉取学习反馈，应用到 txt 文件，重新构建 JSON。

## 触发条件

用户在手机学习时通过「反馈」功能修改了生词标注或标记了问题，并点「同步到云端」上传到 Gist 后，需要在电脑上处理这些反馈。

## 流程

### 1. 拉取反馈

```bash
node scripts/fetch-feedback.js <gist_token>
```

- 若用户未提供gist token，则向用户索要
- 拉取 Gist 中的 `sv_overrides_*` 数据到 `data/feedback.json`
- 输出反馈概览：哪些语库、哪些卡片有改动

### 2. 应用到 txt

```bash
node scripts/apply-feedback.js
```

- 读取 `data/feedback.json`
- 对每个有反馈的语库修改 `data/txt/<语库名>.txt`
- **keyWords 改动**：
  - 用户删除的生词：去除标注
  - 用户新增的生词：标记 `(TODO;待补充)`，需手动补充音标释义
  - 保留的生词：保留原标注
- **issues 标记**：行尾追加 `[ISSUE:问题描述]`
- 处理完自动清理 `data/feedback.json`

### 3. 手动处理 TODO 和 ISSUE

打开修改过的 txt 文件，搜索：

- `TODO` → 手动补充该词的音标和中文释义
- `[ISSUE:` → 手动处理对应问题（如修正大小写、改善语境等）
- 处理完后删除 `[ISSUE:...]` 标记

### 4. 重新构建

```bash
node scripts/build.js
```

### 5. 提交

```bash
git add .
git commit -m "fix: apply feedback"
git push
```

## 注意

- `data/feedback.json` 是临时文件，已 gitignore，不会提交
- Token 只在命令行参数中传递，不写入任何文件
- 提交前确认 txt 中没有遗留的 `TODO` 或 `[ISSUE:` 标记

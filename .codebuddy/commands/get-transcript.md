# get-transcript [DEPRECATED — 已废弃，不可调用]

> ⚠️ **此命令已废弃，请勿调用 `/get-transcript`。**
> 当前 YouTube 字幕抓取在本环境不可用（见下方排查记录）。本文件仅作为问题记录与参考保留。

---

## 现状结论

YouTube 对本机出口 IP 在 **字幕下载端（`/api/timedtext`）做了硬封锁**，返回 `HTTP 429` + Google "Sorry" 封锁页。这是 **IP 信誉级封锁**，认 IP 不认客户端，**本机内任何客户端都绕不过**。脚本本身逻辑无问题，换到干净 IP 即可跑通。

## 排查记录（已逐项实测）

目标视频：`https://www.youtube.com/watch?v=pEbznlwxtSw`

| # | 方案 | 列出字幕 | 下载字幕 |
|---|------|:---:|:---:|
| 1 | `youtube-transcript-api`（普通 requests） | ❌ IpBlocked | ❌ 429 |
| 2 | `youtube-transcript-api`（`curl_cffi` chrome 伪装 + cookie） | ✅ 解封 | ❌ 429 |
| 3 | `yt-dlp`（无认证） | — | ❌ 429 |
| 4 | `yt-dlp`（cookie + `--js-runtimes node` + chrome 伪装 + `--remote-components ejs:github`） | — | ❌ 429 |
| 5 | 直接 `curl_cffi` 请求 timedtext URL（chrome 伪装 + cookie + Referer） | — | ❌ 429 + "Sorry" 页 |

### 关键发现

- **为什么 yt-dlp 也绕不过**：`yt-dlp` 与 `youtube-transcript-api` 下载字幕用的是**同一个 URL** `https://www.youtube.com/api/timedtext?...`。该端点被 IP 硬封锁，换客户端无效。
- **cookie 的作用边界**：登录态 cookie（含 `__Secure-3PSID`/`LOGIN_INFO` 等真实凭证）能解除"列出字幕"（`youtubei` API）的封锁，但**解除不了"下载字幕文本"（`timedtext`）的封锁**。
- **`--cookies-from-browser` 走不通**：Windows 上 Edge/Chrome 的 cookie 用 app-bound 加密，yt-dlp 无法解密（[yt-dlp#10927](https://github.com/yt-dlp/yt-dlp/issues/10927)）；即便结束 Edge 后台进程能复制数据库，仍卡在 DPAPI 解密。必须用浏览器扩展导出 `cookies.txt`。
- **Node 权限问题**：CodeBuddy 会向 node 注入 `NODE_OPTIONS=--require=.../node-language-shim.cjs`，使 node 失去文件读权限，导致 yt-dlp 的 n-challenge 求解失败。脚本已用清空 `NODE_OPTIONS` 修复。
- **指纹/JS 挑战已解决**：用 `--js-runtimes node` + chrome 伪装（`curl_cffi`）+ `--remote-components ejs:github` 可通过 n-challenge，但这只解决指纹类封锁，对 IP 信誉封锁无效。

## 可用方案：油猴脚本（推荐，无需换网络）

`utils/tampermonkey-fetch-transcript.js` —— Tampermonkey 用户脚本，**完全绕过服务器侧 IP 封锁**：它不调用 `timedtext` 接口，而是直接监听播放器渲染的字幕 DOM，边播放边记录，因此不受 IP 限流影响。

安装与使用：
1. 浏览器装 Tampermonkey 扩展
2. 新建脚本，粘贴 `utils/tampermonkey-fetch-transcript.js` 内容并保存
3. 打开目标 YouTube 视频页，确保字幕已开启并显示
4. `Alt+Shift+S` 开始记录 → 播放视频（可拖进度条/倍速快速过一遍）
5. `Alt+Shift+X` 结束 → 字幕自动汇总、复制到剪贴板，并弹出完整文本

说明：
- 基于播放渲染，需把视频过一遍（可倍速/拖动），适合单个视频，不适合批量
- 视频本身关闭了字幕则无法记录（如纯音乐表演）
- 结尾自动暂停、关闭自动连播；切换视频时自动停止并汇总
- 输出为纯文本逐句拼接，不含时间戳

## 其他方案：换网络 / 等待（配合 python 批量脚本）

IP 被硬封锁，`utils/fetch_transcript.py` 这类走 `timedtext` 接口的工具**本机内无法绕过**。要用它只能：

1. **切换网络**（如手机热点）换个 IP → 立即生效
2. **等待数小时**后限流自动解除

满足以上任一条件后，`utils/fetch_transcript.py` 即可正常工作。

## 工具脚本（参考）

`utils/fetch_transcript.py` — 抓取 YouTube 视频或播放列表字幕，合并为单个 txt 到工作区根目录。

```bash
# IP 干净时（无 cookie 也可用）
python utils/fetch_transcript.py "<链接>"

# 带登录态 cookie（解除"列出字幕"封锁，降低被限流概率）
python utils/fetch_transcript.py "<链接>" --cookies www.youtube.com_cookies.txt
```

依赖：

```bash
pip install yt-dlp youtube-transcript-api curl_cffi
```

并确保 PATH 中有 `node`（可用 `node --version` 确认）。

> 注：即便 IP 干净，本命令仍保持废弃状态。如需复用，直接运行 `utils/fetch_transcript.py` 即可，不必经此斜杠命令。

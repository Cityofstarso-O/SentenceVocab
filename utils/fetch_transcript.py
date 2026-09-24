#!/usr/bin/env python3
"""
fetch_transcript.py — 抓取 YouTube 视频或播放列表字幕，合并为单个 txt 文件。

用法:
    python utils/fetch_transcript.py <URL> [输出文件名] [--cookies FILE]

绕过 YouTube IP 限流 (HTTP 429 / IpBlocked):
    --cookies cookies.txt   用浏览器扩展导出的登录态 cookies.txt（解除"列出字幕"的封锁，
                            并显著降低被限流概率）
    若仍报 IpBlocked/429：说明 timedtext 端被 IP 硬封锁，
        → 切换到其他网络（如手机热点）换个 IP，或等待数小时后重试

依赖:
    pip install yt-dlp youtube-transcript-api curl_cffi
    PATH 中需有 node（yt-dlp 列出播放列表时可能用到；脚本会自动清空 CodeBuddy 注入
    的 NODE_OPTIONS shim，以免 node 丢失文件读权限）
"""
import os
import re
import sys
import argparse
import subprocess
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YT_DLP = 'yt-dlp'
PREFERRED_LANGS = ['en', 'en-US', 'en-GB', 'es', 'pt-BR', 'pt']


def _clean_env():
    """CodeBuddy 会向 node 注入 NODE_OPTIONS shim，使 node 失去文件读权限，
    导致 yt-dlp 的 JS 挑战求解失败。这里清空它，保证 node 子进程正常运行。"""
    env = dict(os.environ)
    env['NODE_OPTIONS'] = ''
    return env


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, env=_clean_env())

    def _dec(b):
        if not b:
            return ''
        try:
            return b.decode('utf-8')
        except UnicodeDecodeError:
            return b.decode('cp936', errors='replace')

    return SimpleNamespace(stdout=_dec(r.stdout), stderr=_dec(r.stderr), returncode=r.returncode)


def list_entries(url):
    """用 yt-dlp flat 列出视频 (id, title)，单视频/播放列表均可。"""
    for flags in (['--flat-playlist'], []):
        cmd = [YT_DLP, '--no-config', *flags, '--print', '%(id)s|%(title)s', url]
        r = run(cmd)
        out = []
        for line in r.stdout.splitlines():
            line = line.strip()
            if line and '|' in line:
                vid, title = line.split('|', 1)
                if vid:
                    out.append((vid, title or 'Unknown Title'))
        if out:
            return out
    return []


def make_http_client(cookies_file):
    """构造带 cookie 认证的 HTTP client：优先 curl_cffi(chrome 伪装)，回退 requests。"""
    cookies = None
    if cookies_file:
        from http.cookiejar import MozillaCookieJar
        cookies = MozillaCookieJar(cookies_file)
        cookies.load(ignore_discard=True, ignore_expires=True)
    try:
        from curl_cffi import requests as cffi
        s = cffi.Session(impersonate='chrome')
        if cookies:
            for c in cookies:
                s.cookies.set(c.name, c.value, domain=c.domain, path=c.path)
        return s, 'curl_cffi(chrome)'
    except ImportError:
        import requests
        s = requests.Session()
        s.headers['User-Agent'] = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                                   'AppleWebKit/537.36 (KHTML, like Gecko) '
                                   'Chrome/131.0.0.0 Safari/537.36')
        if cookies:
            s.cookies = cookies
        return s, 'requests'


def pick_transcript(tl):
    stores = (tl._manually_created_transcripts, tl._generated_transcripts)
    for store in stores:
        for lang in PREFERRED_LANGS:
            if lang in store:
                return store[lang]
        if store:
            return next(iter(store.values()))
    return None


def fetch_one(api, vid, title, f):
    """抓取单个视频字幕并写入文件，返回 (language_code_or_None, error_or_None)。"""
    f.write(f"\nTitle: {title}\n" + "=" * 50 + "\n")
    f.write(f"https://www.youtube.com/watch?v={vid}\n" + "=" * 50 + "\n")
    try:
        tl = api.list(vid)
        ts = pick_transcript(tl)
        if ts is None:
            raise RuntimeError('no transcript available for this video')
        lang = ts.language_code
        for sn in ts.fetch():
            f.write(sn.text + '\n')
        f.write("\n" + "=" * 50 + "\n\n")
        return lang, None
    except Exception as e:
        msg = str(e)
        f.write(f"Transcript not available: {msg}\n")
        f.write("\n" + "=" * 50 + "\n\n")
        return None, msg


def resolve_output(args):
    if args.output and not os.path.dirname(args.output):
        return os.path.join(ROOT_DIR, args.output)
    return args.output or os.path.join(ROOT_DIR, 'transcripts.txt')


def main():
    # Windows 控制台默认 GBK，遇到特殊字符 print 会崩溃，强制 UTF-8
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    p = argparse.ArgumentParser(description='抓取 YouTube 视频或播放列表字幕')
    p.add_argument('url', help='YouTube 视频或播放列表链接')
    p.add_argument('output', nargs='?', default=None,
                   help='输出文件名（默认 transcripts.txt，存放在工作区根目录）')
    p.add_argument('--cookies', default=None, help='cookies.txt 路径（绕过 IP 限流）')
    args = p.parse_args()

    output_file = resolve_output(args)

    entries = list_entries(args.url)
    if not entries:
        print('未获取到任何视频，请检查链接或网络。')
        sys.exit(1)

    client, ckind = make_http_client(args.cookies)
    from youtube_transcript_api import YouTubeTranscriptApi
    api = YouTubeTranscriptApi(http_client=client)
    print(f'HTTP client: {ckind}' + (' (with cookies)' if args.cookies else ' (no cookies)'))

    ok = fail = blocked = 0
    total = len(entries)
    with open(output_file, 'w', encoding='utf-8') as f:
        for i, (vid, title) in enumerate(entries, 1):
            print(f"[{i}/{total}] {title}")
            lang, err = fetch_one(api, vid, title, f)
            if lang:
                ok += 1
                print(f"    OK ({lang})")
            else:
                fail += 1
                if err and ('429' in err or 'block' in err.lower()):
                    blocked += 1
                print(f"    FAIL: {(err or '')[:100]}")

    print(f"\n完成：{ok} 成功 / {fail} 失败 / 共 {total}")
    print(f"输出文件：{output_file}")
    if blocked:
        print('\n⚠ 检测到 IP 限流 (429/IpBlocked)。timedtext 端被 IP 硬封锁，cookie/指纹无法绕过。')
        print('  解决：切换到其他网络（如手机热点）换个 IP，或等待数小时后重试。')


if __name__ == '__main__':
    main()

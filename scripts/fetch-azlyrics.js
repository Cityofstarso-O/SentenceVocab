/**
 * fetch-azlyrics.js — 绕开 web_fetch（慢在 LLM 推理），直接下载原始响应并在本地解析歌词
 *
 * 两个数据源，自动降级：
 *   1) AZLyrics 原始 HTML：歌词集中在 <div class="lyricsh"> 后那个无 class 的 <div> 里，<br> 换行
 *      —— 但该站有反爬：脚本直连会返回 "AZLyrics - request for access"。
 *        若已用浏览器通过一次验证，可把 Cookie 放进环境变量 AZLYRICS_COOKIE 再跑。
 *   2) lyrics.ovh 免费 JSON API（无需 key，无反爬）：https://api.lyrics.ovh/v1/<artist>/<title>
 *
 * 所有原始响应都会缓存到 tmp/html/ 下，便于重复解析、零网络成本。
 *
 * 用法:
 *   node scripts/fetch-azlyrics.js                       # 全部歌曲
 *   node scripts/fetch-azlyrics.js starboy               # 只跑歌名/文件名含 starboy 的
 *   node scripts/fetch-azlyrics.js --force               # 忽略缓存重新下载
 *   node scripts/fetch-azlyrics.js --out tmp             # 覆盖写入 tmp/（默认 tmp/auto）
 *   node scripts/fetch-azlyrics.js --source azlyrics     # 只用 AZLyrics（不给回退）
 *
 * 换歌手（歌单见 data/lyrics/*.json）：
 *   node scripts/fetch-azlyrics.js --list data/lyrics/zach-bryan.json --artist "Zach Bryan" \
 *        --out tmp/artists/zach-bryan
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML_DIR = path.join(ROOT, 'tmp', 'html'); // 原始响应缓存

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DELAY_MS = 500;
const AZ_COOKIE = process.env.AZLYRICS_COOKIE || '';

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
// --source/--list/--artist/--out 带值，其余非 -- 参数视为「歌名/文件名过滤关键字」
const VALUED_OPTS = ['source', 'list', 'artist', 'out'];
const opts = {};
const FILTERS = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--force') continue;
  if (a.startsWith('--')) {
    const name = a.slice(2);
    if (VALUED_OPTS.includes(name)) {
      opts[name] = args[i + 1];
      i++;
    }
    continue;
  }
  FILTERS.push(a);
}
const SOURCE = opts.source || 'auto';      // auto | azlyrics | ovh
const LIST_FILE = opts.list || '';         // 外部歌单 JSON（歌手维度，见 data/lyrics/*.json）
const DEFAULT_ARTIST = opts.artist || 'The Weeknd'; // 歌单里未单独指定时的歌手名
const OUT_DIR = path.resolve(opts.out || path.join(ROOT, 'tmp', 'auto'));

const HUT = 'Hurry Up Tomorrow (2025)';
const AH = 'After Hours (2020)';
const DAWN = 'Dawn FM (2022)';
const STARBOY = 'Starboy (2016)';
const BBTM = 'Beauty Behind the Madness (2015)';
const HOB = 'House of Balloons (2011)';

/**
 * 歌曲清单
 *   file    输出文件名
 *   title   歌名（用于 lyrics.ovh 查询）
 *   album   写入文件头的专辑信息
 *   artist  AZLyrics 歌手 slug（默认 weeknd）
 *   ovhArtist / ovhTitle  lyrics.ovh 查询用（合作曲目需要换歌手）
 */
const BUILTIN_SONGS = [
  { file: 'wake-me-up', title: 'Wake Me Up', album: HUT },
  { file: 'cry-for-me', title: 'Cry For Me', album: HUT },
  { file: 'sao-paulo', title: 'São Paulo', album: HUT },
  { file: 'baptized-in-fear', title: 'Baptized In Fear', album: HUT },
  { file: 'open-hearts', title: 'Open Hearts', album: HUT },
  { file: 'timeless', title: 'Timeless', album: HUT },
  { file: 'the-abyss', title: 'The Abyss', album: HUT },
  { file: 'reflections-laughing', title: 'Reflections Laughing', album: HUT },
  { file: 'enjoy-the-show', title: 'Enjoy The Show', album: HUT },
  { file: 'given-up-on-me', title: 'Given Up On Me', album: HUT },
  { file: 'take-me-back-to-la', title: 'Take Me Back To LA', album: HUT },
  { file: 'red-terror', title: 'Red Terror', album: HUT },
  { file: 'hurry-up-tomorrow', title: 'Hurry Up Tomorrow', album: HUT },
  { file: 'without-a-warning', title: 'Without A Warning', album: HUT },
  { file: 'runaway', title: 'Runaway', album: HUT },

  { file: 'blinding-lights', title: 'Blinding Lights', album: AH },
  { file: 'save-your-tears', title: 'Save Your Tears', album: AH },
  { file: 'after-hours', title: 'After Hours', album: AH },
  { file: 'heartless', title: 'Heartless', album: AH },
  { file: 'in-your-eyes', title: 'In Your Eyes', album: AH },
  { file: 'take-my-breath', title: 'Take My Breath', album: DAWN },
  {
    file: 'moth-to-a-flame', title: 'Moth To A Flame', album: 'Paradise Again (2022)',
    artist: 'swedishhousemafia', ovhArtist: 'Swedish House Mafia',
  },

  { file: 'sacrifice', title: 'Sacrifice', album: DAWN },
  { file: 'out-of-time', title: 'Out Of Time', album: DAWN },
  { file: 'is-there-someone-else', title: 'Is There Someone Else?', album: DAWN },
  { file: 'less-than-zero', title: 'Less Than Zero', album: DAWN },
  { file: 'gasoline', title: 'Gasoline', album: DAWN },
  { file: 'how-do-i-make-you-love-me', title: 'How Do I Make You Love Me?', album: DAWN },
  { file: 'starry-eyes', title: 'Starry Eyes', album: DAWN },

  { file: 'starboy', title: 'Starboy', album: STARBOY },
  { file: 'i-feel-it-coming', title: 'I Feel It Coming', album: STARBOY },
  { file: 'party-monster', title: 'Party Monster', album: STARBOY },
  { file: 'reminder', title: 'Reminder', album: STARBOY },
  { file: 'secrets', title: 'Secrets', album: STARBOY },
  { file: 'sidewalks', title: 'Sidewalks', album: STARBOY },
  { file: 'die-for-you', title: 'Die For You', album: STARBOY },
  { file: 'false-alarm', title: 'False Alarm', album: STARBOY },
  { file: 'rockin', title: "Rockin'", album: STARBOY },

  { file: 'the-hills', title: 'The Hills', album: BBTM },
  { file: 'cant-feel-my-face', title: "Can't Feel My Face", album: BBTM },
  { file: 'earned-it', title: 'Earned It', album: BBTM },
  { file: 'often', title: 'Often', album: BBTM },
  { file: 'in-the-night', title: 'In The Night', album: BBTM },
  { file: 'acquainted', title: 'Acquainted', album: BBTM },
  { file: 'prisoner', title: 'Prisoner', album: BBTM },

  { file: 'wicked-games', title: 'Wicked Games', album: HOB },
  { file: 'house-of-balloons', title: 'House Of Balloons / Glass Table Girls', album: HOB },
  { file: 'the-party-and-the-after-party', title: 'The Party & The After Party', album: HOB },
  { file: 'twenty-eight', title: 'Twenty Eight', album: HOB },
  { file: 'kiss-land', title: 'Kiss Land', album: 'Kiss Land (2013)' },

  { file: 'popular', title: 'Popular', album: 'The Idol (Soundtrack) (2023)' },
  { file: 'one-of-the-girls', title: 'One Of The Girls', album: 'The Idol Episode 4 (Soundtrack) (2023)' },
  {
    file: 'creepin', title: "Creepin'", album: 'Heroes & Villains (2022)',
    artist: 'metroboomin', ovhArtist: 'Metro Boomin',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 归一化：去音调符号 + 去非字母数字，用于从歌名推出 AZLyrics slug */
function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** 从 AZLyrics HTML 抠出歌词块：版权注释之后的那个 <div> 内容 */
function extractLyrics(html) {
  const marker = '<!-- Usage of azlyrics.com content by any third-party lyrics provider is prohibited';
  let from;
  let to;

  const markerIdx = html.indexOf(marker);
  if (markerIdx !== -1) {
    from = html.indexOf('-->', markerIdx) + 3;
    to = html.indexOf('</div>', from);
  } else {
    const headIdx = html.indexOf('<div class="lyricsh">');
    if (headIdx === -1) return null;
    const open = html.indexOf('<div>', headIdx);
    if (open === -1) return null;
    from = open + '<div>'.length;
    to = html.indexOf('</div>', from);
  }
  if (to === -1) return null;

  const text = decodeEntities(
    html
      .slice(from, to)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  );

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.length ? lines : null;
}

async function fetchText(url, extraHeaders = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          ...extraHeaders,
        },
      });
      if (res.status === 404) return { status: 404, body: null };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { status: 200, body: await res.text() };
    } catch (e) {
      lastErr = e;
      await sleep(800 * (i + 1));
    }
  }
  throw lastErr;
}

async function getHtml(song) {
  const artist = song.artist || normalize(DEFAULT_ARTIST);
  const slug = song.slug || normalize(song.title);
  const cache = path.join(HTML_DIR, `az-${artist}__${slug}.html`);

  let html = null;
  if (!FORCE && fs.existsSync(cache)) {
    html = fs.readFileSync(cache, 'utf8');
  } else {
    const headers = AZ_COOKIE ? { Cookie: AZ_COOKIE, Referer: `https://www.azlyrics.com/${artist[0]}/${artist}.html` } : {};
    const r = await fetchText(`https://www.azlyrics.com/lyrics/${artist}/${slug}.html`, headers);
    if (r.status === 404) return { lines: null, reason: `404 (slug=${slug})` };
    html = r.body;
    fs.writeFileSync(cache, html, 'utf8');
    await sleep(DELAY_MS);
  }

  if (/AZLyrics - request for access/.test(html)) {
    return { lines: null, reason: '被反爬拦截（需 AZLYRICS_COOKIE）' };
  }
  const lines = extractLyrics(html);
  return lines ? { lines, source: 'AZLyrics' } : { lines: null, reason: 'HTML 结构未匹配到歌词块' };
}

async function getFromOvh(song) {
  const artist = song.ovhArtist || DEFAULT_ARTIST;
  const title = song.ovhTitle || song.title;
  const key = `${artist} - ${title}`.replace(/[^\w\- ]/g, '').replace(/\s+/g, '_');
  const cache = path.join(HTML_DIR, `ovh-${key}.json`);

  let data;
  if (!FORCE && fs.existsSync(cache)) {
    data = JSON.parse(fs.readFileSync(cache, 'utf8'));
  } else {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const r = await fetchText(url, { Accept: 'application/json' });
    if (r.status === 404) return { lines: null, reason: 'lyrics.ovh 无此曲' };
    data = JSON.parse(r.body);
    fs.writeFileSync(cache, JSON.stringify(data), 'utf8');
    await sleep(DELAY_MS);
  }

  if (!data || !data.lyrics) return { lines: null, reason: 'lyrics.ovh 返回空' };
  const lines = data.lyrics
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return { lines, source: 'lyrics.ovh' };
}

async function main() {
  fs.mkdirSync(HTML_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const SONGS = LIST_FILE ? JSON.parse(fs.readFileSync(path.resolve(LIST_FILE), 'utf8')) : BUILTIN_SONGS;
  const targets = SONGS.filter((s) => {
    if (!FILTERS.length) return true;
    const hay = `${s.file} ${s.title}`.toLowerCase();
    return FILTERS.some((f) => hay.includes(f.toLowerCase()));
  });

  const done = [];
  const failed = [];

  for (const song of targets) {
    let result = { lines: null, reason: '未尝试' };
    const order = SOURCE === 'ovh' ? ['ovh'] : SOURCE === 'azlyrics' ? ['az'] : ['az', 'ovh'];

    for (const src of order) {
      try {
        result = src === 'az' ? await getHtml(song) : await getFromOvh(song);
      } catch (e) {
        result = { lines: null, reason: `${src}: ${e.message}` };
      }
      if (result.lines) break;
    }

    if (!result.lines) {
      failed.push(`${song.file}: ${result.reason}`);
      continue;
    }

    const out = [`Song: ${song.title}`, `Album: ${song.album}`, '', ...result.lines].join('\n') + '\n';
    fs.writeFileSync(path.join(OUT_DIR, `${song.file}.txt`), out, 'utf8');
    done.push({ label: `${song.file} (${result.lines.length} 行)`, source: result.source });
  }

  const bySource = {};
  done.forEach((d) => {
    bySource[d.source] = (bySource[d.source] || 0) + 1;
  });
  console.log(`输出目录: ${OUT_DIR}`);
  console.log(`数据来源: ${Object.entries(bySource).map(([k, v]) => `${k} ${v} 首`).join(' / ') || '无'}`);
  console.log(`成功 ${done.length} 首：`);
  done.forEach((d) => console.log(`  ✓ ${d.label} [来源: ${d.source}]`));
  if (failed.length) {
    console.log(`\n失败 ${failed.length} 首：`);
    failed.forEach((l) => console.log('  ✗ ' + l));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

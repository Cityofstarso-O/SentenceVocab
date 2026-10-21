/**
 * fetch-discography.js — 从 MusicBrainz 拉取某歌手「全部专辑/EP 的全部曲目」，
 * 直接产出 fetch-azlyrics.js 可用的歌单 JSON。
 *
 * 用法:
 *   node scripts/fetch-discography.js --artist "Lorde" --out tmp/lyrics-lists/lorde.json
 *   node scripts/fetch-discography.js --artist "Zach Bryan" --out tmp/lyrics-lists/zach-bryan.json --types Album,EP
 *
 * 参数:
 *   --artist <name>  歌手名（必填）
 *   --out <file>     输出歌单 JSON（必填）
 *   --types <list>   收录的发行类型，默认 Album,EP（可选加 Single/Live/Compilation）
 *   --skip <词>      标题含这些词（逗号分隔）的曲目跳过，默认 instrumental,karaoke
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const VALUED = ['artist', 'out', 'types', 'skip', 'mbid'];
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const name = args[i].slice(2);
    if (VALUED.includes(name)) {
      opts[name] = args[i + 1];
      i++;
    }
  }
}
if (!opts.artist && !opts.mbid) {
  console.error('缺少 --artist 或 --mbid');
  process.exit(1);
}
const OUT = path.resolve(opts.out || path.join(__dirname, '..', 'tmp', 'lyrics-lists', `${opts.artist}.json`));
const TYPES = (opts.types || 'Album,EP').split(',').map((s) => s.trim()).filter(Boolean);
const SKIP = (opts.skip || 'instrumental,karaoke').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const UA = 'SentenceVocab/1.0 (lyrics study script)';
const BASE = 'https://musicbrainz.org/ws/2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slug(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function mbGet(url, tries = 5) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    await sleep(1100); // MusicBrainz 要求最多 1 req/s
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status === 503 || res.status === 429) {
        lastErr = new Error(`${res.status} ${url}`);
        await sleep(2000 * (i + 1)); // 限流/临时故障，退避重试
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res.json();
    } catch (e) {
      lastErr = e;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr;
}

async function findArtist() {
  if (opts.mbid) return opts.mbid;
  const q = encodeURIComponent(`artist:"${opts.artist}"`);
  const data = await mbGet(`${BASE}/artist?query=${q}&fmt=json&limit=10`);
  const hits = (data.artists || []).filter((a) => a.name.toLowerCase() === opts.artist.toLowerCase());
  const pick = hits[0] || (data.artists || [])[0];
  if (!pick) throw new Error(`未找到歌手: ${opts.artist}`);
  console.log(`歌手: ${pick.name} (${pick.id})${pick.disambiguation ? ' — ' + pick.disambiguation : ''}`);
  return pick.id;
}

async function main() {
  const artistId = await findArtist();

  const rgData = await mbGet(`${BASE}/release-group?artist=${artistId}&fmt=json&limit=100&offset=0`);
  const groups = (rgData['release-groups'] || [])
    .filter((g) => TYPES.includes(g['primary-type']))
    .filter((g) => !(g['secondary-types'] || []).includes('Live') || TYPES.includes('Live'))
    .map((g) => ({
      id: g.id,
      title: g.title,
      type: g['primary-type'],
      date: g['first-release-date'] || '',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  console.log(`发行体: ${groups.length} 个 (${TYPES.join('/')})`);

  const songs = [];
  const seen = new Set();
  const albums = [];

  for (const g of groups) {
    let tracks = [];
    try {
      const rel = await mbGet(
        `${BASE}/release?release-group=${g.id}&inc=recordings&fmt=json&limit=5`
      );
      const releases = (rel.releases || []).filter((r) => r.media && r.media.length);
      // 取曲目数最多的一版（通常是完整版）
      const best = releases.sort(
        (a, b) =>
          b.media.reduce((n, m) => n + (m['track-count'] || 0), 0) -
          a.media.reduce((n, m) => n + (m['track-count'] || 0), 0)
      )[0];
      if (best) {
        tracks = best.media
          .filter((m) => !/DVD|Blu/.test(m.format || ''))
          .flatMap((m) => m.tracks || [])
          .map((t) => t.title)
          .filter(Boolean);
      }
    } catch (e) {
      console.log(`  ! ${g.title}: ${e.message}`);
    }

    const year = (g.date.match(/^\d{4}/) || [''])[0];
    const albumLabel = `${g.title}${year ? ` (${year})` : ''}`;
    let added = 0;
    for (const t of tracks) {
      const norm = t.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!norm || SKIP.some((s) => t.toLowerCase().includes(s))) continue;
      if (seen.has(norm)) continue;
      seen.add(norm);
      songs.push({ file: slug(t), title: t, album: albumLabel });
      added++;
    }
    albums.push({ album: albumLabel, tracks: tracks.length, added });
    console.log(`  ✓ ${albumLabel}: ${tracks.length} 首（新增 ${added}）`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(songs, null, 2), 'utf8');
  console.log(`\n输出: ${OUT}`);
  console.log(`共 ${songs.length} 首（去重后），覆盖 ${albums.length} 个发行体`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

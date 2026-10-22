#!/usr/bin/env node
/**
 * gen-audio.js — 用 Kokoro-82M 为语库句子批量生成朗读音频
 *
 * 用法:
 *   node scripts/gen-audio.js <libId> [--voice am_onyx] [--force]
 * 例:
 *   node scripts/gen-audio.js snl50-anniversary-special
 *
 * 输出: data/audios/<libId>/<cardId>.mp3（24kHz 单声道 48kbps，每句约 20~50KB）
 *       App 端按 card.id 探测播放，无音频的语库不受影响。
 *
 * 说明:
 * - 构建期依赖（kokoro-js + @breezystack/lamejs，devDependencies），App 运行时仍零依赖
 * - 模型首次运行自动从 HuggingFace 下载（国内可设环境变量 HF_ENDPOINT=https://hf-mirror.com），
 *   缓存于仓库根目录 .cache/（已 gitignore）
 * - 增量生成：已存在的 mp3 跳过，句子被反馈修改后可用 --force 全量重生成
 * - 默认声音 am_onyx（男声，连读自然度实测最好）
 */
import { KokoroTTS } from "kokoro-js";
import { env } from "@huggingface/transformers";
import { Mp3Encoder } from "@breezystack/lamejs";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const VOICE_DEFAULT = "am_onyx";
const BITRATE = 48; // kbps，语音场景足够

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
const libId = args.find(a => !a.startsWith("--"));
if (!libId) {
  console.error("用法: node scripts/gen-audio.js <libId> [--voice am_onyx] [--force]");
  process.exit(1);
}
const getFlag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};
const voice = getFlag("voice", VOICE_DEFAULT);
const force = args.includes("--force");

// ---------- 输入输出 ----------
const libFile = path.join(ROOT, "data", "json", `${libId}.json`);
if (!fs.existsSync(libFile)) {
  console.error(`语库不存在: data/json/${libId}.json`);
  process.exit(1);
}
const lib = JSON.parse(fs.readFileSync(libFile, "utf8"));
const outDir = path.join(ROOT, "data", "audios", libId);
fs.mkdirSync(outDir, { recursive: true });

const targets = lib.cards.filter(c => force || !fs.existsSync(path.join(outDir, `${c.id}.mp3`)));
const skipped = lib.cards.length - targets.length;
if (targets.length === 0) {
  console.log(`${libId}: 全部 ${lib.cards.length} 句已有音频，跳过（--force 可重新生成）`);
  process.exit(0);
}
console.log(`${libId}: 共 ${lib.cards.length} 句，待生成 ${targets.length} 句（跳过 ${skipped}），声音 ${voice}`);

// ---------- 模型 ----------
env.cacheDir = path.join(ROOT, ".cache");
console.log("加载 Kokoro-82M (q8)...");
const t0 = Date.now();
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8" });
console.log(`模型就绪 ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ---------- 合成 ----------
// Float32 [-1,1] → Int16，并按声道数处理（Kokoro 输出为单声道）
function floatToInt16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767);
  }
  return out;
}

function encodeMp3(int16, sampleRate, bitrate) {
  const enc = new Mp3Encoder(1, sampleRate, bitrate);
  const chunks = [];
  const BLOCK = 1152 * 10;
  for (let i = 0; i < int16.length; i += BLOCK) {
    const buf = enc.encodeBuffer(int16.subarray(i, Math.min(i + BLOCK, int16.length)));
    if (buf.length) chunks.push(Buffer.from(buf));
  }
  const end = enc.flush();
  if (end.length) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

let done = 0, failed = 0;
const tStart = Date.now();
for (const card of targets) {
  try {
    const ts = Date.now();
    const audio = await tts.generate(card.text, { voice });
    const mp3 = encodeMp3(floatToInt16(audio.audio), audio.sampling_rate, BITRATE);
    fs.writeFileSync(path.join(outDir, `${card.id}.mp3`), mp3);
    done++;
    const dur = (audio.audio.length / audio.sampling_rate).toFixed(1);
    console.log(`  [${done}/${targets.length}] #${card.id} ${dur}s / 合成 ${((Date.now() - ts) / 1000).toFixed(1)}s  ${card.text.slice(0, 40)}`);
  } catch (e) {
    failed++;
    console.error(`  [失败] #${card.id}: ${e.message}`);
  }
}

const totalKB = targets.reduce((s, c) => {
  const f = path.join(outDir, `${c.id}.mp3`);
  return s + (fs.existsSync(f) ? fs.statSync(f).size : 0);
}, 0) / 1024;
console.log(`完成: 生成 ${done} / 失败 ${failed} / 跳过 ${skipped}，本批音频 ${totalKB.toFixed(0)}KB，总耗时 ${((Date.now() - tStart) / 1000).toFixed(0)}s`);

/**
 * merge-sentences.js — 合并多份「一句一行」的例句文件，去重并保持首次出现顺序。
 *
 * 用法:
 *   node scripts/merge-sentences.js --out lorde-lyrics.txt \
 *        --inputs lorde-lyrics.txt,tmp/sentences/lorde-1.txt,tmp/sentences/lorde-2.txt
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    opts[args[i].slice(2)] = args[i + 1];
    i++;
  }
}
if (!opts.out || !opts.inputs) {
  console.error('用法: --out <file> --inputs <a.txt,b.txt,...>');
  process.exit(1);
}

const OUT = path.resolve(opts.out);
const inputs = opts.inputs.split(',').map((s) => s.trim()).filter(Boolean);

const seen = new Set();
const lines = [];
let total = 0;

for (const rel of inputs) {
  const file = path.resolve(rel);
  if (!fs.existsSync(file)) {
    console.log(`  跳过（不存在）: ${rel}`);
    continue;
  }
  const raw = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let n = 0;
  for (const line of raw) {
    const t = line.trim();
    if (!t) continue;
    total++;
    const key = t.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(t);
    n++;
  }
  console.log(`  + ${rel}: ${n} 行（原 ${raw.filter((l) => l.trim()).length} 行）`);
}

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log(`输出: ${OUT}`);
console.log(`合计 ${lines.length} 行（去重前 ${total} 行）`);

#!/usr/bin/env node
/**
 * 场景坐标预览渲染器（构建期工具，依赖 @playwright/test 的 chromium）
 *
 * 把场景 draft JSON 里的物品坐标画成 pin（带英文品名）合成到原图上，
 * 输出一张 PNG，供人工或 AI 审查标注是否准确。
 *
 * 用法：
 *   PLAYWRIGHT_BROWSERS_PATH=E:\pw-browsers node scripts/render-pins.js data/scenes/kitchen-1.draft.json [out.png]
 *   （不传 out 时默认输出 <draft 同名>.pins.png）
 *
 * 坐标为百分比（0~100），与 App 内渲染一致，因此本图即"所见即所得"的标注效果。
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');

async function main() {
  const [draftPath, outArg] = process.argv.slice(2);
  if (!draftPath) {
    console.error('用法: node scripts/render-pins.js <draft.json> [out.png]');
    process.exit(1);
  }
  const draft = JSON.parse(fs.readFileSync(path.resolve(draftPath), 'utf8'));
  const card = draft.cards[0];
  const imgPath = path.join(ROOT, card.image);
  const out = outArg || draftPath.replace(/\.json$/, '.pins.png');

  // 读取原图尺寸，按原始分辨率渲染
  const size = await imageSize(imgPath);
  const pins = card.items
    .map(
      (it, i) =>
        `<div class="pin" style="left:${it.x}%;top:${it.y}%"><i>${i + 1}</i><b>${esc(it.word)}</b></div>`
    )
    .join('\n');

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; }
    .stage { position: relative; width: ${size.w}px; height: ${size.h}px; }
    .stage img { display: block; width: 100%; height: 100%; }
    .pin { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; }
    .pin i { font: bold 15px/1 system-ui; font-style: normal; color: #fff; background: #ef4444;
             width: 26px; height: 26px; border-radius: 50%; border: 3px solid #fff;
             display: flex; align-items: center; justify-content: center;
             box-shadow: 0 1px 4px rgba(0,0,0,.5); }
    .pin b { font: bold 17px/1 system-ui; color: #fff; background: rgba(28,25,23,.88);
             padding: 5px 9px; border-radius: 6px; margin-left: 6px; white-space: nowrap;
             box-shadow: 0 1px 4px rgba(0,0,0,.4); }
  </style></head><body>
  <div class="stage" id="stage">
    <img src="file:///${imgPath.replace(/\\/g, '/')}">
    ${pins}
  </div></body></html>`;

  // 写临时 HTML 再以 file:// 打开（setContent 的 about:blank 源无法加载 file:// 图片）
  const tmpHtml = path.join(path.dirname(imgPath), `.tmp-pins-${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, html);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h } });
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.locator('#stage').screenshot({ path: out });
  await browser.close();
  fs.unlinkSync(tmpHtml);
  console.log(`已合成 → ${path.relative(ROOT, out)}（${card.items.length} 个 pin）`);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

// 免依赖取图片尺寸：解析 JPEG/PNG 头
function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b[1] === 0x50) { // PNG
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) { // JPEG：扫描 SOF 段
    let o = 2;
    while (o < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const marker = b[o + 1];
      const len = b.readUInt16BE(o + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: b.readUInt16BE(o + 5), w: b.readUInt16BE(o + 7) };
      }
      o += 2 + len;
    }
  }
  throw new Error('无法解析图片尺寸（仅支持 PNG/JPEG）');
}

main().catch((e) => { console.error(e); process.exit(1); });

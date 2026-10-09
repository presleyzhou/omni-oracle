const pptxgen = require("pptxgenjs");
const fs = require("fs");
const C = require("./content.js");
const SCRIPT = require("./script.js");
const notesFor = (id) => { const sc = SCRIPT[id]; return sc ? sc.talk.join("\n\n") + (sc.bridge ? "\n\n→ " + sc.bridge : "") : ""; };
const live = JSON.parse(fs.readFileSync("../../data/live.json", "utf8"));

const P = { bg: "0B0F17", card: "151D2C", card2: "1A2437", border: "24304A", text: "E5EAF3", dim: "93A0B8",
  accent: "4F8CFF", purple: "8B5CF6", green: "22C55E", amber: "F59E0B", red: "EF4444", cyan: "22D3EE", white: "FFFFFF" };
const FONT = "Arial";
const W = 13.33, H = 7.5, M = 0.6;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = C.meta.author; pres.title = C.meta.title;

const tb = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, fontFace: FONT, color: P.text, margin: 0, valign: "top" }, o));
function frame(s, n, total, sources) {
  s.background = { color: P.bg };
  tb(s, C.meta.site, { x: M, y: H - 0.42, w: 5, h: 0.25, fontSize: 9, color: P.dim });
  tb(s, `${n} / ${total}`, { x: W - M - 1.2, y: H - 0.42, w: 1.2, h: 0.25, fontSize: 9, color: P.dim, align: "right" });
  if (sources && sources.length) tb(s, "来源：" + sources.join(" · "), { x: M, y: H - 0.88, w: W - 2 * M, h: 0.44, fontSize: 8.5, color: P.dim, italic: true, fit: "shrink" });
}
function header(s, sl) {
  tb(s, sl.kicker, { x: M, y: 0.42, w: 6, h: 0.3, fontSize: 11, color: P.accent, bold: true, charSpacing: 2 });
  tb(s, sl.title, { x: M, y: 0.72, w: W - 2 * M, h: 0.8, fontSize: 30, bold: true, color: P.white, fit: "shrink" });
}
function card(s, x, y, w, h, fill = P.card) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: P.border, width: 0.75 }, rectRadius: 0.12 });
}
function numCircle(s, x, y, n, color) {
  s.addShape(pres.shapes.OVAL, { x, y, w: 0.42, h: 0.42, fill: { color }, line: { color, width: 0 } });
  tb(s, String(n), { x, y, w: 0.42, h: 0.42, fontSize: 13, bold: true, color: P.bg, align: "center", valign: "middle" });
}
/* key-point rows: numbered circle + bold header + description */
function pointRows(s, points, x, y, w, rowH, colors, fs = 14) {
  points.forEach(([h, d], i) => {
    const yy = y + i * rowH;
    numCircle(s, x, yy + 0.04, i + 1, colors[i % colors.length]);
    const compact = fs <= 12.5; // five-row layouts: tighter header so the body keeps two lines
    tb(s, h, { x: x + 0.65, y: yy, w: w - 0.65, h: compact ? 0.3 : 0.38, fontSize: compact ? 15 : 18, bold: true, color: P.white });
    tb(s, d, { x: x + 0.65, y: yy + (compact ? 0.32 : 0.42), w: w - 0.65, h: rowH - (compact ? 0.36 : 0.5), fontSize: fs, color: P.dim, fit: "shrink", paraSpaceAfter: 0 });
  });
}
const COLORS = [P.accent, P.purple, P.green, P.amber, P.cyan, P.red];
/* pre-rendered Chart.js PNGs (img/*.png, built by render-charts) — Keynote drops imported native charts */
function fitImage(s, path, x, y, w, h, iw, ih) {
  const r = Math.min(w / iw, h / ih), dw = iw * r, dh = ih * r;
  s.addImage({ path, x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh });
}
const total = C.slides.length + 1;

/* ---------- title ---------- */
{
  const s = pres.addSlide(); s.background = { color: P.bg };
  s.addShape(pres.shapes.OVAL, { x: 8.6, y: -1.2, w: 6.5, h: 6.5, fill: { color: P.accent, transparency: 88 }, line: { width: 0 } });
  s.addShape(pres.shapes.OVAL, { x: 10.2, y: 3.2, w: 4.6, h: 4.6, fill: { color: P.purple, transparency: 86 }, line: { width: 0 } });
  tb(s, "OMNI ORACLE · 研究简报", { x: M, y: 1.35, w: 8, h: 0.35, fontSize: 12, color: P.accent, bold: true, charSpacing: 3 });
  tb(s, C.meta.title, { x: M, y: 1.85, w: 9.2, h: 2.0, fontSize: 40, bold: true, color: P.white, fit: "shrink" });
  tb(s, C.meta.subtitle, { x: M, y: 4.0, w: 8.6, h: 0.9, fontSize: 16, color: P.dim, fit: "shrink" });
  tb(s, `${C.meta.author}  ·  ${C.meta.date}`, { x: M, y: 5.5, w: 8, h: 0.35, fontSize: 12, color: P.text });
  tb(s, C.meta.site, { x: M, y: 5.85, w: 8, h: 0.3, fontSize: 11, color: P.accent });
  s.addNotes(notesFor("cover"));
}

C.slides.forEach((sl, idx) => {
  const s = pres.addSlide(); const n = idx + 2;
  frame(s, n, total, sl.sources); header(s, sl);
  s.addNotes(notesFor(sl.id) || sl.notes);
  const top = 1.75, bodyH = H - top - 0.95;

  if (sl.id === "why") {
    const cw = (W - 2 * M - 0.6) / 3;
    sl.points.forEach(([h, d], i) => {
      const x = M + i * (cw + 0.3);
      card(s, x, top, cw, bodyH);
      numCircle(s, x + 0.35, top + 0.35, i + 1, COLORS[i]);
      tb(s, h, { x: x + 0.35, y: top + 1.0, w: cw - 0.7, h: 0.6, fontSize: 23, bold: true, color: P.white });
      tb(s, d, { x: x + 0.35, y: top + 1.7, w: cw - 0.7, h: bodyH - 2.9, fontSize: 16, color: P.dim, fit: "shrink", lineSpacingMultiple: 1.2 });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.35, y: top + bodyH - 1.0, w: cw - 0.7, h: 0.62, fill: { color: COLORS[i], transparency: 85 }, line: { color: COLORS[i], width: 1 }, rectRadius: 0.08 });
      tb(s, sl.fixes[i], { x: x + 0.5, y: top + bodyH - 1.0, w: cw - 1.0, h: 0.62, fontSize: 13, bold: true, color: COLORS[i], valign: "middle", fit: "shrink" });
    });
  }
  else if (sl.table) {
    const rows = [sl.table.head.map(h => ({ text: h, options: { bold: true, color: P.white, fill: { color: P.card2 }, fontSize: 14 } }))]
      .concat(sl.table.rows.map(r => r.map((c, j) => ({ text: c, options: { color: j === 2 ? P.amber : j === 0 ? P.white : P.text, bold: j === 0, fontSize: 13.5 } }))));
    s.addTable(rows, { x: M, y: top, w: W - 2 * M, colW: [2.6, 3.0, 1.2, 5.33], fontFace: FONT, border: { type: "solid", pt: 0.5, color: P.border },
      fill: { color: P.card }, rowH: 0.66, valign: "middle", margin: 0.08 });
  }
  else if (sl.id === "nowcast") {
    const lw = 7.6;
    pointRows(s, sl.points, M, top, lw, 1.2, COLORS);
    const x = M + lw + 0.4, w = W - M - x;
    card(s, x, top, w, bodyH);
    tb(s, "即时预测栈（M1）", { x: x + 0.3, y: top + 0.25, w: w - 0.6, h: 0.35, fontSize: 15, bold: true, color: P.white });
    const layers = [["DFM 即时预测", "混频 · ragged edge · 新闻分解", P.accent], ["随机森林 / GBT", "非线性 · 替代数据", P.purple], ["TSFM 零样本", "Chronos-2 · TimesFM 2.5", P.cyan], ["BVAR 情景", "条件路径 · 扇形图", P.green]];
    layers.forEach(([a, b, c], i) => {
      const yy = top + 0.75 + i * 1.0;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.3, y: yy, w: w - 0.6, h: 0.86, fill: { color: c, transparency: 82 }, line: { color: c, width: 0.75 }, rectRadius: 0.08 });
      tb(s, a, { x: x + 0.5, y: yy + 0.12, w: w - 1, h: 0.34, fontSize: 15, bold: true, color: P.white });
      tb(s, b, { x: x + 0.5, y: yy + 0.48, w: w - 1, h: 0.3, fontSize: 11.5, color: P.dim });
    });
  }
  else if (sl.id === "text") {
    const lw = 8.0;
    pointRows(s, sl.points, M, top, lw, 1.2, COLORS, 13);
    const x = M + lw + 0.4, w = W - M - x;
    card(s, x, top, w, bodyH, P.card2);
    tb(s, sl.stat.big, { x: x + 0.3, y: top + 0.7, w: w - 0.6, h: 1.4, fontSize: 66, bold: true, color: P.amber, align: "center", valign: "middle" });
    tb(s, sl.stat.label, { x: x + 0.3, y: top + 2.3, w: w - 0.6, h: 1.6, fontSize: 15, color: P.text, align: "center", fit: "shrink" });
    tb(s, "ECB · 2026-04 博客", { x: x + 0.3, y: top + bodyH - 0.5, w: w - 0.6, h: 0.3, fontSize: 10, color: P.dim, align: "center" });
  }
  else if (sl.id === "trap") {
    pointRows(s, sl.points, M, top, W - 2 * M, 1.2, [P.red, P.amber, P.green], 13);
    /* point-in-time timeline */
    const ty = top + 3.85, x0 = M + 0.3, x1 = W - M - 0.3, step = (x1 - x0) / (sl.timeline.length - 1);
    s.addShape(pres.shapes.LINE, { x: x0, y: ty + 0.21, w: x1 - x0, h: 0, line: { color: P.border, width: 2 } });
    sl.timeline.forEach((t, i) => {
      const cx = x0 + i * step, col = i <= 1 ? P.green : i === 2 ? P.accent : P.amber;
      s.addShape(pres.shapes.OVAL, { x: cx - 0.21, y: ty, w: 0.42, h: 0.42, fill: { color: col }, line: { width: 0 } });
      tb(s, t, { x: cx - 1.0, y: ty + 0.5, w: 2.0, h: 0.3, fontSize: 13, color: P.text, align: "center", bold: true });
    });
    tb(s, "允许模型看到的一切都必须落在「预测发布」之前——用时间戳、数据 vintage 和知识截止日期来强制执行", { x: M, y: ty + 0.95, w: W - 2 * M, h: 0.35, fontSize: 12.5, color: P.dim, align: "center", italic: true });
  }
  else if (sl.chart) {
    const cw = 5.6;
    card(s, M, top, cw, bodyH);
    fitImage(s, "img/brier.png", M + 0.2, top + 0.2, cw - 0.4, bodyH - 0.4, 1000, 900);
    pointRows(s, sl.points, M + cw + 0.4, top, W - M - (M + cw + 0.4), 1.6, COLORS);
  }
  else if (sl.weights) {
    const lw = 7.4;
    pointRows(s, sl.points, M, top, lw, bodyH / sl.points.length, COLORS, sl.points.length > 4 ? 12.5 : 14);
    const x = M + lw + 0.4, w = W - M - x;
    card(s, x, top, w, bodyH);
    fitImage(s, "img/weights.png", x + 0.15, top + 0.15, w - 0.3, bodyH - 0.3, 1000, 1000);
  }
  else if (sl.chartSpread) {
    /* monthly average 10Y-3M spread from the site's daily snapshot */
    const by = {};
    live.treasury_curve.forEach(r => { const k = r.d.slice(0, 7); (by[k] = by[k] || []).push((r.y10 - r.m3) * 100); });
    const keys = Object.keys(by).sort().slice(-24);
    const vals = keys.map(k => +(by[k].reduce((a, b) => a + b, 0) / by[k].length).toFixed(0));
    const cw = 6.4;
    card(s, M, top, cw, bodyH);
    fitImage(s, "img/spread.png", M + 0.2, top + 0.2, cw - 0.4, bodyH - 0.4, 1200, 900);
    pointRows(s, sl.points, M + cw + 0.4, top, W - M - (M + cw + 0.4), 1.6, [P.red, P.amber, P.green]);
  }
  else if (sl.stats) {
    const sw = (W - 2 * M - 0.6) / 3;
    sl.stats.forEach(([big, lbl], i) => {
      const x = M + i * (sw + 0.3);
      card(s, x, top, sw, 1.7, P.card2);
      tb(s, big, { x: x + 0.25, y: top + 0.12, w: sw - 0.5, h: 0.85, fontSize: 42, bold: true, color: COLORS[i], valign: "middle" });
      tb(s, lbl, { x: x + 0.25, y: top + 1.0, w: sw - 0.5, h: 0.6, fontSize: 12.5, color: P.dim, fit: "shrink" });
    });
    const y2 = top + 2.1, colw = (W - 2 * M - 0.4) / 2;
    sl.points.forEach(([h, d], i) => {
      const x = M + (i % 2) * (colw + 0.4), yy = y2 + Math.floor(i / 2) * 1.55;
      numCircle(s, x, yy + 0.02, i + 1, COLORS[i]);
      tb(s, h, { x: x + 0.65, y: yy, w: colw - 0.65, h: 0.36, fontSize: 17, bold: true, color: P.white });
      tb(s, d, { x: x + 0.65, y: yy + 0.4, w: colw - 0.65, h: 1.0, fontSize: 13.5, color: P.dim, fit: "shrink" });
    });
  }
  else if (sl.id === "score") {
    const colw = (W - 2 * M - 0.4) / 2, rh = (bodyH - 0.4) / 2;
    sl.points.forEach(([h, d], i) => {
      const x = M + (i % 2) * (colw + 0.4), yy = top + Math.floor(i / 2) * (rh + 0.4);
      card(s, x, yy, colw, rh);
      numCircle(s, x + 0.3, yy + 0.3, i + 1, COLORS[i]);
      tb(s, h, { x: x + 0.9, y: yy + 0.3, w: colw - 1.2, h: 0.42, fontSize: 20, bold: true, color: P.white, valign: "middle" });
      tb(s, d, { x: x + 0.3, y: yy + 0.95, w: colw - 0.6, h: rh - 1.15, fontSize: 14, lineSpacingMultiple: 1.2, color: P.dim, fit: "shrink" });
    });
  }
  else if (sl.layers) {
    const rh = 0.82, gap = 0.12;
    sl.layers.slice().reverse().forEach(([name, desc, col], i) => {
      const yy = top + i * (rh + gap);
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: yy, w: W - 2 * M, h: rh, fill: { color: col, transparency: 84 }, line: { color: col, width: 1 }, rectRadius: 0.1 });
      tb(s, name, { x: M + 0.3, y: yy, w: 2.6, h: rh, fontSize: 19, bold: true, color: P.white, valign: "middle" });
      tb(s, desc, { x: M + 3.0, y: yy, w: W - 2 * M - 3.3, h: rh, fontSize: 14.5, color: P.text, valign: "middle", fit: "shrink" });
    });
    tb(s, "↑ 信号自下而上流动；每一层都可独立评分", { x: M, y: top + 5 * (rh + gap) + 0.02, w: W - 2 * M, h: 0.3, fontSize: 12.5, color: P.dim, italic: true, align: "center" });
  }
  else if (sl.roadmap) {
    const head = ["#", "改进项", "模块", "投入", "影响"].map(h => ({ text: h, options: { bold: true, color: P.white, fill: { color: P.card2 }, fontSize: 14 } }));
    const rows = [head].concat(sl.roadmap.map(r => r.map((c, j) => ({ text: c, options: { color: j === 4 ? P.amber : j === 1 ? P.white : P.text, bold: j === 1, fontSize: 14, align: j === 0 || j === 2 || j === 3 ? "center" : "left" } }))));
    s.addTable(rows, { x: M, y: top, w: W - 2 * M, colW: [0.6, 6.3, 1.4, 1.2, 2.63], fontFace: FONT, border: { type: "solid", pt: 0.5, color: P.border }, fill: { color: P.card }, rowH: 0.55, valign: "middle", margin: 0.08 });
    tb(s, "前三项可在 90 天内以演示形式上线；第 7 项决定平台可信度，建议与第 1 项同步。", { x: M, y: top + 8 * 0.55 + 0.3, w: W - 2 * M, h: 0.35, fontSize: 13.5, color: P.dim, italic: true });
  }
  else if (sl.principles) {
    const lw = 8.2;
    sl.principles.forEach((p, i) => {
      const yy = top + i * 0.95;
      numCircle(s, M, yy + 0.1, i + 1, COLORS[i]);
      tb(s, p, { x: M + 0.65, y: yy, w: lw - 0.65, h: 0.78, fontSize: 19, color: P.white, valign: "middle", fit: "shrink" });
    });
    const x = M + lw + 0.4, w = W - M - x;
    card(s, x, top, w, bodyH, "2A1418");
    tb(s, "底线", { x: x + 0.3, y: top + 0.3, w: w - 0.6, h: 0.45, fontSize: 21, bold: true, color: P.red });
    tb(s, sl.bottom, { x: x + 0.3, y: top + 0.9, w: w - 0.6, h: bodyH - 1.2, fontSize: 16, lineSpacingMultiple: 1.25, color: P.text, fit: "shrink" });
  }
  else if (sl.refs) {
    const half = Math.ceil(sl.refs.length / 2), colw = (W - 2 * M - 0.4) / 2;
    [sl.refs.slice(0, half), sl.refs.slice(half)].forEach((col, i) => {
      s.addText(col.map((r, k) => ({ text: r, options: { bullet: true, breakLine: k < col.length - 1 } })),
        { x: M + i * (colw + 0.4), y: top, w: colw, h: bodyH, isTextBox: true, fontFace: FONT, fontSize: 12, color: P.text, margin: 0, valign: "top", paraSpaceAfter: 8, fit: "shrink" });
    });
  }
});

pres.writeFile({ fileName: "ai-macro-forecasting-deck.pptx" }).then(f => console.log("wrote", f));

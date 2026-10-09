/* 讲义 (handout): one section per slide — 要点 / 讲稿 / 过渡 / 可能的提问 / 资料来源. Reads content.js + script.js. */
const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, Footer, PageNumber, TabStopType } = require("docx");
const C = require("./content.js");
const S = require("./script.js");

const FONT = "Arial", CJK = "PingFang SC";
const run = (t, o = {}) => new TextRun(Object.assign({ text: t, font: { ascii: FONT, hAnsi: FONT, eastAsia: CJK }, size: 21 }, o));
const para = (t, o = {}) => new Paragraph(Object.assign({ children: [run(t)], spacing: { after: 140, line: 330 } }, o));
const label = (t) => new Paragraph({ children: [run(t, { bold: true, color: "4F8CFF", size: 22 })], spacing: { before: 220, after: 100 } });
const bullet = (children, ref = "bul") => new Paragraph({ numbering: { reference: ref, level: 0 }, children, spacing: { after: 90, line: 320 } });
const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D1E0" };
const cell = (t, w, head) => new TableCell({ width: { size: w, type: WidthType.DXA }, shading: head ? { type: ShadingType.CLEAR, fill: "E8EEF9", color: "auto" } : undefined,
  borders: { top: border, bottom: border, left: border, right: border }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({ children: [run(t, { bold: !!head, size: 18 })] })] });
const table = (head, rows, w) => new Table({ width: { size: w.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: w, rows: [
  new TableRow({ tableHeader: true, children: head.map((h, k) => cell(h, w[k], true)) }),
  ...rows.map(r => new TableRow({ children: r.map((c, k) => cell(c, w[k], false)) })) ] });

const totalMin = Object.values(S).reduce((a, s) => a + (s.minutes || 0), 0);
const ch = [];
/* cover */
ch.push(new Paragraph({ children: [run("讲义 · 演讲稿", { size: 22, color: "4F8CFF", bold: true })], spacing: { before: 2000, after: 200 } }));
ch.push(new Paragraph({ children: [run(C.meta.title, { size: 46, bold: true })], spacing: { after: 240 } }));
ch.push(new Paragraph({ children: [run(C.meta.subtitle, { size: 24, color: "555F73" })], spacing: { after: 300 } }));
ch.push(new Paragraph({ children: [run(`${C.meta.author} · ${C.meta.date} · ${C.meta.site}`, { size: 20, color: "555F73" })], spacing: { after: 500 } }));
ch.push(label("如何使用"));
[`本讲义与幻灯片逐页对应（"第 N 页" = 幻灯片页码），共 ${C.slides.length + 1} 页，建议总时长约 ${totalMin} 分钟。`,
 "每页包含：幻灯片要点（听众看到的内容）、讲稿（对听众说的话，可直接照读或改写）、过渡语（进入下一页的一句话）、可能的提问与建议回答、资料来源。",
 "讲稿全文同时写入了 PPTX 的演讲者备注，在 Keynote / PowerPoint 的演讲者视图中可见。",
 "所有数字与结论均有出处；如需核对，参考文献汇总在最后一页。"].forEach(t => ch.push(bullet([run(t)])));
ch.push(label("目录"));
const toc = [["第 1 页", "封面", S.cover.minutes], ...C.slides.map((sl, i) => [`第 ${i + 2} 页`, sl.title, (S[sl.id] || {}).minutes || 0])];
toc.forEach(([p, t, m]) => ch.push(new Paragraph({ tabStops: [{ type: TabStopType.LEFT, position: 1300 }],
  children: [run(p, { bold: true }), run("\t" + t), run(m ? `（${m} 分钟）` : "", { color: "555F73" })], spacing: { after: 60 } })));

function section(n, title, kicker, sc, sl) {
  ch.push(new Paragraph({ children: [run(`第 ${n} 页 · ${title}`, { size: 30, bold: true })], heading: HeadingLevel.HEADING_2, pageBreakBefore: true, spacing: { after: 60 } }));
  ch.push(new Paragraph({ children: [run(kicker + (sc.minutes ? `  ·  建议 ${sc.minutes} 分钟` : ""), { size: 18, color: "4F8CFF", bold: true })], spacing: { after: 160 } }));
  if (sl) {
    ch.push(label("幻灯片要点"));
    if (sl.points) sl.points.forEach(([h, d]) => ch.push(bullet([run(h + " — ", { bold: true }), run(d)])));
    if (sl.fixes) sl.fixes.forEach(f => ch.push(bullet([run(f, { italic: true })])));
    if (sl.principles) sl.principles.forEach(p => ch.push(bullet([run(p)], "num")));
    if (sl.bottom) ch.push(para(sl.bottom, { children: [run(sl.bottom, { italic: true })] }));
    if (sl.stats) sl.stats.forEach(([b, l]) => ch.push(bullet([run(b + "  ", { bold: true }), run(l)])));
    if (sl.stat) ch.push(bullet([run(sl.stat.big + "  ", { bold: true }), run(sl.stat.label)]));
    if (sl.chart) ch.push(bullet([run("图表：" + sl.chart.title + " — " + sl.chart.labels.map((l, k) => `${l} ${sl.chart.values[k]}`).join("，"))]));
    if (sl.chartSpread) ch.push(bullet([run("图表：美国 10Y − 3M 国债利差 24 个月月均值（Omni Oracle 每日快照 data/live.json，美国财政部数据）")]));
    if (sl.weights) ch.push(bullet([run("集成权重示例：" + sl.weights.map(([a, b]) => `${a} ${b}%`).join("，"))]));
    if (sl.layers) sl.layers.forEach(([a, b]) => ch.push(bullet([run(a + " — ", { bold: true }), run(b)])));
    if (sl.timeline) ch.push(bullet([run("时间线：" + sl.timeline.join(" → "))]));
    if (sl.table) { ch.push(table(sl.table.head, sl.table.rows, [1800, 2300, 1000, 4260])); ch.push(para("")); }
    if (sl.roadmap) { ch.push(table(["#", "改进项", "模块", "投入", "影响"], sl.roadmap, [500, 4900, 1100, 1000, 1860])); ch.push(para("")); }
    if (sl.refs) sl.refs.forEach(r => ch.push(bullet([run(r, { size: 19 })])));
  }
  ch.push(label("讲稿"));
  sc.talk.forEach(t => ch.push(para(t)));
  if (sc.bridge) { ch.push(label("过渡语")); ch.push(para(sc.bridge, { children: [run(sc.bridge, { italic: true })] })); }
  if (sc.qa && sc.qa.length) {
    ch.push(label("可能的提问"));
    sc.qa.forEach(([q, a]) => { ch.push(new Paragraph({ children: [run("问：" + q, { bold: true })], spacing: { after: 60 } })); ch.push(para("答：" + a)); });
  }
  if (sl && sl.sources && sl.sources.length) {
    ch.push(label("资料来源"));
    sl.sources.forEach(src => ch.push(new Paragraph({ numbering: { reference: "bul", level: 0 }, children: [run(src, { size: 18, color: "555F73" })], spacing: { after: 40 } })));
  }
}
section(1, "封面", "开场", S.cover, null);
C.slides.forEach((sl, i) => section(i + 2, sl.title, sl.kicker, S[sl.id] || { talk: [], qa: [] }, sl));

const doc = new Document({
  creator: C.meta.author, title: C.meta.title + " — 讲义",
  styles: { default: { document: { run: { font: { ascii: FONT, hAnsi: FONT, eastAsia: CJK }, size: 21 } } },
    paragraphStyles: [{ id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: "0B0F17" }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } }] },
  numbering: { config: [
    { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    { reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
  ] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(C.meta.title + " · 讲义 · 第 ", { size: 16, color: "8A93A6" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "8A93A6", font: FONT }), run(" 页", { size: 16, color: "8A93A6" })] })] }) },
    children: ch,
  }],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync("ai-macro-forecasting-handout.docx", b); console.log("wrote handout", b.length, "bytes,", ch.length, "paragraphs"); });

/* HTML replica of the deck (same content.js) → PDF + per-slide PNG via headless Chrome.
   Used for visual QA when no Office renderer is available, and shipped as the PDF handout. */
const fs = require("fs");
const C = require("./content.js");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const COLORS = ["#4F8CFF", "#8B5CF6", "#22C55E", "#F59E0B", "#22D3EE", "#EF4444"];
const num = (i, c) => `<span class="num" style="background:${c}">${i}</span>`;
const rows = (pts, cls = "") => `<div class="rows ${cls}">` + pts.map(([h, d], i) => `<div class="row">${num(i + 1, COLORS[i % 6])}<div><b>${esc(h)}</b><p>${esc(d)}</p></div></div>`).join("") + "</div>";
const total = C.slides.length + 1;
const frame = (n, sl, body) => `<section class="slide" id="s${n}">
  <div class="kicker">${esc(sl.kicker)}</div><h2>${esc(sl.title)}</h2>
  <div class="body">${body}</div>
  ${sl.sources && sl.sources.length ? `<div class="src">来源：${esc(sl.sources.join(" · "))}</div>` : ""}
  <div class="foot"><span>${C.meta.site}</span><span>${n} / ${total}</span></div></section>`;

let html = `<section class="slide title" id="s1"><div class="orb a"></div><div class="orb b"></div>
  <div class="kicker">OMNI ORACLE · 研究简报</div><h1>${esc(C.meta.title)}</h1><p class="sub">${esc(C.meta.subtitle)}</p>
  <p class="meta">${esc(C.meta.author)} · ${esc(C.meta.date)}<br><span class="link">${C.meta.site}</span></p></section>`;

C.slides.forEach((sl, i) => {
  const n = i + 2; let b = "";
  if (sl.id === "why") b = `<div class="cards3">` + sl.points.map(([h, d], k) => `<div class="card why">${num(k + 1, COLORS[k])}<h3>${esc(h)}</h3><p>${esc(d)}</p><div class="chip" style="color:${COLORS[k]};border-color:${COLORS[k]}">${esc(sl.fixes[k])}</div></div>`).join("") + `</div>`;
  else if (sl.table) b = `<table><thead><tr>${sl.table.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${sl.table.rows.map(r => `<tr>${r.map((c, j) => `<td class="${j === 2 ? "amber" : j === 0 ? "strong" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  else if (sl.id === "nowcast") b = `<div class="two"><div>${rows(sl.points)}</div><div class="card stack"><h4>即时预测栈（M1）</h4>${[["DFM 即时预测", "混频 · ragged edge · 新闻分解", "#4F8CFF"], ["随机森林 / GBT", "非线性 · 替代数据", "#8B5CF6"], ["TSFM 零样本", "Chronos-2 · TimesFM 2.5", "#22D3EE"], ["BVAR 情景", "条件路径 · 扇形图", "#22C55E"]].map(([a, c, col]) => `<div class="layer" style="border-color:${col};background:${col}22"><b>${a}</b><span>${c}</span></div>`).join("")}</div></div>`;
  else if (sl.id === "text") b = `<div class="two"><div>${rows(sl.points)}</div><div class="card stat"><div class="big amber">${esc(sl.stat.big)}</div><p>${esc(sl.stat.label)}</p><span class="dim">ECB · 2026-04 博客</span></div></div>`;
  else if (sl.id === "trap") b = rows(sl.points, "tight") + `<div class="timeline">${sl.timeline.map((t, k) => `<div class="tp"><span class="dot" style="background:${k <= 1 ? "#22C55E" : k === 2 ? "#4F8CFF" : "#F59E0B"}"></span><b>${esc(t)}</b></div>`).join("")}</div><p class="caption">允许模型看到的一切都必须落在「预测发布」之前——用时间戳、数据 vintage 和知识截止日期来强制执行</p>`;
  else if (sl.chart) b = `<div class="two rev"><div class="card img"><img src="img/brier.png"></div><div>${rows(sl.points)}</div></div>`;
  else if (sl.weights) b = `<div class="two"><div>${rows(sl.points)}</div><div class="card img"><img src="img/weights.png"></div></div>`;
  else if (sl.chartSpread) b = `<div class="two rev wide"><div class="card img"><img src="img/spread.png"></div><div>${rows(sl.points)}</div></div>`;
  else if (sl.stats) b = `<div class="cards3 stats">${sl.stats.map(([v, l], k) => `<div class="card"><div class="big" style="color:${COLORS[k]}">${esc(v)}</div><p>${esc(l)}</p></div>`).join("")}</div><div class="grid2">${sl.points.map(([h, d], k) => `<div class="row">${num(k + 1, COLORS[k])}<div><b>${esc(h)}</b><p>${esc(d)}</p></div></div>`).join("")}</div>`;
  else if (sl.id === "score") b = `<div class="grid2 cards">${sl.points.map(([h, d], k) => `<div class="card"><div class="ch">${num(k + 1, COLORS[k])}<h3>${esc(h)}</h3></div><p>${esc(d)}</p></div>`).join("")}</div>`;
  else if (sl.layers) b = `<div class="layers">${sl.layers.slice().reverse().map(([a, d, c]) => `<div class="layer wide" style="border-color:#${c};background:#${c}26"><b>${esc(a)}</b><span>${esc(d)}</span></div>`).join("")}<p class="caption">↑ 信号自下而上流动；每一层都可独立评分</p></div>`;
  else if (sl.roadmap) b = `<table class="rm"><thead><tr><th>#</th><th>改进项</th><th>模块</th><th>投入</th><th>影响</th></tr></thead><tbody>${sl.roadmap.map(r => `<tr>${r.map((c, j) => `<td class="${j === 4 ? "amber" : j === 1 ? "strong" : "c"}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table><p class="caption left" style="font-size:15px">前三项可在 90 天内以演示形式上线；第 7 项决定平台可信度，建议与第 1 项同步。</p>`;
  else if (sl.principles) b = `<div class="two"><div class="princ">${sl.principles.map((p, k) => `<div class="row">${num(k + 1, COLORS[k])}<b>${esc(p)}</b></div>`).join("")}</div><div class="card red"><h3>底线</h3><p>${esc(sl.bottom)}</p></div></div>`;
  else if (sl.refs) b = `<ul class="refs">${sl.refs.map(r => `<li>${esc(r)}</li>`).join("")}</ul>`;
  html += frame(n, sl, b);
});

const css = `
@page { size: 13.333in 7.5in; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #0B0F17; color: #E5EAF3; font-family: "PingFang SC", "Helvetica Neue", Arial, sans-serif; }
.slide { position: relative; width: 1333px; height: 750px; padding: 42px 60px 0; background: #0B0F17; overflow: hidden; page-break-after: always; break-after: page; }
.kicker { color: #4F8CFF; font-size: 12px; font-weight: 700; letter-spacing: .18em; }
h2 { font-size: 34px; color: #fff; margin: 8px 0 26px; line-height: 1.25; }
.body { height: 540px; }
.src { position: absolute; left: 60px; right: 60px; bottom: 44px; font-size: 9.5px; color: #93A0B8; font-style: italic; }
.foot { position: absolute; left: 60px; right: 60px; bottom: 18px; display: flex; justify-content: space-between; font-size: 9.5px; color: #93A0B8; }
.title { padding-top: 130px; } .title h1 { font-size: 44px; color: #fff; width: 880px; line-height: 1.3; margin: 16px 0 26px; }
.title .sub { font-size: 17px; color: #93A0B8; width: 820px; line-height: 1.5; } .title .meta { position: absolute; top: 550px; font-size: 13px; line-height: 1.7; } .link { color: #4F8CFF; }
.orb { position: absolute; border-radius: 50%; } .orb.a { width: 650px; height: 650px; right: -120px; top: -120px; background: rgba(79,140,255,.12); } .orb.b { width: 460px; height: 460px; right: -100px; top: 320px; background: rgba(139,92,246,.14); }
.num { display: inline-flex; width: 34px; height: 34px; border-radius: 50%; color: #0B0F17; font-weight: 700; font-size: 14px; align-items: center; justify-content: center; flex: none; }
.rows .row { display: flex; gap: 16px; margin-bottom: 30px; } .rows b { display: block; font-size: 20px; color: #fff; margin: 2px 0 6px; } .rows p { font-size: 15.5px; color: #93A0B8; line-height: 1.6; }
.rows.tight .row { margin-bottom: 30px; }
.card { background: #151D2C; border: 1px solid #24304A; border-radius: 12px; padding: 26px; }
.cards3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; height: 100%; } .cards3 .card h3 { font-size: 25px; color: #fff; margin: 28px 0 18px; } .cards3 .card p { font-size: 17px; color: #93A0B8; line-height: 1.75; }
.two { display: grid; grid-template-columns: 1fr 440px; gap: 34px; height: 100%; } .two.rev { grid-template-columns: 560px 1fr; } .two.wide { grid-template-columns: 640px 1fr; }
.card.img { display: flex; align-items: center; justify-content: center; padding: 16px; height: 100%; } .card.img img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; }
.stack h4 { color: #fff; font-size: 17px; margin-bottom: 18px; } .layer { border: 1px solid; border-radius: 8px; padding: 20px 20px; margin-bottom: 16px; } .layer b { display: block; color: #fff; font-size: 17px; margin-bottom: 4px; } .layer span { font-size: 13px; color: #93A0B8; }
.layer.wide { display: flex; align-items: center; gap: 28px; padding: 26px 30px; margin-bottom: 14px; } .layer.wide b { font-size: 21px; width: 220px; flex: none; margin: 0; } .layer.wide span { font-size: 16px; color: #E5EAF3; line-height: 1.5; }
.card.stat { background: #1A2437; text-align: center; display: flex; flex-direction: column; justify-content: center; } .big { font-size: 76px; font-weight: 800; } .amber { color: #F59E0B; } .card.stat p { font-size: 17px; margin: 24px 0; line-height: 1.6; } .dim { color: #93A0B8; font-size: 13px; }
.timeline { display: flex; justify-content: space-between; margin: 80px 30px 0; position: relative; } .timeline:before { content: ""; position: absolute; left: 0; right: 0; top: 15px; height: 2px; background: #24304A; }
.tp { text-align: center; position: relative; width: 120px; } .dot { display: block; width: 30px; height: 30px; border-radius: 50%; margin: 0 auto 10px; } .tp b { font-size: 15px; }
.caption { text-align: center; color: #93A0B8; font-size: 15px; font-style: italic; margin-top: 26px; } .caption.left { text-align: left; }
table { width: 100%; border-collapse: collapse; font-size: 16px; } th { background: #1A2437; color: #fff; text-align: left; padding: 16px 16px; border: 1px solid #24304A; } td { padding: 19px 16px; border: 1px solid #24304A; background: #151D2C; vertical-align: middle; }
td.strong { color: #fff; font-weight: 700; } td.amber { color: #F59E0B; } td.c { text-align: center; }
.cards3.stats { height: auto; grid-auto-rows: 150px; margin-bottom: 34px; } .stats .card { padding: 20px 24px; } .stats .big { font-size: 46px; } .stats p { font-size: 14px; color: #93A0B8; line-height: 1.45; margin-top: 8px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px 44px; } .grid2 .row { display: flex; gap: 16px; } .grid2 b { display: block; color: #fff; font-size: 19px; margin-bottom: 6px; } .grid2 p { font-size: 15px; color: #93A0B8; line-height: 1.55; }
.grid2.cards { height: 100%; grid-auto-rows: 1fr; } .grid2.cards .card { padding: 34px; } .grid2.cards .ch { display: flex; align-items: center; gap: 16px; margin-bottom: 22px; } .grid2.cards h3 { font-size: 23px; color: #fff; } .grid2.cards p { font-size: 17px; line-height: 1.7; }
.princ .row { display: flex; align-items: center; gap: 18px; margin-bottom: 44px; } .princ b { font-size: 21px; color: #fff; line-height: 1.5; }
.card.red { background: #2A1418; border-color: #5a2a30; } .card.red { padding: 34px; } .card.red h3 { color: #EF4444; font-size: 23px; margin-bottom: 20px; } .card.red p { font-size: 18px; line-height: 1.8; }
.card.why { position: relative; padding-bottom: 80px; } .chip { position: absolute; left: 26px; right: 26px; bottom: 26px; border: 1px solid; border-radius: 8px; padding: 10px 14px; font-size: 14px; font-weight: 600; }
.refs { columns: 2; column-gap: 40px; font-size: 14px; line-height: 1.55; padding-left: 18px; } .refs li { margin-bottom: 14px; break-inside: avoid; }
`;
fs.writeFileSync("deck.html", `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(C.meta.title)}</title><style>${css}</style></head><body>${html}
<script>const q=new URLSearchParams(location.search).get("s");if(q){document.querySelectorAll(".slide").forEach(s=>{if(s.id!=="s"+q)s.style.display="none"});}</script></body></html>`);
console.log("deck.html written,", C.slides.length + 1, "slides");

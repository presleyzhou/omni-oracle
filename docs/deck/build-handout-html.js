/* HTML/PDF handout — same content as the docx, rendered by Chrome so it looks identical everywhere. */
const fs = require("fs");
const C = require("./content.js"), S = require("./script.js");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const totalMin = Object.values(S).reduce((a, s) => a + (s.minutes || 0), 0);
let h = "";
const sec = (n, title, kicker, sc, sl) => {
  let b = `<section class="page"><div class="kick">${esc(kicker)}${sc.minutes ? ` · 建议 ${sc.minutes} 分钟` : ""}</div><h2>第 ${n} 页 · ${esc(title)}</h2>`;
  if (sl) {
    b += `<h3>幻灯片要点</h3><ul>`;
    if (sl.points) b += sl.points.map(([a, d]) => `<li><b>${esc(a)}</b> — ${esc(d)}</li>`).join("");
    if (sl.fixes) b += sl.fixes.map(f => `<li><i>${esc(f)}</i></li>`).join("");
    if (sl.principles) b += sl.principles.map((p, i) => `<li>${i + 1}. ${esc(p)}</li>`).join("");
    if (sl.bottom) b += `<li><i>${esc(sl.bottom)}</i></li>`;
    if (sl.stats) b += sl.stats.map(([v, l]) => `<li><b>${esc(v)}</b> ${esc(l)}</li>`).join("");
    if (sl.stat) b += `<li><b>${esc(sl.stat.big)}</b> ${esc(sl.stat.label)}</li>`;
    if (sl.chart) b += `<li>图表：${esc(sl.chart.title)} — ${sl.chart.labels.map((l, k) => `${esc(l)} ${sl.chart.values[k]}`).join("，")}</li>`;
    if (sl.chartSpread) b += `<li>图表：美国 10Y − 3M 国债利差 24 个月月均值（Omni Oracle 每日快照，美国财政部数据）</li>`;
    if (sl.weights) b += `<li>集成权重示例：${sl.weights.map(([a, w]) => `${esc(a)} ${w}%`).join("，")}</li>`;
    if (sl.layers) b += sl.layers.map(([a, d]) => `<li><b>${esc(a)}</b> — ${esc(d)}</li>`).join("");
    if (sl.timeline) b += `<li>时间线：${sl.timeline.map(esc).join(" → ")}</li>`;
    if (sl.refs) b += sl.refs.map(r => `<li class="small">${esc(r)}</li>`).join("");
    b += `</ul>`;
    if (sl.table) b += `<table><thead><tr>${sl.table.head.map(x => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${sl.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    if (sl.roadmap) b += `<table><thead><tr><th>#</th><th>改进项</th><th>模块</th><th>投入</th><th>影响</th></tr></thead><tbody>${sl.roadmap.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  b += `<h3>讲稿</h3>` + sc.talk.map(t => `<p class="talk">${esc(t)}</p>`).join("");
  if (sc.bridge) b += `<h3>过渡语</h3><p class="bridge">${esc(sc.bridge)}</p>`;
  if (sc.qa && sc.qa.length) b += `<h3>可能的提问</h3>` + sc.qa.map(([q, a]) => `<p class="q">问：${esc(q)}</p><p class="a">答：${esc(a)}</p>`).join("");
  if (sl && sl.sources && sl.sources.length) b += `<h3>资料来源</h3><ul class="src">${sl.sources.map(s => `<li>${esc(s)}</li>`).join("")}</ul>`;
  return b + `</section>`;
};
h += `<section class="page cover"><div class="kick">讲义 · 演讲稿</div><h1>${esc(C.meta.title)}</h1><p class="sub">${esc(C.meta.subtitle)}</p><p class="meta">${esc(C.meta.author)} · ${esc(C.meta.date)} · ${C.meta.site}</p>
<h3>如何使用</h3><ul><li>本讲义与幻灯片逐页对应（"第 N 页" = 幻灯片页码），共 ${C.slides.length + 1} 页，建议总时长约 ${totalMin} 分钟。</li><li>每页包含：幻灯片要点、讲稿（对听众说的话，可直接照读或改写）、过渡语、可能的提问与建议回答、资料来源。</li><li>讲稿全文同时写入了 PPTX 的演讲者备注。</li></ul>
<h3>目录</h3><table class="toc">${[["1", "封面", S.cover.minutes], ...C.slides.map((sl, i) => [String(i + 2), sl.title, (S[sl.id] || {}).minutes || 0])].map(([p, t, m]) => `<tr><td>第 ${p} 页</td><td>${esc(t)}</td><td>${m ? m + " 分钟" : "—"}</td></tr>`).join("")}</table></section>`;
h += sec(1, "封面", "开场", S.cover, null);
C.slides.forEach((sl, i) => { h += sec(i + 2, sl.title, sl.kicker, S[sl.id] || { talk: [], qa: [] }, sl); });
const css = `@page { size: A4; margin: 20mm 18mm 22mm; }
body { font-family: "PingFang SC", "Helvetica Neue", Arial, sans-serif; color: #1a2130; font-size: 11pt; line-height: 1.65; margin: 0; }
.page { page-break-after: always; break-after: page; } .page:last-child { page-break-after: auto; }
.kick { color: #4F8CFF; font-weight: 700; font-size: 9.5pt; letter-spacing: .06em; } h1 { font-size: 24pt; margin: 6px 0 10px; line-height: 1.3; } h2 { font-size: 17pt; margin: 4px 0 14px; }
h3 { color: #4F8CFF; font-size: 11pt; margin: 18px 0 6px; } .sub { color: #555F73; font-size: 12pt; } .meta { color: #555F73; font-size: 10pt; margin-bottom: 24px; }
ul { margin: 0 0 6px; padding-left: 18px; } li { margin-bottom: 5px; } li.small, .src li { font-size: 9.5pt; color: #555F73; }
p.talk { text-indent: 0; margin: 0 0 9px; text-align: justify; } p.bridge { font-style: italic; color: #333; margin: 0; }
p.q { font-weight: 700; margin: 8px 0 2px; } p.a { margin: 0 0 6px; }
table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 6px 0 10px; } th, td { border: 1px solid #C9D1E0; padding: 5px 7px; text-align: left; vertical-align: top; } th { background: #E8EEF9; }
table.toc td { border: none; padding: 2px 6px; } table.toc td:first-child { font-weight: 700; width: 70px; } table.toc td:last-child { color: #555F73; text-align: right; }
.cover { padding-top: 60px; }`;
fs.writeFileSync("handout.html", `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(C.meta.title)} — 讲义</title><style>${css}</style></head><body>${h}</body></html>`);
console.log("handout.html written");

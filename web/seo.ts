/**
 * Server-rendered SEO / AEO pages + crawl infrastructure.
 *
 * Renders real HTML (with structured data) for /faq, /compliance, /blog, /blog/:slug, and emits
 * /sitemap.xml, /robots.txt, /llms.txt. Structured data (FAQPage, BlogPosting, Organization) makes
 * the content eligible for rich results and citable by answer engines (Google AI Overviews,
 * Perplexity, ChatGPT, Gemini). All copy is intel-only.
 */
import { SITE, FAQS, COMPLIANCE, SEED_POSTS, BlogPost, QA } from "./content";

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Inline markdown on already-escaped text: **bold**, [text](url), `code`.
const inline = (s: string): string =>
  s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>");

const ie = (s: string): string => inline(esc(s));

/** Minimal, safe markdown → HTML (h2/h3, blockquote, unordered lists, paragraphs, inline). */
export function mdToHtml(md: string): string {
  const out: string[] = [];
  let list: string[] | null = null;
  let para: string[] = [];
  const flushList = () => { if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; } };
  const flushPara = () => { if (para.length) { out.push(`<p>${ie(para.join(" "))}</p>`); para = []; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (line.startsWith("### ")) { flushPara(); flushList(); out.push(`<h3>${ie(line.slice(4))}</h3>`); }
    else if (line.startsWith("## ")) { flushPara(); flushList(); out.push(`<h2>${ie(line.slice(3))}</h2>`); }
    else if (line.startsWith("> ")) { flushPara(); flushList(); out.push(`<blockquote>${ie(line.slice(2))}</blockquote>`); }
    else if (line.startsWith("- ")) { flushPara(); (list = list || []).push(`<li>${ie(line.slice(2))}</li>`); }
    else { para.push(line); }
  }
  flushPara(); flushList();
  return out.join("\n");
}

const jsonLd = (obj: unknown): string =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

const orgLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.company,
  url: SITE.url,
  description: SITE.description,
  ...(SITE.sameAs.length ? { sameAs: SITE.sameAs } : {}),
});

const faqLd = (faqs: QA[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

const CSS = `
:root{--bg:#08090B;--panel:#0D1117;--bd:#1C2128;--grn:#00FF66;--amb:#FF9900;--tx:#E6E8EB;--dim:#8B949E}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
a{color:var(--grn);text-decoration:none}a:hover{text-decoration:underline}
code{font-family:ui-monospace,"JetBrains Mono",monospace;background:#0d1117;border:1px solid var(--bd);border-radius:4px;padding:1px 5px;font-size:.9em}
header,footer{border-color:var(--bd)}
.wrap{max-width:820px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--bd);position:sticky;top:0;background:rgba(8,9,11,.85);backdrop-filter:blur(8px)}
.nav{display:flex;align-items:center;gap:22px;height:60px}
.brand{font-weight:800;font-size:20px;letter-spacing:-.5px;color:var(--tx)}
.brand b{color:var(--grn)}
.nav a{color:var(--dim);font-size:14px;font-weight:600}
.nav a:hover{color:var(--grn);text-decoration:none}
.nav .sp{flex:1}
main{padding:44px 0 64px}
h1{font-size:34px;line-height:1.15;letter-spacing:-1px;margin:.2em 0 .3em}
h2{font-size:23px;margin:1.7em 0 .4em;letter-spacing:-.4px}
h3{font-size:18px;margin:1.4em 0 .3em}
.eyebrow{font:600 12px/1 ui-monospace,monospace;letter-spacing:3px;color:var(--amb);text-transform:uppercase}
.lede{color:var(--dim);font-size:18px}
blockquote{border-left:3px solid var(--grn);margin:1.4em 0;padding:.2em 0 .2em 16px;color:var(--dim);font-style:italic}
.faq{border-top:1px solid var(--bd);padding:20px 0}
.faq h3{margin:0 0 .4em;font-size:18px;color:var(--tx)}
.faq p{margin:0;color:var(--dim)}
.card{display:block;border:1px solid var(--bd);border-radius:12px;padding:18px 20px;margin:14px 0;background:var(--panel)}
.card:hover{border-color:#2D333B;text-decoration:none}
.card h3{margin:0 0 .3em;color:var(--tx)}
.card p{margin:0;color:var(--dim);font-size:15px}
.meta{color:var(--dim);font-size:13px;font-family:ui-monospace,monospace}
.tag{display:inline-block;border:1px solid var(--bd);border-radius:99px;padding:2px 10px;font-size:12px;color:var(--dim);margin:0 6px 6px 0}
.disc{border:1px solid #FF990033;background:#FF99000d;border-radius:10px;padding:12px 16px;color:var(--amb);font-size:14px;margin:22px 0}
footer{border-top:1px solid var(--bd);padding:26px 0;color:var(--dim);font-size:13px;margin-top:40px}
footer a{color:var(--dim)}footer .row{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:8px}
`;

interface PageOpts {
  title: string;
  description: string;
  path: string;
  bodyHtml: string;
  extraLd?: unknown[];
  ogType?: string;
}

export function layout(o: PageOpts): string {
  const canonical = `${SITE.url}${o.path}`;
  const lds = [orgLd(), ...(o.extraLd || [])].map(jsonLd).join("");
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="${esc(o.ogType || "website")}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.description)}">
<meta name="robots" content="index,follow">
<style>${CSS}</style>
${lds}
</head><body>
<header><div class="wrap"><nav class="nav">
<a class="brand" href="/">TICKRR<b>.</b></a>
<span class="sp"></span>
<a href="/">Terminal</a><a href="/blog">Blog</a><a href="/faq">FAQ</a><a href="/compliance">Compliance</a>
</nav></div></header>
<main><div class="wrap">${o.bodyHtml}</div></main>
<footer><div class="wrap">
<div class="row"><a href="/">Terminal</a><a href="/blog">Blog</a><a href="/faq">FAQ</a><a href="/compliance">Compliance</a><a href="/sitemap.xml">Sitemap</a></div>
<div>${esc(SITE.name)} by ${esc(SITE.company)} · Polymarket + Kalshi · grounded by Gemini · <strong>Intel only, never picks.</strong> Not financial or betting advice.</div>
</div></footer>
</body></html>`;
}

export function renderFaqPage(): string {
  const items = FAQS.map((f) => `<div class="faq"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join("");
  const body = `<span class="eyebrow">FAQ</span>
<h1>Tickrr — frequently asked questions</h1>
<p class="lede">${esc(SITE.tagline)}. Intel only — Tickrr never tells you to bet and never places trades.</p>
${items}
<div class="disc">Informational only. Not financial, investment, or betting advice. See <a href="/compliance">Compliance</a>.</div>`;
  return layout({ title: `FAQ · ${SITE.name}`, description: "Answers about Tickrr: prediction-market analytics, cross-venue divergences, fair value, data sources, and intel-only positioning.", path: "/faq", bodyHtml: body, extraLd: [faqLd(FAQS)] });
}

export function renderCompliancePage(): string {
  const secs = COMPLIANCE.sections.map((s) => `<h2>${esc(s.h)}</h2><p>${esc(s.p)}</p>`).join("");
  const body = `<span class="eyebrow">Compliance</span>
<h1>Compliance &amp; responsible use</h1>
<p class="meta">Last updated ${esc(COMPLIANCE.updated)}</p>
<div class="disc">Tickrr is intel only. It never tells you to bet, buy, sell, or size a position, and it never executes trades.</div>
${secs}`;
  return layout({ title: `Compliance · ${SITE.name}`, description: "Tickrr compliance: informational-only analytics, no execution, data attribution (Polymarket/Kalshi), eligibility, and responsible-use notice.", path: "/compliance", bodyHtml: body });
}

export function renderBlogIndex(posts: BlogPost[]): string {
  const cards = posts.map((p) => `<a class="card" href="/blog/${esc(p.slug)}">
<div class="meta">${esc(p.date)}</div><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></a>`).join("");
  const body = `<span class="eyebrow">Blog</span>
<h1>Tickrr Journal — prediction-market intelligence</h1>
<p class="lede">Explainers and live-market reads across sports, politics, macro &amp; crypto. Intel only.</p>
${cards || "<p class=\"lede\">Posts coming soon.</p>"}`;
  const blogLd = {
    "@context": "https://schema.org", "@type": "Blog", name: `${SITE.name} Journal`, url: `${SITE.url}/blog`,
    blogPost: posts.slice(0, 25).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE.url}/blog/${p.slug}`, datePublished: p.date })),
  };
  return layout({ title: `Blog · ${SITE.name}`, description: "The Tickrr Journal: prediction-market explainers and live-market intelligence across sports, politics, macro, and crypto.", path: "/blog", bodyHtml: body, extraLd: [blogLd] });
}

export function renderBlogPost(p: BlogPost): string {
  const tags = p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("");
  const faqBlock = p.faqs?.length
    ? `<h2>FAQ</h2>${p.faqs.map((f) => `<div class="faq"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join("")}`
    : "";
  const body = `<span class="eyebrow">Journal</span>
<h1>${esc(p.title)}</h1>
<p class="meta">${esc(p.date)} · ${esc(SITE.name)}</p>
<p class="lede">${esc(p.description)}</p>
${mdToHtml(p.body)}
${faqBlock}
<div>${tags}</div>
<div class="disc">Intel only. Not financial, investment, or betting advice. See <a href="/compliance">Compliance</a>.</div>`;
  const articleLd = {
    "@context": "https://schema.org", "@type": "BlogPosting",
    headline: p.title, description: p.description, datePublished: p.date, dateModified: p.date,
    author: { "@type": "Organization", name: SITE.company },
    publisher: { "@type": "Organization", name: SITE.company },
    mainEntityOfPage: `${SITE.url}/blog/${p.slug}`,
    keywords: p.tags.join(", "),
  };
  const extra: unknown[] = [articleLd];
  if (p.faqs?.length) extra.push(faqLd(p.faqs));
  return layout({ title: `${p.title} · ${SITE.name}`, description: p.description, path: `/blog/${p.slug}`, bodyHtml: body, extraLd: extra, ogType: "article" });
}

// ---- crawl infrastructure ----------------------------------------------------------------

export function sitemapXml(posts: BlogPost[]): string {
  const urls = [
    { loc: "/", pri: "1.0" }, { loc: "/blog", pri: "0.8" },
    { loc: "/faq", pri: "0.7" }, { loc: "/compliance", pri: "0.4" },
    ...posts.map((p) => ({ loc: `/blog/${p.slug}`, pri: "0.6", lastmod: p.date })),
  ];
  const body = urls.map((u: any) =>
    `  <url><loc>${SITE.url}${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.pri}</priority></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`;
}

// llms.txt — an emerging convention that points AI answer engines at the pages worth citing.
export function llmsTxt(posts: BlogPost[]): string {
  const postLines = posts.map((p) => `- [${p.title}](${SITE.url}/blog/${p.slug}): ${p.description}`).join("\n");
  return `# ${SITE.name} — ${SITE.tagline}

> ${SITE.description}

Tickrr is INTEL ONLY: it never tells users to bet/buy/sell/size a position and never promises outcomes. Kalshi figures are derived analytics with an attributed link.

## Key pages
- [Terminal](${SITE.url}/): the live prediction-market intelligence board (sports, politics, macro, crypto).
- [FAQ](${SITE.url}/faq): what Tickrr is, cross-venue divergences, fair value, data sources.
- [Compliance](${SITE.url}/compliance): informational-only positioning, data attribution, responsible use.

## Journal
${postLines || "- (posts coming soon)"}
`;
}

export { SEED_POSTS };

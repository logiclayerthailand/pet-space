#!/usr/bin/env node
/*
 * build-blog.js — Pet Space blog generator
 * อ่านไฟล์ content/articles/*.md (มี frontmatter) แล้วสร้าง:
 *   - blog/<slug>.html   (หน้าบทความ + SEO + JSON-LD BlogPosting)
 *   - blog.html          (หน้ารวมบทความ)
 *   - sitemap.xml        (หน้า static + บทความทั้งหมด)
 * ไม่มี dependency ภายนอก — รันด้วย `node scripts/build-blog.js`
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'content', 'articles');
const BLOG_DIR = path.join(ROOT, 'blog');
const DOMAIN = 'https://petspace.vercel.app';
const LOGO = DOMAIN + '/Logo.jpg';
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const STATIC_PAGES = [
  { loc: '/', pri: '1.0', freq: 'weekly' },
  { loc: '/dog-grooming.html', pri: '0.9', freq: 'monthly' },
  { loc: '/cat-grooming.html', pri: '0.9', freq: 'monthly' },
  { loc: '/spa.html', pri: '0.8', freq: 'monthly' },
  { loc: '/pet-hotel.html', pri: '0.8', freq: 'monthly' },
  { loc: '/blog.html', pri: '0.8', freq: 'weekly' },
  { loc: '/contact.html', pri: '0.7', freq: 'monthly' },
];

// ---------- helpers ----------
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;');

function fmtDate(iso) {
  const d = String(iso || '').split('-');
  if (d.length !== 3) return iso || '';
  return `${parseInt(d[2], 10)} ${TH_MONTHS[parseInt(d[1], 10) - 1]} ${d[0]}`;
}

function parseFront(raw) {
  const t = raw.replace(/\r\n/g, '\n');
  const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: t };
  const meta = {};
  for (const ln of m[1].split('\n')) {
    const mm = ln.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (mm) meta[mm[1]] = mm[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2] };
}

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = '', listBuf = '', listType = null, para = [];
  const flushList = () => { if (listType) { html += `<${listType}>${listBuf}</${listType}>`; listBuf = ''; listType = null; } };
  const flushPara = () => { if (para.length) { html += '<p>' + para.map(inline).join(' ') + '</p>'; para = []; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushList(); flushPara(); }
    else if ((m = line.match(/^#{1,3}\s+(.*)/))) { flushList(); flushPara(); const tag = line.startsWith('###') ? 'h3' : 'h2'; html += `<${tag}>${inline(m[1])}</${tag}>`; }
    else if ((m = line.match(/^>\s+(.*)/))) { flushList(); flushPara(); html += `<blockquote>${inline(m[1])}</blockquote>`; }
    else if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/))) { flushList(); flushPara(); html += `<img src="${m[2]}" alt="${escAttr(m[1])}" loading="lazy">`; }
    else if ((m = line.match(/^[-*]\s+(.*)/))) { flushPara(); if (listType !== 'ul') { flushList(); listType = 'ul'; } listBuf += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^\d+\.\s+(.*)/))) { flushPara(); if (listType !== 'ol') { flushList(); listType = 'ol'; } listBuf += `<li>${inline(m[1])}</li>`; }
    else { flushList(); para.push(line); }
  }
  flushList(); flushPara();
  return html;
}

function excerpt(a) {
  if (a.meta.description) return a.meta.description;
  const text = a.body.replace(/[#>*`\-]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
  return text.slice(0, 140) + (text.length > 140 ? '…' : '');
}

function navMenu(prefix, active) {
  const items = [
    ['dog-grooming.html', 'อาบน้ำ-ตัดขนสุนัข'], ['cat-grooming.html', 'อาบน้ำแมว'],
    ['spa.html', 'สปา ARTERO'], ['pet-hotel.html', 'โรงแรม'],
    ['blog.html', 'บทความ'], ['contact.html', 'ติดต่อ'],
  ];
  return items.map(([h, l]) => `<a href="${prefix}${h}"${active === h ? ' class="active"' : ''}>${l}</a>`).join('\n      ');
}

function header(prefix, active) {
  return `<header>
  <nav class="nav">
    <a href="${prefix}index.html" class="brand"><img src="${prefix}Logo.jpg" alt="โลโก้ Pet Space บางพลี"><span class="script">Pet Space</span></a>
    <div class="menu">
      ${navMenu(prefix, active)}
    </div>
    <a href="https://line.me/R/ti/p/@pet-space" class="btn btn-line">💬 จองคิว LINE</a>
    <button class="hamb" aria-label="เปิดเมนู" aria-expanded="false" onclick="var m=this.closest('.nav').querySelector('.menu');this.setAttribute('aria-expanded',m.classList.toggle('open'))">☰</button>
  </nav>
</header>`;
}

function footer(prefix) {
  return `<footer>
  <div class="wrap">
    <div class="script">Pet Space</div>
    <p style="font-size:.9rem;opacity:.9">อาบน้ำ • ตัดขน • สปา • รับฝากเลี้ยง — บางพลี สมุทรปราการ</p>
    <div class="fmenu"><a href="${prefix}index.html">หน้าแรก</a><a href="${prefix}dog-grooming.html">อาบน้ำ-ตัดขนสุนัข</a><a href="${prefix}cat-grooming.html">อาบน้ำแมว</a><a href="${prefix}spa.html">สปา ARTERO</a><a href="${prefix}blog.html">บทความ</a><a href="${prefix}contact.html">ติดต่อ</a></div>
    <p class="small">📞 064-749-6614 · LINE @pet-space · เปิดทุกวัน 10:00–19:00 (หยุดศุกร์)</p>
    <p class="small">© 2026 Pet Space Grooming &amp; Hotel · 111/13 บางพลีใหญ่ บางพลี สมุทรปราการ 10540</p>
  </div>
</footer>
<div class="float-cta">
  <a href="https://line.me/R/ti/p/@pet-space" class="f-line" aria-label="LINE">💬</a>
  <a href="tel:0647496614" class="f-tel" aria-label="โทร">📞</a>
</div>`;
}

function headTag(prefix, opts) {
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(opts.title)}</title>
<meta name="description" content="${escAttr(opts.desc)}">
${opts.keywords ? `<meta name="keywords" content="${escAttr(opts.keywords)}">\n` : ''}<link rel="canonical" href="${opts.canonical}">
<meta name="theme-color" content="#E8A0B0">
<meta property="og:type" content="${opts.ogType || 'website'}">
<meta property="og:title" content="${escAttr(opts.title)}">
<meta property="og:description" content="${escAttr(opts.desc)}">
<meta property="og:image" content="${opts.ogImage || LOGO}">
<meta property="og:url" content="${opts.canonical}">
<meta property="og:locale" content="th_TH">
<link rel="icon" type="image/jpeg" href="${prefix}Logo.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Pacifico&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${prefix}assets/style.css">
${(opts.jsonld || []).map(j => `<script type="application/ld+json">\n${JSON.stringify(j)}\n</script>`).join('\n')}
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-C55FVSRJDN"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-C55FVSRJDN');</script>
</head>
<body>`;
}

// ---------- render article page ----------
function renderArticle(a) {
  const url = `${DOMAIN}/blog/${a.slug}.html`;
  const cover = a.meta.cover ? a.meta.cover : '';
  const coverAbs = cover ? (cover.startsWith('http') ? cover : DOMAIN + '/' + cover.replace(/^\.\.\//, '')) : LOGO;
  const bodyHtml = mdToHtml(a.body);
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: a.meta.title, description: excerpt(a), image: coverAbs, datePublished: a.meta.date, dateModified: a.meta.date, author: { '@type': 'Organization', name: 'Pet Space' }, publisher: { '@type': 'Organization', name: 'Pet Space — Grooming & Hotel', logo: { '@type': 'ImageObject', url: LOGO } }, mainEntityOfPage: url },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: 'บทความ', item: DOMAIN + '/blog.html' },
      { '@type': 'ListItem', position: 3, name: a.meta.title, item: url },
    ] },
  ];
  return `${headTag('../', { title: `${a.meta.title} | Pet Space`, desc: excerpt(a), keywords: a.meta.keywords, canonical: url, ogType: 'article', ogImage: coverAbs, jsonld })}

${header('../', 'blog.html')}

<div class="wrap"><p class="crumbs"><a href="../index.html">หน้าแรก</a> › <a href="../blog.html">บทความ</a> › ${esc(a.meta.title)}</p></div>

<section>
  <div class="wrap">
    <article class="article">
      ${a.meta.category ? `<span class="eyebrow">${esc(a.meta.category)}</span>` : ''}
      <h1>${esc(a.meta.title)}</h1>
      <p class="article-meta">🗓️ ${fmtDate(a.meta.date)} · Pet Space บางพลี สมุทรปราการ</p>
      ${cover ? `<img class="article-cover" src="${cover}" alt="${escAttr(a.meta.title)}">` : ''}
      ${bodyHtml}
      <div class="share-cta">
        <h2 style="margin-bottom:6px">สนใจบริการของเรา?</h2>
        <p class="sec-sub">จองคิวอาบน้ำ ตัดขน สปา หรือฝากเลี้ยง ที่ Pet Space บางพลี</p>
        <div class="cta" style="justify-content:center;margin-top:14px">
          <a href="https://line.me/R/ti/p/@pet-space" class="btn btn-line">💬 จองคิว LINE</a>
          <a href="tel:0647496614" class="btn btn-primary">📞 064-749-6614</a>
        </div>
      </div>
    </article>
  </div>
</section>

${footer('../')}
</body>
</html>`;
}

// ---------- render blog index ----------
function renderIndex(articles) {
  const cards = articles.map(a => {
    const cover = a.meta.cover || '';
    return `      <a class="post-card" href="blog/${a.slug}.html">
        ${cover ? `<img class="cover" src="${cover.replace(/^\.\.\//, '')}" alt="${escAttr(a.meta.title)}" loading="lazy">` : `<div class="cover"></div>`}
        <div class="pbody">
          ${a.meta.category ? `<span class="cat">${esc(a.meta.category)}</span>` : ''}
          <h3>${esc(a.meta.title)}</h3>
          <p class="excerpt">${esc(excerpt(a))}</p>
          <div class="meta"><span>🗓️ ${fmtDate(a.meta.date)}</span><span class="read">อ่านต่อ →</span></div>
        </div>
      </a>`;
  }).join('\n');

  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'Blog', name: 'บทความ Pet Space', url: DOMAIN + '/blog.html', description: 'บทความความรู้เรื่องการดูแลสุนัขและแมว โดย Pet Space บางพลี สมุทรปราการ',
      blogPost: articles.map(a => ({ '@type': 'BlogPosting', headline: a.meta.title, url: `${DOMAIN}/blog/${a.slug}.html`, datePublished: a.meta.date })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: 'บทความ', item: DOMAIN + '/blog.html' },
    ] },
  ];

  return `${headTag('', { title: 'บทความ ความรู้ดูแลสุนัข-แมว | Pet Space บางพลี สมุทรปราการ', desc: 'รวมบทความความรู้เรื่องอาบน้ำ ตัดขน สปา และดูแลสุนัข-แมว โดย Pet Space ร้านโกรมมิ่งย่านบางพลี สมุทรปราการ', keywords: 'บทความดูแลสุนัข, ดูแลแมว, อาบน้ำตัดขน บางพลี, Pet Space บทความ', canonical: DOMAIN + '/blog.html', jsonld })}

${header('', 'blog.html')}

<div class="wrap"><p class="crumbs"><a href="index.html">หน้าแรก</a> › บทความ</p></div>

<section class="page-hero">
  <div class="wrap">
    <span class="eyebrow">Blog</span>
    <h1>บทความ &amp; ความรู้ดูแลน้อง</h1>
    <p>เคล็ดลับดูแลสุนัขและแมว เรื่องอาบน้ำ ตัดขน สปา และสุขภาพขน จากทีม Pet Space บางพลี สมุทรปราการ</p>
  </div>
</section>

<section>
  <div class="wrap">
    ${articles.length ? `<div class="blog-grid">\n${cards}\n    </div>` : '<p class="center sec-sub">เร็วๆ นี้ — กำลังเตรียมบทความดีๆ ให้อ่าน 🐾</p>'}
  </div>
</section>

${footer('')}
</body>
</html>`;
}

// ---------- sitemap ----------
function renderSitemap(articles) {
  const urls = STATIC_PAGES.map(p => `  <url><loc>${DOMAIN}${p.loc}</loc><changefreq>${p.freq}</changefreq><priority>${p.pri}</priority></url>`);
  for (const a of articles) urls.push(`  <url><loc>${DOMAIN}/blog/${a.slug}.html</loc><lastmod>${a.meta.date}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// ---------- main ----------
function main() {
  if (!fs.existsSync(ARTICLES_DIR)) { console.error('ไม่พบโฟลเดอร์ content/articles'); process.exit(1); }
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
  const articles = files.map(f => {
    const { meta, body } = parseFront(fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf8'));
    meta.slug = (meta.slug || f.replace(/\.md$/, '')).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!meta.title) meta.title = meta.slug;
    if (!meta.date) meta.date = '2026-01-01';
    return { meta, body, slug: meta.slug };
  }).sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || ''));

  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });
  for (const a of articles) fs.writeFileSync(path.join(BLOG_DIR, `${a.slug}.html`), renderArticle(a));
  fs.writeFileSync(path.join(ROOT, 'blog.html'), renderIndex(articles));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), renderSitemap(articles));

  console.log(`✅ สร้างบล็อกเสร็จ: ${articles.length} บทความ`);
  articles.forEach(a => console.log(`   • /blog/${a.slug}.html  (${a.meta.title})`));
}

main();

#!/usr/bin/env node
/**
 * 种子数据生成器 v3 — B站排行榜 + 分区推荐
 * 排行榜 rid=36(知识), rid=211(语言)
 * 分区推荐 rid=36,95,201,202,206,210,211,212,213
 */

const SOURCES = [
  // 排行榜 (取前15)
  { type: 'ranking', rid: 36,  domain: '通识知识', pages: 1 },
  { type: 'ranking', rid: 211, domain: '语言学习', pages: 1 },
  // 分区推荐 (每页20条)
  { type: 'region', rid: 36,  domain: '通识知识', pages: 3 },
  { type: 'region', rid: 95,  domain: '科技数码', pages: 3 },
  { type: 'region', rid: 201, domain: '资讯', pages: 2 },
  { type: 'region', rid: 206, domain: '校园学习', pages: 3 },
  { type: 'region', rid: 210, domain: '演讲公开课', pages: 3 },
  { type: 'region', rid: 211, domain: '语言学习', pages: 3 },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.bilibili.com',
};

async function fetchRanking(rid) {
  const res = await fetch(`https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}&type=all`, { headers: HEADERS });
  if (!res.ok) return [];
  const d = await res.json();
  return d.code === 0 ? (d.data?.list || []) : [];
}

async function fetchRegion(rid, pn = 1) {
  const res = await fetch(`https://api.bilibili.com/x/web-interface/dynamic/region?ps=20&rid=${rid}&pn=${pn}`, { headers: HEADERS });
  if (!res.ok) return [];
  const d = await res.json();
  return d.code === 0 ? (d.data?.archives || []) : [];
}

function esc(s) { return (s || '').replace(/'/g, "''").replace(/<[^>]*>/g, ''); }

async function main() {
  console.log('-- Study-DaZi 种子资源数据 v3');
  console.log(`-- 生成时间: ${new Date().toISOString()}`);
  console.log('');

  let total = 0;
  const seen = new Set();

  for (const src of SOURCES) {
    let items = [];

    if (src.type === 'ranking') {
      await new Promise(r => setTimeout(r, 600));
      items = (await fetchRanking(src.rid)).slice(0, 15);
    } else {
      for (let pn = 1; pn <= src.pages; pn++) {
        await new Promise(r => setTimeout(r, 600));
        const page = await fetchRegion(src.rid, pn);
        items.push(...page);
      }
    }

    process.stderr.write(`${src.domain} (${src.type} rid=${src.rid}): ${items.length} videos\n`);
    if (items.length === 0) continue;

    console.log(`-- ── ${src.domain} ──────────────────────────`);

    for (const v of items) {
      const bvid = v.bvid;
      if (!bvid || seen.has(bvid)) continue;
      seen.add(bvid);

      const title = esc(v.title);
      const author = esc(v.owner?.name || '');
      const thumb = (v.pic || '').replace(/^\/\//, 'https://');
      const dur = v.duration || 0;
      const views = v.stat?.view || 0;
      const lang = /[\u4e00-\u9fff]/.test(v.title) ? 'zh' : 'en';

      console.log(
        `INSERT INTO resource_index (platform, external_id, title, url, instructor, thumbnail, duration, language, domain, tags, view_count, is_free) VALUES ('bilibili', '${bvid}', '${title}', 'https://www.bilibili.com/video/${bvid}', '${author}', '${thumb}', ${dur}, '${lang}', '${src.domain}', '[]'::jsonb, ${views}, true) ON CONFLICT DO NOTHING;`
      );
      total++;
    }
    console.log('');
  }

  console.log(`-- 共 ${total} 条资源`);
  process.stderr.write(`\nDone! Total: ${total} unique resources\n`);
}

main().catch(console.error);

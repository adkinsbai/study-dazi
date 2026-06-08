#!/usr/bin/env node
/**
 * 种子数据生成器 v2 — B站排行榜 + 分区
 * 不依赖搜索API（需要wbi签名），用公开排行榜接口
 */

const CATEGORIES = [
  { rid: 36,   domain: '通识知识', label: '知识-全区' },
  { rid: 201,  domain: '科技资讯', label: '科技资讯' },
  { rid: 202,  domain: '计算机技术', label: '极客DIY' },
  { rid: 203,  domain: '社科法律', label: '社科·法律·心理' },
  { rid: 204,  domain: '人文历史', label: '人文历史' },
  { rid: 205,  domain: '财经商业', label: '财经商业' },
  { rid: 206,  domain: '校园学习', label: '校园学习' },
  { rid: 207,  domain: '职场', label: '职场' },
  { rid: 208,  domain: '设计创意', label: '设计·创意' },
  { rid: 209,  domain: '技能学习', label: '野生技能协会' },
  { rid: 210,  domain: '演讲公开课', label: '演讲·公开课' },
  { rid: 211,  domain: '语言学习', label: '语言学习' },
  { rid: 212,  domain: '人工智能', label: '人工智能' },
  { rid: 213,  domain: '编程开发', label: '编程' },
  { rid: 214,  domain: '考研考公', label: '考研·考公' },
  { rid: 215,  domain: '设计师', label: '设计师' },
  { rid: 216,  domain: '配音播音', label: '配音·播音' },
];

async function fetchRanking(rid) {
  const url = `https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}&type=all`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 0) return [];
    return data.data?.list || [];
  } catch {
    return [];
  }
}

function escapeSql(s) {
  return (s || '').replace(/'/g, "''").replace(/<[^>]*>/g, '');
}

function parseDuration(sec) {
  return sec || 0;
}

async function main() {
  console.log('-- Study-DaZi 种子资源数据 (排行榜版)');
  console.log(`-- 生成时间: ${new Date().toISOString()}`);
  console.log('-- 来源: B站分区排行榜 API');
  console.log('');

  let total = 0;
  const seen = new Set();

  for (const { rid, domain, label } of CATEGORIES) {
    await new Promise(r => setTimeout(r, 800));

    const items = await fetchRanking(rid);
    process.stderr.write(`${label} (rid=${rid}): ${items.length} videos\n`);

    if (items.length === 0) continue;

    console.log(`-- ── ${domain} (${label}) ──────────────────────────`);

    // 每个分区取前 15
    for (const v of items.slice(0, 15)) {
      const bvid = v.bvid;
      if (!bvid || seen.has(bvid)) continue;
      seen.add(bvid);

      const title = escapeSql(v.title);
      const author = escapeSql(v.owner?.name || '');
      const thumbnail = (v.pic || '').replace(/^\/\//, 'https://');
      const duration = v.duration || 0;
      const views = v.stat?.view || 0;
      const likes = v.stat?.like || 0;
      const tags = [];
      const lang = /[\u4e00-\u9fff]/.test(v.title) ? 'zh' : 'en';
      const url = `https://www.bilibili.com/video/${bvid}`;

      const tagsJson = tags.length > 0
        ? `'${JSON.stringify(tags)}'::jsonb`
        : `'[]'::jsonb`;

      console.log(
        `INSERT INTO resource_index (platform, external_id, title, url, instructor, thumbnail, duration, language, domain, tags, view_count, is_free) VALUES ('bilibili', '${bvid}', '${title}', '${url}', '${author}', '${thumbnail}', ${duration}, '${lang}', '${domain}', ${tagsJson}, ${views}, true) ON CONFLICT DO NOTHING;`
      );
      total++;
    }
    console.log('');
  }

  console.log(`-- 共 ${total} 条资源`);
  process.stderr.write(`\nDone! Total: ${total} resources\n`);
}

main().catch(console.error);

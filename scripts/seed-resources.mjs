#!/usr/bin/env node
/**
 * 种子数据生成器 — 从 B站抓取学习资源，输出 SQL INSERT 语句
 * 用法: node scripts/seed-resources.mjs > seed.sql
 * 然后把 seed.sql 粘到 Supabase SQL Editor 执行
 */

const DOMAINS = [
  { domain: '前端开发', queries: ['前端开发教程', 'React入门', 'Vue3教程', 'CSS布局', 'JavaScript基础', 'Next.js教程', 'TypeScript入门'] },
  { domain: '后端开发', queries: ['Python后端', 'Node.js教程', 'Go语言入门', 'Java Spring Boot', '数据库设计', 'Redis教程', '微服务架构'] },
  { domain: '人工智能', queries: ['机器学习入门', '深度学习教程', 'PyTorch教程', '大模型LLM', 'NLP自然语言处理', '计算机视觉', '强化学习'] },
  { domain: '数据科学', queries: ['数据分析教程', 'Pandas教程', 'SQL入门', '数据可视化', '统计学基础', 'Excel数据分析', 'Tableau教程'] },
  { domain: '移动开发', queries: ['Flutter教程', 'React Native', 'iOS开发', 'Android开发', 'Swift入门', 'Kotlin教程', 'UniApp教程'] },
  { domain: 'UI设计', queries: ['UI设计入门', 'Figma教程', '设计原理', '用户体验设计', 'Sketch教程', '设计系统', '交互设计'] },
  { domain: 'DevOps', queries: ['Docker教程', 'Kubernetes入门', 'Linux运维', 'CI/CD教程', 'AWS云服务', 'Nginx配置', 'Git教程'] },
  { domain: '模拟IC设计', queries: ['模拟IC设计', 'CMOS电路', '运放设计', '电源管理IC', '版图设计Cadence', 'SerDes设计', 'ADC DAC设计'] },
  { domain: '考研数学', queries: ['考研数学基础', '高等数学辅导', '线性代数', '概率论', '考研数学真题'] },
  { domain: '英语学习', queries: ['英语口语教程', '英语语法', '雅思备考', '托福备考', '英语听力'] },
];

async function searchBilibili(query, maxResults = 5) {
  const url = new URL('https://api.bilibili.com/x/web-interface/search/type');
  url.searchParams.set('search_type', 'video');
  url.searchParams.set('keyword', query);
  url.searchParams.set('page', '1');
  url.searchParams.set('pagesize', String(maxResults));
  url.searchParams.set('order', 'click');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.result || []).map(item => ({
      bvid: item.bvid,
      title: (item.title || '').replace(/<[^>]*>/g, '').replace(/'/g, "''"),
      author: (item.author || '').replace(/'/g, "''"),
      thumbnail: item.pic?.startsWith('//') ? `https:${item.pic}` : (item.pic || ''),
      duration: item.duration || '',
      play: item.play || 0,
      tags: item.tag ? item.tag.split(',').map(t => t.trim()).filter(Boolean) : [],
    }));
  } catch {
    return [];
  }
}

function parseDuration(dur) {
  const parts = dur.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

async function main() {
  console.log('-- Study-DaZi 种子资源数据');
  console.log(`-- 生成时间: ${new Date().toISOString()}`);
  console.log('-- 来源: B站公开搜索API');
  console.log('');

  let total = 0;
  const seen = new Set();

  for (const { domain, queries } of DOMAINS) {
    console.log(`-- ── ${domain} ──────────────────────────`);

    for (const query of queries) {
      // 限速：每次请求间隔 2s，避免被 B站风控
      await new Promise(r => setTimeout(r, 2000));

      const results = await searchBilibili(query, 8);
      process.stderr.write(`  ${query}: ${results.length} results\n`);

      for (const item of results) {
        if (seen.has(item.bvid)) continue;
        seen.add(item.bvid);

        const duration = parseDuration(item.duration);
        const tags = item.tags.length > 0
          ? `'${JSON.stringify(item.tags)}'::jsonb`
          : `'[]'::jsonb`;
        const lang = /[\u4e00-\u9fff]/.test(item.title) ? 'zh' : 'en';

        const sql = `INSERT INTO resource_index (platform, external_id, title, url, instructor, thumbnail, duration, language, domain, tags, view_count, is_free) VALUES ('bilibili', '${item.bvid}', '${item.title}', 'https://www.bilibili.com/video/${item.bvid}', '${item.author}', '${item.thumbnail}', ${duration}, '${lang}', '${domain}', ${tags}, ${item.play}, true) ON CONFLICT DO NOTHING;`;

        console.log(sql);
        total++;
      }
    }
    console.log('');
  }

  console.log(`-- 共 ${total} 条资源`);
  process.stderr.write(`\nDone! Total: ${total} resources\n`);
}

main().catch(console.error);

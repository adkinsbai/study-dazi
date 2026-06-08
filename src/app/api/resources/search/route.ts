import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/resources/search?keywords=CMOS,反相器&domain=模拟IC设计&limit=10
 * 按知识点关键词搜索资源库，返回匹配的资源列表
 */
export async function GET(req: NextRequest) {
  try {
    const keywordsParam = req.nextUrl.searchParams.get('keywords') || '';
    const domain = req.nextUrl.searchParams.get('domain') || '';
    const limit = Math.min(20, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '6')));
    const platform = req.nextUrl.searchParams.get('platform') || '';

    if (!keywordsParam && !domain) {
      return NextResponse.json({ error: '请提供 keywords 或 domain 参数' }, { status: 400 });
    }

    const keywords = keywordsParam
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    // 构建查询条件：tags JSON 数组中包含任意一个关键词
    // PostgreSQL JSON array 包含查询
    const conditions: Record<string, unknown>[] = [];

    if (keywords.length > 0) {
      // 用 OR 匹配任一关键词在 tags 中
      conditions.push({
        OR: keywords.map(kw => ({
          tags: { array_contains: [kw] },
        })),
      });
    }

    if (domain) {
      conditions.push({ domain: { contains: domain, mode: 'insensitive' } });
    }

    if (platform) {
      conditions.push({ platform });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    const resources = await prisma.resourceIndex.findMany({
      where,
      orderBy: [
        { rating: 'desc' },
        { viewCount: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        platform: true,
        title: true,
        url: true,
        instructor: true,
        thumbnail: true,
        duration: true,
        language: true,
        difficulty: true,
        tags: true,
        rating: true,
        viewCount: true,
        isFree: true,
      },
    });

    // 计算每个资源与关键词的匹配度（命中几个关键词）
    const scored = resources.map(r => {
      const tags = (r.tags as string[]) || [];
      const matchedCount = keywords.filter(kw =>
        tags.some(t => t.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(t.toLowerCase()))
      ).length;
      return { ...r, matched_keywords: matchedCount };
    });

    // 按匹配度 > 评分 > 播放量排序
    scored.sort((a, b) => {
      if (b.matched_keywords !== a.matched_keywords) return b.matched_keywords - a.matched_keywords;
      if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
      return (b.viewCount || 0) - (a.viewCount || 0);
    });

    return NextResponse.json({ resources: scored, total: scored.length });
  } catch (err) {
    console.error('GET /api/resources/search error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

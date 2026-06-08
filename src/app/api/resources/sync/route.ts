import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';
import { searchYouTube, searchBilibili, type CrawledResource } from '@/lib/crawlers';

/**
 * POST /api/resources/sync
 * 从 YouTube / B站 同步资源到 resource_index 表
 * Body: { domain: string, keywords: string[], platforms?: string[] }
 *
 * 需要登录（管理员/普通用户均可触发）
 */
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    await verifyAccessToken(auth);

    const BodySchema = z.object({
      domain: z.string().min(1),
      keywords: z.array(z.string()).min(1).max(10),
      platforms: z.array(z.enum(['youtube', 'bilibili'])).optional(),
    });

    const body = BodySchema.parse(await req.json());
    const platforms = body.platforms || ['youtube', 'bilibili'];

    const allResults: CrawledResource[] = [];

    // 并行搜索各平台
    const tasks = body.keywords.map(async (keyword) => {
      const query = `${keyword} ${body.domain} 教程`;
      const results: CrawledResource[] = [];

      if (platforms.includes('youtube')) {
        const yt = await searchYouTube(query, 5);
        results.push(...yt);
      }
      if (platforms.includes('bilibili')) {
        const bili = await searchBilibili(query, 5);
        results.push(...bili);
      }

      return results;
    });

    const keywordResults = await Promise.all(tasks);
    for (const results of keywordResults) {
      allResults.push(...results);
    }

    // 去重（按 platform + externalId）
    const seen = new Set<string>();
    const unique = allResults.filter(r => {
      const key = `${r.platform}:${r.externalId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 写入数据库（upsert：存在则更新，不存在则创建）
    let created = 0;
    let updated = 0;

    for (const res of unique) {
      const existing = await prisma.resourceIndex.findFirst({
        where: { platform: res.platform, externalId: res.externalId },
      });

      const data = {
        platform: res.platform,
        externalId: res.externalId,
        title: res.title,
        url: res.url,
        instructor: res.instructor,
        thumbnail: res.thumbnail,
        duration: res.duration,
        language: res.language,
        domain: body.domain,
        tags: res.tags,
        viewCount: res.viewCount,
        isFree: res.isFree,
        lastChecked: new Date(),
      };

      if (existing) {
        await prisma.resourceIndex.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.resourceIndex.create({ data });
        created++;
      }
    }

    return NextResponse.json({
      synced: unique.length,
      created,
      updated,
      keywords_searched: body.keywords.length,
      platforms,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    }
    console.error('POST /api/resources/sync error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

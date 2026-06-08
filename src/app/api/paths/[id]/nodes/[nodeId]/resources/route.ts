import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/paths/[id]/nodes/[nodeId]/resources
 * 获取某个节点关联的学习资源列表
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  try {
    const { id, nodeId } = await params;

    // 查找节点关联的资源
    const links = await prisma.nodeResource.findMany({
      where: { pathId: id, nodeId },
      include: {
        resource: true,
      },
      orderBy: { relevance: 'desc' },
    });

    const resources = links.map(link => ({
      id: link.resource.id,
      platform: link.resource.platform,
      title: link.resource.title,
      url: link.resource.url,
      instructor: link.resource.instructor,
      thumbnail: link.resource.thumbnail,
      duration: link.resource.duration,
      language: link.resource.language,
      difficulty: link.resource.difficulty,
      tags: link.resource.tags,
      rating: link.resource.rating,
      viewCount: link.resource.viewCount,
      isFree: link.resource.isFree,
      relevance: link.relevance,
      matched_keywords: 0,
    }));

    return NextResponse.json({ resources });
  } catch (err) {
    console.error('GET node resources error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/**
 * POST /api/paths/[id]/nodes/[nodeId]/resources
 * 手动为节点关联资源
 * Body: { resourceId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  try {
    const { id, nodeId } = await params;
    const body = await req.json();

    if (!body.resourceId) {
      return NextResponse.json({ error: '缺少 resourceId' }, { status: 400 });
    }

    const link = await prisma.nodeResource.create({
      data: {
        pathId: id,
        nodeId,
        resourceId: body.resourceId,
        relevance: body.relevance || 0.5,
        addedBy: 'user',
      },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (err) {
    console.error('POST node resources error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

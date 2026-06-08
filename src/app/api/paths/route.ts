import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { verifyAccessToken } from '@/lib/auth';

const CreateSchema = z.object({
  title: z.string().min(1, '请输入路径名称'),
  domain: z.string().min(1),
  tree_data: z.object({}).passthrough(),
  isPublic: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);

    const paths = await prisma.learningPath.findMany({
      where: { userId: payload.sub },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        domain: true,
        isPublic: true,
        isTemplate: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ paths });
  } catch {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const body = CreateSchema.parse(await req.json());

    const path = await prisma.learningPath.create({
      data: {
        userId: payload.sub,
        title: body.title,
        domain: body.domain,
        treeData: body.tree_data as Prisma.InputJsonValue,
        isPublic: body.isPublic ?? false,
        isTemplate: body.isTemplate ?? false,
      },
    });

    // 异步为节点匹配资源（不阻塞响应）
    linkResourcesToNodes(path.id, body.tree_data, body.domain).catch(err => {
      console.error('[AutoLink] Failed to link resources:', err);
    });

    return NextResponse.json({ id: path.id, title: path.title, createdAt: path.createdAt }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: '参数错误', details: err.issues }, { status: 422 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/**
 * 遍历树结构，为有 keywords 的叶子节点自动匹配资源库
 */
async function linkResourcesToNodes(
  pathId: string,
  treeData: Record<string, unknown>,
  domain: string,
) {
  const phases = (treeData as { phases?: Array<{ id: string; children?: Array<{ id: string; keywords?: string[] }> }> }).phases;
  if (!phases) return;

  let linkedCount = 0;

  for (const phase of phases) {
    const children = phase.children || [];
    for (const node of children) {
      const keywords = node.keywords || [];
      if (keywords.length === 0) continue;

      // 搜索资源库
      const resources = await prisma.resourceIndex.findMany({
        where: {
          AND: [
            { domain: { contains: domain, mode: 'insensitive' } },
            { OR: keywords.map(kw => ({ tags: { array_contains: [kw] } })) },
          ],
        },
        orderBy: [{ rating: 'desc' }, { viewCount: 'desc' }],
        take: 3,
      });

      // 如果领域匹配不够，去掉领域限制再搜
      if (resources.length < 2) {
        const moreResources = await prisma.resourceIndex.findMany({
          where: {
            OR: keywords.map(kw => ({ tags: { array_contains: [kw] } })),
          },
          orderBy: [{ rating: 'desc' }, { viewCount: 'desc' }],
          take: 3,
        });
        // 合并去重
        const existingIds = new Set(resources.map(r => r.id));
        for (const r of moreResources) {
          if (!existingIds.has(r.id) && resources.length < 3) {
            resources.push(r);
          }
        }
      }

      // 写入关联
      for (const resource of resources) {
        try {
          await prisma.nodeResource.create({
            data: {
              pathId,
              nodeId: node.id,
              resourceId: resource.id,
              relevance: 0.8,
              addedBy: 'ai',
            },
          });
          linkedCount++;
        } catch {
          // 唯一约束冲突忽略
        }
      }
    }
  }

  if (linkedCount > 0) {
    console.log(`[AutoLink] Linked ${linkedCount} resources to path ${pathId}`);
  }
}

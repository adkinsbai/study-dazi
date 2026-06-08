import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAccessToken } from '@/lib/auth';

/**
 * GET /api/paths/[id]/daily-tasks
 * 基于当前进度生成今日学习任务
 * 
 * 逻辑：
 * 1. 找到所有 in_progress 的节点
 * 2. 如果没有，自动解锁下一个未开始的节点
 * 3. 为每个进行中的节点查找关联资源
 * 4. 按可用时间生成今日任务列表
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const payload = await verifyAccessToken(auth);
    const { id } = await params;

    // 获取路径
    const path = await prisma.learningPath.findFirst({
      where: { id, userId: payload.sub },
    });
    if (!path) return NextResponse.json({ error: '路径不存在' }, { status: 404 });

    // 获取所有进度
    const allProgress = await prisma.nodeProgress.findMany({
      where: { pathId: id },
    });

    const progressMap: Record<string, { status: string; notes: string }> = {};
    for (const p of allProgress) {
      progressMap[p.nodeId] = { status: p.status, notes: p.notes || '' };
    }

    // 解析树结构，收集所有叶子节点
    const treeData = path.treeData as Record<string, unknown>;
    const phases = (treeData as { phases?: Array<{ id: string; title: string; children?: Array<{ id: string; title: string; estimated_hours: number; node_type: string; keywords?: string[] }> }> }).phases || [];
    
    interface NodeInfo {
      id: string;
      title: string;
      estimatedHours: number;
      nodeType: string;
      phaseTitle: string;
      keywords: string[];
    }

    const allNodes: NodeInfo[] = [];
    for (const phase of phases) {
      for (const node of phase.children || []) {
        allNodes.push({
          id: node.id,
          title: node.title,
          estimatedHours: node.estimated_hours || 2,
          nodeType: node.node_type || 'required',
          phaseTitle: phase.title,
          keywords: node.keywords || [],
        });
      }
    }

    // 找到进行中的节点
    let inProgressNodes = allNodes.filter(n => progressMap[n.id]?.status === 'in_progress');

    // 如果没有进行中的节点，自动解锁下一个
    if (inProgressNodes.length === 0) {
      const nextNode = allNodes.find(n => !progressMap[n.id] || progressMap[n.id].status === 'unlocked');
      if (nextNode) {
        // 创建进度记录
        await prisma.nodeProgress.create({
          data: {
            pathId: id,
            nodeId: nextNode.id,
            userId: payload.sub,
            status: 'in_progress',
          },
        });
        inProgressNodes = [nextNode];
      }
    }

    if (inProgressNodes.length === 0) {
      return NextResponse.json({
        tasks: [],
        message: '所有节点已完成！🎉',
        summary: { total: allNodes.length, completed: allNodes.filter(n => progressMap[n.id]?.status === 'completed').length },
      });
    }

    // 为进行中的节点查找资源
    const tasks = [];
    for (const node of inProgressNodes) {
      const resources = await prisma.nodeResource.findMany({
        where: { pathId: id, nodeId: node.id },
        include: { resource: true },
        orderBy: { relevance: 'desc' },
        take: 2,
      });

      tasks.push({
        nodeId: node.id,
        nodeTitle: node.title,
        phaseTitle: node.phaseTitle,
        estimatedMinutes: node.estimatedHours * 60,
        resources: resources.map(r => ({
          id: r.resource.id,
          platform: r.resource.platform,
          title: r.resource.title,
          url: r.resource.url,
          duration: r.resource.duration,
          instructor: r.resource.instructor,
          isFree: r.resource.isFree,
        })),
        keywords: node.keywords,
      });
    }

    // 计算今日建议时长（假设每周学习天数=5）
    const totalEstimate = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

    return NextResponse.json({
      tasks,
      todayMinutes: Math.min(totalEstimate, 120), // 上限 2 小时
      summary: {
        total: allNodes.length,
        completed: allNodes.filter(n => progressMap[n.id]?.status === 'completed').length,
        inProgress: inProgressNodes.length,
      },
    });
  } catch (err) {
    console.error('GET daily tasks error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

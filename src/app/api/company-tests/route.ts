import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/company-tests - 公司真题列表
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const company = url.searchParams.get('company') || undefined;
    const position = url.searchParams.get('position') || undefined;
    const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')!, 10) : undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));

    const where: Record<string, unknown> = {};
    if (company) where.company = { contains: company, mode: 'insensitive' };
    if (position) where.position = { contains: position, mode: 'insensitive' };
    if (year) where.year = year;

    const [items, total] = await Promise.all([
      prisma.companyTest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { problems: true } },
        },
      }),
      prisma.companyTest.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

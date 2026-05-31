import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/auth';
import { logError } from '@/lib/log';

// POST /api/push/subscribe — 注册推送订阅
export async function POST(req: NextRequest) {
  try {
    const payload = await authenticate(req);
    if (payload instanceof NextResponse) return payload;
    const { endpoint, keys } = await req.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: payload.sub, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: payload.sub, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logError('POST /api/push/subscribe', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

// DELETE /api/push/unsubscribe — 取消推送订阅
export async function DELETE(req: NextRequest) {
  try {
    const payload = await authenticate(req);
    if (payload instanceof NextResponse) return payload;
    const { endpoint } = await req.json();

    await prisma.pushSubscription.deleteMany({
      where: { userId: payload.sub, endpoint },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logError('DELETE /api/push/unsubscribe', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

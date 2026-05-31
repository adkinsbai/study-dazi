import prisma from '@/lib/prisma';
import type webpush from 'web-push';

let _webpush: typeof webpush | null = null;
async function getWebPush(): Promise<typeof webpush> {
  if (_webpush) return _webpush;
  const wp = await import('web-push');
  wp.setVapidDetails(
    'mailto:noreply@studydazi.top',
    process.env.VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || '',
  );
  _webpush = wp;
  return wp;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  data?: { url?: string };
}

/** 向指定用户推送浏览器通知 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!process.env.VAPID_PRIVATE_KEY) return; // VAPID 未配置，静默跳过

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
  });
  if (subs.length === 0) return;

  const wp = await getWebPush();
  const message = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await wp.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        message,
      );
    } catch (err) {
      // 410 Gone / 404 — 订阅已过期，清理
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
}

/** 在关键社交事件后异步推送（不阻塞主流程） */
export function pushToUser(userId: string, payload: PushPayload) {
  void sendPushToUser(userId, payload);
}

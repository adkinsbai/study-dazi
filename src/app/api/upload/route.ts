import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

// Vercel API body 限制 4.5MB，base64 编码会膨胀 33%
// 所以实际文件限制 2MB 保证安全
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    await verifyAccessToken(auth);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '没有文件' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: '文件不能超过 2MB' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type;

    if (mime.startsWith('image/') || mime === 'application/pdf') {
      const b64 = buffer.toString('base64');
      return NextResponse.json({ url: `data:${mime};base64,${b64}`, name: file.name, type: mime.startsWith('image/') ? 'image' : 'file' });
    }

    if (mime === 'text/markdown' || file.name.endsWith('.md')) {
      const text = buffer.toString('utf-8');
      return NextResponse.json({ content: text, name: file.name, type: 'markdown' });
    }

    const b64 = buffer.toString('base64');
    return NextResponse.json({ url: `data:${mime};base64,${b64}`, name: file.name, type: 'file' });
  } catch {
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    await verifyAccessToken(auth);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: '没有文件' }, { status: 400 });

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

    // 其他文件类型也支持（base64 存储）
    const b64 = buffer.toString('base64');
    return NextResponse.json({ url: `data:${mime};base64,${b64}`, name: file.name, type: 'file' });
  } catch {
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}

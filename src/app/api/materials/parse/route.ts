import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import { buildMaterialBrief, parseWithMineru } from '@/lib/mineru';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'xls',
  'png',
  'jpg',
  'jpeg',
  'webp',
]);

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!auth) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    await verifyAccessToken(auth);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '请上传文件' }, { status: 422 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '文件不能超过 50MB' }, { status: 413 });
    }

    const ext = getExtension(file.name);
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: '仅支持 PDF/DOCX/PPTX/XLSX/图片文件' }, { status: 422 });
    }

    const parsed = await parseWithMineru(file);
    return NextResponse.json({
      name: file.name,
      markdown: parsed.markdown,
      brief: buildMaterialBrief(parsed.markdown),
      parser: 'mineru',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '解析失败';
    const status = message.includes('未配置 MINERU_API_URL') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

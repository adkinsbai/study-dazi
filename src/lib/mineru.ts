export interface MineruParseResult {
  markdown: string;
  raw: unknown;
}

function getStringAtPath(value: unknown, path: string[]): string | null {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || !(key in current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : null;
}

function extractMarkdown(payload: unknown): string {
  const directPaths = [
    ['md'],
    ['markdown'],
    ['content'],
    ['data', 'md'],
    ['data', 'markdown'],
    ['data', 'content'],
    ['result', 'md'],
    ['result', 'markdown'],
    ['result', 'content'],
  ];

  for (const path of directPaths) {
    const found = getStringAtPath(payload, path);
    if (found?.trim()) return found.trim();
  }

  const files = getStringAtPath(payload, ['data', 'files']);
  if (files?.trim()) return files.trim();

  if (payload && typeof payload === 'object') {
    const walk = (value: unknown): string | null => {
      if (!value || typeof value !== 'object') return null;
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = walk(item);
          if (found) return found;
        }
        return null;
      }
      for (const [key, child] of Object.entries(value)) {
        if (/^(md|markdown|content)$/i.test(key) && typeof child === 'string' && child.trim()) {
          return child.trim();
        }
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    const found = walk(payload);
    if (found) return found;
  }

  throw new Error('MinerU 未返回 Markdown 内容');
}

export async function parseWithMineru(file: File): Promise<MineruParseResult> {
  const baseUrl = process.env.MINERU_API_URL || process.env.CONVERTER_URL;
  if (!baseUrl) {
    throw new Error('未配置 MINERU_API_URL');
  }

  const form = new FormData();
  form.append('files', file, file.name);
  form.append('return_md', 'true');

  if (process.env.MINERU_BACKEND) form.append('backend', process.env.MINERU_BACKEND);
  if (process.env.MINERU_LANG) form.append('lang_list', process.env.MINERU_LANG);

  const headers: HeadersInit = {};
  if (process.env.MINERU_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.MINERU_API_TOKEN}`;
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/file_parse`, {
    method: 'POST',
    headers,
    body: form,
  });

  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => '');

  if (!res.ok) {
    const message = payload && typeof payload === 'object'
      ? JSON.stringify(payload).slice(0, 300)
      : String(payload).slice(0, 300);
    throw new Error(`MinerU 解析失败: ${res.status}${message ? ` ${message}` : ''}`);
  }

  if (typeof payload === 'string' && payload.trim()) {
    return { markdown: payload.trim(), raw: payload };
  }

  return { markdown: extractMarkdown(payload), raw: payload };
}

export function buildMaterialBrief(markdown: string, maxChars = 3000): string {
  const cleaned = markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const headings = cleaned
    .split('\n')
    .filter(line => /^#{1,4}\s+\S/.test(line))
    .slice(0, 12);

  const firstParagraphs = cleaned
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 8);

  const brief = [
    headings.length ? `## 目录线索\n${headings.join('\n')}` : '',
    `## 内容摘录\n${firstParagraphs.join('\n\n')}`,
  ].filter(Boolean).join('\n\n');

  return brief.slice(0, maxChars);
}

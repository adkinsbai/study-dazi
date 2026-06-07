import { randomUUID } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

export interface MarkitdownParseResult {
  markdown: string;
  raw: unknown;
}

const DEFAULT_TIMEOUT_MS = 120_000;

function getMarkitdownApiUrl(): string | null {
  const url = process.env.MARKITDOWN_API_URL;
  return url?.trim() || null;
}

function getMarkitdownApiHeaders(): HeadersInit {
  return process.env.MARKITDOWN_API_TOKEN
    ? { Authorization: `Bearer ${process.env.MARKITDOWN_API_TOKEN}` }
    : {};
}

function getPythonCommand(): string {
  return process.env.MARKITDOWN_PYTHON || 'python';
}

function getTimeoutMs(): number {
  const configured = Number(process.env.MARKITDOWN_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function safeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^\w.-]+/g, '_');
  return base || 'upload';
}

function parseConverterOutput(stdout: string): MarkitdownParseResult {
  const payload = JSON.parse(stdout || '{}') as { markdown?: unknown };
  const markdown = typeof payload.markdown === 'string' ? payload.markdown.trim() : '';
  if (!markdown) {
    throw new Error('MarkItDown 未提取到 Markdown 内容');
  }
  return { markdown, raw: payload };
}

async function parseWithRemoteMarkitdown(file: File, endpoint: string): Promise<MarkitdownParseResult> {
  const form = new FormData();
  form.append('file', file, file.name);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: getMarkitdownApiHeaders(),
      body: form,
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await res.json().catch(() => null)
      : await res.text().catch(() => '');

    if (!res.ok) {
      const message = payload && typeof payload === 'object'
        ? JSON.stringify(payload)
        : String(payload || '');
      throw new Error(`MarkItDown 服务解析失败: ${res.status}${message ? ` ${message.slice(0, 300)}` : ''}`);
    }

    if (typeof payload === 'string') {
      return parseConverterOutput(payload);
    }

    const markdown = payload && typeof payload === 'object' && typeof (payload as { markdown?: unknown }).markdown === 'string'
      ? (payload as { markdown: string }).markdown.trim()
      : '';

    if (!markdown) {
      throw new Error('MarkItDown 服务未返回 Markdown 内容');
    }

    return { markdown, raw: payload };
  } finally {
    clearTimeout(timer);
  }
}

async function runConverter(filePath: string): Promise<MarkitdownParseResult> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'markitdown-convert.py');
  const timeoutMs = getTimeoutMs();

  return await new Promise((resolve, reject) => {
    const child = spawn(getPythonCommand(), [scriptPath, filePath], {
      cwd: process.cwd(),
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill();
      reject(new Error('MarkItDown 解析超时，请稍后重试或换一个更小的文件'));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', err => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(stderr.trim() || `MarkItDown 解析失败: ${code}`));
        return;
      }

      try {
        resolve(parseConverterOutput(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function parseWithMarkitdown(file: File): Promise<MarkitdownParseResult> {
  const remoteEndpoint = getMarkitdownApiUrl();
  if (remoteEndpoint) {
    return await parseWithRemoteMarkitdown(file, remoteEndpoint);
  }

  if (process.env.VERCEL) {
    throw new Error('Vercel 部署环境不能直接启动本机 MarkItDown Python 进程，请配置 MARKITDOWN_API_URL 指向外部 MarkItDown 服务');
  }

  const tempDir = path.join(os.tmpdir(), `study-dazi-markitdown-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, safeFileName(file.name));

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(tempPath, bytes);
    return await runConverter(tempPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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

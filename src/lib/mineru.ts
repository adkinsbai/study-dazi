export interface MineruParseResult {
  markdown: string;
  raw: unknown;
}

const DEFAULT_TASK_TIMEOUT_MS = 285_000;
const DEFAULT_POLL_INTERVAL_MS = 3_000;

function getEnvBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
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
    ['md_content'],
    ['markdown'],
    ['content'],
    ['data', 'md'],
    ['data', 'md_content'],
    ['data', 'markdown'],
    ['data', 'content'],
    ['result', 'md'],
    ['result', 'md_content'],
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
        if (/^(md|md_content|markdown|content)$/i.test(key) && typeof child === 'string' && child.trim()) {
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

function getMineruBaseUrl(): string {
  const baseUrl = process.env.MINERU_API_URL || process.env.CONVERTER_URL;
  if (!baseUrl) throw new Error('未配置 MINERU_API_URL');
  return baseUrl.replace(/\/$/, '');
}

function getMineruHeaders(): HeadersInit {
  return process.env.MINERU_API_TOKEN
    ? { Authorization: `Bearer ${process.env.MINERU_API_TOKEN}` }
    : {};
}

function buildMineruForm(file: File): FormData {
  const form = new FormData();
  form.append('files', file, file.name);
  form.append('return_md', 'true');

  if (process.env.MINERU_BACKEND) form.append('backend', process.env.MINERU_BACKEND);
  if (process.env.MINERU_LANG) form.append('lang_list', process.env.MINERU_LANG);
  form.append('formula_enable', String(getEnvBoolean('MINERU_FORMULA_ENABLE', false)));
  form.append('table_enable', String(getEnvBoolean('MINERU_TABLE_ENABLE', false)));
  return form;
}

async function readMineruResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => '');
}

function stringifyMineruPayload(payload: unknown, maxChars = 300): string {
  const message = payload && typeof payload === 'object'
    ? JSON.stringify(payload)
    : String(payload || '');
  return message.slice(0, maxChars);
}

async function requestMineru(baseUrl: string, path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const payload = await readMineruResponse(res);

  if (!res.ok) {
    const message = stringifyMineruPayload(payload);
    throw new Error(`MinerU 解析失败: ${res.status}${message ? ` ${message}` : ''}`);
  }

  return payload;
}

function extractTaskId(payload: unknown): string {
  const paths = [
    ['task_id'],
    ['taskId'],
    ['id'],
    ['data', 'task_id'],
    ['data', 'taskId'],
    ['data', 'id'],
    ['result', 'task_id'],
    ['result', 'taskId'],
    ['result', 'id'],
  ];

  for (const path of paths) {
    const found = getStringAtPath(payload, path);
    if (found?.trim()) return found.trim();
  }

  throw new Error(`MinerU 未返回任务 ID: ${stringifyMineruPayload(payload)}`);
}

function extractTaskStatus(payload: unknown): string | null {
  const paths = [
    ['status'],
    ['state'],
    ['task_status'],
    ['data', 'status'],
    ['data', 'state'],
    ['data', 'task_status'],
    ['result', 'status'],
    ['result', 'state'],
    ['result', 'task_status'],
  ];

  for (const path of paths) {
    const found = getStringAtPath(payload, path);
    if (found?.trim()) return found.trim().toLowerCase();
  }

  return null;
}

function isCompletedStatus(status: string | null): boolean {
  return !!status && ['completed', 'complete', 'success', 'succeeded', 'finished', 'done'].includes(status);
}

function isFailedStatus(status: string | null): boolean {
  return !!status && ['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled'].includes(status);
}

function getMineruTaskTimeoutMs(): number {
  const configured = Number(process.env.MINERU_TASK_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TASK_TIMEOUT_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollMineruTask(baseUrl: string, taskId: string, headers: HeadersInit): Promise<unknown> {
  const timeoutMs = getMineruTaskTimeoutMs();
  const startedAt = Date.now();
  let lastStatus: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastStatus = await requestMineru(baseUrl, `/tasks/${encodeURIComponent(taskId)}`, { headers, cache: 'no-store' });
    const status = extractTaskStatus(lastStatus);

    if (isCompletedStatus(status)) {
      return requestMineru(baseUrl, `/tasks/${encodeURIComponent(taskId)}/result`, { headers, cache: 'no-store' });
    }

    if (isFailedStatus(status)) {
      throw new Error(`MinerU 任务失败: ${stringifyMineruPayload(lastStatus)}`);
    }

    await sleep(DEFAULT_POLL_INTERVAL_MS);
  }

  throw new Error(`MinerU 任务超时，请稍后重试或换一个页数更少的文件: ${stringifyMineruPayload(lastStatus)}`);
}

export async function parseWithMineru(file: File): Promise<MineruParseResult> {
  const baseUrl = getMineruBaseUrl();
  const headers = getMineruHeaders();
  const submitPayload = await requestMineru(baseUrl, '/tasks', {
    method: 'POST',
    headers,
    body: buildMineruForm(file),
  });
  const taskId = extractTaskId(submitPayload);
  const payload = await pollMineruTask(baseUrl, taskId, headers);

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

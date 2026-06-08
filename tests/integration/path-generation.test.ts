import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---
vi.mock('@/lib/auth', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  chatCompletionStream: vi.fn(),
  chatCompletionStreamWithMeta: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
    userApiKey: {
      findUnique: vi.fn(),
    },
  },
}));

import { verifyAccessToken } from '@/lib/auth';
import { chatCompletionStreamWithMeta } from '@/lib/ai';
import prisma from '@/lib/prisma';

// --- Helpers ---
function mockAuth() {
  vi.mocked(verifyAccessToken).mockResolvedValue({
    sub: 'user-1',
    email: 'test@example.com',
    emailVerified: true,
  });
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: 'user-1',
    email: 'test@example.com',
    deepseekApiKey: 'sk-test-key',
  } as never);
  vi.mocked(prisma.userApiKey.findUnique).mockResolvedValue(null as never);
}

function createMockStream(text: string) {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}

function mockAIStream(text: string, finishReason: string | null = 'stop') {
  vi.mocked(chatCompletionStreamWithMeta).mockResolvedValue({
    stream: createMockStream(text),
    getFinishReason: () => finishReason,
  });
}

function mockAIStreamOnce(text: string, finishReason: string | null = 'stop') {
  vi.mocked(chatCompletionStreamWithMeta).mockResolvedValueOnce({
    stream: createMockStream(text),
    getFinishReason: () => finishReason,
  });
}

async function readSseResult(res: Response) {
  const text = await res.text();
  const doneLine = text
    .split('\n')
    .find((line) => line.startsWith('data: ') && line.includes('"result"'));
  if (!doneLine) throw new Error(`Missing done event in SSE response: ${text}`);
  return JSON.parse(doneLine.slice(6)).result;
}

function buildReq(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token', 'X-Stream': 'true' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Framework API ---
describe('POST /api/paths/generate/framework', () => {
  it('returns { phases: [...] } when AI returns bare array', async () => {
    mockAuth();
    mockAIStream('[{"id":"1","title":"阶段一","description":"基础","estimated_hours":10,"is_required":true,"why":"打基础"}]');

    const { POST } = await import('@/app/api/paths/generate/framework/route');
    const req = buildReq('http://localhost/api/paths/generate/framework', { domain: 'React', level: '零基础' });
    const res = await POST(req);
    const data = await readSseResult(res);

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('phases');
    expect(Array.isArray(data.phases)).toBe(true);
    expect(data.phases.length).toBe(1);
    expect(data.phases[0].title).toBe('阶段一');
  });

  it('passes through when AI already returns { phases: [...] }', async () => {
    mockAuth();
    mockAIStream('{"phases":[{"id":"1","title":"已包裹","description":"d","estimated_hours":5,"is_required":true,"why":"w"}]}');

    const { POST } = await import('@/app/api/paths/generate/framework/route');
    const req = buildReq('http://localhost/api/paths/generate/framework', { domain: 'React', level: '零基础' });
    const res = await POST(req);
    const data = await readSseResult(res);

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('phases');
    expect(data.phases[0].title).toBe('已包裹');
  });

  it('retries with a higher token budget when the provider reports max_tokens truncation', async () => {
    mockAuth();
    mockAIStreamOnce('{"phases":[{"id":"1","title":"截断"', 'length');
    mockAIStreamOnce('{"phases":[{"id":"1","title":"重试成功","description":"d","estimated_hours":5,"is_required":true,"why":"w"}]}');

    const { POST } = await import('@/app/api/paths/generate/framework/route');
    const req = buildReq('http://localhost/api/paths/generate/framework', { domain: 'React', level: '零基础' });
    const res = await POST(req);
    const data = await readSseResult(res);

    expect(res.status).toBe(200);
    expect(data.phases[0].title).toBe('重试成功');
    expect(chatCompletionStreamWithMeta).toHaveBeenCalledTimes(2);
    expect(vi.mocked(chatCompletionStreamWithMeta).mock.calls[1][4]).toMatchObject({ maxTokens: 3800 });
  });
});

// --- Nodes API ---
describe('POST /api/paths/generate/nodes', () => {
  it('returns { nodes: [...] } when AI returns bare array', async () => {
    mockAuth();
    mockAIStream('[{"id":"n1","title":"子节点一","description":"d","estimated_hours":3,"node_type":"required","resources_hint":"r","check_criteria":"c"}]');

    const { POST } = await import('@/app/api/paths/generate/nodes/route');
    const req = buildReq(
      'http://localhost/api/paths/generate/nodes',
      {
        domain: 'React',
        phases_json: '[{"id":"1","title":"P1"}]',
        phase_id: '1',
        phase_title: 'P1',
      },
    );
    const res = await POST(req);
    const data = await readSseResult(res);

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('nodes');
    expect(Array.isArray(data.nodes)).toBe(true);
    expect(data.nodes.length).toBe(1);
    expect(data.nodes[0].title).toBe('子节点一');
  });

  it('passes through when AI already returns { nodes: [...] }', async () => {
    mockAuth();
    mockAIStream('{"nodes":[{"id":"n1","title":"已包裹节点","description":"d","estimated_hours":2,"node_type":"required","resources_hint":"r","check_criteria":"c"}]}');

    const { POST } = await import('@/app/api/paths/generate/nodes/route');
    const req = buildReq(
      'http://localhost/api/paths/generate/nodes',
      {
        domain: 'React',
        phases_json: '[{"id":"1","title":"P1"}]',
        phase_id: '1',
        phase_title: 'P1',
      },
    );
    const res = await POST(req);
    const data = await readSseResult(res);

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('nodes');
    expect(data.nodes[0].title).toBe('已包裹节点');
  });
});

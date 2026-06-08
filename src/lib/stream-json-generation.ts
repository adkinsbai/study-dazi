import { chatCompletionStreamWithMeta } from './ai';
import { extractJSON, isTruncatedJSON } from './extract-json';

interface StreamJSONGenerationOptions {
  provider: string;
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  baseUrl?: string;
  initialMaxTokens: number;
  maxRetries?: number;
  tokenStep?: number;
  label: string;
  normalize: (value: object) => object;
}

interface StreamTextGenerationOptions {
  provider: string;
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  baseUrl?: string;
  initialMaxTokens: number;
  maxRetries?: number;
  tokenStep?: number;
  label: string;
  normalize: (text: string) => object;
}

function isLengthLimited(finishReason: string | null): boolean {
  return finishReason === 'length' || finishReason === 'max_tokens' || finishReason === 'model_context_window_exceeded';
}

function sendSse(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

export function streamJSONGeneration(options: StreamJSONGenerationOptions): ReadableStream<Uint8Array> {
  const maxRetries = options.maxRetries ?? 2;
  const tokenStep = options.tokenStep ?? 2000;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let maxTokens = options.initialMaxTokens;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        let fullText = '';
        let chunkCount = 0;

        try {
          const aiResult = await chatCompletionStreamWithMeta(
            options.provider,
            options.apiKey,
            options.systemPrompt,
            options.userMessage,
            { maxTokens, baseUrl: options.baseUrl },
          );
          const reader = aiResult.stream.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              fullText += String(value);
              chunkCount++;
              sendSse(controller, 'progress', { chunks: chunkCount, attempt, maxTokens });
            }
          } finally {
            reader.releaseLock();
          }

          const finishReason = aiResult.getFinishReason();
          console.log(`[${options.label}] Attempt ${attempt} done. Chunks: ${chunkCount}, Length: ${fullText.length}, Finish: ${finishReason || 'unknown'}`);

          try {
            const result = extractJSON(fullText);
            sendSse(controller, 'done', { result: options.normalize(result) });
            controller.close();
            return;
          } catch (parseError) {
            const lengthLimited = isLengthLimited(finishReason);
            if (lengthLimited || isTruncatedJSON(fullText)) {
              throw new Error('AI 响应达到 max_tokens 上限');
            }
            throw parseError;
          }
        } catch (err) {
          const truncated = isTruncatedJSON(fullText) || (err instanceof Error && err.message.includes('max_tokens'));
          if (truncated && attempt <= maxRetries) {
            const nextMaxTokens = maxTokens + tokenStep;
            console.warn(`[${options.label}] Truncated response, retrying (${maxTokens} -> ${nextMaxTokens})`);
            maxTokens = nextMaxTokens;
            sendSse(controller, 'retry', { attempt, maxTokens });
            continue;
          }

          console.error(`[${options.label}] Generation failed. Text length:`, fullText.length);
          if (fullText) {
            console.error(`[${options.label}] Raw text (first 500):`, fullText.substring(0, 500));
            console.error(`[${options.label}] Raw text (last 500):`, fullText.substring(Math.max(0, fullText.length - 500)));
          }
          const message = truncated ? 'AI 响应仍然过长，请缩小范围或减少上传资料后重试' : 'AI 响应解析失败，请重试';
          sendSse(controller, 'error', { message });
          controller.close();
          return;
        }
      }
    },
  });
}

export function streamTextGeneration(options: StreamTextGenerationOptions): ReadableStream<Uint8Array> {
  const maxRetries = options.maxRetries ?? 2;
  const tokenStep = options.tokenStep ?? 1500;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let maxTokens = options.initialMaxTokens;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        let fullText = '';
        let chunkCount = 0;

        try {
          const aiResult = await chatCompletionStreamWithMeta(
            options.provider,
            options.apiKey,
            options.systemPrompt,
            options.userMessage,
            { maxTokens, baseUrl: options.baseUrl },
          );
          const reader = aiResult.stream.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              fullText += String(value);
              chunkCount++;
              sendSse(controller, 'progress', { chunks: chunkCount, attempt, maxTokens });
            }
          } finally {
            reader.releaseLock();
          }

          const finishReason = aiResult.getFinishReason();
          console.log(`[${options.label}] Attempt ${attempt} done. Chunks: ${chunkCount}, Length: ${fullText.length}, Finish: ${finishReason || 'unknown'}`);

          if (!isLengthLimited(finishReason)) {
            sendSse(controller, 'done', { result: options.normalize(fullText.trim()) });
            controller.close();
            return;
          }

          throw new Error('AI 响应达到 max_tokens 上限');
        } catch (err) {
          const lengthLimited = err instanceof Error && err.message.includes('max_tokens');
          if (lengthLimited && attempt <= maxRetries) {
            const nextMaxTokens = maxTokens + tokenStep;
            console.warn(`[${options.label}] Length-limited text response, retrying (${maxTokens} -> ${nextMaxTokens})`);
            maxTokens = nextMaxTokens;
            sendSse(controller, 'retry', { attempt, maxTokens });
            continue;
          }

          const message = lengthLimited ? 'AI 响应仍然过长，请缩小范围后重试' : (err instanceof Error ? err.message : 'AI 响应生成失败');
          sendSse(controller, 'error', { message });
          controller.close();
          return;
        }
      }
    },
  });
}

export function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
}

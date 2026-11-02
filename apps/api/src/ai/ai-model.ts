import { Logger } from '@nestjs/common';
import { z } from 'zod';

/** What a generation can fail with; each maps to one API error code. */
export type AiModelErrorCode = 'AI_NOT_CONFIGURED' | 'AI_BUSY' | 'AI_BUDGET' | 'AI_BLOCKED' | 'AI_UNAVAILABLE' | 'AI_BAD_RESPONSE';

export class AiModelError extends Error {
  constructor(readonly code: AiModelErrorCode) {
    super(code);
  }
}

export type AiPart = { type: 'text'; text: string } | { type: 'document' | 'image'; data: string; mimeType: string };

export interface AiTextRequest {
  model: string;
  system: string;
  input: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface AiJsonRequest {
  model: string;
  system: string;
  input: AiPart[];
  /** JSON Schema of the answer. */
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

/** The model behind the assistant. Injected by this class token, so tests and local checks can replace it. */
export abstract class AiModel {
  abstract readonly configured: boolean;
  abstract stream(request: AiTextRequest): AsyncIterable<string>;
  abstract json(request: AiJsonRequest): Promise<unknown>;
}

const API = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/** Maps an HTTP status and error code of the Interactions API to our error. */
export function errorFromGemini(status: number, code: string | undefined): AiModelError {
  if (code === 'payment_required' || status === 402 || code === 'quota_exceeded') return new AiModelError('AI_BUDGET');
  if (status === 429) return new AiModelError('AI_BUSY');
  if (status === 401 || status === 403) return new AiModelError('AI_NOT_CONFIGURED');
  if (code && ['safety', 'recitation', 'language', 'prohibited_content', 'spii', 'blocklist', 'content_blocked'].includes(code)) return new AiModelError('AI_BLOCKED');
  return new AiModelError('AI_UNAVAILABLE');
}

const StreamEvent = z.looseObject({
  event_type: z.string().optional(),
  delta: z.looseObject({ type: z.string().optional(), text: z.string().optional() }).optional(),
  error: z.looseObject({ code: z.string().optional() }).optional(),
  interaction: z.looseObject({ status: z.string().optional() }).optional(),
});

/**
 * Reads the text out of one SSE `data:` payload. Unknown events are skipped, as the API asks.
 * Thought deltas have their own type, so reasoning never reaches the learner.
 */
export function parseStreamData(data: string): { text?: string; error?: AiModelError; done?: boolean } {
  if (data === '[DONE]') return { done: true };
  let parsed: z.infer<typeof StreamEvent>;
  try {
    parsed = StreamEvent.parse(JSON.parse(data));
  } catch {
    return {};
  }
  if (parsed.event_type === 'error' || parsed.error) return { error: errorFromGemini(0, parsed.error?.code) };
  if (parsed.event_type === 'step.delta' && parsed.delta?.type === 'text' && parsed.delta.text) return { text: parsed.delta.text };
  if (parsed.event_type === 'interaction.completed') return { done: true };
  return {};
}

/** Splits a growing SSE buffer into complete `data:` payloads and the unfinished rest. */
export function splitSse(buffer: string): { events: string[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? '';
  const events = blocks.flatMap((block) => {
    const data = block.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart());
    return data.length ? [data.join('\n')] : [];
  });
  return { events, rest };
}

const InteractionResponse = z.looseObject({
  steps: z.array(z.looseObject({ type: z.string().optional(), content: z.array(z.looseObject({ type: z.string().optional(), text: z.string().optional() })).optional() })).optional(),
});

/** The model's text in a finished interaction: the text parts of its output steps. */
export function outputText(body: unknown): string {
  const parsed = InteractionResponse.safeParse(body);
  if (!parsed.success) return '';
  return (parsed.data.steps ?? [])
    .filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('');
}

/** The Gemini Interactions API over plain fetch (no package). `store: false`: Google keeps no conversation state for us. */
export class GeminiModel extends AiModel {
  private readonly logger = new Logger(GeminiModel.name);

  constructor(private readonly apiKey: string | undefined) {
    super();
  }

  get configured(): boolean {
    return !!this.apiKey;
  }

  private async post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    if (!this.apiKey) throw new AiModelError('AI_NOT_CONFIGURED');
    let response: Response;
    try {
      response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    } catch (error) {
      if (signal?.aborted) throw error;
      this.logger.warn(`Gemini could not be reached: ${error instanceof Error ? error.name : 'error'}`);
      throw new AiModelError('AI_UNAVAILABLE');
    }
    if (response.ok) return response;
    const code = await response
      .json()
      .then((j: { error?: { code?: unknown } }) => (typeof j.error?.code === 'string' ? j.error.code : undefined))
      .catch(() => undefined);
    // Status and code only: the body could quote the learner's text.
    this.logger.warn(`Gemini answered ${response.status} ${code ?? ''}`);
    throw errorFromGemini(response.status, code);
  }

  async *stream(request: AiTextRequest): AsyncIterable<string> {
    const response = await this.post(
      '?alt=sse',
      { model: request.model, system_instruction: request.system, input: request.input, stream: true, store: false, generation_config: { max_output_tokens: request.maxOutputTokens } },
      request.signal,
    );
    if (!response.body) throw new AiModelError('AI_UNAVAILABLE');
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      const { events, rest } = splitSse(buffer);
      buffer = rest;
      for (const data of events) {
        const event = parseStreamData(data);
        if (event.error) throw event.error;
        if (event.text) yield event.text;
        if (event.done) return;
      }
    }
  }

  async json(request: AiJsonRequest): Promise<unknown> {
    const input = request.input.map((part) => (part.type === 'text' ? part : { type: part.type, data: part.data, mime_type: part.mimeType }));
    const response = await this.post(
      '',
      {
        model: request.model,
        system_instruction: request.system,
        input,
        store: false,
        generation_config: { max_output_tokens: request.maxOutputTokens },
        response_format: { type: 'text', mime_type: 'application/json', schema: request.schema },
      },
      request.signal,
    );
    const text = outputText(await response.json().catch(() => null));
    if (!text) throw new AiModelError('AI_BLOCKED');
    try {
      return JSON.parse(text);
    } catch {
      throw new AiModelError('AI_BAD_RESPONSE');
    }
  }
}

/**
 * Canned answers without network, for tests and for checking the screens locally (AI_PROVIDER=mock).
 * The server refuses to start with it in production.
 */
export class MockAiModel extends AiModel {
  readonly configured = true;
  /** Set in tests: the next call fails with this error. */
  failWith: AiModelError | null = null;
  /** What the model last received, for tests. */
  last: AiTextRequest | AiJsonRequest | null = null;

  async *stream(request: AiTextRequest): AsyncIterable<string> {
    this.last = request;
    if (this.failWith) throw this.failWith;
    for (const piece of ['Проверочный ответ помощника. ', 'Это **локальный режим** без настоящей модели: ', 'экран и поток ответа работают.']) {
      if (request.signal?.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
      yield piece;
    }
  }

  async json(request: AiJsonRequest): Promise<unknown> {
    this.last = request;
    if (this.failWith) throw this.failWith;
    const text = (s: string) => ({ en: s, ru: `${s} (ru)`, tg: `${s} (tg)` });
    const properties = (request.schema as { properties?: Record<string, { items?: { properties?: { topicSlug?: { enum?: string[] } } } }> }).properties ?? {};
    const topicSlug = properties.questions?.items?.properties?.topicSlug?.enum?.[0] ?? 'js-variables';
    const questions = [1, 2, 3].map((n) => ({
      topicSlug,
      prompt: text(`Mock question ${n}`),
      code: '',
      options: [text('Right'), text('Wrong')],
      correctIndex: 0,
      explanation: text('Mock explanation'),
    }));
    return { title: 'Mock test', lessonTitle: 'Mock lesson', lessonBody: '# Mock lesson\n\nText of the lesson.', questions };
  }
}

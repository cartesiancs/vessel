import type { HistoryMessage, ChatResponse, ChatOptions, StreamCallback } from './types';
import type { CapsuleClient } from './client';

/**
 * 기본 최대 히스토리 메시지 수
 */
const DEFAULT_MAX_HISTORY = 50;

/**
 * 대화 옵션
 */
export interface ConversationOptions {
  /** 시스템 프롬프트 */
  systemPrompt?: string;
  /** 최대 히스토리 메시지 수 (기본값: 50) */
  maxHistory?: number;
}

/**
 * 멀티턴 대화 관리자
 *
 * 대화 히스토리를 자동으로 관리하고 매 요청에 포함시킵니다.
 * 히스토리는 메모리에만 저장되며 서버에 저장되지 않습니다.
 *
 * @example
 * ```typescript
 * const client = new CapsuleClient({ baseUrl: 'https://capsule.example.com' });
 * const conversation = new Conversation(client, {
 *   systemPrompt: 'You are a helpful assistant.',
 *   maxHistory: 20,
 * });
 *
 * const res1 = await conversation.chat('Hello!');
 * console.log(res1.response);
 *
 * const res2 = await conversation.chat('What did I just say?');
 * // AI가 이전 대화를 참조하여 응답
 * ```
 */
export class Conversation {
  private client: CapsuleClient;
  private history: HistoryMessage[] = [];
  private systemPrompt?: string;
  private maxHistory: number;

  constructor(client: CapsuleClient, options?: ConversationOptions) {
    this.client = client;
    this.systemPrompt = options?.systemPrompt;
    this.maxHistory = options?.maxHistory ?? DEFAULT_MAX_HISTORY;
  }

  /**
   * 메시지 전송 및 응답 수신
   *
   * 사용자 메시지와 AI 응답을 자동으로 히스토리에 추가합니다.
   */
  async chat(message: string): Promise<ChatResponse> {
    const chatOptions: ChatOptions = {
      systemPrompt: this.systemPrompt,
      history: this.history.length > 0 ? [...this.history] : undefined,
    };

    const response = await this.client.chat(message, chatOptions);

    this.appendToHistory({ role: 'user', content: message });
    this.appendToHistory({ role: 'assistant', content: response.response });

    return response;
  }

  /**
   * 스트리밍 메시지 전송
   *
   * 스트리밍 완료 후 전체 응답을 히스토리에 추가합니다.
   */
  async chatStream(message: string, onChunk: StreamCallback): Promise<void> {
    const chatOptions: ChatOptions = {
      systemPrompt: this.systemPrompt,
      history: this.history.length > 0 ? [...this.history] : undefined,
    };

    let fullResponse = '';

    await this.client.chatStream(
      message,
      (chunk: string, done: boolean) => {
        if (!done) {
          fullResponse += chunk;
        }
        onChunk(chunk, done);

        if (done) {
          this.appendToHistory({ role: 'user', content: message });
          this.appendToHistory({ role: 'assistant', content: fullResponse });
        }
      },
      chatOptions,
    );
  }

  /**
   * 이미지 분석 결과를 히스토리에 추가
   *
   * 암호화된 이미지는 재전송할 수 없으므로,
   * 이미지 분석 결과를 텍스트로 히스토리에 추가합니다.
   */
  addImageAnalysisToHistory(userMessage: string, assistantResponse: string): void {
    this.appendToHistory({
      role: 'user',
      content: `[Image analysis request] ${userMessage}`,
    });
    this.appendToHistory({
      role: 'assistant',
      content: assistantResponse,
    });
  }

  /**
   * 현재 대화 히스토리 조회 (읽기 전용 복사본)
   */
  getHistory(): ReadonlyArray<HistoryMessage> {
    return [...this.history];
  }

  /**
   * 대화 히스토리 초기화
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * 시스템 프롬프트 변경
   */
  setSystemPrompt(prompt: string | undefined): void {
    this.systemPrompt = prompt;
  }

  private appendToHistory(message: HistoryMessage): void {
    this.history.push(message);

    while (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
}

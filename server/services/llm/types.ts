export interface LLMConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateOptions {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface LLMProvider {
  generateText(messages: Message[], options?: GenerateOptions): Promise<string>;
}

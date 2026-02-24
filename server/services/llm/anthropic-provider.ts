import type { LLMConfig, LLMProvider, Message, GenerateOptions } from "./types.js";

export function createAnthropicProvider(config: LLMConfig): LLMProvider {
  return {
    async generateText(messages: Message[], options?: GenerateOptions): Promise<string> {
      let system: string | undefined;
      const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

      for (const m of messages) {
        if (m.role === "system") {
          system = m.content;
        } else {
          apiMessages.push({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          });
        }
      }

      const body: Record<string, unknown> = {
        model: config.model,
        max_tokens: options?.maxOutputTokens ?? 4096,
        messages: apiMessages,
      };
      if (system) body.system = system;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err?.error?.message || `Anthropic API error: ${res.status}`);
      }

      const data = (await res.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };
      const block = data.content?.find((b) => b.type === "text");
      const text = block?.text;
      if (text != null) return text;
      throw new Error("No text in Anthropic response");
    },
  };
}

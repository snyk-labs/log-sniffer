import type { LLMConfig, LLMProvider, Message, GenerateOptions } from "./types.js";

function openAiRole(role: Message["role"]): "user" | "assistant" | "system" {
  return role === "model" ? "assistant" : role;
}

export function createOpenAIProvider(config: LLMConfig): LLMProvider {
  const baseUrl = config.baseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1";

  return {
    async generateText(messages: Message[], options?: GenerateOptions): Promise<string> {
      const apiMessages = messages.map((m) => ({
        role: openAiRole(m.role),
        content: m.content,
      }));

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: apiMessages,
          max_tokens: options?.maxOutputTokens ?? 4096,
          temperature: options?.temperature ?? 0.1,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err?.error?.message || `OpenAI API error: ${res.status}`);
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content;
      if (text != null) return text;
      throw new Error("No content in OpenAI response");
    },
  };
}

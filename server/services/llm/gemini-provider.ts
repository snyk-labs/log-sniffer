import { GoogleGenAI } from "@google/genai";
import type { LLMConfig, LLMProvider, Message, GenerateOptions } from "./types.js";

export function createGeminiProvider(config: LLMConfig): LLMProvider {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  return {
    async generateText(messages: Message[], options?: GenerateOptions): Promise<string> {
      const contents = messages.map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      }));
      if (contents.length === 0) {
        contents.push({ role: "user", parts: [{ text: "" }] });
      }

      const response = await ai.models.generateContent({
        model: config.model,
        contents,
        config: {
          maxOutputTokens: options?.maxOutputTokens ?? 4096,
          temperature: options?.temperature ?? 0.1,
          topP: options?.topP ?? 0.9,
          topK: options?.topK ?? 40,
        },
      });

      if (response.text) return response.text;
      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts?.[0]?.text) return candidate.content.parts[0].text;
      throw new Error("No text in Gemini response");
    },
  };
}

import type { LLMConfig, LLMProvider } from "./types.js";
import { createGeminiProvider } from "./gemini-provider.js";
import { createOpenAIProvider } from "./openai-provider.js";
import { createAnthropicProvider } from "./anthropic-provider.js";

const UNCONFIGURED_MESSAGE =
  "AI is not configured. Please configure an AI provider (provider, model, and API key) in the settings.";

function createNoOpProvider(): LLMProvider {
  return {
    async generateText(): Promise<string> {
      return UNCONFIGURED_MESSAGE;
    },
  };
}

export function getProvider(config: LLMConfig | null): LLMProvider {
  if (!config?.provider?.trim() || !config?.model?.trim() || !config?.apiKey?.trim()) {
    return createNoOpProvider();
  }

  const provider = config.provider.toLowerCase();

  if (provider === "gemini" || provider === "google" || provider === "google gemini") {
    return createGeminiProvider(config);
  }

  if (provider === "openai" || provider === "custom") {
    return createOpenAIProvider(config);
  }

  if (provider === "anthropic" || provider === "claude") {
    return createAnthropicProvider(config);
  }

  return createNoOpProvider();
}

export type { LLMConfig, LLMProvider, Message, GenerateOptions } from "./types.js";

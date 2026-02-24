import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Eye, EyeOff, ChevronDown, ChevronUp, Bot } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface LlmConfigResponse {
  provider: string;
  model: string;
  configured: boolean;
}

const PROVIDERS = [
  { value: "gemini", label: "Google Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "custom", label: "Custom (OpenAI-compatible)" },
] as const;

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  gemini: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
  custom: [],
};

interface LlmConfigurationPanelProps {
  onClear?: () => void;
}

export default function LlmConfigurationPanel({ onClear }: LlmConfigurationPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    provider: "gemini",
    model: "gemini-2.5-flash",
    modelOther: "",
    apiKey: "",
    baseUrl: "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const configQuery = useQuery<LlmConfigResponse | null>({
    queryKey: ["/api/llm-config"],
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (body: { provider: string; model: string; apiKey: string; baseUrl?: string }) => {
      const response = await fetch("/api/llm-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Save failed");
      }
      return response.json() as Promise<LlmConfigResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config"] });
      toast({ title: "AI configuration saved", description: "Your LLM provider and model are configured." });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/llm-config/clear", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Clear failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/llm-config"] });
      setFormData({
        provider: "gemini",
        model: "gemini-2.5-flash",
        modelOther: "",
        apiKey: "",
        baseUrl: "",
      });
      onClear?.();
      toast({ title: "AI configuration cleared" });
    },
  });

  const configured = configQuery.data?.configured ?? false;
  const currentProvider = configQuery.data?.provider;
  const currentModel = configQuery.data?.model;

  useEffect(() => {
    if (configQuery.data?.provider) {
      const provider = configQuery.data.provider;
      const model = configQuery.data.model;
      const presets = MODELS_BY_PROVIDER[provider] || [];
      const isPreset = presets.some((m) => m.value === model);
      setFormData((prev) => ({
        ...prev,
        provider,
        model: isPreset ? model : presets[0]?.value ?? prev.model,
        modelOther: isPreset ? "" : model,
      }));
    }
  }, [configQuery.data]);

  useEffect(() => {
    if (configured && !configQuery.isLoading) setIsCollapsed(true);
  }, [configured, configQuery.isLoading]);

  const models = MODELS_BY_PROVIDER[formData.provider] || [];
  const useOtherModel =
    formData.provider === "custom" ||
    (formData.modelOther.length > 0 && !models.some((m) => m.value === formData.model));
  const effectiveModel = useOtherModel ? formData.modelOther.trim() || formData.model : formData.model;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.apiKey.trim() || !effectiveModel) return;
    saveMutation.mutate({
      provider: formData.provider,
      model: effectiveModel,
      apiKey: formData.apiKey.trim(),
      baseUrl: formData.provider === "custom" ? formData.baseUrl.trim() || undefined : undefined,
    });
  };

  const handleClear = () => clearMutation.mutate();

  const isValid = formData.apiKey.trim().length > 0 && effectiveModel.length > 0;

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg font-semibold text-snyk-text">
                AI / LLM Configuration
              </CardTitle>
            </div>
            {configured && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-gray-500 hover:text-gray-700"
              >
                {isCollapsed ? (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Show
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Hide
                  </>
                )}
              </Button>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={!isValid || saveMutation.isPending}
                className="bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
              {configured && (
                <Button
                  type="button"
                  onClick={handleClear}
                  disabled={clearMutation.isPending}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Clear
                </Button>
              )}
            </div>
          )}
          {isCollapsed && configured && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>✓ Configured</span>
              <span>
                ({currentProvider} · {currentModel})
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <Label className="block text-sm font-medium text-snyk-text mb-2">Provider</Label>
              <Select
                value={formData.provider}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    provider: value,
                    model:
                      value === "gemini"
                        ? "gemini-2.5-flash"
                        : value === "openai"
                          ? "gpt-4o-mini"
                          : value === "anthropic"
                            ? "claude-3-5-sonnet-20241022"
                            : prev.modelOther || "gpt-4o-mini",
                    modelOther: value === "custom" ? prev.modelOther : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.provider !== "custom" && models.length > 0 && (
              <div>
                <Label className="block text-sm font-medium text-snyk-text mb-2">Model</Label>
                <Select
                  value={formData.modelOther ? "other" : formData.model}
                  onValueChange={(value) =>
                    setFormData((prev) =>
                      value === "other"
                        ? { ...prev, model: "", modelOther: prev.modelOther || prev.model }
                        : { ...prev, model: value, modelOther: "" }
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other (type below)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(formData.provider === "custom" || formData.modelOther || formData.model === "other") && (
              <div>
                <Label className="block text-sm font-medium text-snyk-text mb-2">
                  {formData.provider === "custom" ? "Model" : "Model (other)"}
                </Label>
                <Input
                  placeholder="e.g. gpt-4o-mini or your model id"
                  value={formData.modelOther}
                  onChange={(e) => setFormData((prev) => ({ ...prev, modelOther: e.target.value }))}
                />
              </div>
            )}

            <div>
              <Label className="block text-sm font-medium text-snyk-text mb-2">
                API Key <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Enter your API key"
                  value={formData.apiKey}
                  onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Used for executive summary, chat, and insights</p>
            </div>

            {formData.provider === "custom" && (
              <div className="md:col-span-2">
                <Label className="block text-sm font-medium text-snyk-text mb-2">Base URL (optional)</Label>
                <Input
                  placeholder="https://api.openai.com/v1"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))}
                />
                <p className="text-xs text-gray-500 mt-1">OpenAI-compatible API endpoint</p>
              </div>
            )}
          </form>
        </CardContent>
      )}
    </Card>
  );
}

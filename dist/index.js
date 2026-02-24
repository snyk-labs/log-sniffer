// server/index.ts
import express2 from "express";
import cookieParser from "cookie-parser";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  auditLogs;
  chatSessions;
  apiConfigurations;
  constructor() {
    this.auditLogs = /* @__PURE__ */ new Map();
    this.chatSessions = /* @__PURE__ */ new Map();
    this.apiConfigurations = /* @__PURE__ */ new Map();
  }
  async getAuditLogs(filters) {
    let logs = Array.from(this.auditLogs.values());
    if (filters.from) {
      logs = logs.filter((log2) => log2.created >= new Date(filters.from));
    }
    if (filters.to) {
      logs = logs.filter((log2) => log2.created < new Date(filters.to));
    }
    if (filters.events && filters.events.length > 0) {
      logs = logs.filter((log2) => filters.events.includes(log2.event));
    }
    if (filters.excludeEvents && filters.excludeEvents.length > 0) {
      logs = logs.filter((log2) => !filters.excludeEvents.includes(log2.event));
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      logs = logs.filter(
        (log2) => log2.event.toLowerCase().includes(searchLower) || JSON.stringify(log2.content).toLowerCase().includes(searchLower)
      );
    }
    logs.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    const total = logs.length;
    const size = filters.size || 50;
    let startIndex = 0;
    if (filters.cursor) {
      const cursorIndex = logs.findIndex((log2) => log2.id === filters.cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }
    const items = logs.slice(startIndex, startIndex + size);
    const nextCursor = items.length === size && startIndex + size < total ? items[items.length - 1].id : void 0;
    return { items, nextCursor, total };
  }
  async createAuditLog(insertAuditLog) {
    const id = randomUUID();
    const auditLog = {
      ...insertAuditLog,
      id,
      orgId: insertAuditLog.orgId || null,
      groupId: insertAuditLog.groupId || null,
      projectId: insertAuditLog.projectId || null
    };
    this.auditLogs.set(id, auditLog);
    return auditLog;
  }
  async getChatSession(id) {
    return this.chatSessions.get(id);
  }
  async createChatSession(insertSession) {
    const id = randomUUID();
    const now = /* @__PURE__ */ new Date();
    const session = {
      ...insertSession,
      id,
      userId: insertSession.userId || null,
      messages: insertSession.messages || [],
      createdAt: now,
      updatedAt: now
    };
    this.chatSessions.set(id, session);
    return session;
  }
  async updateChatSession(id, update) {
    const session = this.chatSessions.get(id);
    if (!session) {
      throw new Error("Chat session not found");
    }
    const updatedSession = {
      ...session,
      ...update,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.chatSessions.set(id, updatedSession);
    return updatedSession;
  }
  async getAllAuditLogs() {
    return Array.from(this.auditLogs.values());
  }
  async getApiConfiguration(userId) {
    return Array.from(this.apiConfigurations.values()).find(
      (config) => config.userId === userId || !userId
    );
  }
  async createApiConfiguration(insertConfig) {
    const id = randomUUID();
    const now = /* @__PURE__ */ new Date();
    const config = {
      ...insertConfig,
      id,
      userId: insertConfig.userId || null,
      snykApiToken: insertConfig.snykApiToken || null,
      groupId: insertConfig.groupId || null,
      orgId: insertConfig.orgId || null,
      apiVersion: insertConfig.apiVersion || null,
      createdAt: now,
      updatedAt: now
    };
    this.apiConfigurations.set(id, config);
    return config;
  }
  async updateApiConfiguration(id, updateConfig) {
    const config = this.apiConfigurations.get(id);
    if (!config) {
      throw new Error("API configuration not found");
    }
    const updatedConfig = {
      ...config,
      ...updateConfig,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.apiConfigurations.set(id, updatedConfig);
    return updatedConfig;
  }
};
var storage = new MemStorage();

// server/services/snyk-api.ts
var SnykApiError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "SnykApiError";
  }
};
var SnykApiClient = class {
  baseUrl = "https://api.snyk.io/rest";
  apiToken;
  apiVersion;
  constructor(apiToken, apiVersion = "2024-10-15") {
    this.apiToken = apiToken;
    this.apiVersion = apiVersion;
  }
  async makeRequest(endpoint, params) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== void 0 && value !== null && value !== "") {
          if (Array.isArray(value)) {
            value.forEach((item) => url.searchParams.append(key, String(item)));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }
    console.log(`Final API URL: ${url.toString()}`);
    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `token ${this.apiToken}`,
        "Content-Type": "application/vnd.api+json",
        "User-Agent": "Snyk-Audit-Dashboard/1.0",
        "version": this.apiVersion
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Snyk API error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.errors?.[0]?.detail || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      throw new SnykApiError(errorMessage, response.status);
    }
    return response.json();
  }
  async getOrganizationAuditLogs(orgId, filters = {}) {
    try {
      const params = {
        version: this.apiVersion,
        limit: String(filters.size || 50)
      };
      if (filters.cursor) params.starting_after = filters.cursor;
      if (filters.from) params["filter[from]"] = filters.from;
      if (filters.to) params["filter[to]"] = filters.to;
      if (filters.events && filters.events.length > 0) params["filter[event]"] = filters.events;
      if (filters.excludeEvents && filters.excludeEvents.length > 0) params["filter[exclude_event]"] = filters.excludeEvents;
      console.log(`Making API request with params:`, JSON.stringify(params, null, 2));
      const response = await this.makeRequest(`/orgs/${orgId}/audit_logs/search`, params);
      const data = response.data || response;
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      return {
        items: items.map((item) => this.transformAuditLogItem(item)),
        total: response.meta?.count || response.total || items.length,
        nextCursor: response.links?.next ? this.extractCursor(response.links.next) : void 0
      };
    } catch (error) {
      if (error instanceof SnykApiError) {
        throw error;
      }
      throw new SnykApiError(`Failed to fetch organization audit logs: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  async getGroupAuditLogs(groupId, filters = {}) {
    try {
      const params = {
        version: this.apiVersion,
        limit: String(filters.size || 50)
      };
      if (filters.cursor) params.starting_after = filters.cursor;
      if (filters.from) params["filter[from]"] = filters.from;
      if (filters.to) params["filter[to]"] = filters.to;
      if (filters.events && filters.events.length > 0) params["filter[event]"] = filters.events;
      if (filters.excludeEvents && filters.excludeEvents.length > 0) params["filter[exclude_event]"] = filters.excludeEvents;
      console.log(`Making Group API request with params:`, JSON.stringify(params, null, 2));
      const response = await this.makeRequest(`/groups/${groupId}/audit_logs/search`, params);
      const data = response.data || response;
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      return {
        items: items.map((item) => this.transformAuditLogItem(item)),
        total: response.meta?.count || response.total || items.length,
        nextCursor: response.links?.next ? this.extractCursor(response.links.next) : void 0
      };
    } catch (error) {
      if (error instanceof SnykApiError) {
        throw error;
      }
      throw new SnykApiError(`Failed to fetch group audit logs: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  transformAuditLogItem(item) {
    return {
      id: item.id || item.uuid || crypto.randomUUID(),
      event: item.attributes?.event || item.event || "unknown.event",
      created: item.attributes?.created || item.created || item.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      content: item.attributes?.content || item.content || item.data || {},
      orgId: item.relationships?.org?.data?.id || item.orgId || item.org_id || null,
      groupId: item.relationships?.group?.data?.id || item.groupId || item.group_id || null,
      projectId: item.relationships?.project?.data?.id || item.projectId || item.project_id || null
    };
  }
  extractCursor(nextUrl) {
    try {
      const url = new URL(nextUrl);
      return url.searchParams.get("starting_after") || void 0;
    } catch {
      return void 0;
    }
  }
  async testConnection() {
    try {
      await this.makeRequest("/orgs", {
        version: this.apiVersion
      });
      return { success: true, message: "Connection successful" };
    } catch (error) {
      const message = error instanceof SnykApiError ? error.message : "Failed to connect to Snyk API";
      return { success: false, message };
    }
  }
};

// server/services/llm/gemini-provider.ts
import { GoogleGenAI } from "@google/genai";
function createGeminiProvider(config) {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  return {
    async generateText(messages, options) {
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
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
          topK: options?.topK ?? 40
        }
      });
      if (response.text) return response.text;
      const candidate = response.candidates?.[0];
      if (candidate?.content?.parts?.[0]?.text) return candidate.content.parts[0].text;
      throw new Error("No text in Gemini response");
    }
  };
}

// server/services/llm/openai-provider.ts
function openAiRole(role) {
  return role === "model" ? "assistant" : role;
}
function createOpenAIProvider(config) {
  const baseUrl = config.baseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1";
  return {
    async generateText(messages, options) {
      const apiMessages = messages.map((m) => ({
        role: openAiRole(m.role),
        content: m.content
      }));
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: apiMessages,
          max_tokens: options?.maxOutputTokens ?? 4096,
          temperature: options?.temperature ?? 0.1
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `OpenAI API error: ${res.status}`);
      }
      const data = await res.json();
      const text2 = data.choices?.[0]?.message?.content;
      if (text2 != null) return text2;
      throw new Error("No content in OpenAI response");
    }
  };
}

// server/services/llm/anthropic-provider.ts
function createAnthropicProvider(config) {
  return {
    async generateText(messages, options) {
      let system;
      const apiMessages = [];
      for (const m of messages) {
        if (m.role === "system") {
          system = m.content;
        } else {
          apiMessages.push({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content
          });
        }
      }
      const body = {
        model: config.model,
        max_tokens: options?.maxOutputTokens ?? 4096,
        messages: apiMessages
      };
      if (system) body.system = system;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Anthropic API error: ${res.status}`);
      }
      const data = await res.json();
      const block = data.content?.find((b) => b.type === "text");
      const text2 = block?.text;
      if (text2 != null) return text2;
      throw new Error("No text in Anthropic response");
    }
  };
}

// server/services/llm/index.ts
var UNCONFIGURED_MESSAGE = "AI is not configured. Please configure an AI provider (provider, model, and API key) in the settings.";
function createNoOpProvider() {
  return {
    async generateText() {
      return UNCONFIGURED_MESSAGE;
    }
  };
}
function getProvider(config) {
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

// server/services/llm-service.ts
async function generateExecutiveSummary(auditLogs2, llmConfig) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
    const recentLogs = auditLogs2.filter((log2) => new Date(log2.created) >= oneDayAgo);
    const logSummary = recentLogs.slice(0, 200).map((log2) => ({
      event: log2.event,
      created: log2.created,
      content: log2.content
    }));
    if (recentLogs.length === 0) {
      return "No recent audit logs found in the last 24 hours. Please check if your Snyk organization has recent activity.";
    }
    const eventSummary = logSummary.reduce((acc, log2) => {
      acc[log2.event] = (acc[log2.event] || 0) + 1;
      return acc;
    }, {});
    const uniqueUsers = new Set(
      logSummary.map((log2) => {
        const content = log2.content;
        return content?.user_email || content?.user_id || "Unknown";
      })
    ).size;
    const topEvents = Object.entries(eventSummary).sort(([, a], [, b]) => b - a).slice(0, 5).map(([event, count]) => `${event}: ${count}`).join(", ");
    const currentDate = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC"
    });
    const prompt = `Create a comprehensive executive security summary for Snyk audit events from the last 24 hours.

IMPORTANT: Today's date is ${currentDate}. Use this as the report date and reference timeframe.

Event Data: ${logSummary.length} events, ${uniqueUsers} users
Top Events: ${topEvents}

Generate a detailed executive report with these sections:

## Executive Security Summary

### \u{1F50D} Activity Overview
Provide a thorough assessment of security activity and operational posture over the last 24 hours. Include the current date (${currentDate}) in your analysis.

### \u{1F6A8} Critical Events
Analyze the top security events by frequency and potential impact, including specific details about each event type.

### \u26A0\uFE0F Risk Analysis
Evaluate security concerns, threat patterns, and vulnerability implications from the logged activities.

### \u{1F465} User Activity Insights
Examine user behavior patterns, access trends, and any anomalies in user actions.

### \u{1F4CB} Recommendations
Provide detailed, prioritized actionable steps for leadership with High/Medium/Low priority levels and business impact analysis.

### \u{1F4CA} Key Metrics & Trends
Present comprehensive statistics including event frequencies, user engagement, and security posture indicators.

Create a professional, detailed executive-level analysis with complete sections. Use proper Markdown formatting with headers, bullet points, bold text, and comprehensive insights.`;
    const provider = getProvider(llmConfig);
    const text2 = await provider.generateText([{ role: "user", content: prompt }], {
      maxOutputTokens: 4096,
      temperature: 0.1,
      topP: 0.9,
      topK: 40
    });
    return text2;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Executive summary error:", error);
    return `Summary generation error: ${message}`;
  }
}
async function analyzeAuditLogs(auditLogs2, llmConfig) {
  try {
    const logSummary = auditLogs2.slice(0, 100).map((log2) => ({
      event: log2.event,
      created: log2.created,
      content: log2.content
    }));
    const prompt = `
Analyze these Snyk audit logs and provide security insights:

${JSON.stringify(logSummary, null, 2)}

Please provide:
1. Key security events summary
2. Risk patterns or anomalies
3. Recommendations for improvement
4. Overall security posture assessment

Format as a JSON array of string insights.
`;
    const provider = getProvider(llmConfig);
    const result = await provider.generateText([{ role: "user", content: prompt }]);
    try {
      const insights = JSON.parse(result);
      return Array.isArray(insights) ? insights : [result];
    } catch {
      return [result];
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI analysis error:", error);
    return [`Analysis error: ${message}`];
  }
}
async function chatWithAI(message, auditLogs2, previousMessages, llmConfig) {
  try {
    const context = auditLogs2.slice(0, 50).map((log2) => ({
      event: log2.event,
      created: log2.created,
      content: log2.content
    }));
    const systemContent = `You are a security analyst assistant for Snyk audit logs. 
You have access to recent audit log data and can help users understand security events, 
identify patterns, and provide recommendations.

Recent audit logs context:
${JSON.stringify(context, null, 2)}

Previous conversation:
${previousMessages.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}

Current user message: ${message}

IMPORTANT: Respond in PLAIN TEXT format only. Do not use Markdown formatting like **bold**, *italics*, # headers, - bullet points, ## headings, or any other Markdown syntax. Use simple text with line breaks for readability.

Please provide helpful, security-focused responses based on the audit log data using plain text formatting only.`;
    const provider = getProvider(llmConfig);
    const result = await provider.generateText([{ role: "user", content: systemContent }]);
    return result || "I apologize, but I couldn't process your request at this time.";
  } catch (error) {
    const message2 = error instanceof Error ? error.message : String(error);
    console.error("Chat error:", error);
    return `I encountered an error: ${message2}. Please try again.`;
  }
}

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  event: text("event").notNull(),
  created: timestamp("created").notNull(),
  orgId: text("org_id"),
  groupId: text("group_id"),
  projectId: text("project_id"),
  content: jsonb("content").notNull()
});
var chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});
var apiConfigurations = pgTable("api_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id"),
  snykApiToken: text("snyk_api_token"),
  groupId: text("group_id"),
  orgId: text("org_id"),
  apiVersion: text("api_version").default("2024-10-15"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});
var insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true
});
var insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertApiConfigurationSchema = createInsertSchema(apiConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var auditLogFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  events: z.array(z.string()).optional(),
  excludeEvents: z.array(z.string()).optional(),
  size: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
  search: z.string().optional()
});
var chatMessageSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional()
});

// server/cookie-session-storage.ts
import { randomBytes } from "crypto";
var CookieSessionStorage = class {
  sessions = /* @__PURE__ */ new Map();
  CLEANUP_INTERVAL = 5 * 60 * 1e3;
  // 5 minutes
  SESSION_TIMEOUT = 30 * 60 * 1e3;
  // 30 minutes
  COOKIE_NAME = "snyk-session-id";
  constructor() {
    setInterval(() => this.cleanupExpiredSessions(), this.CLEANUP_INTERVAL);
  }
  // Generate a cryptographically secure session ID
  generateSessionId() {
    const timestamp2 = Date.now().toString(36);
    const random = randomBytes(16).toString("hex");
    return `${timestamp2}-${random}`;
  }
  // Get session ID from cookie or create new one
  getOrCreateSessionId(req, res) {
    let sessionId = req.cookies?.[this.COOKIE_NAME];
    if (sessionId && this.sessions.has(sessionId)) {
      const session2 = this.sessions.get(sessionId);
      if (Date.now() - session2.lastAccessed > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        sessionId = void 0;
      } else {
        session2.lastAccessed = Date.now();
        return sessionId;
      }
    }
    sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };
    this.sessions.set(sessionId, session);
    const cookieOptions = {
      httpOnly: true,
      // Prevent XSS
      secure: false,
      // Disable secure flag for local HTTP development
      sameSite: "strict",
      // Use strict for better isolation in local dev
      maxAge: this.SESSION_TIMEOUT,
      // 30 minutes
      path: "/",
      // Available for all paths
      domain: void 0
      // Let browser determine domain
    };
    res.cookie(this.COOKIE_NAME, sessionId, cookieOptions);
    return sessionId;
  }
  // Set configuration with expiration
  setApiConfiguration(req, res, config, expirationMinutes = 30) {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    session.snykConfig = {
      ...config,
      expiresAt: Date.now() + expirationMinutes * 60 * 1e3
    };
    return sessionId;
  }
  // Get configuration from session
  getApiConfiguration(req, res) {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    if (!session?.snykConfig) {
      return null;
    }
    if (Date.now() > session.snykConfig.expiresAt) {
      delete session.snykConfig;
      return null;
    }
    const { expiresAt, ...config } = session.snykConfig;
    return {
      config,
      sessionId
    };
  }
  // Get time until expiration
  getTimeUntilExpiration(req, res) {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    if (!session?.snykConfig) {
      return null;
    }
    const remainingMs = session.snykConfig.expiresAt - Date.now();
    return Math.max(0, Math.floor(remainingMs / (60 * 1e3)));
  }
  // Clear configuration
  clearConfiguration(req, res) {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    if (session) {
      delete session.snykConfig;
    }
    res.clearCookie(this.COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/"
    });
    this.sessions.delete(sessionId);
  }
  // Extend configuration expiration
  extendConfiguration(req, res, additionalMinutes = 30) {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    if (!session?.snykConfig || Date.now() > session.snykConfig.expiresAt) {
      return false;
    }
    session.snykConfig.expiresAt = Date.now() + additionalMinutes * 60 * 1e3;
    return true;
  }
  // --- LLM configuration (same session, separate TTL) ---
  setLlmConfiguration(req, res, config, expirationMinutes = 30) {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    session.llmConfig = {
      ...config,
      expiresAt: Date.now() + expirationMinutes * 60 * 1e3
    };
    return sessionId;
  }
  getLlmConfiguration(req, res) {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    if (!session?.llmConfig) return null;
    if (Date.now() > session.llmConfig.expiresAt) {
      delete session.llmConfig;
      return null;
    }
    const { expiresAt, ...rest } = session.llmConfig;
    return { config: rest, sessionId };
  }
  clearLlmConfiguration(req, res) {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    if (session) delete session.llmConfig;
  }
  // Cleanup expired sessions
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }
  }
  // Get debug info
  getDebugInfo() {
    return {
      totalSessions: this.sessions.size,
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        hasConfig: !!session.snykConfig,
        hasLlmConfig: !!session.llmConfig,
        configExpired: session.snykConfig ? Date.now() > session.snykConfig.expiresAt : null,
        createdAt: new Date(session.createdAt),
        lastAccessed: new Date(session.lastAccessed),
        ageMinutes: Math.floor((Date.now() - session.createdAt) / (60 * 1e3))
      }))
    };
  }
};
var cookieSessionStorage = new CookieSessionStorage();

// server/routes.ts
async function registerRoutes(app2) {
  app2.get("/api/config", async (req, res) => {
    try {
      const result = cookieSessionStorage.getApiConfiguration(req, res);
      if (!result) {
        return res.json(null);
      }
      const { config, sessionId } = result;
      const { snykApiToken, ...safeConfig } = config;
      const timeRemaining = cookieSessionStorage.getTimeUntilExpiration(req, res);
      res.json({
        ...safeConfig,
        snykApiToken: "***",
        expiresInMinutes: timeRemaining,
        sessionId
        // Debug info
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/config", async (req, res) => {
    try {
      const { snykApiToken, groupId, orgId } = req.body;
      if (!snykApiToken) {
        return res.status(400).json({ error: "Snyk API token is required" });
      }
      const { apiVersion } = req.body;
      const snykApi = new SnykApiClient(snykApiToken, apiVersion);
      const result = await snykApi.testConnection();
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      const config = {
        snykApiToken,
        groupId,
        orgId,
        apiVersion: apiVersion || "2024-10-15"
      };
      const sessionId = cookieSessionStorage.setApiConfiguration(req, res, config, 30);
      const timeRemaining = cookieSessionStorage.getTimeUntilExpiration(req, res);
      res.json({
        groupId,
        orgId,
        apiVersion: config.apiVersion,
        snykApiToken: "***",
        expiresInMinutes: timeRemaining,
        sessionId
        // Debug info
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/config/clear", async (req, res) => {
    try {
      cookieSessionStorage.clearConfiguration(req, res);
      res.json({ message: "Configuration cleared successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/config/extend", async (req, res) => {
    try {
      const { minutes = 30 } = req.body;
      const success = cookieSessionStorage.extendConfiguration(req, res, minutes);
      if (!success) {
        return res.status(400).json({ error: "No valid configuration to extend" });
      }
      const timeRemaining = cookieSessionStorage.getTimeUntilExpiration(req, res);
      res.json({
        message: "Configuration extended successfully",
        expiresInMinutes: timeRemaining
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/llm-config", async (req, res) => {
    try {
      const result = cookieSessionStorage.getLlmConfiguration(req, res);
      if (!result) return res.json(null);
      const { provider, model } = result.config;
      res.json({ provider, model, configured: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/llm-config", async (req, res) => {
    try {
      const { provider, model, apiKey, baseUrl } = req.body;
      if (!provider || typeof provider !== "string" || !model || typeof model !== "string" || !apiKey || typeof apiKey !== "string") {
        return res.status(400).json({ error: "provider, model, and apiKey are required" });
      }
      cookieSessionStorage.setLlmConfiguration(req, res, {
        provider: provider.trim(),
        model: model.trim(),
        apiKey: apiKey.trim(),
        baseUrl: baseUrl && typeof baseUrl === "string" ? baseUrl.trim() || void 0 : void 0
      }, 30);
      res.json({ provider: provider.trim(), model: model.trim(), configured: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/llm-config/clear", async (req, res) => {
    try {
      cookieSessionStorage.clearLlmConfiguration(req, res);
      res.json({ message: "LLM configuration cleared successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/debug/sessions", async (req, res) => {
    try {
      const debugInfo = cookieSessionStorage.getDebugInfo();
      res.json(debugInfo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/debug/test-cookie", async (req, res) => {
    try {
      console.log(`[DEBUG] === COOKIE TEST ===`);
      console.log(`[DEBUG] User-Agent: ${req.get("User-Agent")?.substring(0, 50)}`);
      console.log(`[DEBUG] Host: ${req.get("Host")}`);
      console.log(`[DEBUG] Existing cookies:`, req.cookies);
      res.cookie("test-cookie", "test-value-" + Date.now(), {
        httpOnly: false,
        // Allow JS access for testing
        secure: false,
        sameSite: "strict",
        maxAge: 30 * 60 * 1e3,
        path: "/"
      });
      const cookieResult = cookieSessionStorage.getApiConfiguration(req, res);
      res.json({
        message: "Cookie test - check your browser dev tools for 'test-cookie' and 'snyk-session-id'",
        sessionResult: cookieResult,
        existingCookies: req.cookies,
        host: req.get("Host"),
        userAgent: req.get("User-Agent")?.substring(0, 100),
        sessionDebug: cookieSessionStorage.getDebugInfo(),
        instructions: {
          step1: "Check browser dev tools > Application > Cookies",
          step2: "Look for 'test-cookie' and 'snyk-session-id' cookies",
          step3: "Try this endpoint in different browsers/incognito",
          step4: "Each should get different session IDs"
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/audit-logs", async (req, res) => {
    try {
      const queryParams = {
        from: req.query.from,
        to: req.query.to,
        events: Array.isArray(req.query.events) ? req.query.events : req.query.events ? [req.query.events] : [],
        excludeEvents: Array.isArray(req.query.excludeEvents) ? req.query.excludeEvents : req.query.excludeEvents ? [req.query.excludeEvents] : [],
        size: req.query.size ? parseInt(req.query.size) : 50,
        cursor: req.query.cursor,
        search: req.query.search
      };
      const filters = auditLogFilterSchema.parse(queryParams);
      console.log(`[SEARCH DEBUG] Received filters:`, JSON.stringify(filters, null, 2));
      const result = cookieSessionStorage.getApiConfiguration(req, res);
      if (!result || !result.config || !result.config.snykApiToken) {
        return res.status(400).json({ error: "Snyk API not configured or session expired" });
      }
      const config = result.config;
      const snykApi = new SnykApiClient(config.snykApiToken, config.apiVersion || "2024-10-15");
      const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toISOString();
      };
      const snykFilters = {
        from: filters.from ? formatDate(filters.from) : void 0,
        to: filters.to ? formatDate(filters.to) : void 0,
        events: filters.events,
        excludeEvents: filters.excludeEvents,
        size: filters.size,
        cursor: filters.cursor,
        search: filters.search
      };
      let snykResponse;
      if (config.orgId) {
        snykResponse = await snykApi.getOrganizationAuditLogs(config.orgId, snykFilters);
      } else if (config.groupId) {
        snykResponse = await snykApi.getGroupAuditLogs(config.groupId, snykFilters);
      } else {
        return res.status(400).json({ error: "No organization or group ID configured" });
      }
      for (const item of snykResponse.items) {
        try {
          await storage.createAuditLog({
            event: item.event,
            created: new Date(item.created),
            orgId: item.orgId || null,
            groupId: item.groupId || null,
            projectId: item.projectId || null,
            content: item.content
          });
        } catch (storageError) {
          console.error("Failed to store audit log:", storageError);
        }
      }
      res.json({
        items: snykResponse.items,
        nextCursor: snykResponse.nextCursor,
        total: snykResponse.total
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/audit-logs/export", async (req, res) => {
    try {
      const { format = "json" } = req.query;
      const filters = auditLogFilterSchema.parse(req.query);
      const result = cookieSessionStorage.getApiConfiguration(req, res);
      if (!result || !result.config || !result.config.snykApiToken) {
        return res.status(400).json({ error: "Snyk API not configured or session expired" });
      }
      const config = result.config;
      const snykApi = new SnykApiClient(config.snykApiToken, config.apiVersion || "2024-10-15");
      const snykFilters = {
        from: filters.from ? new Date(filters.from).toISOString() : void 0,
        to: filters.to ? new Date(filters.to).toISOString() : void 0,
        events: filters.events,
        excludeEvents: filters.excludeEvents,
        size: 1e3,
        // Max export size
        search: filters.search
      };
      let snykResponse;
      if (config.orgId) {
        snykResponse = await snykApi.getOrganizationAuditLogs(config.orgId, snykFilters);
      } else if (config.groupId) {
        snykResponse = await snykApi.getGroupAuditLogs(config.groupId, snykFilters);
      } else {
        return res.status(400).json({ error: "No organization or group ID configured" });
      }
      if (format === "csv") {
        const csvHeaders = "Timestamp,Event,Organization ID,Group ID,Project ID,Content\n";
        const csvRows = snykResponse.items.map(
          (item) => `${item.created},${item.event},${item.orgId || ""},${item.groupId || ""},${item.projectId || ""},"${JSON.stringify(item.content).replace(/"/g, '""')}"`
        ).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="snyk-audit-logs-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.csv"`);
        res.send(csvHeaders + csvRows);
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="snyk-audit-logs-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json"`);
        res.json(snykResponse.items);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/executive-summary", async (req, res) => {
    try {
      const result = cookieSessionStorage.getApiConfiguration(req, res);
      if (!result || !result.config || !result.config.snykApiToken) {
        return res.json({ summary: "No API configuration found or session expired. Please configure your Snyk API settings." });
      }
      const config = result.config;
      const snykApi = new SnykApiClient(config.snykApiToken, config.apiVersion || "2024-10-15");
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
      const snykFilters = {
        from: oneDayAgo.toISOString(),
        to: (/* @__PURE__ */ new Date()).toISOString(),
        size: 500
        // Get more data for better analysis
      };
      let snykResponse;
      if (config.orgId) {
        snykResponse = await snykApi.getOrganizationAuditLogs(config.orgId, snykFilters);
      } else if (config.groupId) {
        snykResponse = await snykApi.getGroupAuditLogs(config.groupId, snykFilters);
      } else {
        return res.json({ summary: "No organization or group ID configured for analysis." });
      }
      if (snykResponse.items.length === 0) {
        return res.json({ summary: "No audit logs found in the last 24 hours for analysis." });
      }
      const auditLogs2 = snykResponse.items.map((item) => ({
        id: item.id || `temp-${Date.now()}-${Math.random()}`,
        event: item.event,
        created: new Date(item.created),
        orgId: item.orgId || null,
        groupId: item.groupId || null,
        projectId: item.projectId || null,
        content: item.content
      }));
      const llmResult = cookieSessionStorage.getLlmConfiguration(req, res);
      const llmConfig = llmResult?.config ?? null;
      const summary = await generateExecutiveSummary(auditLogs2, llmConfig);
      res.json({ summary });
    } catch (error) {
      console.error("Executive summary error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.post("/api/chat", async (req, res) => {
    try {
      const { message, sessionId } = chatMessageSchema.parse(req.body);
      const auditLogs2 = await storage.getAllAuditLogs();
      let session;
      if (sessionId) {
        session = await storage.getChatSession(sessionId);
      }
      if (!session) {
        session = await storage.createChatSession({
          userId: "default",
          messages: []
        });
      }
      const userMessage = {
        role: "user",
        content: message,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      const currentMessages = Array.isArray(session.messages) ? session.messages : [];
      const llmResult = cookieSessionStorage.getLlmConfiguration(req, res);
      const llmConfig = llmResult?.config ?? null;
      const aiResponse = await chatWithAI(message, auditLogs2, currentMessages, llmConfig);
      const assistantMessage = {
        role: "assistant",
        content: aiResponse,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      const updatedMessages = [...currentMessages, userMessage, assistantMessage];
      await storage.updateChatSession(session.id, {
        messages: updatedMessages
      });
      res.json({
        sessionId: session.id,
        response: aiResponse,
        messages: updatedMessages
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/insights", async (req, res) => {
    try {
      const auditLogs2 = await storage.getAllAuditLogs();
      if (auditLogs2.length === 0) {
        return res.json({ insights: [] });
      }
      const llmResult = cookieSessionStorage.getLlmConfiguration(req, res);
      const llmConfig = llmResult?.config ?? null;
      const insights = await analyzeAuditLogs(auditLogs2, llmConfig);
      res.json({ insights });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.disable("x-powered-by");
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use(cookieParser());
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || (process.env.DOCKER === "true" ? "0.0.0.0" : "localhost");
  server.listen(port, host, () => {
    log(`serving on http://${host}:${port}`);
  });
})();

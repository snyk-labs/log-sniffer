import type { LLMConfig } from "./llm/index.js";
import { getProvider } from "./llm/index.js";
import type { AuditLog } from "../../shared/schema.js";

export async function generateExecutiveSummary(
  auditLogs: AuditLog[],
  llmConfig: LLMConfig | null
): Promise<string> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = auditLogs.filter((log) => new Date(log.created) >= oneDayAgo);
    const logSummary = recentLogs.slice(0, 200).map((log) => ({
      event: log.event,
      created: log.created,
      content: log.content,
    }));

    if (recentLogs.length === 0) {
      return "No recent audit logs found in the last 24 hours. Please check if your Snyk organization has recent activity.";
    }

    const eventSummary = logSummary.reduce((acc, log) => {
      acc[log.event] = (acc[log.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const uniqueUsers = new Set(
      logSummary.map((log) => {
        const content = log.content as Record<string, unknown>;
        return (content?.user_email || content?.user_id || "Unknown") as string;
      })
    ).size;

    const topEvents = Object.entries(eventSummary)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([event, count]) => `${event}: ${count}`)
      .join(", ");

    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

    const prompt = `Create a comprehensive executive security summary for Snyk audit events from the last 24 hours.

IMPORTANT: Today's date is ${currentDate}. Use this as the report date and reference timeframe.

Event Data: ${logSummary.length} events, ${uniqueUsers} users
Top Events: ${topEvents}

Generate a detailed executive report with these sections:

## Executive Security Summary

### 🔍 Activity Overview
Provide a thorough assessment of security activity and operational posture over the last 24 hours. Include the current date (${currentDate}) in your analysis.

### 🚨 Critical Events
Analyze the top security events by frequency and potential impact, including specific details about each event type.

### ⚠️ Risk Analysis
Evaluate security concerns, threat patterns, and vulnerability implications from the logged activities.

### 👥 User Activity Insights
Examine user behavior patterns, access trends, and any anomalies in user actions.

### 📋 Recommendations
Provide detailed, prioritized actionable steps for leadership with High/Medium/Low priority levels and business impact analysis.

### 📊 Key Metrics & Trends
Present comprehensive statistics including event frequencies, user engagement, and security posture indicators.

Create a professional, detailed executive-level analysis with complete sections. Use proper Markdown formatting with headers, bullet points, bold text, and comprehensive insights.`;

    const provider = getProvider(llmConfig);
    const text = await provider.generateText([{ role: "user", content: prompt }], {
      maxOutputTokens: 4096,
      temperature: 0.1,
      topP: 0.9,
      topK: 40,
    });
    return text;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Executive summary error:", error);
    return `Summary generation error: ${message}`;
  }
}

export async function analyzeAuditLogs(
  auditLogs: AuditLog[],
  llmConfig: LLMConfig | null
): Promise<string[]> {
  try {
    const logSummary = auditLogs.slice(0, 100).map((log) => ({
      event: log.event,
      created: log.created,
      content: log.content,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI analysis error:", error);
    return [`Analysis error: ${message}`];
  }
}

export async function chatWithAI(
  message: string,
  auditLogs: AuditLog[],
  previousMessages: Array<{ role: string; content: string }>,
  llmConfig: LLMConfig | null
): Promise<string> {
  try {
    const context = auditLogs.slice(0, 50).map((log) => ({
      event: log.event,
      created: log.created,
      content: log.content,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Chat error:", error);
    return `I encountered an error: ${message}. Please try again.`;
  }
}

import { Request, Response } from 'express';
import { randomBytes } from 'crypto';

export interface LlmSessionConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  expiresAt: number;
}

export interface CookieSession {
  id: string;
  snykConfig?: {
    snykApiToken: string;
    groupId?: string;
    orgId?: string;
    apiVersion?: string;
    expiresAt: number;
  };
  llmConfig?: LlmSessionConfig;
  createdAt: number;
  lastAccessed: number;
}

export class CookieSessionStorage {
  private sessions: Map<string, CookieSession> = new Map();
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly COOKIE_NAME = 'snyk-session-id';

  constructor() {
    // Periodic cleanup of expired sessions
    setInterval(() => this.cleanupExpiredSessions(), this.CLEANUP_INTERVAL);
  }

  // Generate a cryptographically secure session ID
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(16).toString('hex');
    return `${timestamp}-${random}`;
  }

  // Get session ID from cookie or create new one
  private getOrCreateSessionId(req: Request, res: Response): string {
    // Try to get session ID from cookie
    let sessionId = req.cookies?.[this.COOKIE_NAME];
    
    // Validate existing session
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      
      // Check if session is expired
      if (Date.now() - session.lastAccessed > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        sessionId = undefined;
      } else {
        // Update last accessed time
        session.lastAccessed = Date.now();
        return sessionId;
      }
    }

    // Create new session ID
    sessionId = this.generateSessionId();
    
    // Create session record
    const session: CookieSession = {
      id: sessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };

    this.sessions.set(sessionId, session);
    
    // Set secure cookie
    const cookieOptions = {
      httpOnly: true, // Prevent XSS
      secure: false, // Disable secure flag for local HTTP development
      sameSite: 'strict' as const, // Use strict for better isolation in local dev
      maxAge: this.SESSION_TIMEOUT, // 30 minutes
      path: '/', // Available for all paths
      domain: undefined // Let browser determine domain
    };
    
    res.cookie(this.COOKIE_NAME, sessionId, cookieOptions);
    return sessionId;
  }

  // Set configuration with expiration
  setApiConfiguration(
    req: Request,
    res: Response,
    config: {
      snykApiToken: string;
      groupId?: string;
      orgId?: string;
      apiVersion?: string;
    },
    expirationMinutes: number = 30
  ): string {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId)!;
    
    session.snykConfig = {
      ...config,
      expiresAt: Date.now() + (expirationMinutes * 60 * 1000)
    };

    return sessionId;
  }

  // Get configuration from session
  getApiConfiguration(req: Request, res: Response): {
    config: any;
    sessionId: string;
  } | null {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    
    if (!session?.snykConfig) {
      return null;
    }

    // Check if config is expired
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
  getTimeUntilExpiration(req: Request, res: Response): number | null {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    
    if (!session?.snykConfig) {
      return null;
    }

    const remainingMs = session.snykConfig.expiresAt - Date.now();
    return Math.max(0, Math.floor(remainingMs / (60 * 1000)));
  }

  // Clear configuration
  clearConfiguration(req: Request, res: Response): void {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    
    if (session) {
      delete session.snykConfig;
    }
    
    // Also clear the cookie
    res.clearCookie(this.COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    // Remove session entirely
    this.sessions.delete(sessionId);
  }

  // Extend configuration expiration
  extendConfiguration(req: Request, res: Response, additionalMinutes: number = 30): boolean {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    
    if (!session?.snykConfig || Date.now() > session.snykConfig.expiresAt) {
      return false;
    }

    session.snykConfig.expiresAt = Date.now() + (additionalMinutes * 60 * 1000);
    return true;
  }

  // --- LLM configuration (same session, separate TTL) ---

  setLlmConfiguration(
    req: Request,
    res: Response,
    config: { provider: string; model: string; apiKey: string; baseUrl?: string },
    expirationMinutes: number = 30
  ): string {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId)!;
    session.llmConfig = {
      ...config,
      expiresAt: Date.now() + (expirationMinutes * 60 * 1000),
    };
    return sessionId;
  }

  getLlmConfiguration(req: Request, res: Response): { config: Omit<LlmSessionConfig, 'apiKey' | 'expiresAt'> & { apiKey: string }; sessionId: string } | null {
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

  clearLlmConfiguration(req: Request, res: Response): void {
    const sessionId = this.getOrCreateSessionId(req, res);
    const session = this.sessions.get(sessionId);
    if (session) delete session.llmConfig;
  }

  // Cleanup expired sessions
  private cleanupExpiredSessions(): void {
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
  getDebugInfo(): any {
    return {
      totalSessions: this.sessions.size,
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        hasConfig: !!session.snykConfig,
        hasLlmConfig: !!session.llmConfig,
        configExpired: session.snykConfig ? Date.now() > session.snykConfig.expiresAt : null,
        createdAt: new Date(session.createdAt),
        lastAccessed: new Date(session.lastAccessed),
        ageMinutes: Math.floor((Date.now() - session.createdAt) / (60 * 1000))
      }))
    };
  }
}

// Global instance
export const cookieSessionStorage = new CookieSessionStorage();

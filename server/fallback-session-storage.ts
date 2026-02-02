import { Request, Response } from 'express';
import { randomBytes } from 'crypto';

export interface FallbackSession {
  id: string;
  snykConfig?: {
    snykApiToken: string;
    groupId?: string;
    orgId?: string;
    apiVersion?: string;
    expiresAt: number;
  };
  createdAt: number;
  lastAccessed: number;
  fingerprint: string;
}

export class FallbackSessionStorage {
  private sessions: Map<string, FallbackSession> = new Map();
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Periodic cleanup of expired sessions
    setInterval(() => this.cleanupExpiredSessions(), this.CLEANUP_INTERVAL);
    console.log('[FALLBACK SESSION] Initialized - uses in-memory storage with request fingerprinting');
  }

  // Create a unique fingerprint for each request context
  private createRequestFingerprint(req: Request): string {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    const referer = req.get('Referer') || '';
    
    // Create a stable but unique fingerprint
    const fingerprint = Buffer.from(`${userAgent}:${acceptLanguage}:${acceptEncoding}:${ip}:${referer}`)
      .toString('base64')
      .replace(/[+/=]/g, '')
      .substring(0, 16);
    
    console.log(`[FALLBACK SESSION] Created fingerprint: ${fingerprint}`);
    console.log(`[FALLBACK SESSION] Based on UA: ${userAgent.substring(0, 50)}...`);
    return fingerprint;
  }

  // Get or create session for this request
  private getOrCreateSession(req: Request): FallbackSession {
    const fingerprint = this.createRequestFingerprint(req);
    
    // Try to find existing session by fingerprint
    let existingSession: FallbackSession | undefined;
    for (const session of this.sessions.values()) {
      if (session.fingerprint === fingerprint) {
        // Check if not expired
        if (Date.now() - session.lastAccessed <= this.SESSION_TIMEOUT) {
          existingSession = session;
          break;
        } else {
          // Remove expired session
          this.sessions.delete(session.id);
          console.log(`[FALLBACK SESSION] Removed expired session: ${session.id}`);
        }
      }
    }

    if (existingSession) {
      existingSession.lastAccessed = Date.now();
      console.log(`[FALLBACK SESSION] Using existing session: ${existingSession.id}`);
      return existingSession;
    }

    // Create new session
    const sessionId = `fallback-${fingerprint}-${randomBytes(8).toString('hex')}`;
    const session: FallbackSession = {
      id: sessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      fingerprint
    };

    this.sessions.set(sessionId, session);
    console.log(`[FALLBACK SESSION] Created new session: ${sessionId}`);
    
    return session;
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
    const session = this.getOrCreateSession(req);
    
    session.snykConfig = {
      ...config,
      expiresAt: Date.now() + (expirationMinutes * 60 * 1000)
    };

    // Also send session ID in response header for debugging
    res.set('X-Fallback-Session-ID', session.id);

    console.log(`[FALLBACK SESSION] Stored config in session: ${session.id}`);
    return session.id;
  }

  // Get configuration from session
  getApiConfiguration(req: Request, res: Response): {
    config: any;
    sessionId: string;
  } | null {
    const session = this.getOrCreateSession(req);
    
    // Send session ID in response header for debugging
    res.set('X-Fallback-Session-ID', session.id);
    
    if (!session.snykConfig) {
      console.log(`[FALLBACK SESSION] No config found in session: ${session.id}`);
      return null;
    }

    // Check if config is expired
    if (Date.now() > session.snykConfig.expiresAt) {
      console.log(`[FALLBACK SESSION] Config expired in session: ${session.id}`);
      delete session.snykConfig;
      return null;
    }

    const { expiresAt, ...config } = session.snykConfig;
    console.log(`[FALLBACK SESSION] Retrieved config from session: ${session.id}`);
    
    return {
      config,
      sessionId: session.id
    };
  }

  // Get time until expiration
  getTimeUntilExpiration(req: Request, res: Response): number | null {
    const session = this.getOrCreateSession(req);
    
    if (!session.snykConfig) {
      return null;
    }

    const remainingMs = session.snykConfig.expiresAt - Date.now();
    return Math.max(0, Math.floor(remainingMs / (60 * 1000)));
  }

  // Clear configuration
  clearConfiguration(req: Request, res: Response): void {
    const session = this.getOrCreateSession(req);
    delete session.snykConfig;
    console.log(`[FALLBACK SESSION] Cleared config from session: ${session.id}`);
  }

  // Extend configuration expiration
  extendConfiguration(req: Request, res: Response, additionalMinutes: number = 30): boolean {
    const session = this.getOrCreateSession(req);
    
    if (!session.snykConfig || Date.now() > session.snykConfig.expiresAt) {
      return false;
    }

    session.snykConfig.expiresAt = Date.now() + (additionalMinutes * 60 * 1000);
    console.log(`[FALLBACK SESSION] Extended config in session: ${session.id}`);
    return true;
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

    if (cleanedCount > 0) {
      console.log(`[FALLBACK SESSION] Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  // Get debug info
  getDebugInfo(): any {
    return {
      totalSessions: this.sessions.size,
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        id,
        hasConfig: !!session.snykConfig,
        configExpired: session.snykConfig ? Date.now() > session.snykConfig.expiresAt : null,
        createdAt: new Date(session.createdAt),
        lastAccessed: new Date(session.lastAccessed),
        fingerprint: session.fingerprint,
        ageMinutes: Math.floor((Date.now() - session.createdAt) / (60 * 1000))
      }))
    };
  }
}

// Global instance
export const fallbackSessionStorage = new FallbackSessionStorage();

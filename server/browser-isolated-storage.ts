import { Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';

export interface BrowserSession {
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
  userAgent: string;
  fingerprint: string;
}

export class BrowserIsolatedStorage {
  private sessions: Map<string, BrowserSession> = new Map();
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Periodic cleanup of expired sessions
    setInterval(() => this.cleanupExpiredSessions(), this.CLEANUP_INTERVAL);
    console.log('[BROWSER STORAGE] Initialized with periodic cleanup');
  }

  // Create a unique fingerprint for each browser context
  private createBrowserFingerprint(req: Request): string {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const connection = req.get('Connection') || '';
    const ip = req.ip || req.connection.remoteAddress || '';
    
    // Include a timestamp component to ensure uniqueness for each browser session
    const timestamp = Date.now().toString();
    const random = randomBytes(8).toString('hex');
    
    const fingerprint = createHash('sha256')
      .update(`${userAgent}:${acceptLanguage}:${acceptEncoding}:${connection}:${ip}:${timestamp}:${random}`)
      .digest('hex')
      .substring(0, 16);
    
    console.log(`[BROWSER STORAGE] Created fingerprint: ${fingerprint} for ${userAgent.substring(0, 50)}`);
    return fingerprint;
  }

  // Get or create a session for this browser context
  private getOrCreateSession(req: Request): BrowserSession {
    // Try to get session ID from custom header first (for subsequent requests)
    let sessionId = req.get('X-Browser-Session-ID');
    
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)!;
      
      // Check if session is expired
      if (Date.now() - session.lastAccessed > this.SESSION_TIMEOUT) {
        console.log(`[BROWSER STORAGE] Session ${sessionId} expired, creating new one`);
        this.sessions.delete(sessionId);
        sessionId = undefined;
      } else {
        // Update last accessed time
        session.lastAccessed = Date.now();
        console.log(`[BROWSER STORAGE] Using existing session: ${sessionId}`);
        return session;
      }
    }

    // Create new session
    const fingerprint = this.createBrowserFingerprint(req);
    sessionId = `${fingerprint}-${randomBytes(8).toString('hex')}`;
    
    const session: BrowserSession = {
      id: sessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      userAgent: req.get('User-Agent') || '',
      fingerprint
    };

    this.sessions.set(sessionId, session);
    console.log(`[BROWSER STORAGE] Created new session: ${sessionId}`);
    
    return session;
  }

  // Set configuration with expiration
  setApiConfiguration(
    req: Request,
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

    console.log(`[BROWSER STORAGE] Stored config in session: ${session.id}`);
    return session.id;
  }

  // Get configuration from session
  getApiConfiguration(req: Request): {
    config: any;
    sessionId: string;
  } | null {
    const session = this.getOrCreateSession(req);
    
    if (!session.snykConfig) {
      console.log(`[BROWSER STORAGE] No config found in session: ${session.id}`);
      return null;
    }

    // Check if config is expired
    if (Date.now() > session.snykConfig.expiresAt) {
      console.log(`[BROWSER STORAGE] Config expired in session: ${session.id}`);
      delete session.snykConfig;
      return null;
    }

    const { expiresAt, ...config } = session.snykConfig;
    console.log(`[BROWSER STORAGE] Retrieved config from session: ${session.id}`);
    
    return {
      config,
      sessionId: session.id
    };
  }

  // Get time until expiration
  getTimeUntilExpiration(req: Request): number | null {
    const session = this.getOrCreateSession(req);
    
    if (!session.snykConfig) {
      return null;
    }

    const remainingMs = session.snykConfig.expiresAt - Date.now();
    return Math.max(0, Math.floor(remainingMs / (60 * 1000)));
  }

  // Clear configuration
  clearConfiguration(req: Request): void {
    const session = this.getOrCreateSession(req);
    delete session.snykConfig;
    console.log(`[BROWSER STORAGE] Cleared config from session: ${session.id}`);
  }

  // Extend configuration expiration
  extendConfiguration(req: Request, additionalMinutes: number = 30): boolean {
    const session = this.getOrCreateSession(req);
    
    if (!session.snykConfig || Date.now() > session.snykConfig.expiresAt) {
      return false;
    }

    session.snykConfig.expiresAt = Date.now() + (additionalMinutes * 60 * 1000);
    console.log(`[BROWSER STORAGE] Extended config in session: ${session.id}`);
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
      console.log(`[BROWSER STORAGE] Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  // Middleware to add session ID to response headers
  sessionMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      const session = this.getOrCreateSession(req);
      
      // Add session ID to response headers for client to include in future requests
      res.set('X-Browser-Session-ID', session.id);
      
      next();
    };
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
        userAgent: session.userAgent.substring(0, 50)
      }))
    };
  }
}

// Global instance
export const browserStorage = new BrowserIsolatedStorage();

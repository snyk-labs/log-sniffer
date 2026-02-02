import session from 'express-session';
import { randomBytes } from 'crypto';

// Extend session data interface
declare module 'express-session' {
  interface SessionData {
    snykConfig?: {
      snykApiToken: string;
      groupId?: string;
      orgId?: string;
      apiVersion?: string;
      expiresAt: number; // Unix timestamp
    };
  }
}

// Custom memory store that ensures proper isolation
class IsolatedMemoryStore extends session.MemoryStore {
  private sessions: Map<string, any> = new Map();

  constructor() {
    super();
    console.log('[SESSION DEBUG] Created IsolatedMemoryStore');
  }

  get(sessionID: string, callback: (err: any, session?: any) => void): void {
    console.log(`[SESSION DEBUG] Getting session: ${sessionID}`);
    const session = this.sessions.get(sessionID);
    console.log(`[SESSION DEBUG] Found session data:`, !!session);
    setImmediate(() => callback(null, session));
  }

  set(sessionID: string, session: any, callback?: (err?: any) => void): void {
    console.log(`[SESSION DEBUG] Setting session: ${sessionID}`);
    this.sessions.set(sessionID, session);
    if (callback) setImmediate(callback);
  }

  destroy(sessionID: string, callback?: (err?: any) => void): void {
    console.log(`[SESSION DEBUG] Destroying session: ${sessionID}`);
    this.sessions.delete(sessionID);
    if (callback) setImmediate(callback);
  }

  clear(callback?: (err?: any) => void): void {
    console.log('[SESSION DEBUG] Clearing all sessions');
    this.sessions.clear();
    if (callback) setImmediate(callback);
  }

  length(callback: (err: any, length?: number) => void): void {
    setImmediate(() => callback(null, this.sessions.size));
  }

  all(callback: (err: any, obj?: any) => void): void {
    const sessions = Object.fromEntries(this.sessions);
    setImmediate(() => callback(null, sessions));
  }
}

// Session configuration with security best practices
export const sessionConfig = session({
  secret: process.env.SESSION_SECRET || randomBytes(32).toString('hex'),
  name: 'snyk.session', // Custom session name for security
  resave: false,
  saveUninitialized: true, // Changed to true to force session creation
  rolling: true, // Reset expiration on each request
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 30 * 60 * 1000, // 30 minutes default
    sameSite: 'strict', // CSRF protection
    // Force new cookie for each browser context
    domain: undefined, // Don't set domain to prevent sharing
    path: '/' // Explicit path
  },
  // Use our custom isolated memory store
  store: new IsolatedMemoryStore(),
  // Force new session ID generation with timestamp
  genid: () => {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(12).toString('hex');
    const id = `${timestamp}-${random}`;
    console.log(`[SESSION DEBUG] Generated new session ID: ${id}`);
    return id;
  }
});

// Configuration expiration times (in minutes)
export const EXPIRATION_TIMES = {
  SHORT: 15,    // 15 minutes for sensitive operations
  MEDIUM: 30,   // 30 minutes for regular use  
  LONG: 60      // 1 hour maximum
} as const;

// Helper function to check if config is expired
export function isConfigExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

// Helper function to create expiration timestamp
export function createExpiration(minutes: number): number {
  return Date.now() + (minutes * 60 * 1000);
}

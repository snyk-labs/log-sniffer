import { Request, Response } from 'express';
import { EXPIRATION_TIMES, createExpiration, isConfigExpired } from './session-config.js';

// Re-export for easier imports
export { EXPIRATION_TIMES };

export interface SessionApiConfiguration {
  snykApiToken: string;
  groupId?: string;
  orgId?: string;
  apiVersion?: string;
}

export interface SessionStorageConfig extends SessionApiConfiguration {
  expiresAt: number;
}

export class SessionBasedStorage {
  
  // Store API configuration in session with expiration
  static setApiConfiguration(
    req: Request, 
    config: SessionApiConfiguration, 
    expirationMinutes: number = EXPIRATION_TIMES.MEDIUM
  ): void {
    console.log(`[SESSION DEBUG] Setting config for session ID: ${req.sessionID}`);
    req.session.snykConfig = {
      ...config,
      expiresAt: createExpiration(expirationMinutes)
    };
    console.log(`[SESSION DEBUG] Config stored in session: ${req.sessionID}`);
  }

  // Get API configuration from session (returns null if expired)
  static getApiConfiguration(req: Request): SessionApiConfiguration | null {
    console.log(`[SESSION DEBUG] Getting config for session ID: ${req.sessionID}`);
    const config = req.session.snykConfig;
    
    if (!config) {
      console.log(`[SESSION DEBUG] No config found for session: ${req.sessionID}`);
      return null;
    }

    // Check if configuration has expired
    if (isConfigExpired(config.expiresAt)) {
      // Auto-cleanup expired config
      delete req.session.snykConfig;
      return null;
    }

    // Return config without expiration timestamp
    const { expiresAt, ...apiConfig } = config;
    return apiConfig;
  }

  // Check if configuration exists and is valid
  static hasValidConfiguration(req: Request): boolean {
    return this.getApiConfiguration(req) !== null;
  }

  // Get remaining time until expiration (in minutes)
  static getTimeUntilExpiration(req: Request): number | null {
    const config = req.session.snykConfig;
    
    if (!config) {
      return null;
    }

    const remainingMs = config.expiresAt - Date.now();
    return Math.max(0, Math.floor(remainingMs / (60 * 1000)));
  }

  // Extend configuration expiration time
  static extendConfiguration(
    req: Request, 
    additionalMinutes: number = EXPIRATION_TIMES.MEDIUM
  ): boolean {
    const config = req.session.snykConfig;
    
    if (!config || isConfigExpired(config.expiresAt)) {
      return false;
    }

    config.expiresAt = createExpiration(additionalMinutes);
    return true;
  }

  // Clear configuration from session
  static clearConfiguration(req: Request): void {
    delete req.session.snykConfig;
  }

  // Middleware to automatically clear expired configurations
  static cleanupMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      const config = req.session.snykConfig;
      
      if (config && isConfigExpired(config.expiresAt)) {
        delete req.session.snykConfig;
        console.log('Automatically cleared expired API configuration from session');
      }
      
      next();
    };
  }
}

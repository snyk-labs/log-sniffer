# Security Improvements: Session-Based Configuration Storage

## Overview

The application has been updated to use **session-based storage** instead of persistent database storage for sensitive API credentials. This significantly improves security by ensuring that API tokens and other sensitive configuration data are:

1. **Temporarily stored** in secure HTTP-only cookies
2. **Automatically expired** after a configurable time period
3. **Unique per browser session** instead of shared globally
4. **Cleared when the browser session ends**

## Key Security Features

### 1. Cookie-Based Session Storage
- API tokens, group IDs, and org IDs are stored in server-side memory with secure HTTP-only cookies for session identification
- No persistent storage of sensitive credentials in the database
- Each browser/user has their own isolated configuration via unique session cookies

### 2. Automatic Expiration
- **Default expiration**: 30 minutes
- **Available options**: 15 minutes (short), 30 minutes (medium), 60 minutes (long)
- Automatic cleanup of expired configurations
- Rolling expiration (resets on each request)

### 3. Secure Cookie Configuration
```typescript
const cookieOptions = {
  httpOnly: true, // Prevent XSS attacks
  secure: false, // Set to true for HTTPS in production
  sameSite: 'strict' as const, // CSRF protection
  maxAge: 30 * 60 * 1000, // 30 minutes
  path: '/', // Available for all paths
  domain: undefined // Let browser determine domain
};
```

### 4. New API Endpoints

#### GET `/api/config`
- Returns current configuration (without API token)
- Includes `expiresInMinutes` field showing remaining time

#### POST `/api/config/clear`
- Immediately clears all configuration from the session
- Useful for explicit logout

#### POST `/api/config/extend`
- Extends the current session expiration
- Body: `{ "minutes": 30 }` (optional, defaults to 30)

## Environment Variables

The current implementation uses `cookieSessionStorage` and doesn't require additional environment variables. The system generates cryptographically secure session IDs automatically.

**For Docker deployment:**
```bash
# Tells the server to bind to 0.0.0.0 for external access
DOCKER=true
```

**Optional (if using alternative session systems):**
```bash
# Only needed if switching to express-session middleware
SESSION_SECRET=your_session_secret_here_32_chars_minimum
```

## Frontend Changes

### Configuration Panel Updates
- Shows remaining session time: "✓ Configured (expires in 25m)"
- Added "Clear" button to immediately clear configuration
- Session expiration warnings

### Automatic Cleanup
- Expired configurations are automatically detected and cleared
- Users see appropriate "session expired" messages
- Graceful handling of expired sessions during API calls

## Usage Examples

### Setting Configuration with Custom Expiration
```typescript
// 15-minute expiration for sensitive environments
cookieSessionStorage.setApiConfiguration(req, res, config, 15);

// Default 30-minute expiration
cookieSessionStorage.setApiConfiguration(req, res, config);

// 1-hour expiration for development
cookieSessionStorage.setApiConfiguration(req, res, config, 60);
```

### Checking Session Status
```typescript
const result = cookieSessionStorage.getApiConfiguration(req, res);
if (!result) {
  // Session expired or not configured
  return res.status(400).json({ error: "Session expired, please reconfigure" });
}

const { config, sessionId } = result;
const timeLeft = cookieSessionStorage.getTimeUntilExpiration(req, res);
console.log(`Configuration expires in ${timeLeft} minutes`);
```

## Migration Notes

### Breaking Changes
- Configuration is no longer persistent across server restarts
- Users need to reconfigure after browser sessions end
- Old persistent configurations in the database are ignored

### Benefits
- Significantly reduced attack surface
- No sensitive data in database logs or backups
- Per-user isolation prevents cross-contamination
- Compliance with security best practices for handling API tokens

## Security Best Practices Implemented

1. **No Persistent Token Storage**: API tokens stored only in server memory, never in database
2. **Session Isolation**: Each browser gets unique session ID via secure cookies
3. **Automatic Expiration**: 30-minute default expiration with automatic cleanup
4. **Secure Cookies**: HTTP-only, SameSite=strict protection against XSS/CSRF
5. **Memory-Based Storage**: Session data stored in server memory with automatic cleanup
6. **Cryptographic Session IDs**: Secure random session ID generation
7. **Explicit Cleanup**: Manual clear functionality and automatic expired session removal

## Recommendations

1. **Use HTTPS in Production**: Set `secure: true` in cookie options for HTTPS environments
2. **Docker Deployment**: Set `DOCKER=true` environment variable for container deployments
3. **Monitor Sessions**: Use `/api/debug/sessions` endpoint for session monitoring
4. **Educate Users**: Inform users about 30-minute session expiration
5. **Cleanup Strategy**: Server automatically cleans expired sessions every 5 minutes
6. **Session Security**: Sessions use cryptographically secure random IDs (32 bytes)

This approach follows security principles of **least privilege**, **defense in depth**, and **time-limited access** to significantly reduce the risk associated with API token storage.

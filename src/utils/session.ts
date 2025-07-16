// Shared session storage for OAuth authentication
// Modified for Vercel serverless compatibility - uses environment storage

interface SessionData {
  access_token: string;
  username: string;
  expires_at: number;
  created_at: number;
  ip_address?: string;
  user_agent?: string;
}

// Use process.env for serverless-compatible storage
// Note: This is a workaround for Vercel serverless function isolation
// In production, consider using Redis or Vercel KV
const SESSION_PREFIX = 'TEMP_SESSION_';

// Helper to get session from environment
function getSessionFromEnv(sessionId: string): SessionData | null {
  try {
    const envKey = `${SESSION_PREFIX}${sessionId}`;
    const sessionData = process.env[envKey];
    if (!sessionData) return null;
    
    const parsed = JSON.parse(sessionData);
    
    // Check if expired
    if (Date.now() > parsed.expires_at) {
      delete process.env[envKey];
      return null;
    }
    
    return parsed;
  } catch (error) {
    console.error(`[SESSION-ERROR] Failed to parse session ${sessionId}:`, error);
    return null;
  }
}

// Helper to store session in environment
function setSessionToEnv(sessionId: string, sessionData: SessionData): void {
  try {
    const envKey = `${SESSION_PREFIX}${sessionId}`;
    process.env[envKey] = JSON.stringify(sessionData);
    
    console.log(`[SESSION-DEBUG] Session stored in env: ${sessionId}`);
  } catch (error) {
    console.error(`[SESSION-ERROR] Failed to store session ${sessionId}:`, error);
  }
}

// Clean up expired sessions from environment
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  const envKeys = Object.keys(process.env);
  
  for (const key of envKeys) {
    if (key.startsWith(SESSION_PREFIX)) {
      try {
        const sessionData = JSON.parse(process.env[key] || '{}');
        if (now > sessionData.expires_at) {
          delete process.env[key];
          console.log(`[SESSION-DEBUG] Cleaned up expired session: ${key}`);
        }
      } catch (error) {
        // Invalid session data, remove it
        delete process.env[key];
      }
    }
  }
}

// Generate session ID
export function generateSessionId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Date.now().toString(36)
  );
}

// Create new session
export function createSession(
  access_token: string,
  username: string,
  expiresInMs: number = 30 * 60 * 1000, // 30 minutes default
  metadata?: { ip_address?: string; user_agent?: string }
): string {
  cleanupExpiredSessions();
  
  const sessionId = generateSessionId();
  const now = Date.now();
  
  const sessionData: SessionData = {
    access_token,
    username,
    expires_at: now + expiresInMs,
    created_at: now,
    ip_address: metadata?.ip_address,
    user_agent: metadata?.user_agent,
  };
  
  setSessionToEnv(sessionId, sessionData);
  
  return sessionId;
}

// Create session with specified ID (for OAuth callback compatibility)
export function createSessionWithId(
  sessionId: string,
  access_token: string,
  username: string,
  expiresInMs: number = 30 * 60 * 1000, // 30 minutes default
  metadata?: { ip_address?: string; user_agent?: string }
): boolean {
  cleanupExpiredSessions();
  
  // Check if session ID already exists
  if (getSessionFromEnv(sessionId)) {
    console.log(`[SESSION-DEBUG] Session ID already exists: ${sessionId}`);
    return false;
  }
  
  const now = Date.now();
  
  const sessionData: SessionData = {
    access_token,
    username,
    expires_at: now + expiresInMs,
    created_at: now,
    ip_address: metadata?.ip_address,
    user_agent: metadata?.user_agent,
  };
  
  setSessionToEnv(sessionId, sessionData);
  
  console.log(`[SESSION-DEBUG] Session created with ID: ${sessionId}, expires: ${new Date(sessionData.expires_at).toISOString()}`);
  
  return true;
}

// Get session by ID
export function getSession(sessionId: string): SessionData | null {
  cleanupExpiredSessions();
  return getSessionFromEnv(sessionId);
}

// Validate session and return session data
export function validateSession(sessionId: string): SessionData | null {
  const session = getSessionFromEnv(sessionId);
  
  console.log(`[SESSION-DEBUG] Validating session ${sessionId}:`, {
    found: !!session,
    expires_at: session?.expires_at,
    username: session?.username,
    currentTime: Date.now(),
    isExpired: session ? Date.now() > session.expires_at : 'N/A'
  });
  
  return session;
}

// Update existing session (for OAuth completion)
export function updateSession(
  sessionId: string,
  access_token: string,
  username: string,
  expiresInMs?: number
): boolean {
  const existingSession = getSessionFromEnv(sessionId);
  if (!existingSession) {
    console.log(`[SESSION-DEBUG] Cannot update non-existent session: ${sessionId}`);
    return false;
  }

  // Update session data
  const now = Date.now();
  const updatedSession: SessionData = {
    ...existingSession,
    access_token,
    username,
    expires_at: expiresInMs ? now + expiresInMs : existingSession.expires_at,
  };

  setSessionToEnv(sessionId, updatedSession);
  
  console.log(`[SESSION-DEBUG] Session updated: ${sessionId}, new username: ${username}`);
  
  return true;
}

// Delete session
export function deleteSession(sessionId: string): boolean {
  const envKey = `${SESSION_PREFIX}${sessionId}`;
  if (process.env[envKey]) {
    delete process.env[envKey];
    console.log(`[SESSION-DEBUG] Session deleted: ${sessionId}`);
    return true;
  }
  return false;
}

// Get all active sessions (for debugging)
export function getAllSessions(): Map<string, SessionData> {
  cleanupExpiredSessions();
  
  const sessions = new Map<string, SessionData>();
  const envKeys = Object.keys(process.env);
  
  for (const key of envKeys) {
    if (key.startsWith(SESSION_PREFIX)) {
      try {
        const sessionId = key.replace(SESSION_PREFIX, '');
        const sessionData = JSON.parse(process.env[key] || '{}');
        sessions.set(sessionId, sessionData);
      } catch (error) {
        // Skip invalid session data
      }
    }
  }
  
  return sessions;
}

// Get session count (for monitoring)
export function getSessionCount(): number {
  cleanupExpiredSessions();
  
  const envKeys = Object.keys(process.env);
  let count = 0;
  
  for (const key of envKeys) {
    if (key.startsWith(SESSION_PREFIX)) {
      count++;
    }
  }
  
  console.log(`[SESSION-DEBUG] Current session count: ${count}`);
  
  return count;
} 
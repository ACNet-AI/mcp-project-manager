// Shared session storage for OAuth authentication
// This ensures session data is accessible across all API endpoints

interface SessionData {
  access_token: string;
  username: string;
  expires_at: number;
  created_at: number;
  ip_address?: string;
  user_agent?: string;
}

// In-memory session storage (consider using Redis for production)
const sessions = new Map<string, SessionData>();

// Clean up expired sessions
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expires_at) {
      sessions.delete(sessionId);
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
  expiresInMs: number = 30 * 60 * 1000, // 30 minutes default (OAuth security best practice)
  metadata?: { ip_address?: string; user_agent?: string }
): string {
  cleanupExpiredSessions();
  
  const sessionId = generateSessionId();
  const now = Date.now();
  
  sessions.set(sessionId, {
    access_token,
    username,
    expires_at: now + expiresInMs,
    created_at: now,
    ip_address: metadata?.ip_address,
    user_agent: metadata?.user_agent,
  });
  
  return sessionId;
}

// Create session with specified ID (for OAuth callback compatibility)
export function createSessionWithId(
  sessionId: string,
  access_token: string,
  username: string,
  expiresInMs: number = 30 * 60 * 1000, // 30 minutes default (OAuth security best practice)
  metadata?: { ip_address?: string; user_agent?: string }
): boolean {
  cleanupExpiredSessions();
  
  // Check if session ID already exists
  if (sessions.has(sessionId)) {
    return false;
  }
  
  const now = Date.now();
  
  sessions.set(sessionId, {
    access_token,
    username,
    expires_at: now + expiresInMs,
    created_at: now,
    ip_address: metadata?.ip_address,
    user_agent: metadata?.user_agent,
  });
  
  return true;
}

// Get session by ID
export function getSession(sessionId: string): SessionData | null {
  cleanupExpiredSessions();
  
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  
  // Check if session is expired
  if (Date.now() > session.expires_at) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

// Validate session and return session data
export function validateSession(sessionId: string): SessionData | null {
  return getSession(sessionId);
}

// Delete session
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

// Get all active sessions (for debugging)
export function getAllSessions(): Map<string, SessionData> {
  cleanupExpiredSessions();
  return new Map(sessions);
}

// Get session count (for monitoring)
export function getSessionCount(): number {
  cleanupExpiredSessions();
  return sessions.size;
} 
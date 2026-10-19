/**
 * Explicit client storage interface with built-in security constraints.
 * 
 * SECURITY POLICY:
 * 1. JWT tokens MUST NEVER be stored in localStorage or sessionStorage.
 *    Authentication relies strictly on HTTP-Only Secure cookies handled by the browser.
 * 2. Biometric images (camera frames, face embeddings) MUST NEVER be stored in persistent browser storage.
 * 3. Only non-sensitive preferences (e.g. theme, onboarding dismissals) are permitted here.
 */

const BLOCKED_KEYS = ['token', 'jwt', 'auth', 'access_token', 'refresh_token', 'face', 'embedding', 'image', 'photo', 'camera'];

function assertSafeKey(key: string): void {
  const lower = key.toLowerCase();
  for (const blocked of BLOCKED_KEYS) {
    if (lower.includes(blocked)) {
      throw new Error(
        `[SECURITY VIOLATION] Storing sensitive credential or biometric data in browser storage is strictly forbidden: "${key}"`
      );
    }
  }
}

export const safeClientStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      assertSafeKey(key);
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    assertSafeKey(key);
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn('Storage setItem failed:', e);
    }
  },

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};

const STORAGE_KEY = 'tabungan_auth_token';
const EXPIRY_MS = 5 * 60 * 1000;

interface AuthToken {
  role: 'admin' | 'student';
  issuedAt: number;
}

export function setAuthToken(role: 'admin' | 'student'): void {
  const token: AuthToken = { role, issuedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
}

export function getAuthToken(): AuthToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const token: AuthToken = JSON.parse(raw);
    if (Date.now() - token.issuedAt > EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearAuthToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isTokenValid(): boolean {
  return getAuthToken() !== null;
}

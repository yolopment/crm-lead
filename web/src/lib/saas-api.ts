const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

export interface SaasAdminProfile {
  id: string;
  email: string;
  name: string;
  saasRole: string;
  lastLoginAt?: string;
}

export function getSaasToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('saas_token');
}

export function setSaasToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('saas_token', token);
}

export function clearSaasToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('saas_token');
}

export function getSaasAdmin(): SaasAdminProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('saas_admin');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setSaasAdmin(admin: SaasAdminProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('saas_admin', JSON.stringify(admin));
}

export function clearSaasAdmin(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('saas_admin');
}

export async function fetchSaasApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSaasToken();

  // Normalize path to ensure it hits the superadmin router properly
  let endpoint = path;
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    if (!endpoint.startsWith('/')) {
      endpoint = `/${endpoint}`;
    }
    // Prepend /superadmin if not already present
    if (!endpoint.startsWith('/superadmin')) {
      endpoint = `/superadmin${endpoint}`;
    }
    endpoint = `${API_BASE}${endpoint}`;
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearSaasToken();
    clearSaasAdmin();
    const errorData = await res.json().catch(() => ({}));
    if (!endpoint.includes('/login') && typeof window !== 'undefined' && !window.location.pathname.startsWith('/superadmin/login')) {
      window.location.href = '/superadmin/login';
    }
    throw new Error(errorData.error || 'Session expired or unauthorized. Please log in again.');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }

  return null as T;
}

export { API_BASE };

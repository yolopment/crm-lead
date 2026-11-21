const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData (multipart)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('crm_token');
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const err: any = new Error(errorData.error || `Request failed: ${res.status}`);
    err.code = errorData.code;
    err.status = res.status;
    throw err;
  }

  // Handle empty responses (204 No Content)
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }
  return null;
}

export function getAudioUrl(callId: string): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : '';
  return `${API_BASE}/calls/${callId}/audio?token=${encodeURIComponent(token || '')}`;
}

export { API_BASE };

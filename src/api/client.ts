import type { ApiErrorBody } from './contract';
import { getMockUser } from '../auth/session';

export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock';
const BASE = API_MODE === 'live' ? (import.meta.env.VITE_API_BASE_URL ?? '') : '';

export class ApiError extends Error {
  constructor(public status: number, public code: ApiErrorBody['code'] | 'NETWORK', message: string) { super(message); }
}

/** Where live mode will add the SSO access token (MSAL) - see README "Connecting the backend". */
async function authHeaders(): Promise<Record<string, string>> {
  if (API_MODE === 'mock') return { 'x-mock-user': getMockUser() };
  return {};
}

export async function apiGet<T>(path: string, params?: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : '';
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}${qs}`, { headers: { Accept: 'application/json', ...(await authHeaders()) }, signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'Could not reach the server.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body?.code ?? 'BAD_REQUEST', body?.error ?? `Request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

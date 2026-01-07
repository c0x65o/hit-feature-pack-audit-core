import { NextRequest } from 'next/server';

export interface User {
  sub: string;
  email: string;
  roles?: string[];
}

/**
 * Extract user claims from JWT token in cookies or Authorization header.
 *
 * Note: The HIT app dispatcher normalizes JWT segments to be compatible with `atob`,
 * so we can decode the payload without pulling in a full JWT library here.
 */
export function extractUserFromRequest(request: NextRequest): User | null {
  let token = request.cookies.get('hit_token')?.value;
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
  }

  // Some deployments set x-user-id (trusted proxy). If present, treat as authenticated.
  const xUserId = request.headers.get('x-user-id');
  if (xUserId) return { sub: xUserId, email: '', roles: [] };

  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return { sub: payload.sub || payload.email || '', email: payload.email || '', roles: payload.roles || [] };
  } catch {
    return null;
  }
}

export function getUserId(request: NextRequest): string | null {
  const user = extractUserFromRequest(request);
  return user?.sub || null;
}

export function isAdmin(request: NextRequest): boolean {
  const user = extractUserFromRequest(request);
  const roles = Array.isArray(user?.roles) ? user!.roles! : [];
  return roles.includes('admin');
}

/**
 * Extract user claims from JWT token in cookies or Authorization header.
 *
 * Note: The HIT app dispatcher normalizes JWT segments to be compatible with `atob`,
 * so we can decode the payload without pulling in a full JWT library here.
 */
export function extractUserFromRequest(request) {
    let token = request.cookies.get('hit_token')?.value;
    if (!token) {
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer '))
            token = authHeader.slice(7);
    }
    if (!token)
        return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now())
            return null;
        return { sub: payload.sub || payload.email || '', email: payload.email || '', roles: payload.roles || [] };
    }
    catch {
        return null;
    }
}
export function getUserId(request) {
    const user = extractUserFromRequest(request);
    return user?.sub || null;
}
export function isAdmin(request) {
    const user = extractUserFromRequest(request);
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return roles.includes('admin');
}

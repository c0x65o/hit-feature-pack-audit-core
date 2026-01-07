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
export declare function extractUserFromRequest(request: NextRequest): User | null;
export declare function getUserId(request: NextRequest): string | null;
export declare function isAdmin(request: NextRequest): boolean;
//# sourceMappingURL=auth.d.ts.map
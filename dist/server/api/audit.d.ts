import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/audit
 *
 * Query params:
 * - entityKind?: string
 * - entityId?: string
 * - action?: string
 * - actorId?: string
 * - correlationId?: string
 * - packName?: string
 * - q?: string (searches summary)
 * - from?: ISO string (createdAt >= from)
 * - to?: ISO string (createdAt <= to)
 * - page?: number (default 1)
 * - pageSize?: number (default 25, max 100)
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    items: any;
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}>>;
//# sourceMappingURL=audit.d.ts.map
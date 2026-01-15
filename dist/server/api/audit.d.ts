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
 * - actorType?: string
 * - correlationId?: string
 * - packName?: string
 * - method?: string (HTTP method: GET, POST, PUT, PATCH, DELETE)
 * - eventType?: string
 * - outcome?: string
 * - targetKind?: string
 * - targetId?: string
 * - sessionId?: string
 * - q?: string (searches summary)
 * - from?: ISO string (createdAt >= from)
 * - to?: ISO string (createdAt <= to)
 * - page?: number (default 1)
 * - pageSize?: number (default 25, max 100)
 *
 * Error/latency filtering (uses details JSONB):
 * - status?: "4xx" | "5xx" | "error" (4xx+5xx) | exact number
 * - minDuration?: number (ms) - only events slower than this
 * - maxDuration?: number (ms) - only events faster than this
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
import { NextResponse } from 'next/server';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { auditEvents } from '@/lib/feature-pack-schemas';
import { getUserId, isAdmin } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function jsonError(message, status = 400) {
    return NextResponse.json({ error: message }, { status });
}
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
 * - method?: string (HTTP method: GET, POST, PUT, PATCH, DELETE)
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
export async function GET(request) {
    const userId = getUserId(request);
    if (!userId)
        return jsonError('Unauthorized', 401);
    if (!isAdmin(request))
        return jsonError('Forbidden', 403);
    const url = new URL(request.url);
    const entityKind = String(url.searchParams.get('entityKind') || '').trim();
    const entityId = String(url.searchParams.get('entityId') || '').trim();
    const action = String(url.searchParams.get('action') || '').trim();
    const actorId = String(url.searchParams.get('actorId') || '').trim();
    const correlationId = String(url.searchParams.get('correlationId') || '').trim();
    const packName = String(url.searchParams.get('packName') || '').trim();
    const method = String(url.searchParams.get('method') || '').trim().toUpperCase();
    const q = String(url.searchParams.get('q') || '').trim();
    const from = String(url.searchParams.get('from') || '').trim();
    const to = String(url.searchParams.get('to') || '').trim();
    // Error/latency filters
    const status = String(url.searchParams.get('status') || '').trim();
    const minDuration = url.searchParams.get('minDuration');
    const maxDuration = url.searchParams.get('maxDuration');
    const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 25) || 25));
    const offset = (page - 1) * pageSize;
    const whereParts = [];
    if (entityKind)
        whereParts.push(eq(auditEvents.entityKind, entityKind));
    if (entityId)
        whereParts.push(eq(auditEvents.entityId, entityId));
    if (action)
        whereParts.push(eq(auditEvents.action, action));
    if (actorId)
        whereParts.push(eq(auditEvents.actorId, actorId));
    if (correlationId)
        whereParts.push(eq(auditEvents.correlationId, correlationId));
    if (packName)
        whereParts.push(eq(auditEvents.packName, packName));
    if (method)
        whereParts.push(eq(auditEvents.method, method));
    if (q)
        whereParts.push(ilike(auditEvents.summary, `%${q}%`));
    if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime()))
            whereParts.push(gte(auditEvents.createdAt, d));
    }
    if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime()))
            whereParts.push(lte(auditEvents.createdAt, d));
    }
    // Status filtering on details->responseStatus
    if (status === '4xx') {
        whereParts.push(sql `(details->>'responseStatus')::int >= 400 AND (details->>'responseStatus')::int < 500`);
    }
    else if (status === '5xx') {
        whereParts.push(sql `(details->>'responseStatus')::int >= 500`);
    }
    else if (status === 'error') {
        whereParts.push(sql `(details->>'responseStatus')::int >= 400`);
    }
    else if (status && !isNaN(Number(status))) {
        whereParts.push(sql `(details->>'responseStatus')::int = ${Number(status)}`);
    }
    // Duration filtering on details->durationMs
    if (minDuration && !isNaN(Number(minDuration))) {
        whereParts.push(sql `(details->>'durationMs')::float >= ${Number(minDuration)}`);
    }
    if (maxDuration && !isNaN(Number(maxDuration))) {
        whereParts.push(sql `(details->>'durationMs')::float <= ${Number(maxDuration)}`);
    }
    const where = whereParts.length ? and(...whereParts) : undefined;
    const db = getDb();
    const countRows = await db
        .select({ count: sql `count(*)`.as('count') })
        .from(auditEvents)
        .where(where);
    const total = Number(countRows[0]?.count || 0);
    const items = await db
        .select()
        .from(auditEvents)
        .where(where)
        .orderBy(desc(auditEvents.createdAt))
        .limit(pageSize)
        .offset(offset);
    return NextResponse.json({
        items,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
        },
    });
}

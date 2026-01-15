import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, ilike, lte, sql, or, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { auditEvents, userOrgAssignments } from '@/lib/feature-pack-schemas';
import { getUserId, extractUserFromRequest } from '../auth';
import { resolveAuditCoreScopeMode } from '../lib/scope-mode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function fetchUserOrgScopeIds(db: any, userKey: string): Promise<{
  divisionIds: string[];
  departmentIds: string[];
  locationIds: string[];
}> {
  const rows = await db
    .select({
      divisionId: userOrgAssignments.divisionId,
      departmentId: userOrgAssignments.departmentId,
      locationId: userOrgAssignments.locationId,
    })
    .from(userOrgAssignments)
    .where(eq(userOrgAssignments.userKey, userKey));

  const divisionIds: string[] = [];
  const departmentIds: string[] = [];
  const locationIds: string[] = [];

  for (const r of rows as any[]) {
    if (r.divisionId && !divisionIds.includes(r.divisionId)) divisionIds.push(r.divisionId);
    if (r.departmentId && !departmentIds.includes(r.departmentId)) departmentIds.push(r.departmentId);
    if (r.locationId && !locationIds.includes(r.locationId)) locationIds.push(r.locationId);
  }

  return { divisionIds, departmentIds, locationIds };
}

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
export async function GET(request: NextRequest) {
  const user = extractUserFromRequest(request);
  if (!user || !user.sub) return jsonError('Unauthorized', 401);

  // Resolve scope mode for read access
  const mode = await resolveAuditCoreScopeMode(request, { verb: 'read' });

  const db = getDb();
  const url = new URL(request.url);
  const entityKind = String(url.searchParams.get('entityKind') || '').trim();
  const entityId = String(url.searchParams.get('entityId') || '').trim();
  const action = String(url.searchParams.get('action') || '').trim();
  const actorId = String(url.searchParams.get('actorId') || '').trim();
  const actorType = String(url.searchParams.get('actorType') || '').trim();
  const correlationId = String(url.searchParams.get('correlationId') || '').trim();
  const packName = String(url.searchParams.get('packName') || '').trim();
  const method = String(url.searchParams.get('method') || '').trim().toUpperCase();
  const eventType = String(url.searchParams.get('eventType') || '').trim();
  const outcome = String(url.searchParams.get('outcome') || '').trim();
  const targetKind = String(url.searchParams.get('targetKind') || '').trim();
  const targetId = String(url.searchParams.get('targetId') || '').trim();
  const sessionId = String(url.searchParams.get('sessionId') || '').trim();
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

  const whereParts: any[] = [];

  // Apply scope-based filtering (explicit branching on none/own/ldd/any)
  if (mode === 'none') {
    // Explicit deny: return empty results (fail-closed but non-breaking for list UI)
    whereParts.push(sql<boolean>`false`);
  } else if (mode === 'own') {
    // Only show events where the current user is the actor
    if (user.sub) {
      whereParts.push(eq((auditEvents as any).actorId, user.sub));
    } else {
      // No user ID, deny access
      whereParts.push(sql<boolean>`false`);
    }
  } else if (mode === 'ldd') {
    // Show events where:
    // 1. The current user is the actor (own)
    // 2. The actor's user has matching L/D/D assignments
    const scopeIds = await fetchUserOrgScopeIds(db, user.sub);
    
    const ownCondition = user.sub ? eq((auditEvents as any).actorId, user.sub) : sql<boolean>`false`;
    
    // For LDD matching, check if the actor's user has matching assignments
    const lddParts: any[] = [];
    if (scopeIds.divisionIds.length) {
      lddParts.push(
        sql`exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${(auditEvents as any).actorId}
            and ${userOrgAssignments.divisionId} in (${sql.join(scopeIds.divisionIds.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }
    if (scopeIds.departmentIds.length) {
      lddParts.push(
        sql`exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${(auditEvents as any).actorId}
            and ${userOrgAssignments.departmentId} in (${sql.join(scopeIds.departmentIds.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }
    if (scopeIds.locationIds.length) {
      lddParts.push(
        sql`exists (
          select 1 from ${userOrgAssignments}
          where ${userOrgAssignments.userKey} = ${(auditEvents as any).actorId}
            and ${userOrgAssignments.locationId} in (${sql.join(scopeIds.locationIds.map(id => sql`${id}`), sql`, `)})
        )`
      );
    }
    
    if (lddParts.length > 0) {
      whereParts.push(or(ownCondition, or(...lddParts)!)!);
    } else {
      // No LDD assignments, fall back to own only
      whereParts.push(ownCondition);
    }
  } else if (mode === 'any') {
    // No scoping - show all events
  }

  // Apply query filters
  if (entityKind) whereParts.push(eq((auditEvents as any).entityKind, entityKind));
  if (entityId) whereParts.push(eq((auditEvents as any).entityId, entityId));
  if (action) whereParts.push(eq((auditEvents as any).action, action));
  if (actorId) whereParts.push(eq((auditEvents as any).actorId, actorId));
  if (actorType) whereParts.push(eq((auditEvents as any).actorType, actorType));
  if (correlationId) whereParts.push(eq((auditEvents as any).correlationId, correlationId));
  if (packName) whereParts.push(eq((auditEvents as any).packName, packName));
  if (method) whereParts.push(eq((auditEvents as any).method, method));
  if (eventType) whereParts.push(eq((auditEvents as any).eventType, eventType));
  if (outcome) whereParts.push(eq((auditEvents as any).outcome, outcome));
  if (targetKind) whereParts.push(eq((auditEvents as any).targetKind, targetKind));
  if (targetId) whereParts.push(eq((auditEvents as any).targetId, targetId));
  if (sessionId) whereParts.push(eq((auditEvents as any).sessionId, sessionId));
  if (q) whereParts.push(ilike((auditEvents as any).summary, `%${q}%`));

  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) whereParts.push(gte((auditEvents as any).createdAt, d));
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) whereParts.push(lte((auditEvents as any).createdAt, d));
  }

  // Status filtering on details->responseStatus
  if (status === '4xx') {
    whereParts.push(sql`(details->>'responseStatus')::int >= 400 AND (details->>'responseStatus')::int < 500`);
  } else if (status === '5xx') {
    whereParts.push(sql`(details->>'responseStatus')::int >= 500`);
  } else if (status === 'error') {
    whereParts.push(sql`(details->>'responseStatus')::int >= 400`);
  } else if (status && !isNaN(Number(status))) {
    whereParts.push(sql`(details->>'responseStatus')::int = ${Number(status)}`);
  }

  // Duration filtering on details->durationMs
  if (minDuration && !isNaN(Number(minDuration))) {
    whereParts.push(sql`(details->>'durationMs')::float >= ${Number(minDuration)}`);
  }
  if (maxDuration && !isNaN(Number(maxDuration))) {
    whereParts.push(sql`(details->>'durationMs')::float <= ${Number(maxDuration)}`);
  }

  const where = whereParts.length ? and(...whereParts) : undefined;

  const countRows = await db
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(auditEvents as any)
    .where(where as any);
  const total = Number((countRows as any[])[0]?.count || 0);

  const items = await db
    .select()
    .from(auditEvents as any)
    .where(where as any)
    .orderBy(desc((auditEvents as any).createdAt))
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

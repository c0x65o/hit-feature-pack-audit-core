/**
 * Auto-Audit: Automatic audit logging for API mutations.
 *
 * Called by the feature-pack-api-dispatcher when a write operation (POST/PUT/PATCH/DELETE)
 * completes and the handler didn't write its own audit event.
 *
 * Level 1: Basic audit (entityKind, entityId, action, summary)
 * Level 2: Full observability (+ requestBody, durationMs, responseStatus)
 *
 * Logs ALL writes (success AND failure) for full observability.
 */
import { pgTable, uuid, varchar, text, jsonb, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { getAuditContext, markAuditWrite } from './audit-context';
// Local table definition (same as write-audit.ts)
const auditActorTypeEnum = pgEnum('audit_actor_type', ['user', 'system', 'api']);
const auditEvents = pgTable('audit_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    entityKind: varchar('entity_kind', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }),
    action: varchar('action', { length: 100 }).notNull(),
    summary: text('summary').notNull(),
    details: jsonb('details'),
    actorId: varchar('actor_id', { length: 255 }),
    actorName: varchar('actor_name', { length: 255 }),
    actorType: auditActorTypeEnum('actor_type').notNull().default('user'),
    correlationId: varchar('correlation_id', { length: 255 }),
    packName: varchar('pack_name', { length: 100 }),
    method: varchar('method', { length: 16 }),
    path: text('path'),
    ipAddress: varchar('ip_address', { length: 100 }),
    userAgent: varchar('user_agent', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    entityIdx: index('audit_events_entity_idx').on(t.entityKind, t.entityId),
    createdAtIdx: index('audit_events_created_at_idx').on(t.createdAt),
}));
/**
 * Map HTTP method to audit action.
 */
function methodToAction(method) {
    switch (method.toUpperCase()) {
        case 'GET':
            return 'read';
        case 'POST':
            return 'created';
        case 'PUT':
        case 'PATCH':
            return 'updated';
        case 'DELETE':
            return 'deleted';
        default:
            return method.toLowerCase();
    }
}
/**
 * Extract entity kind and ID from API path.
 *
 * Examples:
 *   /api/crm/contacts/123        → { kind: 'contact', id: '123' }
 *   /api/crm/contacts            → { kind: 'contact', id: null }
 *   /api/vault/folders/abc/items → { kind: 'item', id: null }
 *   /api/forms/xyz/entries/456   → { kind: 'entry', id: '456' }
 *
 * Heuristic: Last path segment that looks like an ID (UUID or number) is the entityId.
 * The segment before it (singularized) is the entityKind.
 */
function extractEntityFromPath(path) {
    // Remove /api/ prefix and split
    const cleaned = path.replace(/^\/api\//, '');
    const segments = cleaned.split('/').filter(Boolean);
    if (segments.length === 0) {
        return { kind: 'unknown', id: null };
    }
    // Skip the pack name (first segment)
    const pathSegments = segments.slice(1);
    if (pathSegments.length === 0) {
        // Just /api/packName - use pack name as entity kind
        return { kind: segments[0], id: null };
    }
    // Check if last segment looks like an ID (UUID or numeric)
    const lastSegment = pathSegments[pathSegments.length - 1];
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const numericPattern = /^\d+$/;
    if (uuidPattern.test(lastSegment) || numericPattern.test(lastSegment)) {
        // Last segment is an ID
        const entityId = lastSegment;
        // Get the kind from the segment before it
        if (pathSegments.length >= 2) {
            const kindSegment = pathSegments[pathSegments.length - 2];
            return { kind: singularize(kindSegment), id: entityId };
        }
        // Just /api/pack/[id] - use pack name
        return { kind: segments[0], id: entityId };
    }
    // Last segment is not an ID - it's the entity kind
    return { kind: singularize(lastSegment), id: null };
}
/**
 * Simple singularization for common patterns.
 */
function singularize(word) {
    if (word.endsWith('ies')) {
        return word.slice(0, -3) + 'y';
    }
    if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes')) {
        return word.slice(0, -2);
    }
    if (word.endsWith('s') && !word.endsWith('ss')) {
        return word.slice(0, -1);
    }
    return word;
}
/**
 * Build a human-readable summary for the audit event.
 */
function buildSummary(action, entityKind, entityId, packName) {
    const actionVerb = action.charAt(0).toUpperCase() + action.slice(1);
    if (entityId) {
        return `${actionVerb} ${entityKind} (${entityId})`;
    }
    return `${actionVerb} ${entityKind}`;
}
/**
 * Truncate large payloads to avoid bloating the audit table.
 */
function truncatePayload(payload, maxLength = 4000) {
    if (payload === null || payload === undefined)
        return null;
    try {
        const str = JSON.stringify(payload);
        if (str.length <= maxLength)
            return payload;
        // Return truncated indicator
        return {
            _truncated: true,
            _originalLength: str.length,
            _preview: str.slice(0, maxLength),
        };
    }
    catch {
        return { _error: 'Could not serialize payload' };
    }
}
function truncateText(s, maxLength = 160) {
    const trimmed = s.trim();
    if (trimmed.length <= maxLength)
        return trimmed;
    return trimmed.slice(0, maxLength - 1) + '…';
}
function extractErrorHint(responseBody) {
    if (responseBody === null || responseBody === undefined)
        return null;
    if (typeof responseBody === 'string')
        return responseBody.trim() || null;
    if (typeof responseBody !== 'object')
        return String(responseBody);
    const obj = responseBody;
    const candidates = [
        obj.error,
        obj.message,
        obj.detail,
        obj.exception?.message,
        obj.exception?.name,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim())
            return c.trim();
    }
    return null;
}
/**
 * Write an automatic audit event using the current audit context.
 *
 * Called by the dispatcher after a write operation when the handler
 * didn't write its own audit event. This provides baseline audit coverage.
 *
 * Level 2: Logs ALL writes (success and failure) with full observability data.
 *
 * @returns true if audit was written, false if skipped
 */
export async function writeAutoAuditEvent(input) {
    const ctx = getAuditContext();
    if (!ctx) {
        console.warn('[auto-audit] No audit context available, skipping auto-audit');
        return false;
    }
    // Don't double-write if handler already wrote
    if (ctx.auditWrites > 0) {
        return false;
    }
    const method = ctx.method?.toUpperCase();
    if (!method) {
        return false;
    }
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isError = input.responseStatus >= 400;
    // Audit: all writes (success or failure) OR any request that errors (4xx/5xx)
    if (!isWrite && !isError) {
        return false;
    }
    try {
        // Dynamically import the app's db connection
        // This works because auto-audit runs in the app context (via dispatcher)
        const dbModule = await import('@/lib/db');
        const db = dbModule.getDb();
        const isSuccess = input.responseStatus >= 200 && input.responseStatus < 300;
        const isClientError = input.responseStatus >= 400 && input.responseStatus < 500;
        const isServerError = input.responseStatus >= 500;
        // Determine action based on method and outcome
        let action = methodToAction(method);
        if (!isSuccess) {
            action = isClientError ? `${action}_rejected` : `${action}_failed`;
        }
        let { kind: entityKind, id: entityId } = extractEntityFromPath(ctx.path);
        // For POST responses, try to extract the created entity ID from response
        if (method === 'POST' && !entityId && input.responseBody && isSuccess) {
            const body = input.responseBody;
            if (body.id && typeof body.id === 'string') {
                entityId = body.id;
            }
        }
        // Build Level 2.5 details object (observability payloads)
        const details = {
            responseStatus: input.responseStatus,
            durationMs: input.durationMs ?? null,
            success: isSuccess,
        };
        // Level 3: Timing breakdown (DB vs module vs other)
        if (input.dbTimeMs != null) {
            details.dbTimeMs = input.dbTimeMs;
        }
        if (input.moduleTimeMs != null) {
            details.moduleTimeMs = input.moduleTimeMs;
        }
        if (input.slowQueries && input.slowQueries.length > 0) {
            // Limit to top 5 slowest queries to avoid bloating
            const topSlowQueries = [...input.slowQueries]
                .sort((a, b) => b.durationMs - a.durationMs)
                .slice(0, 5);
            details.slowQueries = topSlowQueries;
        }
        // Include request body (truncated if large)
        if (input.requestBody !== undefined && input.requestBody !== null) {
            details.requestBody = truncatePayload(input.requestBody);
        }
        // Include response body when available.
        // This enables "Level 2.5" snapshots (diff later without DB reads) when handlers return the updated entity.
        // Still truncated to avoid bloating the audit table.
        if (input.responseBody !== undefined && input.responseBody !== null) {
            details.responseBody = truncatePayload(input.responseBody);
        }
        // Mark slow requests (>500ms)
        if (input.durationMs && input.durationMs > 500) {
            details.isSlow = true;
        }
        let summary = buildSummary(action, entityKind, entityId, ctx.packName);
        if (!isSuccess) {
            const hint = extractErrorHint(input.responseBody);
            if (hint)
                summary = `${summary} — ${truncateText(hint)}`;
        }
        await db.insert(auditEvents).values({
            entityKind,
            entityId,
            action,
            summary,
            details,
            actorId: input.actorId ?? ctx.actorId ?? 'system',
            actorName: null,
            actorType: 'user',
            correlationId: ctx.correlationId,
            packName: ctx.packName,
            method: ctx.method,
            path: ctx.path,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
        });
        markAuditWrite();
        return true;
    }
    catch (error) {
        // Log but don't fail the request - audit is best-effort for auto-mode
        console.error('[auto-audit] Failed to write auto-audit event:', error);
        return false;
    }
}
// Export helpers for testing
export { extractEntityFromPath, singularize, methodToAction, buildSummary };

/**
 * Auto-Audit: Automatic audit logging for API mutations.
 *
 * Called by the feature-pack-api-dispatcher when a write operation (POST/PUT/PATCH/DELETE)
 * succeeds but the handler didn't write its own audit event.
 *
 * This provides "Level 1" audit coverage: every mutation gets logged with basic info,
 * even if the handler doesn't explicitly call writeAuditEvent.
 */

import { pgTable, uuid, varchar, text, jsonb, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { getAuditContext, markAuditWrite } from './audit-context';

// Local table definition (same as write-audit.ts)
const auditActorTypeEnum = pgEnum('audit_actor_type', ['user', 'system', 'api']);
const auditEvents = pgTable(
  'audit_events',
  {
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
  },
  (t) => ({
    entityIdx: index('audit_events_entity_idx').on(t.entityKind, t.entityId),
    createdAtIdx: index('audit_events_created_at_idx').on(t.createdAt),
  })
);

/**
 * Map HTTP method to audit action.
 */
function methodToAction(method: string): string {
  switch (method.toUpperCase()) {
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
function extractEntityFromPath(path: string): { kind: string; id: string | null } {
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
function singularize(word: string): string {
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
function buildSummary(
  action: string,
  entityKind: string,
  entityId: string | null,
  packName: string
): string {
  const actionVerb = action.charAt(0).toUpperCase() + action.slice(1);
  if (entityId) {
    return `${actionVerb} ${entityKind} (${entityId})`;
  }
  return `${actionVerb} ${entityKind}`;
}

export interface AutoAuditInput {
  /** Response status code - only logs for 2xx */
  responseStatus: number;
  /** Response body (for extracting created entity ID on POST) */
  responseBody?: unknown;
  /** Actor ID (user email/ID) */
  actorId?: string | null;
}

/**
 * Write an automatic audit event using the current audit context.
 *
 * Called by the dispatcher after a successful write operation when the handler
 * didn't write its own audit event. This provides baseline audit coverage.
 *
 * @returns true if audit was written, false if skipped (e.g., not a 2xx response)
 */
export async function writeAutoAuditEvent(input: AutoAuditInput): Promise<boolean> {
  // Only audit successful responses
  if (input.responseStatus < 200 || input.responseStatus >= 300) {
    return false;
  }

  const ctx = getAuditContext();
  if (!ctx) {
    console.warn('[auto-audit] No audit context available, skipping auto-audit');
    return false;
  }

  // Don't double-write if handler already wrote
  if (ctx.auditWrites > 0) {
    return false;
  }

  // Only audit write operations
  const method = ctx.method?.toUpperCase();
  if (!method || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return false;
  }

  try {
    // Dynamically import the app's db connection
    // This works because auto-audit runs in the app context (via dispatcher)
    const dbModule = await import('@/lib/db');
    const db = dbModule.getDb();

    const action = methodToAction(method);
    let { kind: entityKind, id: entityId } = extractEntityFromPath(ctx.path);

    // For POST responses, try to extract the created entity ID from response
    if (method === 'POST' && !entityId && input.responseBody) {
      const body = input.responseBody as Record<string, unknown>;
      if (body.id && typeof body.id === 'string') {
        entityId = body.id;
      }
    }

    const summary = buildSummary(action, entityKind, entityId, ctx.packName);

    await db.insert(auditEvents as any).values({
      entityKind,
      entityId,
      action,
      summary,
      details: null, // Basic auto-audit doesn't capture request/response details
      actorId: input.actorId ?? ctx.actorId ?? 'system',
      actorName: null,
      actorType: 'user',
      correlationId: ctx.correlationId,
      packName: ctx.packName,
      method: ctx.method,
      path: ctx.path,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    } as any);

    markAuditWrite();
    return true;
  } catch (error) {
    // Log but don't fail the request - audit is best-effort for auto-mode
    console.error('[auto-audit] Failed to write auto-audit event:', error);
    return false;
  }
}

// Export helpers for testing
export { extractEntityFromPath, singularize, methodToAction, buildSummary };

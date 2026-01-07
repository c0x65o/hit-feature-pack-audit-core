import { pgTable, uuid, varchar, text, jsonb, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';
import { getAuditContext, markAuditWrite } from './audit-context';
// Local shape so write path works even if host app hasn't regenerated feature-pack-schemas yet.
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
 * Strict audit write: throws on failure.
 *
 * Pass a Drizzle DB or transaction (`tx`) so the audit row can be written in the same transaction
 * as the mutation. If this insert fails, you should let the error propagate to fail the request.
 */
export async function writeAuditEvent(dbOrTx, input) {
    const ctx = getAuditContext();
    await dbOrTx.insert(auditEvents).values({
        entityKind: String(input.entityKind),
        entityId: input.entityId != null ? String(input.entityId) : null,
        action: String(input.action),
        summary: String(input.summary),
        details: input.details ?? null,
        actorId: String(input.actorId),
        actorName: input.actorName ?? null,
        actorType: input.actorType ?? 'user',
        correlationId: input.correlationId ?? ctx?.correlationId ?? null,
        packName: input.packName ?? ctx?.packName ?? null,
        method: input.method ?? ctx?.method ?? null,
        path: input.path ?? ctx?.path ?? null,
        ipAddress: input.ipAddress ?? ctx?.ipAddress ?? null,
        userAgent: input.userAgent ?? ctx?.userAgent ?? null,
    });
    markAuditWrite();
}

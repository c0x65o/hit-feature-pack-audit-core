import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
export const auditActorTypeEnum = pgEnum('audit_actor_type', ['user', 'system', 'api']);
/**
 * Global audit event log.
 *
 * One row per “interesting change” (create/update/delete/transition/etc).
 * Designed to be attachable to anything via (entityKind, entityId).
 */
export const auditEvents = pgTable('audit_events', {
    id: uuid('id').primaryKey().defaultRandom(),
    // What changed
    entityKind: varchar('entity_kind', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }),
    action: varchar('action', { length: 100 }).notNull(),
    summary: text('summary').notNull(),
    details: jsonb('details'),
    // Who did it
    actorId: varchar('actor_id', { length: 255 }),
    actorName: varchar('actor_name', { length: 255 }),
    actorType: auditActorTypeEnum('actor_type').notNull().default('user'),
    // Correlation / debug / observability hooks
    correlationId: varchar('correlation_id', { length: 255 }),
    packName: varchar('pack_name', { length: 100 }),
    method: varchar('method', { length: 16 }),
    path: text('path'),
    // Request metadata (optional)
    ipAddress: varchar('ip_address', { length: 100 }),
    userAgent: varchar('user_agent', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
    entityIdx: index('audit_events_entity_idx').on(t.entityKind, t.entityId),
    createdAtIdx: index('audit_events_created_at_idx').on(t.createdAt),
    actorIdx: index('audit_events_actor_idx').on(t.actorId),
    correlationIdx: index('audit_events_correlation_idx').on(t.correlationId),
    packIdx: index('audit_events_pack_idx').on(t.packName),
}));

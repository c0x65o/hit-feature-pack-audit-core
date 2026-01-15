import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
export const auditActorTypeEnum = pgEnum('audit_actor_type', ['user', 'system', 'api']);
export const auditOutcomeEnum = pgEnum('audit_outcome', ['success', 'failure', 'denied', 'error']);
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
    changes: jsonb('changes'),
    // Event metadata
    eventType: varchar('event_type', { length: 120 }),
    outcome: auditOutcomeEnum('outcome'),
    targetKind: varchar('target_kind', { length: 100 }),
    targetId: varchar('target_id', { length: 255 }),
    targetName: varchar('target_name', { length: 255 }),
    sessionId: varchar('session_id', { length: 255 }),
    authMethod: varchar('auth_method', { length: 50 }),
    mfaMethod: varchar('mfa_method', { length: 50 }),
    errorCode: varchar('error_code', { length: 120 }),
    errorMessage: text('error_message'),
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
    eventTypeIdx: index('audit_events_event_type_idx').on(t.eventType),
    outcomeIdx: index('audit_events_outcome_idx').on(t.outcome),
    targetIdx: index('audit_events_target_idx').on(t.targetKind, t.targetId),
    sessionIdx: index('audit_events_session_idx').on(t.sessionId),
}));

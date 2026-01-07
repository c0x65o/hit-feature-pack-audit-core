export type WriteAuditEventInput = {
    entityKind: string;
    entityId?: string | null;
    action: string;
    summary: string;
    details?: Record<string, unknown> | null;
    actorId: string;
    actorName?: string | null;
    actorType?: 'user' | 'system' | 'api';
    correlationId?: string | null;
    packName?: string | null;
    method?: string | null;
    path?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
};
/**
 * Strict audit write: throws on failure.
 *
 * Pass a Drizzle DB or transaction (`tx`) so the audit row can be written in the same transaction
 * as the mutation. If this insert fails, you should let the error propagate to fail the request.
 */
export declare function writeAuditEvent(dbOrTx: any, input: WriteAuditEventInput): Promise<void>;
//# sourceMappingURL=write-audit.d.ts.map
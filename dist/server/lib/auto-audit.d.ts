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
/**
 * Map HTTP method to audit action.
 */
declare function methodToAction(method: string): string;
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
declare function extractEntityFromPath(path: string): {
    kind: string;
    id: string | null;
};
/**
 * Simple singularization for common patterns.
 */
declare function singularize(word: string): string;
/**
 * Build a human-readable summary for the audit event.
 */
declare function buildSummary(action: string, entityKind: string, entityId: string | null, packName: string): string;
export interface SlowQueryRecord {
    sql: string;
    durationMs: number;
}
export interface AutoAuditInput {
    /** Response status code (logs both success and failure for observability) */
    responseStatus: number;
    /** Response body (for extracting created entity ID on POST, or error details) */
    responseBody?: unknown;
    /** Request body (Level 2: what was sent) */
    requestBody?: unknown;
    /** Duration in milliseconds (Level 2: how long it took) */
    durationMs?: number;
    /** Actor ID (user email/ID) */
    actorId?: string | null;
    /** Database time in milliseconds (Level 3: timing breakdown) */
    dbTimeMs?: number;
    /** External module call time in milliseconds (Level 3: timing breakdown) */
    moduleTimeMs?: number;
    /** Slow queries with full SQL (Level 3: query observability) */
    slowQueries?: SlowQueryRecord[];
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
export declare function writeAutoAuditEvent(input: AutoAuditInput): Promise<boolean>;
export { extractEntityFromPath, singularize, methodToAction, buildSummary };
//# sourceMappingURL=auto-audit.d.ts.map
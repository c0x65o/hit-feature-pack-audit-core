/**
 * Auto-Audit: Automatic audit logging for API mutations.
 *
 * Called by the feature-pack-api-dispatcher when a write operation (POST/PUT/PATCH/DELETE)
 * succeeds but the handler didn't write its own audit event.
 *
 * This provides "Level 1" audit coverage: every mutation gets logged with basic info,
 * even if the handler doesn't explicitly call writeAuditEvent.
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
export declare function writeAutoAuditEvent(input: AutoAuditInput): Promise<boolean>;
export { extractEntityFromPath, singularize, methodToAction, buildSummary };
//# sourceMappingURL=auto-audit.d.ts.map
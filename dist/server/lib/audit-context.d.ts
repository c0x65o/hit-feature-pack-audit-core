export type AuditRequestContext = {
    correlationId: string;
    packName: string;
    method: string;
    path: string;
    actorId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    auditWrites: number;
};
export declare function getAuditContext(): AuditRequestContext | null;
export declare function getAuditWrites(): number;
export declare function markAuditWrite(): void;
export declare function withAuditContext<T>(meta: Omit<AuditRequestContext, 'auditWrites'>, fn: () => Promise<T>): Promise<T>;
//# sourceMappingURL=audit-context.d.ts.map
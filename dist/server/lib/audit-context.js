import { AsyncLocalStorage } from 'node:async_hooks';
const als = new AsyncLocalStorage();
export function getAuditContext() {
    return als.getStore() ?? null;
}
export function getAuditWrites() {
    return als.getStore()?.auditWrites ?? 0;
}
export function markAuditWrite() {
    const store = als.getStore();
    if (!store)
        return;
    store.auditWrites += 1;
}
export async function withAuditContext(meta, fn) {
    const ctx = { ...meta, auditWrites: 0 };
    return await als.run(ctx, fn);
}

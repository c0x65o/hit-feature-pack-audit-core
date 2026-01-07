import { AsyncLocalStorage } from 'node:async_hooks';

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

const als = new AsyncLocalStorage<AuditRequestContext>();

export function getAuditContext(): AuditRequestContext | null {
  return als.getStore() ?? null;
}

export function getAuditWrites(): number {
  return als.getStore()?.auditWrites ?? 0;
}

export function markAuditWrite(): void {
  const store = als.getStore();
  if (!store) return;
  store.auditWrites += 1;
}

export async function withAuditContext<T>(
  meta: Omit<AuditRequestContext, 'auditWrites'>,
  fn: () => Promise<T>
): Promise<T> {
  const ctx: AuditRequestContext = { ...meta, auditWrites: 0 };
  return await als.run(ctx, fn);
}


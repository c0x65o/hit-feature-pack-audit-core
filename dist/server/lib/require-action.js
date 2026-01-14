import { checkActionPermission, requireActionPermission, } from '@hit/feature-pack-auth-core/server/lib/action-check';
export async function checkAuditCoreAction(request, actionKey) {
    return checkActionPermission(request, actionKey, { logPrefix: 'Audit-Core' });
}
export async function requireAuditCoreAction(request, actionKey) {
    return requireActionPermission(request, actionKey, { logPrefix: 'Audit-Core' });
}

import { checkAuditCoreAction } from './require-action';
/**
 * Resolve effective scope mode using a tree:
 * - audit-core default: audit-core.{verb}.scope.{mode}
 * - fallback:        own
 *
 * Precedence if multiple are granted: most restrictive wins.
 */
export async function resolveAuditCoreScopeMode(request, args) {
    const { verb } = args;
    const globalPrefix = `audit-core.${verb}.scope`;
    // Most restrictive wins (first match returned).
    const modes = ['none', 'own', 'ldd', 'any'];
    for (const m of modes) {
        const res = await checkAuditCoreAction(request, `${globalPrefix}.${m}`);
        if (res.ok)
            return m;
    }
    return 'own';
}

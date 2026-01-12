import type { NextRequest } from 'next/server';
export type ScopeMode = 'none' | 'own' | 'ldd' | 'any';
export type ScopeVerb = 'read';
/**
 * Resolve effective scope mode using a tree:
 * - audit-core default: audit-core.{verb}.scope.{mode}
 * - fallback:        own
 *
 * Precedence if multiple are granted: most restrictive wins.
 */
export declare function resolveAuditCoreScopeMode(request: NextRequest, args: {
    verb: ScopeVerb;
}): Promise<ScopeMode>;
//# sourceMappingURL=scope-mode.d.ts.map
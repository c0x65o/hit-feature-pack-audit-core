'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { useUi } from '@hit/ui-kit';
function formatValue(val) {
    if (val === null || val === undefined)
        return '(empty)';
    if (Array.isArray(val)) {
        if (val.length === 0)
            return '(none)';
        return val.join(', ');
    }
    return String(val);
}
function ChangeRow({ change }) {
    return (_jsxs("div", { style: { fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--hit-border, #e5e7eb)' }, children: [_jsx("div", { style: { fontWeight: 500, color: 'var(--hit-text, #111827)' }, children: change.field }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }, children: [_jsx("span", { style: { color: 'var(--hit-danger, #ef4444)', textDecoration: 'line-through' }, children: formatValue(change.from) }), _jsx("span", { style: { color: 'var(--hit-text-muted, #9ca3af)' }, children: "\u2192" }), _jsx("span", { style: { color: 'var(--hit-success, #22c55e)' }, children: formatValue(change.to) })] })] }));
}
export function AuditTrail(props) {
    const { Card } = useUi();
    const [loading, setLoading] = React.useState(true);
    const [items, setItems] = React.useState([]);
    const [error, setError] = React.useState(null);
    const [expandedIds, setExpandedIds] = React.useState(new Set());
    React.useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const sp = new URLSearchParams();
                sp.set('entityKind', props.entityKind);
                sp.set('entityId', props.entityId);
                sp.set('page', '1');
                sp.set('pageSize', '50');
                const res = await fetch(`/api/audit?${sp.toString()}`, { credentials: 'include' });
                const json = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(json?.error || `Failed to load audit (${res.status})`);
                const rows = Array.isArray(json?.items) ? json.items : [];
                if (!cancelled)
                    setItems(rows);
            }
            catch (e) {
                if (!cancelled)
                    setError(e?.message || String(e));
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        }
        if (props.entityKind && props.entityId)
            load();
        return () => {
            cancelled = true;
        };
    }, [props.entityKind, props.entityId]);
    const toggleExpand = (id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    };
    return (_jsx(Card, { children: _jsxs("div", { style: { padding: 16 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 600 }, children: "Audit Trail" }), _jsx("div", { style: { fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)' }, children: loading ? 'Loading…' : `${items.length} events` })] }), error ? (_jsx("div", { style: { fontSize: 13, color: 'var(--hit-danger, #ef4444)' }, children: error })) : items.length === 0 && !loading ? (_jsx("div", { style: { fontSize: 13, color: 'var(--hit-text-muted, #9ca3af)' }, children: "No audit events yet." })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: items.map((it) => {
                        const changes = it.details?.changes;
                        const hasChanges = Array.isArray(changes) && changes.length > 0;
                        const isExpanded = expandedIds.has(it.id);
                        const actorLabel = it.actorName || it.actorId || it.actorType || 'unknown';
                        const metaBits = [it.action, actorLabel, it.correlationId ? `trace:${it.correlationId}` : null].filter(Boolean);
                        return (_jsxs("div", { style: {
                                padding: 12,
                                border: '1px solid var(--hit-border, #e5e7eb)',
                                borderRadius: 8,
                                cursor: hasChanges ? 'pointer' : 'default',
                            }, onClick: () => hasChanges && toggleExpand(it.id), children: [_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }, children: [hasChanges && (_jsx("span", { style: { fontSize: 10, color: 'var(--hit-text-muted, #9ca3af)' }, children: isExpanded ? '▼' : '▶' })), it.summary] }), _jsx("div", { style: { fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)', whiteSpace: 'nowrap' }, children: new Date(it.createdAt).toLocaleString() })] }), _jsx("div", { style: { marginTop: 4, fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)' }, children: metaBits.join(' · ') }), isExpanded && hasChanges && (_jsx("div", { style: { marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hit-border, #e5e7eb)' }, children: changes.map((change, idx) => (_jsx(ChangeRow, { change: change }, idx))) }))] }, it.id));
                    }) }))] }) }));
}

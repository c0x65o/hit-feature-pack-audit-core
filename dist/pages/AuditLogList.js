'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { ClipboardList } from 'lucide-react';
import { useUi } from '@hit/ui-kit';
export function AuditLogList(props) {
    const { Page, Card, Input, Select, Button, Alert } = useUi();
    const navigate = (path) => {
        if (props.onNavigate)
            props.onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [items, setItems] = React.useState([]);
    const [entityKind, setEntityKind] = React.useState('');
    const [entityId, setEntityId] = React.useState('');
    const [action, setAction] = React.useState('');
    const [q, setQ] = React.useState('');
    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const sp = new URLSearchParams();
            if (entityKind.trim())
                sp.set('entityKind', entityKind.trim());
            if (entityId.trim())
                sp.set('entityId', entityId.trim());
            if (action.trim())
                sp.set('action', action.trim());
            if (q.trim())
                sp.set('q', q.trim());
            sp.set('page', '1');
            sp.set('pageSize', '50');
            const res = await fetch(`/api/audit?${sp.toString()}`, { credentials: 'include' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(json?.error || `Failed to load audit (${res.status})`);
            setItems(Array.isArray(json?.items) ? json.items : []);
        }
        catch (e) {
            setError(e?.message || String(e));
        }
        finally {
            setLoading(false);
        }
    }, [entityKind, entityId, action, q]);
    React.useEffect(() => {
        load();
    }, [load]);
    const breadcrumbs = [
        { label: 'Admin', href: '/admin', icon: _jsx(ClipboardList, { size: 14 }) },
        { label: 'Audit Logs' },
    ];
    return (_jsxs(Page, { title: "Audit Logs", breadcrumbs: breadcrumbs, onNavigate: navigate, actions: _jsx(Button, { variant: "secondary", onClick: load, disabled: loading, children: "Refresh" }), children: [_jsx(Card, { children: _jsxs("div", { style: { padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10 }, children: [_jsx(Input, { label: "Entity kind", value: entityKind, onChange: setEntityKind, placeholder: "e.g. opportunity" }), _jsx(Input, { label: "Entity id", value: entityId, onChange: setEntityId, placeholder: "UUID / id" }), _jsx(Select, { label: "Action", value: action, onChange: (v) => setAction(String(v || '')), options: [
                                { value: '', label: 'All' },
                                { value: 'created', label: 'created' },
                                { value: 'updated', label: 'updated' },
                                { value: 'deleted', label: 'deleted' },
                            ] }), _jsx(Input, { label: "Search", value: q, onChange: setQ, placeholder: "Search summary\u2026" }), _jsx("div", { style: { display: 'flex', alignItems: 'end' }, children: _jsx(Button, { variant: "primary", onClick: load, disabled: loading, children: "Apply" }) })] }) }), error ? (_jsx(Alert, { variant: "error", title: "Failed to load audit", children: error })) : null, _jsx(Card, { children: _jsxs("div", { style: { padding: 16 }, children: [_jsx("div", { style: { fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)', marginBottom: 8 }, children: loading ? 'Loading…' : `${items.length} events` }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [items.map((it) => (_jsxs("div", { style: {
                                        padding: 12,
                                        border: '1px solid var(--hit-border, #e5e7eb)',
                                        borderRadius: 8,
                                    }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 10 }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600 }, children: it.summary }), _jsx("div", { style: { fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)', whiteSpace: 'nowrap' }, children: new Date(it.createdAt).toLocaleString() })] }), _jsxs("div", { style: { marginTop: 4, fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)' }, children: [it.action, " \u00B7 ", it.entityKind, it.entityId ? `:${it.entityId}` : '', it.packName ? ` · ${it.packName}` : '', it.correlationId ? ` · trace:${it.correlationId}` : '', it.actorName || it.actorId ? ` · ${it.actorName || it.actorId}` : ''] })] }, it.id))), !loading && items.length === 0 ? (_jsx("div", { style: { fontSize: 13, color: 'var(--hit-text-muted, #9ca3af)' }, children: "No events found." })) : null] })] }) })] }));
}
export default AuditLogList;

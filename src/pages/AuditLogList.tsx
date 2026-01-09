'use client';

import React from 'react';
import { ClipboardList } from 'lucide-react';
import type { BreadcrumbItem } from '@hit/ui-kit';
import { useUi } from '@hit/ui-kit';

type AuditItem = {
  id: string;
  entityKind: string;
  entityId: string | null;
  action: string;
  summary: string;
  actorId: string | null;
  actorName: string | null;
  actorType: string;
  correlationId: string | null;
  packName: string | null;
  createdAt: string;
};

export function AuditLogList(props: { onNavigate?: (path: string) => void }) {
  const { Page, Card, Input, Select, Button, Alert } = useUi();

  const navigate = (path: string) => {
    if (props.onNavigate) props.onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<AuditItem[]>([]);

  const [entityKind, setEntityKind] = React.useState('');
  const [entityId, setEntityId] = React.useState('');
  const [action, setAction] = React.useState('');
  const [q, setQ] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (entityKind.trim()) sp.set('entityKind', entityKind.trim());
      if (entityId.trim()) sp.set('entityId', entityId.trim());
      if (action.trim()) sp.set('action', action.trim());
      if (q.trim()) sp.set('q', q.trim());
      sp.set('page', '1');
      sp.set('pageSize', '50');

      const res = await fetch(`/api/audit?${sp.toString()}`, { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Failed to load audit (${res.status})`);
      setItems(Array.isArray(json?.items) ? (json.items as AuditItem[]) : []);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [entityKind, entityId, action, q]);

  React.useEffect(() => {
    load();
  }, [load]);

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Admin', href: '/admin', icon: <ClipboardList size={14} /> },
    { label: 'Audit Logs' },
  ];

  return (
    <Page
      title="Audit Logs"
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      actions={
        <Button variant="secondary" onClick={load} disabled={loading}>
          Refresh
        </Button>
      }
    >
      <Card>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 10 }}>
          <Input label="Entity kind" value={entityKind} onChange={setEntityKind} placeholder="e.g. opportunity" />
          <Input label="Entity id" value={entityId} onChange={setEntityId} placeholder="UUID / id" />
          <Select
            label="Action"
            value={action}
            onChange={(v: any) => setAction(String(v || ''))}
            options={[
              { value: '', label: 'All' },
              { value: 'created', label: 'created' },
              { value: 'updated', label: 'updated' },
              { value: 'deleted', label: 'deleted' },
            ]}
          />
          <Input label="Search" value={q} onChange={setQ} placeholder="Search summary…" />
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <Button variant="primary" onClick={load} disabled={loading}>
              Apply
            </Button>
          </div>
        </div>
      </Card>

      {error ? (
        <Alert variant="error" title="Failed to load audit">
          {error}
        </Alert>
      ) : null}

      <Card>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)', marginBottom: 8 }}>
            {loading ? 'Loading…' : `${items.length} events`}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((it) => (
              <div
                key={it.id}
                style={{
                  padding: 12,
                  border: '1px solid var(--hit-border, #e5e7eb)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{it.summary}</div>
                  <div style={{ fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)', whiteSpace: 'nowrap' }}>
                    {new Date(it.createdAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)' }}>
                  {it.action} · {it.entityKind}
                  {it.entityId ? `:${it.entityId}` : ''}
                  {it.packName ? ` · ${it.packName}` : ''}
                  {it.correlationId ? ` · trace:${it.correlationId}` : ''}
                  {it.actorName || it.actorId ? ` · ${it.actorName || it.actorId}` : ''}
                </div>
              </div>
            ))}
            {!loading && items.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--hit-text-muted, #9ca3af)' }}>No events found.</div>
            ) : null}
          </div>
        </div>
      </Card>
    </Page>
  );
}

export default AuditLogList;

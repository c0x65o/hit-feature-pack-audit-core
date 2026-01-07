'use client';

import React from 'react';
import { useUi } from '@hit/ui-kit';

type AuditChange = {
  field: string;
  from: any;
  to: any;
};

type AuditItem = {
  id: string;
  entityKind: string;
  entityId: string | null;
  action: string;
  summary: string;
  details: { changes?: AuditChange[]; [key: string]: any } | null;
  actorId: string | null;
  actorName: string | null;
  actorType: string;
  correlationId: string | null;
  createdAt: string;
};

function formatValue(val: any): string {
  if (val === null || val === undefined) return '(empty)';
  if (Array.isArray(val)) {
    if (val.length === 0) return '(none)';
    return val.join(', ');
  }
  return String(val);
}

function ChangeRow({ change }: { change: AuditChange }) {
  return (
    <div style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--hit-border, #e5e7eb)' }}>
      <div style={{ fontWeight: 500, color: 'var(--hit-text, #111827)' }}>{change.field}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <span style={{ color: 'var(--hit-danger, #ef4444)', textDecoration: 'line-through' }}>
          {formatValue(change.from)}
        </span>
        <span style={{ color: 'var(--hit-text-muted, #9ca3af)' }}>→</span>
        <span style={{ color: 'var(--hit-success, #22c55e)' }}>{formatValue(change.to)}</span>
      </div>
    </div>
  );
}

export function AuditTrail(props: { entityKind: string; entityId: string }) {
  const { Card } = useUi();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<AuditItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

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
        if (!res.ok) throw new Error(json?.error || `Failed to load audit (${res.status})`);
        const rows = Array.isArray(json?.items) ? (json.items as any[]) : [];
        if (!cancelled) setItems(rows as AuditItem[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (props.entityKind && props.entityId) load();
    return () => {
      cancelled = true;
    };
  }, [props.entityKind, props.entityId]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Audit Trail</div>
          <div style={{ fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)' }}>
            {loading ? 'Loading…' : `${items.length} events`}
          </div>
        </div>

        {error ? (
          <div style={{ fontSize: 13, color: 'var(--hit-danger, #ef4444)' }}>{error}</div>
        ) : items.length === 0 && !loading ? (
          <div style={{ fontSize: 13, color: 'var(--hit-text-muted, #9ca3af)' }}>No audit events yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((it) => {
              const changes = it.details?.changes;
              const hasChanges = Array.isArray(changes) && changes.length > 0;
              const isExpanded = expandedIds.has(it.id);
              const actorLabel = it.actorName || it.actorId || it.actorType || 'unknown';
              const metaBits = [it.action, actorLabel, it.correlationId ? `trace:${it.correlationId}` : null].filter(Boolean);

              return (
                <div
                  key={it.id}
                  style={{
                    padding: 12,
                    border: '1px solid var(--hit-border, #e5e7eb)',
                    borderRadius: 8,
                    cursor: hasChanges ? 'pointer' : 'default',
                  }}
                  onClick={() => hasChanges && toggleExpand(it.id)}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {hasChanges && (
                        <span style={{ fontSize: 10, color: 'var(--hit-text-muted, #9ca3af)' }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}
                      {it.summary}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)', whiteSpace: 'nowrap' }}>
                      {new Date(it.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--hit-text-muted, #9ca3af)' }}>
                    {metaBits.join(' · ')}
                  </div>

                  {isExpanded && hasChanges && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hit-border, #e5e7eb)' }}>
                      {changes!.map((change, idx) => (
                        <ChangeRow key={idx} change={change} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

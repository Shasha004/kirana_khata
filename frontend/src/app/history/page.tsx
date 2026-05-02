'use client';

import { useEffect, useState } from 'react';
import { HistoryTable } from '../../components/history/HistoryTable';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { getHistory } from '../../lib/api';
import type { HistoryRecord } from '../../types/underwriting';
import { formatINR } from '../../lib/format';

type Filter = 'all' | 'approve' | 'review' | 'reject';

function SkeletonRow() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '9% 18% 14% 13% 13% 11% 11% 8% 13%',
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        gap: 0,
        alignItems: 'center',
      }}
    >
      {[60, 120, 90, 80, 80, 50, 60, 55, 90].map((w, i) => (
        <div
          key={i}
          className="shimmer"
          style={{
            height: 12,
            width: w,
            borderRadius: 4,
          }}
        />
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await getHistory();
    if (!res.success || !res.data) {
      setError(res.error ?? 'Failed to load history');
    } else {
      setRecords(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered =
    filter === 'all' ? records : records.filter((r) => r.decision === filter);

  // Summary stats
  const totalRevenue = records.reduce((s, r) => s + r.monthly_revenue, 0);
  const totalLoan = records.reduce((s, r) => s + r.loan_amount, 0);
  const approveCount = records.filter((r) => r.decision === 'approve').length;
  const avgConfidence =
    records.length > 0
      ? records.reduce((s, r) => s + r.confidence, 0) / records.length
      : 0;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px 80px' }}>
      {/* Title */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div className="accent-line" />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            Assessment History
          </span>
        </div>
        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 32,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
          }}
        >
          Underwriting Pipeline
        </h1>
      </div>

      {/* Stats bar */}
      {!loading && records.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            marginBottom: 24,
            animation: 'fadeIn 0.5s ease',
          }}
        >
          {[
            { label: 'Total Cases', value: String(records.length), accent: false },
            {
              label: 'Approved',
              value: `${approveCount} (${records.length > 0 ? Math.round((approveCount / records.length) * 100) : 0}%)`,
              accent: false,
              color: 'var(--success)',
            },
            {
              label: 'Portfolio Revenue',
              value: formatINR(totalRevenue),
              accent: true,
            },
            {
              label: 'Sanctioned Amount',
              value: formatINR(totalLoan),
              accent: false,
            },
            {
              label: 'Avg Confidence',
              value: `${(avgConfidence * 100).toFixed(1)}%`,
              accent: false,
              color:
                avgConfidence >= 0.75
                  ? 'var(--success)'
                  : avgConfidence >= 0.58
                  ? 'var(--warning)'
                  : 'var(--danger)',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="card"
              style={{ padding: '16px 18px' }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 6,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 20,
                  fontWeight: 800,
                  color: stat.color ?? (stat.accent ? 'var(--accent)' : 'var(--text-primary)'),
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters + refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 6,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 4,
          }}
        >
          {(['all', 'approve', 'review', 'reject'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px',
                borderRadius: 5,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
                background: filter === f ? 'var(--accent)' : 'transparent',
                color: filter === f ? '#0a0f1e' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              {f === 'all'
                ? `All (${records.length})`
                : f === 'approve'
                ? `Approved (${records.filter((r) => r.decision === 'approve').length})`
                : f === 'review'
                ? `Review (${records.filter((r) => r.decision === 'review').length})`
                : `Rejected (${records.filter((r) => r.decision === 'reject').length})`}
            </button>
          ))}
        </div>

        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid var(--border-bright)',
            borderRadius: 7,
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            opacity: loading ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          }}
        >
          {loading ? (
            <LoadingSpinner size={14} color="var(--accent)" />
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorBanner message={error} onRetry={load} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Header skeleton */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '9% 18% 14% 13% 13% 11% 11% 8% 13%',
              padding: '10px 20px',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-bright)',
            }}
          >
            {['Case ID', 'Store', 'Owner', 'Monthly Rev.', 'Loan Amount', 'Confidence', 'Risk', 'Decision', 'Date'].map(
              (h) => (
                <div
                  key={h}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {h}
                </div>
              )
            )}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : (
        <HistoryTable records={filtered} />
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { UnderwritingResult } from '../../types/underwriting';
import { formatINR, formatDate, formatConfidence } from '../../lib/format';
import { ConfidenceMeter } from './ConfidenceMeter';
import { FraudFlags } from './FraudFlags';
import { LoanSizing } from './LoanSizing';
import { FeatureScores } from './FeatureScores';

interface ResultCardProps {
  result: UnderwritingResult;
}

function AnimatedNumber({
  target,
  prefix = '',
  suffix = '',
  formatter,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  formatter?: (v: number) => string;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 1200;

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [target]);

  return (
    <>
      {prefix}
      {formatter ? formatter(value) : value.toLocaleString('en-IN')}
      {suffix}
    </>
  );
}

const DECISION_CONFIG = {
  approve: {
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    border: 'rgba(16,185,129,0.2)',
    label: 'APPROVE',
    glow: 'rgba(16,185,129,0.15)',
  },
  review: {
    color: 'var(--review)',
    bg: 'var(--review-bg)',
    border: 'rgba(99,102,241,0.2)',
    label: 'MANUAL REVIEW',
    glow: 'rgba(99,102,241,0.15)',
  },
  reject: {
    color: 'var(--danger)',
    bg: 'var(--danger-bg)',
    border: 'rgba(239,68,68,0.2)',
    label: 'REJECT',
    glow: 'rgba(239,68,68,0.15)',
  },
};

export function ResultCard({ result }: ResultCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cfg = DECISION_CONFIG[result.decision];

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div
      ref={ref}
      style={{
        animation: 'slideUp 0.6s ease forwards',
        scrollMarginTop: 80,
      }}
    >
      {/* Header strip */}
      <div
        style={{
          padding: '20px 28px',
          background: 'var(--bg-card)',
          border: `1px solid ${cfg.border}`,
          borderBottom: 'none',
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 0% 50%, ${cfg.glow} 0%, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
            >
              {result.store_name}
            </div>
            <div
              style={{
                padding: '3px 12px',
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 800,
                color: cfg.color,
                letterSpacing: '0.08em',
              }}
            >
              {cfg.label}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{result.owner_name}</span>
            <span style={{ color: 'var(--border-bright)' }}>·</span>
            <span>Case #{result.id}</span>
            <span style={{ color: 'var(--border-bright)' }}>·</span>
            <span>{formatDate(result.created_at)}</span>
            <span style={{ color: 'var(--border-bright)' }}>·</span>
            <span>{result.images_count} images analysed</span>
          </div>
        </div>

        {/* Risk score */}
        <div
          style={{
            textAlign: 'center',
            padding: '10px 20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 2,
            }}
          >
            Risk Score
          </div>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 32,
              fontWeight: 800,
              color:
                result.risk_score < 35
                  ? 'var(--success)'
                  : result.risk_score < 60
                  ? 'var(--warning)'
                  : 'var(--danger)',
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            <AnimatedNumber target={result.risk_score} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>/ 100</div>
        </div>
      </div>

      {/* KPI bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: 'var(--bg-secondary)',
          border: `1px solid ${cfg.border}`,
          borderTop: `1px solid var(--border)`,
          borderBottom: 'none',
        }}
      >
        {[
          {
            label: 'Monthly Revenue',
            value: result.monthly_revenue,
            formatter: (v: number) => formatINR(v),
            accent: true,
          },
          {
            label: 'Monthly Profit',
            value: result.monthly_profit,
            formatter: (v: number) => formatINR(v),
            accent: false,
          },
          {
            label: 'Confidence',
            value: result.confidence * 100,
            formatter: (v: number) => `${v.toFixed(1)}%`,
            accent: false,
          },
          {
            label: 'Fraud Flags',
            value: result.fraud_flags.length,
            formatter: (v: number) => String(v),
            accent: false,
            danger: result.fraud_flags.length > 0,
          },
        ].map((item, i) => (
          <div
            key={item.label}
            style={{
              padding: '16px 20px',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              position: 'relative',
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 4,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 20,
                fontWeight: 800,
                color: item.danger
                  ? 'var(--danger)'
                  : item.accent
                  ? 'var(--accent)'
                  : 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              <AnimatedNumber target={item.value} formatter={item.formatter} />
            </div>
          </div>
        ))}
      </div>

      {/* Main content grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          border: `1px solid ${cfg.border}`,
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden',
        }}
      >
        {/* Left column */}
        <div
          style={{
            padding: 24,
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          {/* Confidence */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 16,
              }}
            >
              Underwriting Confidence
            </div>
            <ConfidenceMeter value={result.confidence} />
          </div>

          <div
            style={{ height: 1, background: 'var(--border)' }}
          />

          {/* Feature scores */}
          <FeatureScores scores={result.feature_scores} />
        </div>

        {/* Right column */}
        <div
          style={{
            background: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          <div style={{ padding: 24, borderBottom: '1px solid var(--border)' }}>
            <LoanSizing data={result.loan_sizing} decision={result.decision} />
          </div>
          <div style={{ padding: 24 }}>
            <FraudFlags flags={result.fraud_flags} />
          </div>
        </div>
      </div>

      {/* Location footer */}
      <div
        style={{
          marginTop: 12,
          padding: '10px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        GPS verified:{' '}
        <code style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
          {result.location.lat.toFixed(6)}, {result.location.lng.toFixed(6)}
        </code>
        {result.location.accuracy && (
          <span style={{ marginLeft: 4 }}>
            · ±{Math.round(result.location.accuracy)}m accuracy
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          Confidence: {formatConfidence(result.confidence)}
        </span>
      </div>
    </div>
  );
}

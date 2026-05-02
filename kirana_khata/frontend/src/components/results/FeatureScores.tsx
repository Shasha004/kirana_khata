'use client';

import { useEffect, useState } from 'react';
import type { FeatureScore } from '../../types/underwriting';

interface FeatureScoresProps {
  scores: FeatureScore[];
}

function ScoreBar({ score, delay }: { score: FeatureScore; delay: number }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const start = performance.now();
      const duration = 900;

      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setAnimated(Math.round(ease * score.score));
        if (p < 1) requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    }, delay);

    return () => clearTimeout(timer);
  }, [score.score, delay]);

  const color =
    score.score >= 75
      ? 'var(--success)'
      : score.score >= 55
      ? 'var(--accent)'
      : 'var(--danger)';

  const grade =
    score.score >= 80 ? 'A' : score.score >= 65 ? 'B' : score.score >= 50 ? 'C' : 'D';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
        animation: `fadeIn 0.5s ease ${delay}ms both`,
      }}
    >
      {/* Grade badge */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: `${color}15`,
          border: `1px solid ${color}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          color,
          flexShrink: 0,
          fontFamily: 'Syne, sans-serif',
        }}
      >
        {grade}
      </div>

      {/* Name + bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 5,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {score.label}
          </span>
          <span
            style={{
              fontSize: 13,
              color,
              fontWeight: 700,
              fontFamily: 'Syne, sans-serif',
              marginLeft: 8,
              flexShrink: 0,
            }}
          >
            {animated}
          </span>
        </div>
        {/* Track */}
        <div
          style={{
            height: 5,
            background: 'var(--bg-elevated)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${animated}%`,
              background: `linear-gradient(90deg, ${color}80, ${color})`,
              borderRadius: 3,
              transition: 'width 0.05s linear',
              boxShadow: `0 0 6px ${color}50`,
            }}
          />
        </div>
      </div>

      {/* Weight */}
      <div
        style={{
          width: 36,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            fontWeight: 600,
          }}
        >
          ×{score.weight.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function FeatureScores({ scores }: FeatureScoresProps) {
  const weighted = scores.reduce(
    (acc, s) => acc + s.score * s.weight,
    0
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              fontSize: 14,
              color: 'var(--text-primary)',
            }}
          >
            Feature Scores
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          Weighted avg:{' '}
          <span
            style={{
              color: 'var(--accent)',
              fontWeight: 700,
            }}
          >
            {weighted.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Header row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '0 0 8px 0',
          borderBottom: '1px solid var(--border-bright)',
          marginBottom: 2,
        }}
      >
        <div style={{ width: 28, flexShrink: 0 }} />
        <div
          style={{
            flex: 1,
            fontSize: 10,
            color: 'var(--text-muted)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Signal
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            width: 36,
            textAlign: 'right',
          }}
        >
          Wt.
        </div>
      </div>

      {scores.map((s, i) => (
        <ScoreBar key={s.name} score={s} delay={i * 80} />
      ))}
    </div>
  );
}

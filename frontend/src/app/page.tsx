'use client';

import { useState, useEffect } from 'react';
import { ImageUpload } from '../components/upload/ImageUpload';
import { GpsInput } from '../components/upload/GpsInput';
import { ResultCard } from '../components/results/ResultCard';
import { ErrorBanner } from '../components/ui/ErrorBanner';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useUnderwrite } from '../hooks/useUnderwrite';
import type { GpsCoordinates } from '../types/underwriting';

const REQUIRED_IMAGES = 5;

const FACTS = [
  {
    title: "India's Retail Backbone 🇮🇳",
    text: "India is home to over 12 million Kirana stores. They handle more than 90% of the country's grocery retail market and represent a $500B financial ecosystem."
  },
  {
    title: "Computer Vision Inventory 📦",
    text: "Our backend uses YOLOv8 (You Only Look Once) to run deep object detection. It scans and counts up to 300+ items per shelf image in under 500 milliseconds!"
  },
  {
    title: "Shelf Density Index (SDI) 🏷️",
    text: "A well-stocked shelf is a reliable proxy for consistent daily revenue. The system automatically measures Saturation, Uniformity, and Depth to score store health."
  },
  {
    title: "Cross-Signal Fraud Detection 🛡️",
    text: "The pipeline detects sophisticated fraud like duplicate uploads, blurry exposures, or claims of massive shop sizes that don't match detected shelf products."
  },
  {
    title: "Geospatial Intelligence 🌍",
    text: "By utilizing coordinates, the Geo-Extractor models population densities, local points of interest, and competition proximity within concentric 200m, 500m, and 1km bands."
  },
  {
    title: "Dynamic Uncertainty Bands 📈",
    text: "Instead of a single revenue estimate, we compute dynamic uncertainty margins that shrink or widen based on the store's age and alignment of credit signals."
  }
];

export default function HomePage() {
  const [images, setImages] = useState<File[]>([]);
  const [gps, setGps] = useState<GpsCoordinates | null>(null);

  // Optional Inputs
  const [shopSize, setShopSize] = useState<string>('');
  const [rent, setRent] = useState<string>('');
  const [yearsInOperation, setYearsInOperation] = useState<string>('');

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { status, result, error, submit, reset } = useUnderwrite();

  const [factIndex, setFactIndex] = useState(0);

  const isLoading = status === 'uploading' || status === 'analyzing';

  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % FACTS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const validate = (): boolean => {
    const errs: string[] = [];
    if (images.length < REQUIRED_IMAGES) {
      errs.push(`Upload exactly ${REQUIRED_IMAGES} store images (${images.length} uploaded)`);
    }
    if (!gps) {
      errs.push('GPS coordinates are required');
    }
    setValidationErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!gps) return;
    setValidationErrors([]);

    const optional = {
      ...(shopSize && { shop_size: Number(shopSize) }),
      ...(rent && { rent: Number(rent) }),
      ...(yearsInOperation && { years_in_operation: Number(yearsInOperation) }),
    };

    await submit(images, gps, optional);
  };

  const handleReset = () => {
    setImages([]);
    setGps(null);
    setShopSize('');
    setRent('');
    setYearsInOperation('');
    setValidationErrors([]);
    reset();
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px 80px' }}>
      {/* Page title */}
      <div style={{ marginBottom: 40 }}>
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
            Cash Flow Underwriting
          </span>
        </div>
        <h1
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 36,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            marginBottom: 10,
          }}
        >
          New Store Assessment
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 520 }}>
          Upload store images and capture GPS location. AI analyzes inventory density,
          footfall signals, and store health to generate an underwriting decision.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Left: Form or Loading Screen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {isLoading ? (
            <div
              className="card"
              style={{
                padding: '36px 24px',
                background: 'rgba(10, 15, 30, 0.4)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-bright)',
                borderRadius: 16,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 24,
                position: 'relative',
                overflow: 'hidden',
                animation: 'fadeIn 0.3s ease',
              }}
            >
              {/* Animated scanning bar */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
                  animation: 'scanLine 3s linear infinite',
                }}
              />
              
              <style>{`
                @keyframes scanLine {
                  0% { top: 0%; opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; }
                  100% { top: 100%; opacity: 0; }
                }
                @keyframes pulseRadar {
                  0% { transform: scale(0.9); opacity: 0.2; }
                  50% { transform: scale(1.15); opacity: 0.6; }
                  100% { transform: scale(0.9); opacity: 0.2; }
                }
                @keyframes bounceDot {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-4px); }
                }
              `}</style>

              {/* Pulsing Visual Radar/Scan Icon */}
              <div
                style={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '2px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 24px var(--accent-glow)',
                }}
              >
                {/* Pulse ring */}
                <div
                  style={{
                    position: 'absolute',
                    top: -6,
                    left: -6,
                    right: -6,
                    bottom: -6,
                    borderRadius: '50%',
                    border: '1px dashed var(--accent)',
                    animation: 'pulseRadar 3.5s ease infinite',
                  }}
                />
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
                </svg>
              </div>

              {/* Title & dynamic progress pulsing indicators */}
              <div>
                <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.02em' }}>
                  {status === 'uploading' ? 'Uploading Store Views' : 'Running Deep ML Inference'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: 'var(--accent)' }}>
                  <span style={{ fontWeight: 600 }}>
                    {status === 'uploading' ? 'Saving files to temp server' : 'YOLOv8 & OpenCV counting stock'}
                  </span>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <span style={{ animation: 'bounceDot 1s infinite 0.1s', display: 'inline-block' }}>.</span>
                    <span style={{ animation: 'bounceDot 1s infinite 0.2s', display: 'inline-block' }}>.</span>
                    <span style={{ animation: 'bounceDot 1s infinite 0.3s', display: 'inline-block' }}>.</span>
                  </div>
                </div>
              </div>

              {/* Live Stage Stepper inside loader */}
              <div
                style={{
                  width: '100%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Processing Stages
                </div>
                {[
                  { step: "Stage 1", text: "Image parsing & brightness auto-boost", active: status === 'uploading' || status === 'analyzing', done: status === 'analyzing' },
                  { step: "Stage 2", text: "YOLOv8 deep item detection & categorization", active: status === 'analyzing', done: false },
                  { step: "Stage 3", text: "Shelf overlap-corrected density (SDI)", active: status === 'analyzing', done: false },
                  { step: "Stage 4", text: "Hough grid angle safety & MD5 duplication checks", active: status === 'analyzing', done: false },
                  { step: "Stage 5", text: "XGBoost local credit and footprint scoring", active: status === 'analyzing', done: false }
                ].map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: s.active ? 1 : 0.3, transition: 'all 0.3s' }}>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: s.done ? 'var(--success)' : s.active ? 'var(--accent)' : 'transparent',
                        border: `1px solid ${s.done ? 'var(--success)' : s.active ? 'var(--accent)' : 'var(--text-muted)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        color: s.done || s.active ? '#0a0f1e' : 'var(--text-muted)',
                        fontWeight: 700
                      }}
                    >
                      {s.done ? "✓" : idx + 1}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: s.active ? 600 : 400, color: s.active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {s.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '4px 0' }} />

              {/* Interactive Did You Know card */}
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.03)',
                  border: '1px solid rgba(99, 102, 241, 0.12)',
                  borderRadius: 12,
                  padding: 16,
                  width: '100%',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    💡 Did you know?
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {factIndex + 1} / {FACTS.length}
                  </span>
                </div>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {FACTS[factIndex].title}
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, minHeight: 54, margin: 0 }}>
                  {FACTS[factIndex].text}
                </p>

                {/* Manual Fact Navigation buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
                  <button
                    onClick={() => setFactIndex((prev) => (prev - 1 + FACTS.length) % FACTS.length)}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, outline: 'none' }}
                  >
                    ◀ Prev
                  </button>
                  <button
                    onClick={() => setFactIndex((prev) => (prev + 1) % FACTS.length)}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, outline: 'none' }}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Upload card */}
              <div
                className="card"
                style={{ padding: 24 }}
              >
                <ImageUpload images={images} onChange={setImages} />
              </div>

              {/* GPS card */}
              <div className="card" style={{ padding: 24 }}>
                <GpsInput value={gps} onChange={setGps} />
              </div>

              {/* Optional Details Card */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ fontWeight: 600, marginBottom: 16 }}>Store Details (Optional)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Shop Size (sq ft)</label>
                    <input
                      type="number"
                      value={shopSize}
                      onChange={(e) => setShopSize(e.target.value)}
                      placeholder="e.g. 200"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Monthly Rent (₹)</label>
                    <input
                      type="number"
                      value={rent}
                      onChange={(e) => setRent(e.target.value)}
                      placeholder="e.g. 15000"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Years in Operation</label>
                    <input
                      type="number"
                      value={yearsInOperation}
                      onChange={(e) => setYearsInOperation(e.target.value)}
                      placeholder="e.g. 5"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 10,
                    padding: '14px 18px',
                    animation: 'fadeIn 0.3s ease',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--danger)',
                      marginBottom: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Complete the following before submitting:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {validationErrors.map((e) => (
                      <li
                        key={e}
                        style={{
                          fontSize: 13,
                          color: 'var(--danger)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>›</span> {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* API error */}
              {status === 'error' && error && (
                <ErrorBanner message={error} onRetry={handleReset} />
              )}

              {/* Submit */}
              {status !== 'done' && (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: isLoading ? 'var(--accent-dim)' : 'var(--accent)',
                    border: 'none',
                    borderRadius: 10,
                    color: '#0a0f1e',
                    fontFamily: 'Syne, sans-serif',
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    transition: 'all 0.2s',
                    boxShadow: isLoading ? 'none' : '0 4px 24px var(--accent-glow)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        '0 8px 32px var(--accent-glow)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'none';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      isLoading ? 'none' : '0 4px 24px var(--accent-glow)';
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0a0f1e"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Run Underwriting Analysis
                </button>
              )}
            </>
          )}

          {status === 'done' && (
            <button
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: 'transparent',
                border: '1px solid var(--border-bright)',
                borderRadius: 10,
                color: 'var(--text-secondary)',
                fontFamily: 'Syne, sans-serif',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  'var(--border-bright)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
              </svg>
              New Assessment
            </button>
          )}
        </div>

        {/* Right: Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Progress tracker */}
          <div className="card" style={{ padding: 20 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 16,
              }}
            >
              Assessment Progress
            </div>

            {[
              {
                step: 1,
                label: 'Upload 5 store images',
                done: images.length === REQUIRED_IMAGES,
                partial: images.length > 0 && images.length < REQUIRED_IMAGES,
                detail: `${images.length}/${REQUIRED_IMAGES} images`,
              },
              {
                step: 2,
                label: 'Capture GPS location',
                done: !!gps,
                partial: false,
                detail: gps
                  ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
                  : 'Not captured',
              },
              {
                step: 3,
                label: 'Run AI analysis',
                done: status === 'done',
                partial: isLoading,
                detail:
                  status === 'uploading'
                    ? 'Uploading...'
                    : status === 'analyzing'
                      ? 'Analyzing...'
                      : status === 'done'
                        ? 'Complete'
                        : 'Pending',
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: item.done
                      ? 'var(--success)'
                      : item.partial
                        ? 'var(--accent)'
                        : 'var(--bg-elevated)',
                    border: `2px solid ${item.done ? 'var(--success)' : item.partial ? 'var(--accent)' : 'var(--border-bright)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.3s',
                  }}
                >
                  {item.done ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : item.partial ? (
                    <LoadingSpinner size={12} color="#0a0f1e" />
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {item.step}
                    </span>
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: item.done
                        ? 'var(--success)'
                        : item.partial
                          ? 'var(--accent)'
                          : 'var(--text-secondary)',
                      marginBottom: 2,
                      transition: 'color 0.3s',
                    }}
                  >
                    {item.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {item.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Info box */}
          <div
            className="card"
            style={{ padding: 18 }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 12,
              }}
            >
              What We Analyze
            </div>
            {[
              { icon: '📦', label: 'Shelf Density Index (SDI)' },
              { icon: '🏷️', label: 'SKU Diversity & Categories' },
              { icon: '🌍', label: 'Geo-Intelligence & Footfall' },
              { icon: '💸', label: 'Fast-Moving Inventory Value' },
              { icon: '🛡️', label: 'Cross-Signal Fraud Validation' },
              { icon: '📍', label: 'GPS vs Regional Tier Check' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>

          {/* Mock mode badge */}
          {process.env.NEXT_PUBLIC_MOCK_MODE === 'true' && (
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: 8,
                fontSize: 11,
                color: 'var(--review)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 500,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              MOCK MODE — using simulated API responses
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {status === 'done' && result && (
        <div style={{ marginTop: 48 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div className="accent-line" />
            <h2
              style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
            >
              Underwriting Result
            </h2>
            <div
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}
            >
              Generated in real-time
            </div>
          </div>
          <ResultCard result={result} />
        </div>
      )}
    </div>
  );
}

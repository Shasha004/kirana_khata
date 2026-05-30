'use client';

import { useCallback, useRef, useState } from 'react';

const MAX_IMAGES = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE_MB = 10;

const SLOT_INFO = [
  { label: 'Exterior', fullLabel: 'Front / Street View', text: 'Shop entrance and street view' },
  { label: 'Checkout Counter', fullLabel: 'Billing / Counter Area', text: 'Counter for fast-moving items & POS' },
  { label: 'Left Side Shelves', fullLabel: 'Left Interior Wall', text: 'Shelves on the left side of the store' },
  { label: 'Back Wall Shelves', fullLabel: 'Centre / Back Wall', text: 'Main back wall view for Shelf Density Index' },
  { label: 'Right Side Shelves', fullLabel: 'Right Interior Wall', text: 'Shelves on the right side of the store' }
];

interface ImageUploadProps {
  images: File[];
  onChange: (files: File[]) => void;
}

export function ImageUpload({ images, onChange }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      setError(null);

      const arr = Array.from(incoming);

      const filtered = arr.filter((f) => {
        if (!ACCEPTED.includes(f.type) && !f.name.toLowerCase().endsWith('.heic')) {
          setError(`"${f.name}" is not a supported image type`);
          return false;
        }
        if (f.size > MAX_SIZE_MB * 1024 * 1024) {
          setError(`"${f.name}" exceeds ${MAX_SIZE_MB}MB limit`);
          return false;
        }
        return true;
      });

      const merged = [...images, ...filtered].slice(0, MAX_IMAGES);

      // 🔥 NO backend call here
      onChange(merged);
    },
    [images, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleRemove = (idx: number) => {
    const next = images.filter((_, i) => i !== idx);
    onChange(next);
    setError(null);
  };

  const slots = Array.from({ length: MAX_IMAGES });

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <label style={{ fontWeight: 600, fontSize: 14 }}>
            Store Images
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12, marginLeft: 6 }}>
              (Exactly 5 required)
            </span>
          </label>
        </div>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: images.length === MAX_IMAGES ? 'var(--success)' : 'var(--text-muted)',
          background: images.length === MAX_IMAGES ? 'var(--success-bg)' : 'var(--bg-elevated)',
          padding: '3px 10px',
          borderRadius: 20,
          border: `1px solid ${images.length === MAX_IMAGES ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
        }}>{images.length} / {MAX_IMAGES}</span>
      </div>

      {/* Drop zone */}
      {images.length < MAX_IMAGES && (
        <div
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-bright)'}`,
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
            background: dragging ? 'var(--accent-glow)' : 'var(--bg-elevated)',
            transition: 'all 0.2s',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block' }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
            {dragging ? 'Drop images here' : 'Click or drag images to upload'}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED.join(',')}
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>
      )}

      {/* Image grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {slots.map((_, idx) => {
          const file = images[idx];

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  aspectRatio: '1',
                  border: `1px solid ${file ? 'var(--success)' : 'var(--border)'}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                  position: 'relative',
                  width: '100%',
                  background: file ? 'transparent' : 'var(--bg-elevated)',
                  transition: 'border-color 0.2s',
                }}
              >
                {file ? (
                  <>
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    {/* Green checkmark overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'var(--success)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(16,185,129,0.3)',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>

                    <button
                      onClick={() => handleRemove(idx)}
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        background: 'rgba(239,68,68,0.9)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 20,
                        height: 20,
                        cursor: 'pointer',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        boxShadow: '0 2px 6px rgba(239,68,68,0.3)',
                      }}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '30%', color: 'var(--text-muted)', fontSize: 12, paddingLeft: 8, paddingRight: 8 }}>
                    <div style={{
                      fontSize: 18,
                      marginBottom: 4,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 6px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}>{idx + 1}</div>
                    <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-muted)' }}>{SLOT_INFO[idx].label}</div>
                  </div>
                )}
              </div>

              {/* Numbered purple label */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: file ? 'var(--success)' : 'var(--accent)',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {file ? '✓' : idx + 1}
                  </span>
                  <span
                    style={{
                      lineHeight: 1.3,
                      color: 'var(--text-primary)',
                      fontWeight: 700,
                    }}
                  >
                    {SLOT_INFO[idx].label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    lineHeight: 1.3,
                    paddingLeft: 2,
                  }}
                >
                  {SLOT_INFO[idx].text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          color: 'var(--danger)',
          marginTop: 10,
          fontSize: 12,
          background: 'var(--danger-bg)',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid rgba(239,68,68,0.2)',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
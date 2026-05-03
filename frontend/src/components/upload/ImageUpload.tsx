'use client';

import { useCallback, useRef, useState } from 'react';

const MAX_IMAGES = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE_MB = 10;

const SLOT_INFO = [
  { label: 'Front / Street View', text: 'Upload the exterior showing the shop entrance and street (used for signage & footfall proxy)' },
  { label: 'Billing / Counter Area', text: 'Upload the checkout counter (used for fast-moving items & POS detection)' },
  { label: 'Left Interior Wall', text: 'Upload the shelves on the left side of the store' },
  { label: 'Centre / Back Wall', text: 'Upload the main back wall shelves (primary view for Shelf Density Index)' },
  { label: 'Right Interior Wall', text: 'Upload the shelves on the right side of the store' }
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
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <label style={{ fontWeight: 600 }}>
          Store Images (Exactly 5 required)
        </label>
        <span>{images.length} / {MAX_IMAGES}</span>
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
            border: `2px dashed ${dragging ? '#4f46e5' : '#ccc'}`,
            borderRadius: 10,
            padding: 20,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 14,
          }}
        >
          <p>{dragging ? 'Drop images here' : 'Click or drag images'}</p>
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
                  border: '1px solid #ccc',
                  borderRadius: 8,
                  overflow: 'hidden',
                  position: 'relative',
                  width: '100%',
                }}
              >
                {file ? (
                  <>
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />

                    <button
                      onClick={() => handleRemove(idx)}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        background: 'red',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: 22,
                        height: 22,
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '30%', color: '#999', fontSize: 12, paddingLeft: 8, paddingRight: 8 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{idx + 1}</div>
                    <div style={{ fontWeight: 600 }}>{SLOT_INFO[idx].label}</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                <span style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  width: 14, 
                  height: 14, 
                  borderRadius: '50%', 
                  background: 'var(--bg-elevated)', 
                  border: '1px solid var(--border)', 
                  fontSize: 9, 
                  fontWeight: 'bold', 
                  color: 'var(--text-secondary)',
                  flexShrink: 0
                }}>i</span>
                <span style={{ lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 700, color: 'var(--danger)', marginRight: 4 }}>
                    (MANDATORY)
                  </span>
                  {SLOT_INFO[idx].text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: 'red', marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
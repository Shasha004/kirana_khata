'use client';

import { useCallback, useRef, useState } from 'react';

const MAX_IMAGES = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE_MB = 10;

/** Labels for the five required store-view image slots. */
const SLOT_LABELS = ['Front', 'Billing Area', 'Left Wall', 'Centre Wall', 'Right Wall'] as const;

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
            <div
              key={idx}
              style={{
                aspectRatio: '1',
                border: '1px solid #ccc',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
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
                <div style={{ textAlign: 'center', paddingTop: 20, color: '#999', fontSize: 12 }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{idx + 1}</div>
                  {SLOT_LABELS[idx]}
                </div>
              )}
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
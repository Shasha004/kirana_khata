'use client';

import { useCallback, useRef, useState } from 'react';
import { addImages } from '../../lib/api';

const MAX_IMAGES = 5;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE_MB = 10;

interface ImageUploadProps {
  images: File[];
  onChange: (files: File[]) => void;
}

export function ImageUpload({ images, onChange }: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
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
      onChange(merged);
      
      // Upload images to database if we have 5 images
      if (merged.length === MAX_IMAGES) {
        setUploading(true);
        const result = await addImages(merged);
        if (!result.success) {
          setError(result.error || 'Failed to upload images');
        }
        setUploading(false);
      }
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <label
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--text-primary)',
          }}
        >
          Store Images
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 400,
              fontFamily: 'DM Sans, sans-serif',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Exactly 5 required
          </span>
        </label>
        <span
          style={{
            fontSize: 12,
            color:
              images.length === MAX_IMAGES
                ? 'var(--success)'
                : 'var(--text-muted)',
            fontWeight: 600,
            transition: 'color 0.3s',
          }}
        >
          {images.length} / {MAX_IMAGES}
        </span>
      </div>

      {/* Drop zone */}
      {images.length < MAX_IMAGES && !uploading && (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-bright)'}`,
            borderRadius: 10,
            padding: '24px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'var(--accent-glow)' : 'var(--bg-secondary)',
            transition: 'all 0.2s ease',
            marginBottom: 14,
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke={dragging ? 'var(--accent)' : 'var(--text-muted)'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ margin: '0 auto 8px', display: 'block', transition: 'stroke 0.2s' }}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div
            style={{
              fontSize: 13,
              color: dragging ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: 500,
              transition: 'color 0.2s',
            }}
          >
            {dragging ? 'Drop images here' : 'Drag & drop images or click to browse'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            JPG, PNG, WEBP · Max {MAX_SIZE_MB}MB each
          </div>
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 10,
        }}
      >
        {slots.map((_, idx) => {
          const file = images[idx];
          return (
            <div
              key={idx}
              style={{
                aspectRatio: '1',
                borderRadius: 8,
                border: `1px solid ${file ? 'var(--border-bright)' : 'var(--border)'}`,
                background: file ? 'transparent' : 'var(--bg-secondary)',
                overflow: 'hidden',
                position: 'relative',
                transition: 'border-color 0.2s',
              }}
            >
              {file ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Store image ${idx + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0)',
                      transition: 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        'rgba(0,0,0,0.55)';
                      const btn = (e.currentTarget as HTMLDivElement).querySelector(
                        'button'
                      ) as HTMLButtonElement | null;
                      if (btn) btn.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        'rgba(0,0,0,0)';
                      const btn = (e.currentTarget as HTMLDivElement).querySelector(
                        'button'
                      ) as HTMLButtonElement | null;
                      if (btn) btn.style.opacity = '0';
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(idx);
                      }}
                      style={{
                        background: 'var(--danger)',
                        border: 'none',
                        borderRadius: '50%',
                        width: 26,
                        height: 26,
                        color: '#fff',
                        fontSize: 14,
                        cursor: 'pointer',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      left: 4,
                      background: 'rgba(0,0,0,0.65)',
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontSize: 10,
                      color: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    {idx + 1}
                  </div>
                </>
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: '1.5px dashed var(--border-bright)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      color: 'var(--text-muted)',
                    }}
                  >
                    {idx + 1}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

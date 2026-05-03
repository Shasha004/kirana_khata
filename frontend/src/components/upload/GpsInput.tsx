'use client';

import { useState } from 'react';
import type { GpsCoordinates } from '../../types/underwriting';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { addLocation } from '../../lib/api';

interface GpsInputProps {
  value: GpsCoordinates | null;
  onChange: (coords: GpsCoordinates | null) => void;
}

export function GpsInput({ value, onChange }: GpsInputProps) {
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported in this browser');
      return;
    }

    setLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        onChange(coords);
        
        // Save location to database
        await addLocation(coords.lat, coords.lng, { accuracy: coords.accuracy });
        setLoading(false);
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Location permission denied. Use manual entry.'
            : 'Unable to determine location. Try again or use manual entry.'
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const applyManual = async () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setGeoError('Invalid coordinates. Latitude: −90 to 90, Longitude: −180 to 180');
      return;
    }

    setGeoError(null);
    onChange({ lat, lng });
    
    // Save location to database
    await addLocation(lat, lng);
  };

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
          Store Location
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
            GPS required
          </span>
        </label>

        {/* Mode toggle */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {(['auto', 'manual'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setGeoError(null);
              }}
              style={{
                padding: '5px 14px',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: 'none',
                cursor: 'pointer',
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? '#0a0f1e' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              {m === 'auto' ? 'Auto' : 'Manual'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'auto' ? (
        <div>
          <button
            onClick={detectLocation}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: value
                ? 'var(--success-bg)'
                : 'var(--bg-secondary)',
              border: `1px solid ${value ? 'rgba(16,185,129,0.3)' : 'var(--border-bright)'}`,
              borderRadius: 8,
              color: value ? 'var(--success)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <>
                <LoadingSpinner size={16} color="var(--accent)" />
                Acquiring GPS signal...
              </>
            ) : value ? (
              <>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Location acquired
              </>
            ) : (
              <>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                Detect My Location
              </>
            )}
          </button>

          {value && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 16,
                padding: '8px 12px',
                background: 'var(--bg-secondary)',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              <CoordPill label="LAT" value={value.lat.toFixed(6)} />
              <CoordPill label="LNG" value={value.lng.toFixed(6)} />
              {value.accuracy && (
                <CoordPill
                  label="ACC"
                  value={`±${Math.round(value.accuracy)}m`}
                />
              )}
              <button
                onClick={() => onChange(null)}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: '0 4px',
                }}
                aria-label="Clear location"
              >
                ×
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="Latitude (e.g. 28.6139)"
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            className="input-base"
            style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
          />
          <input
            type="text"
            placeholder="Longitude (e.g. 77.2090)"
            value={manualLng}
            onChange={(e) => setManualLng(e.target.value)}
            className="input-base"
            style={{ flex: 1, padding: '10px 14px', fontSize: 13 }}
          />
          <button
            onClick={applyManual}
            style={{
              padding: '10px 18px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: '#0a0f1e',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Set
          </button>
        </div>
      )}

      {geoError && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {geoError}
        </div>
      )}
    </div>
  );
}

function CoordPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span
        style={{
          fontSize: 9,
          color: 'var(--text-muted)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          fontWeight: 500,
          fontFamily: 'monospace',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// 🔥 FINAL PRODUCTION-SAFE API LAYER

import type {
  UnderwriteRequest,
  UnderwriteApiResponse,
  HistoryApiResponse,
} from '../types/underwriting';

import { supabase } from './supabase';
import { fetchHistory } from './db';

// ==============================
// 🔥 MAIN API CALL (FINAL)
// ==============================

export async function submitUnderwrite(
  req: UnderwriteRequest
): Promise<UnderwriteApiResponse> {
  try {
    const formData = new FormData();

    // ✅ Validate images
    if (!req.images || req.images.length < 5) {
      throw new Error("Please upload all 5 required images");
    }

    // 🔥 Image mapping
    formData.append("storefront", req.images[0]);
    formData.append("interior_wide", req.images[1]);
    formData.append("shelf_close", req.images[2]);
    formData.append("billing_area", req.images[3]);
    formData.append("signage", req.images[4]);

    // 🔥 GPS
    formData.append("lat", req.gps.lat.toString());
    formData.append("lng", req.gps.lng.toString());

    // 🔥 Backend call
    const res = await fetch("http://127.0.0.1:8000/underwrite", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Backend error: ${errorText}`);
    }

    const raw = await res.json();
    const output = raw.underwriting_output || raw;

    // ==============================
    // 🔥 NORMALIZATION LAYER
    // ==============================

    // ✅ Fix decision casing
    const decision = (output.decision || "review").toLowerCase();

    // ✅ Inject location
    const location = {
      lat: req.gps.lat,
      lng: req.gps.lng,
      accuracy: 10,
    };

    // ✅ Feature scores (UI expects array)
    const scores = [
      {
        name: "Visual",
        label: "Visual Signal",
        score: Math.round((output.visual_score ?? 0) * 100),
        weight: 0.4,
      },
      {
        name: "Geo",
        label: "Geo Signal",
        score: Math.round((output.geo_score ?? 0) * 100),
        weight: 0.3,
      },
      {
        name: "Fraud",
        label: "Fraud Safety",
        score: Math.round((1 - (output.fraud_score ?? 0)) * 100),
        weight: 0.3,
      },
    ];

    // ✅ Simple working capital proxy → loan sizing
    const base = (output.visual_score ?? 0.5) * 50000;

    const loan_sizing = {
      recommended: Math.round(base * 6),
      minimum: Math.round(base * 3),
      maximum: Math.round(base * 9),
      tenure_months: 12,
      interest_rate: 18,
      emi: Math.round((base * 6 * 1.18) / 12),
    };

    // ✅ Final normalized object
    const normalized = {
      ...output,
      decision,
      location,
      scores,
      loan_sizing,

      // fallback fields
      risk_score: output.composite_score ?? 50,
      confidence: output.confidence ?? 0.5,
      store_name: output.store_id ?? "Unknown Store",
      owner_name: "Store Owner",
      id: Math.random().toString(36).slice(2, 10).toUpperCase(),
      created_at: new Date().toISOString(),
      images_count: req.images.length,

      fraud_flags: output.fraud_flags ?? [],

      breakdown: output.breakdown ?? {
        visual_contribution: 0,
        geo_contribution: 0,
        fraud_penalty: 0,
      },

      metadata: output.metadata ?? {},
    };

    return {
      success: true,
      data: normalized,
    };

  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ==============================
// 📊 HISTORY
// ==============================

export async function getHistory(): Promise<HistoryApiResponse> {
  try {
    const rows = await fetchHistory();
    return { success: true, data: rows };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load history',
    };
  }
}

// ==============================
// 📍 LOCATION
// ==============================

export async function addLocation(
  lat: number,
  lng: number,
  metadata?: Record<string, unknown>
) {
  try {
    const { data, error } = await supabase.from('locations').insert([
      {
        latitude: lat,
        longitude: lng,
        metadata,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) return { success: false, error: error.message };

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add location',
    };
  }
}
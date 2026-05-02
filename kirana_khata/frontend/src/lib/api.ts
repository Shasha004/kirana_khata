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

    // 🔥 Image mapping (must match backend /underwrite params)
    formData.append("front", req.images[0]);
    formData.append("billing_area", req.images[1]);
    formData.append("left_wall", req.images[2]);
    formData.append("centre_wall", req.images[3]);
    formData.append("right_wall", req.images[4]);

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

    // ✅ Decision: pipeline returns APPROVE/REVIEW/REJECT
    const rawDecision = (output.decision || output.recommendation || "review");
    const decisionMap: Record<string, string> = {
      APPROVE: "approve",
      REVIEW: "review",
      REJECT: "reject",
      approved: "approve",
      needs_verification: "review",
      rejected: "reject",
    };
    const decision = decisionMap[rawDecision] || rawDecision.toLowerCase();

    // ✅ Financial estimates from backend ranges (use midpoint)
    const revenueRange = output.monthly_revenue_range ?? [0, 0];
    const incomeRange = output.monthly_income_range ?? [0, 0];
    const monthly_revenue = Math.round((revenueRange[0] + revenueRange[1]) / 2);
    const monthly_profit = Math.round((incomeRange[0] + incomeRange[1]) / 2);

    // ✅ Confidence (pipeline field or transform field)
    const confidence = output.confidence ?? output.confidence_score ?? 0.5;

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

    // ✅ Loan sizing based on monthly revenue
    const loanBase = monthly_revenue || ((output.visual_score ?? 0.5) * 50000);

    const loan_sizing = {
      recommended: Math.round(loanBase * 6),
      minimum: Math.round(loanBase * 3),
      maximum: Math.round(loanBase * 9),
      tenure_months: 12,
      interest_rate: 18,
      emi: Math.round((loanBase * 6 * 1.18) / 12),
    };

    // ✅ Merge pipeline fraud_flags + risk_flags into unified array
    const pipelineFlags = (output.fraud_flags ?? []).map((f: any) =>
      typeof f === "string"
        ? { code: f, severity: "medium" as const, description: f }
        : f
    );
    const riskFlags = (output.risk_flags ?? []).map((r: string) => ({
      code: r,
      severity: "medium" as const,
      description: r.replace(/_/g, " "),
    }));
    const allFlags = [...pipelineFlags, ...riskFlags];

    // ✅ Risk score: composite_score scaled to 0-100 (lower = better)
    const compositeScore = output.composite_score ?? 0.5;
    const risk_score = Math.round((1 - compositeScore) * 100);

    // ✅ Final normalized object
    const normalized = {
      ...output,
      decision,
      location,
      feature_scores: scores,
      loan_sizing,
      monthly_revenue,
      monthly_profit,
      confidence,
      risk_score,

      store_name: output.store_id ?? "Unknown Store",
      owner_name: "Store Owner",
      id: Math.random().toString(36).slice(2, 10).toUpperCase(),
      created_at: new Date().toISOString(),
      images_count: req.images.length,

      fraud_flags: allFlags,

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
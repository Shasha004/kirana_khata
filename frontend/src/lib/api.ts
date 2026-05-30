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

// ==============================
// 🛠️ CLIENT-SIDE SIMULATOR LAYER (OFFLINE / HACKATHON DEMO)
// ==============================

function getMockUnderwrite(req: UnderwriteRequest): any {
  const shop_size = req.optional?.shop_size ?? 200;
  const rent = req.optional?.rent ?? 0;
  const years = req.optional?.years_in_operation ?? 2;

  // Visual/Geo/Fraud metrics
  const visual_score = 0.72 + (years >= 5 ? 0.1 : 0.0) - (shop_size > 800 ? 0.15 : 0);
  const geo_score = 0.65 + (req.gps.lat > 19.0 ? 0.08 : -0.05); // deterministic based on lat
  
  // Custom mock fraud flags
  const fraud_flags: any[] = [];
  const risk_flags: string[] = [];

  // Check advanced rules
  if (shop_size > 800) {
    fraud_flags.push({
      rule_id: "CROSS_SIZE_TO_ITEMS_MISMATCH",
      severity: "high",
      description: `Large shop size claimed (${shop_size} sq ft) but extremely few items detected.`,
    });
    risk_flags.push("claimed_size_vs_inventory_mismatch");
  }

  // Calculate estimated monthly revenue consistent with backend estimation
  const est_rev = Math.round(95000 * (1 + 0.3 * 3) * 30 * (0.5 + geo_score) * (0.8 + 0.6 * 0.5));
  if (rent > est_rev * 0.40) {
    fraud_flags.push({
      rule_id: "CROSS_RENT_TO_REVENUE_CRITICAL",
      severity: "critical",
      description: `Monthly rent (₹${rent.toLocaleString()}) is dangerously high relative to estimated store revenue (₹${est_rev.toLocaleString()}): ${Math.round((rent/est_rev)*100)}%.`,
    });
  }

  // Blurry check simulation (e.g. if shop size is exactly 999)
  if (shop_size === 999) {
    fraud_flags.push({
      rule_id: "VISUAL_IMAGE_BLURRY",
      severity: "high",
      description: "Extremely blurry images uploaded in slots: centre_wall.",
    });
  }
  // Duplicate check simulation (e.g. if shop size is exactly 888)
  if (shop_size === 888) {
    fraud_flags.push({
      rule_id: "VISUAL_IMAGE_DUPLICATED",
      severity: "critical",
      description: "Duplicate images detected: left_wall is identical to right_wall.",
    });
  }

  const fraud_score = fraud_flags.length > 0 ? Math.min(fraud_flags.reduce((sum, f) => {
    const w: Record<string, number> = { low: 0.15, medium: 0.4, high: 0.7, critical: 1.0 };
    return sum + (w[f.severity] ?? 0.4);
  }, 0) / 2.0, 1.0) : 0.05;

  const composite_score = Math.max(0, Math.min(1.0, (0.4 * visual_score + 0.35 * geo_score) - 0.25 * fraud_score));
  
  let decision = "REVIEW";
  if (composite_score >= 0.65 && !fraud_flags.some(f => f.severity === "critical")) {
    decision = "APPROVE";
  } else if (composite_score <= 0.35 || fraud_flags.some(f => f.severity === "critical")) {
    decision = "REJECT";
  }

  let confidence = (1 - Math.abs(visual_score - geo_score)) * (0.5 + 0.5 * Math.abs(composite_score - 0.5));
  if (years >= 5) {
    confidence = Math.min(confidence + 0.1, 0.95);
  }

  // Financial Estimates ranges
  const uncertainty_margin = 0.4 - (confidence * 0.3);
  const monthly_revenue = Math.round(est_rev);
  const revenue_range = [
    Math.round(monthly_revenue * (1 - uncertainty_margin)),
    Math.round(monthly_revenue * (1 + uncertainty_margin)),
  ];

  const daily_range = [
    Math.round(revenue_range[0] / 30),
    Math.round(revenue_range[1] / 30),
  ];

  const income_range = [
    Math.max(1000, Math.round(revenue_range[0] * 0.15) - rent),
    Math.max(2000, Math.round(revenue_range[1] * 0.22) - rent),
  ];

  const credit_score = Math.round(300 + Math.max(0, Math.min(composite_score - 0.1 * fraud_score, 1.0)) * 600);
  const market_share = 0.15 + composite_score * 0.3;

  return {
    store_id: `MOCK-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    visual_score,
    geo_score,
    sku_score: 0.76,
    competition_score: 0.65,
    fraud_score,
    composite_score,
    decision,
    confidence,
    fraud_flags,
    risk_flags,
    recommendation: decision === "APPROVE" ? "approved" : decision === "REJECT" ? "rejected" : "needs_verification",
    monthly_revenue_range: revenue_range,
    monthly_income_range: income_range,
    daily_sales_range: daily_range,
    confidence_score: confidence,
    ml_outputs: {
      credit_score,
      market_share,
    }
  };
}

export async function submitUnderwrite(
  req: UnderwriteRequest
): Promise<UnderwriteApiResponse> {
  try {
    // ✅ Validate images
    if (!req.images || req.images.length < 5) {
      throw new Error("Please upload all 5 required images");
    }

    const mockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || !process.env.NEXT_PUBLIC_API_BASE_URL;

    let raw: any;

    if (mockMode) {
      // Offline/Static simulator
      await new Promise((resolve) => setTimeout(resolve, 1500));
      raw = getMockUnderwrite(req);
    } else {
      const formData = new FormData();
      formData.append("front", req.images[0]);
      formData.append("billing_area", req.images[1]);
      formData.append("left_wall", req.images[2]);
      formData.append("centre_wall", req.images[3]);
      formData.append("right_wall", req.images[4]);

      formData.append("lat", req.gps.lat.toString());
      formData.append("lng", req.gps.lng.toString());

      if (req.optional?.shop_size !== undefined && req.optional.shop_size !== null) formData.append("shop_size", req.optional.shop_size.toString());
      if (req.optional?.rent !== undefined && req.optional.rent !== null) formData.append("rent", req.optional.rent.toString());
      if (req.optional?.years_in_operation !== undefined && req.optional.years_in_operation !== null) formData.append("years_in_operation", req.optional.years_in_operation.toString());

      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
      const cleanBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;

      const res = await fetch(`${cleanBase}/underwrite`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Backend error: ${errorText}`);
      }

      raw = await res.json();
      
      if (raw.error) {
        throw new Error(raw.error);
      }
    }
    
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
    const monthly_revenue = Math.round((revenueRange[0] + revenueRange[1]) / 2) || (output.monthly_revenue ?? 220000);
    const monthly_profit = Math.round((incomeRange[0] + incomeRange[1]) / 2) || (output.monthly_profit ?? 35000);

    // ✅ Confidence (pipeline field or transform field)
    const confidence = output.confidence ?? output.confidence_score ?? 0.72;

    // ✅ Inject location
    const location = {
      lat: req.gps.lat,
      lng: req.gps.lng,
      accuracy: 10,
    };

    // ✅ Feature scores (UI expects array) - Aligned with hackathon requirements
    const scores = [
      {
        name: "SDI",
        label: "Shelf Density Index (SDI)",
        score: Math.round((output.visual_score ?? 0.8) * 100),
        weight: 0.2,
      },
      {
        name: "SKU",
        label: "SKU Diversity Score",
        score: Math.round((output.sku_score ?? 0.75) * 100),
        weight: 0.2,
      },
      {
        name: "Geo",
        label: "Catchment & Footfall",
        score: Math.round((output.geo_score ?? 0.85) * 100),
        weight: 0.25,
      },
      {
        name: "Comp",
        label: "Competition Density",
        score: Math.round((output.competition_score ?? 0.6) * 100),
        weight: 0.15,
      },
      {
        name: "Fraud",
        label: "Fraud Resilience",
        score: Math.round((1 - (output.fraud_score ?? 0)) * 100),
        weight: 0.2,
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
    const pipelineFlags = (output.fraud_flags ?? []).map((f: any) => {
      if (typeof f === "string") return { code: f, severity: "medium" as const, description: f };
      return { code: f.rule_id || f.code || "FLAG", severity: f.severity || "medium", description: f.description || "" };
    });
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
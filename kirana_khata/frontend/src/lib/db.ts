import { supabase } from './supabase';
import type { UnderwritingResult, HistoryRecord } from '../types/underwriting';

const LOCAL_STORAGE_KEY = 'kirana_hackathon_history';

export async function saveUnderwritingResult(result: UnderwritingResult): Promise<void> {
  // 🔥 Hackathon Local Fallback: Always save to localStorage first so demos never break
  try {
    if (typeof window !== 'undefined') {
      const existingStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      const existing = existingStr ? JSON.parse(existingStr) : [];
      const updated = [result, ...existing].slice(0, 50); // Keep last 50
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('[DB] LocalStorage fallback failed:', e);
  }

  // Attempt real DB save (fails silently if Supabase is not configured)
  const { error } = await supabase.from('underwriting_results').insert([
    {
      id: result.id,
      store_name: result.store_name,
      owner_name: result.owner_name,
      monthly_revenue: result.monthly_revenue,
      monthly_profit: result.monthly_profit,
      confidence: result.confidence,
      risk_score: result.risk_score,
      decision: result.decision,
      fraud_flags: result.fraud_flags,
      loan_sizing: result.loan_sizing,
      feature_scores: result.feature_scores,
      location: result.location,
      images_count: result.images_count,
      created_at: result.created_at,
    },
  ]);

  if (error) {
    console.warn('[DB] Supabase save failed (using localStorage instead):', error.message);
  }
}

export async function fetchHistory(): Promise<HistoryRecord[]> {
  // 1. Try real DB
  const { data, error } = await supabase
    .from('underwriting_results')
    .select(
      'id, store_name, owner_name, monthly_revenue, confidence, decision, risk_score, created_at, loan_sizing'
    )
    .order('created_at', { ascending: false })
    .limit(50);

  // 2. If real DB fails (e.g. hackathon demo without API keys), use localStorage fallback
  if (error || !data || data.length === 0) {
    console.warn('[DB] Supabase fetch failed or empty, falling back to localStorage');
    try {
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
          const parsed = JSON.parse(local) as UnderwritingResult[];
          return parsed.map((row) => ({
            id: row.id,
            store_name: row.store_name,
            owner_name: row.owner_name,
            monthly_revenue: row.monthly_revenue,
            confidence: row.confidence,
            decision: row.decision,
            risk_score: row.risk_score,
            created_at: row.created_at,
            loan_amount: row.loan_sizing.recommended,
          }));
        }
      }
    } catch (e) {
      console.warn('[DB] LocalStorage read failed:', e);
    }
    // If both fail, return empty
    return [];
  }

  // Return Supabase data
  return (data ?? []).map((row) => ({
    id: row.id as string,
    store_name: row.store_name as string,
    owner_name: row.owner_name as string,
    monthly_revenue: row.monthly_revenue as number,
    confidence: row.confidence as number,
    decision: row.decision as 'approve' | 'reject' | 'review',
    risk_score: row.risk_score as number,
    created_at: row.created_at as string,
    loan_amount: (row.loan_sizing as { recommended: number }).recommended,
  }));
}

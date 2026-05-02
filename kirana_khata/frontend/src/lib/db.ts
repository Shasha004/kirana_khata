import { supabase } from './supabase';
import type { UnderwritingResult, HistoryRecord } from '../types/underwriting';

export async function saveUnderwritingResult(result: UnderwritingResult): Promise<void> {
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
    console.error('[DB] Failed to save result:', error.message);
    throw new Error('Failed to persist underwriting result');
  }
}

export async function fetchHistory(): Promise<HistoryRecord[]> {
  const { data, error } = await supabase
    .from('underwriting_results')
    .select(
      'id, store_name, owner_name, monthly_revenue, confidence, decision, risk_score, created_at, loan_sizing'
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[DB] Failed to fetch history:', error.message);
    throw new Error('Failed to fetch underwriting history');
  }

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

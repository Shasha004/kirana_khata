export interface GpsCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface FeatureScore {
  name: string;
  score: number; // 0-100
  weight: number; // 0-1
  label: string;
}

export interface FraudFlag {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface LoanSizing {
  recommended: number;
  minimum: number;
  maximum: number;
  tenure_months: number;
  interest_rate: number;
  emi: number;
}

export interface UnderwritingResult {
  id: string;
  store_name: string;
  owner_name: string;
  monthly_revenue: number;
  monthly_profit: number;
  confidence: number; // 0-1
  risk_score: number; // 0-100 (lower is better)
  decision: 'approve' | 'reject' | 'review';
  fraud_flags: FraudFlag[];
  loan_sizing: LoanSizing;
  feature_scores: FeatureScore[];
  created_at: string;
  location: GpsCoordinates;
  images_count: number;
}

export interface UnderwriteRequest {
  images: File[];
  gps: GpsCoordinates;
  optional?: {
    shop_size?: number;
    rent?: number;
    years_in_operation?: number;
  };
}

export interface UnderwriteApiResponse {
  success: boolean;
  data?: UnderwritingResult;
  error?: string;
}

export interface HistoryRecord {
  id: string;
  store_name: string;
  owner_name: string;
  monthly_revenue: number;
  confidence: number;
  decision: 'approve' | 'reject' | 'review';
  risk_score: number;
  created_at: string;
  loan_amount: number;
}

export interface HistoryApiResponse {
  success: boolean;
  data?: HistoryRecord[];
  error?: string;
}

export type UploadStatus = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error';

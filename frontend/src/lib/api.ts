import type {
  UnderwriteRequest,
  UnderwriteApiResponse,
  HistoryApiResponse,
  UnderwritingResult,
  HistoryRecord,
} from '../types/underwriting';

const MOCK_MODE =
  process.env.NEXT_PUBLIC_MOCK_MODE === 'true' ||
  !process.env.NEXT_PUBLIC_API_BASE_URL;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

function generateId(): string {
  return Math.random().toString(36).slice(2, 11).toUpperCase();
}

function mockResult(req: UnderwriteRequest): UnderwritingResult {
  const revenue = 85000 + Math.floor(Math.random() * 120000);
  const profit = Math.floor(revenue * (0.12 + Math.random() * 0.18));
  const confidence = 0.61 + Math.random() * 0.32;
  const risk = Math.floor(100 - confidence * 100 + Math.random() * 15);
  const decision: 'approve' | 'reject' | 'review' =
    confidence > 0.75 ? 'approve' : confidence > 0.58 ? 'review' : 'reject';

  return {
    id: generateId(),
    store_name: 'Sharma General Store',
    owner_name: 'Ramesh Sharma',
    monthly_revenue: revenue,
    monthly_profit: profit,
    confidence,
    risk_score: risk,
    decision,
    fraud_flags:
      risk > 55
        ? [
            {
              code: 'LOCATION_MISMATCH',
              severity: 'medium',
              description: 'GPS coordinates differ from registered address by >500m',
            },
            {
              code: 'REVENUE_SPIKE',
              severity: 'low',
              description: 'Declared revenue 40% above 6-month trailing average',
            },
          ]
        : [],
    loan_sizing: {
      recommended: Math.floor(profit * 6),
      minimum: Math.floor(profit * 3),
      maximum: Math.floor(profit * 9),
      tenure_months: 12,
      interest_rate: 18.5,
      emi: Math.floor((profit * 6 * 1.185) / 12),
    },
    feature_scores: [
      { name: 'Stock Density', score: 72 + Math.floor(Math.random() * 20), weight: 0.25, label: 'Stock Density' },
      { name: 'Shelf Utilization', score: 60 + Math.floor(Math.random() * 30), weight: 0.2, label: 'Shelf Utilization' },
      { name: 'Footfall Proxy', score: 50 + Math.floor(Math.random() * 40), weight: 0.2, label: 'Footfall Proxy' },
      { name: 'Store Cleanliness', score: 65 + Math.floor(Math.random() * 25), weight: 0.15, label: 'Store Cleanliness' },
      { name: 'Digital Payment Signs', score: 40 + Math.floor(Math.random() * 50), weight: 0.1, label: 'Digital Payment Signs' },
      { name: 'Signage Quality', score: 55 + Math.floor(Math.random() * 35), weight: 0.1, label: 'Signage Quality' },
    ],
    created_at: new Date().toISOString(),
    location: req.gps,
    images_count: req.images.length,
  };
}

function mockHistory(): HistoryRecord[] {
  const names = [
    ['Patel Provisions', 'Suresh Patel'],
    ['Singh Kirana', 'Gurpreet Singh'],
    ['Yadav General', 'Vijay Yadav'],
    ['Kumar Stores', 'Rajesh Kumar'],
    ['Mehta Mart', 'Anita Mehta'],
    ['Joshi Trading', 'Priya Joshi'],
    ['Sharma Grocers', 'Ramesh Sharma'],
  ];

  return names.map(([store, owner], i) => {
    const revenue = 60000 + Math.floor(Math.random() * 180000);
    const confidence = 0.48 + Math.random() * 0.45;
    const decision: 'approve' | 'reject' | 'review' =
      confidence > 0.75 ? 'approve' : confidence > 0.58 ? 'review' : 'reject';
    const d = new Date();
    d.setDate(d.getDate() - i * 3 - Math.floor(Math.random() * 4));

    return {
      id: generateId(),
      store_name: store,
      owner_name: owner,
      monthly_revenue: revenue,
      confidence,
      decision,
      risk_score: Math.floor(100 - confidence * 100),
      created_at: d.toISOString(),
      loan_amount: Math.floor(revenue * 0.15 * 6),
    };
  });
}

export async function submitUnderwrite(
  req: UnderwriteRequest
): Promise<UnderwriteApiResponse> {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 2800));
    return { success: true, data: mockResult(req) };
  }

  try {
    const form = new FormData();
    req.images.forEach((img, i) => form.append(`image_${i}`, img));
    form.append('lat', String(req.gps.lat));
    form.append('lng', String(req.gps.lng));

    const res = await fetch(`${API_BASE}/api/underwrite`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: text || 'Server error' };
    }

    const json = (await res.json()) as UnderwritingResult;
    return { success: true, data: json };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function getHistory(): Promise<HistoryApiResponse> {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 900));
    return { success: true, data: mockHistory() };
  }

  try {
    const res = await fetch(`${API_BASE}/api/history`);
    if (!res.ok) return { success: false, error: 'Failed to load history' };
    const json = (await res.json()) as HistoryRecord[];
    return { success: true, data: json };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KiraNA — Cash Flow Underwriting | NBFC Intelligence Platform',
  description:
    'AI-powered kirana store cash flow analysis and loan underwriting for NBFCs',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>₹</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="relative min-h-screen">
        <nav
          style={{
            background: 'rgba(10, 15, 30, 0.92)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <div
            style={{
              maxWidth: 1280,
              margin: '0 auto',
              padding: '0 24px',
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  background: 'var(--accent)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#0a0f1e',
                }}
              >
                ₹
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: 700,
                    fontSize: 17,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.03em',
                  }}
                >
                  KiraNA
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                  }}
                >
                  Underwriting Intelligence
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <a
                href="/"
                className="nav-link"
              >
                New Assessment
              </a>
              <a
                href="/history"
                className="nav-link"
              >
                History
              </a>
              <div
                style={{
                  padding: '5px 14px',
                  background: 'var(--accent-glow)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                NBFC Officer
              </div>
            </div>
          </div>
        </nav>
        <main style={{ position: 'relative', zIndex: 1 }}>{children}</main>
      </body>
    </html>
  );
}

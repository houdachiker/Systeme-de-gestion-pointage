import { useState, useEffect } from 'react';
import Navbar from './Navbar';
import useResponsive from '../hooks/useResponsive';

/* ─── TopBar : titre + sous-titre + date ──────────────────────────────── */
function TopBar({ title, subtitle }) {
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <header style={tb.bar}>
      <div style={tb.left}>
        {title && (
          <div>
            <h1 style={tb.title}>
              {title}
              {subtitle && (
                <>
                  <span style={tb.sep}>—</span>
                  <span style={tb.sub}>{subtitle}</span>
                </>
              )}
            </h1>
            <div style={tb.date}>{dateStr}</div>
          </div>
        )}
      </div>
    </header>
  );
}

const tb = {
  bar: {
    height: 64,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 28px',
    background: 'var(--bg)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, zIndex: 50,
    gap: 16,
  },
  left: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 },
  title: {
    fontSize: 16, fontWeight: 500, color: 'var(--text)',
    letterSpacing: '-0.2px',
    display: 'flex', alignItems: 'baseline', gap: 8,
    margin: 0,
  },
  sep: { color: 'var(--text3)', fontWeight: 300, fontSize: 14 },
  sub: { fontSize: 13, color: 'var(--text2)', fontWeight: 400 },
  date: { fontSize: 11, color: 'var(--text3)', marginTop: 3 },
};

/* ─── Layout wrapper ────────────────────────────────────────────────────── */
export default function Layout({ children, title, subtitle, topBar = true }) {
  const { isMobile } = useResponsive();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Fermer la sidebar quand la taille change
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Mobile Top Header */}
      {isMobile && (
        <header style={S.mobileHeader}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={S.hamburger}
            aria-label="Ouvrir le menu"
            id="mobile-hamburger-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div style={S.mobileTitle}>{title || 'WorkPulse'}</div>
          <div style={{ width: 36 }} /> {/* Balance element for center title */}
        </header>
      )}

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Backdrop overlay for mobile drawer */}
        {isMobile && isSidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={S.backdrop}
            aria-hidden="true"
          />
        )}

        {/* Responsive Navbar */}
        <Navbar
          isOpen={isSidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
        />

        <main style={{
          flex: 1,
          marginLeft: isMobile ? 0 : 240,
          minHeight: isMobile ? 'calc(100vh - 56px)' : '100vh',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
        }}>
          {topBar && !isMobile && <TopBar title={title} subtitle={subtitle} />}
          <div style={{ flex: 1, padding: isMobile ? '16px' : '0' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

const S = {
  mobileHeader: {
    height: 56,
    background: '#0c0c0e',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    position: 'sticky',
    top: 0,
    zIndex: 90,
  },
  hamburger: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  mobileTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '-0.2px',
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 99,
  },
};

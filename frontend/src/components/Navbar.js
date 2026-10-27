import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/* ─── SVG Icons (line-style, neutres) ────────────────────────────────────── */
const Icon = ({ name, size = 16 }) => {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    users: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    qr: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <path d="M14 14h3v3M17 17h3v3M14 20h3" />
      </>
    ),
    history: (
      <>
        <path d="M3 3v5h5" />
        <path d="M3.05 13A9 9 0 1012 3a9 9 0 00-8.45 5.93" />
        <polyline points="12 7 12 12 15 14" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </>
    ),
    megaphone: (
      <>
        <path d="M3 11l18-5v12L3 13v-2z" />
        <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

/* ─── Couleurs douces pour avatars (déterministe) ────────────────────────── */
function avatarColor(seed) {
  const palette = ['#d4a574', '#7dd3a8', '#c4a3c0', '#e8b4a0', '#b8a08f', '#9eb5d4', '#d4a8b8'];
  let h = 0;
  for (let i = 0; i < (seed || '').length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

/* ─── Hook : compteurs annonces (non-lues employé / total admin) ──────── */
function useAnnouncementCounts(user) {
  const [unread, setUnread] = useState(0);
  const [total, setTotal]   = useState(0);

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === 'ADMIN';
    const storageKey = `workpulse_read_${user.id || 'anon'}`;

    const fetch = () => {
      api.get('/announcement').then(r => {
        const list = r.data || [];
        setTotal(list.length);
        if (!isAdmin) {
          try {
            const read = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
            setUnread(list.filter(a => !read.has(a.id)).length);
          } catch { setUnread(list.length); }
        }
      }).catch(() => {});
    };

    fetch();
    const iv = setInterval(fetch, 10000);
    // Aussi quand l'utilisateur revient sur l'onglet
    const onFocus = () => fetch();
    window.addEventListener('focus', onFocus);
    // Quand le localStorage change (l'utilisateur a marqué comme lu)
    const onStorage = (e) => { if (e.key === storageKey) fetch(); };
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [user]);

  return { unread, total };
}

/* ─── Navbar (Sidebar) ───────────────────────────────────────────────────── */
export default function Navbar({ isOpen, onClose, isMobile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'ADMIN';
  const { unread, total } = useAnnouncementCounts(user);

  const handleLogout = () => { 
    logout(); 
    if (isMobile) onClose();
    navigate('/login'); 
  };

  /* Liens admin */
  const adminLinks = [
    { to: '/dashboard',    label: 'Tableau de bord', icon: 'dashboard' },
    { to: '/employes',     label: 'Employés',        icon: 'users' },
    { to: '/conges/admin', label: 'Gestion congés',  icon: 'calendar' },
    { to: '/qrcodes',      label: 'QR Codes',        icon: 'qr' },
    { to: '/annonces',     label: 'Annonces',        icon: 'megaphone', badge: total },
  ];
  /* Liens employé */
  const employeLinks = [
    { to: '/pointage',     label: 'Pointage',         icon: 'clock' },
    { to: '/conges',       label: 'Mes congés',       icon: 'calendar' },
    { to: '/historique',   label: 'Mon historique',   icon: 'history' },
    { to: '/notifications', label: 'Notifications',   icon: 'bell', badge: unread, badgeColor: 'var(--accent)' },
  ];

  const links = isAdmin ? adminLinks : employeLinks;
  const isActive = (to) => location.pathname === to ||
    (to === '/dashboard' && location.pathname === '/');

  const av = avatarColor(user?.nom);
  const initials = user?.nom
    ? user.nom.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <aside style={{
      ...S.sidebar,
      ...(isMobile ? {
        left: isOpen ? 0 : -240,
        boxShadow: isOpen ? '5px 0 25px rgba(0,0,0,0.6)' : 'none',
        zIndex: 1000,
        transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      } : {})
    }}>
      {/* ─── Logo ─── */}
      <div style={S.logoArea}>
        <div style={S.logoIcon}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.55" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.7" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.4" />
          </svg>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={S.logoText}>WorkPulse</div>
          <div style={S.logoSub}>{isAdmin ? 'Console RH' : 'Espace employé'}</div>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            style={S.closeBtn}
            aria-label="Fermer le menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ─── Nav links ─── */}
      <div style={S.section}>
        <div style={S.sectionLabel}>NAVIGATION</div>
        <nav style={S.nav}>
          {links.map(({ to, label, icon, badge, badgeColor }) => {
            const active = isActive(to);
            const showBadge = badge != null && badge > 0;
            return (
              <Link 
                key={to} 
                to={to} 
                onClick={() => { if (isMobile) onClose(); }}
                style={{
                  ...S.navLink,
                  background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                  color:      active ? 'var(--text)' : 'var(--text2)',
                }}
              >
                <Icon name={icon} />
                <span style={{ flex: 1 }}>{label}</span>
                {showBadge && (
                  <span style={{
                    ...S.badge,
                    background: badgeColor || 'var(--surface2)',
                    color:      badgeColor ? '#0e0e10' : 'var(--text2)',
                  }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
                {active && !showBadge && <span style={S.activeDot} />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ flex: 1 }} />

      {/* ─── User profile + logout ─── */}
      <div style={S.userBox}>
        <div style={S.userRow}>
          <div style={{ ...S.avatar, background: av, color: '#1a1a1a' }}>
            {initials}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={S.userName}>{user?.nom}</div>
            <div style={S.userRole}>
              {isAdmin ? 'Administrateur RH' : 'Employé'}
            </div>
          </div>
          <span style={S.statusDot} />
        </div>
        <button onClick={handleLogout} style={S.logoutBtn}>
          <Icon name="logout" size={14} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}

const S = {
  sidebar: {
    width: 240,
    minHeight: '100vh',
    background: '#0c0c0e',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'fixed',
    top: 0, left: 0, bottom: 0,
    zIndex: 100,
    padding: '20px 14px 16px',
  },

  /* Logo */
  logoArea: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '4px 6px 18px',
  },
  logoIcon: {
    width: 36, height: 36, borderRadius: 9,
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text)',
    flexShrink: 0,
  },
  logoText: {
    fontSize: 14, fontWeight: 600, color: 'var(--text)',
    letterSpacing: '-0.2px', lineHeight: 1.2,
  },
  logoSub: {
    fontSize: 11, color: 'var(--text3)',
    marginTop: 2, fontFamily: 'var(--mono)',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 6,
  },

  /* Sections */
  section: { marginTop: 18 },
  sectionLabel: {
    fontSize: 10, fontWeight: 500,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '1.4px',
    padding: '0 8px 8px',
  },

  /* Nav */
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navLink: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '9px 10px',
    borderRadius: 9,
    fontSize: 13, fontWeight: 400,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  activeDot: {
    width: 5, height: 5, borderRadius: '50%',
    background: 'var(--accent)',
    flexShrink: 0,
  },
  badge: {
    minWidth: 19, height: 18, padding: '0 5px',
    borderRadius: 99,
    fontSize: 10, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--mono)', letterSpacing: '0',
  },

  /* User profile */
  userBox: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 600,
    flexShrink: 0,
  },
  userName: {
    fontSize: 13, fontWeight: 500, color: 'var(--text)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: 11, color: 'var(--text3)',
    fontFamily: 'var(--mono)', marginTop: 1,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: '50%',
    background: 'var(--green)',
    boxShadow: '0 0 0 2px rgba(110,200,160,0.18)',
    flexShrink: 0,
  },
  logoutBtn: {
    width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '9px',
    background: 'transparent',
    border: '1px solid var(--border2)',
    color: 'var(--text2)',
    borderRadius: 9,
    fontSize: 12, fontWeight: 500,
    cursor: 'pointer',
  },
};

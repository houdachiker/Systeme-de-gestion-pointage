import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import useResponsive from '../hooks/useResponsive';

/* ─── Helpers ───────────────────────────────────────────────────────── */
function avatarColor(seed) {
  const palette = ['#d4a574','#7dd3a8','#c4a3c0','#e8b4a0','#b8a08f','#9eb5d4','#d4a8b8'];
  let h = 0;
  for (let i = 0; i < (seed || '').length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}
function initials(nom) {
  if (!nom) return '?';
  const parts = nom.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : nom.slice(0, 2).toUpperCase();
}
function timeAgo(d) {
  if (!d) return '—';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60)    return `il y a ${Math.floor(diff)} sec`;
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'hier';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TYPE_CONF = {
  INFO:      { label: 'Info',      color: 'var(--accent)', bg: 'var(--accent-soft)' },
  IMPORTANT: { label: 'Important', color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  URGENT:    { label: 'Urgent',    color: 'var(--red)',    bg: 'var(--red-bg)' },
};

const FILTERS = [
  { id: 'ALL',    label: 'Toutes' },
  { id: 'UNREAD', label: 'Non lues' },
  { id: 'URGENT', label: 'Urgentes' },
];

/* ─── Page Notifications (employé) ──────────────────────────────────── */
export default function Notifications() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const storageKey = `workpulse_read_${user?.id || 'anon'}`;

  const [announcements, setAnn] = useState([]);
  const [readSet, setReadSet]   = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  });
  const [filter, setFilter] = useState('ALL');

  const load = () => api.get('/announcement').then(r => setAnn(r.data || [])).catch(() => {});
  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  /* Marquer comme lu */
  const markAsRead = (id) => {
    setReadSet(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const markAllAsRead = () => {
    const next = new Set(announcements.map(a => a.id));
    setReadSet(next);
    try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
  };

  /* Filtre */
  const filtered = announcements.filter(a => {
    if (filter === 'ALL')    return true;
    if (filter === 'UNREAD') return !readSet.has(a.id);
    if (filter === 'URGENT') return a.type === 'URGENT';
    return true;
  });

  const unreadCount = announcements.filter(a => !readSet.has(a.id)).length;
  const urgentCount = announcements.filter(a => a.type === 'URGENT').length;

  const counts = {
    ALL:    announcements.length,
    UNREAD: unreadCount,
    URGENT: urgentCount,
  };

  return (
    <Layout title="Notifications" subtitle="Annonces et communications de l'entreprise">
      <style>{`
        .notif-tabs-scroll {
          display: flex;
          gap: 4px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          margin-bottom: 12px;
          padding-bottom: 2px;
        }
        .notif-tabs-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <div style={{ ...s.page, padding: isMobile ? '16px 12px 40px' : '24px 28px 40px' }}>
        {/* ═══ Header + actions ═══ */}
        <div style={{
          ...s.headerActions,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
        }}>
          {/* Résumé — 3 compteurs côte à côte */}
          <div style={{
            ...s.summary,
            justifyContent: isMobile ? 'space-around' : 'flex-start',
          }}>
            <div style={s.summaryItem}>
              <span style={s.summaryLbl}>Total</span>
              <span style={s.summaryVal}>{announcements.length}</span>
            </div>
            <div style={s.summaryDiv} />
            <div style={s.summaryItem}>
              <span style={s.summaryLbl}>Non lues</span>
              <span style={{ ...s.summaryVal, color: unreadCount > 0 ? 'var(--accent)' : 'var(--text2)' }}>
                {unreadCount}
              </span>
            </div>
            <div style={s.summaryDiv} />
            <div style={s.summaryItem}>
              <span style={s.summaryLbl}>Urgentes</span>
              <span style={{ ...s.summaryVal, color: urgentCount > 0 ? 'var(--red)' : 'var(--text2)' }}>
                {urgentCount}
              </span>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              id="notif-mark-all-read"
              onClick={markAllAsRead}
              style={{
                ...s.markAllBtn,
                width: isMobile ? '100%' : 'auto',
                justifyContent: 'center',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Tout marquer comme lu
            </button>
          )}
        </div>

        {/* ═══ Tabs — scroll horizontal sur mobile ═══ */}
        <div className="notif-tabs-scroll">
          {FILTERS.map(f => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                id={`notif-tab-${f.id.toLowerCase()}`}
                onClick={() => setFilter(f.id)}
                style={{
                  ...s.tab,
                  color: active ? 'var(--text)' : 'var(--text3)',
                  background: active ? 'var(--surface)' : 'transparent',
                  border: active ? '1px solid var(--border2)' : '1px solid transparent',
                  flexShrink: 0,
                }}
              >
                {f.label}
                {counts[f.id] > 0 && (
                  <span style={{
                    ...s.tabCount,
                    background: f.id === 'UNREAD' && unreadCount > 0 ? 'var(--accent-soft)' : 'var(--surface2)',
                    color: f.id === 'UNREAD' && unreadCount > 0 ? 'var(--accent)' : 'var(--text2)',
                  }}>
                    {counts[f.id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ═══ Liste ═══ */}
        <section style={s.list}>
          {filtered.length === 0 ? (
            <div style={s.empty}>
              <div style={s.emptyIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              </div>
              <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>
                {filter === 'UNREAD' ? 'Tout est à jour !' : 'Aucune notification'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {filter === 'UNREAD'
                  ? 'Vous avez lu toutes vos notifications.'
                  : 'Les annonces publiées par les RH apparaîtront ici.'}
              </div>
            </div>
          ) : filtered.map(a => {
            const conf   = TYPE_CONF[a.type] || { label: a.type, color: 'var(--text3)', bg: 'var(--surface2)' };
            const av     = avatarColor(a.author);
            const isRead = readSet.has(a.id);
            return (
              <div key={a.id}
                   id={`notif-item-${a.id}`}
                   onClick={() => !isRead && markAsRead(a.id)}
                   style={{
                     ...s.notif,
                     borderLeft: `3px solid ${conf.color}`,
                     opacity: isRead ? 0.75 : 1,
                     cursor: isRead ? 'default' : 'pointer',
                     padding: isMobile ? '12px 12px 12px 14px' : '14px 16px 14px 18px',
                   }}>
                {!isRead && <div style={s.unreadDot} />}

                <div style={{
                  ...s.notifHeader,
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  gap: isMobile ? 8 : 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ ...s.avatar, background: av, color: '#1a1a1a' }}>
                      {initials(a.author)}
                    </div>
                    <div>
                      <div style={s.authorName}>
                        {a.author}
                        <span style={s.authorRole}> · Admin RH</span>
                      </div>
                      <div style={s.authorMeta}>{timeAgo(a.createdAt)}</div>
                    </div>
                  </div>
                  <span style={{
                    ...s.typeBadge,
                    background: conf.bg, color: conf.color,
                    marginRight: isMobile ? 0 : 16,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: conf.color }} />
                    {conf.label}
                  </span>
                </div>

                <div style={s.notifText}>{a.text}</div>

                {!isRead && (
                  <div style={s.markReadHint}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'var(--accent)',
                    }} />
                    Cliquez pour marquer comme lu
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </Layout>
  );
}

const s = {
  page: { maxWidth: 880, margin: '0 auto' },

  headerActions: {
    display: 'flex', justifyContent: 'space-between',
    gap: 12, marginBottom: 14, flexWrap: 'wrap',
  },
  summary: {
    display: 'flex', alignItems: 'center', gap: 16,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '10px 18px',
    flex: 1,
  },
  summaryItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  summaryLbl: {
    fontSize: 10, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 500,
  },
  summaryVal: {
    fontSize: 18, fontWeight: 500, color: 'var(--text)',
    fontFamily: 'var(--mono)', letterSpacing: '-0.3px', lineHeight: 1,
  },
  summaryDiv: { width: 1, height: 26, background: 'var(--border2)' },
  markAllBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 14px',
    background: 'var(--surface)',
    border: '1px solid var(--border2)',
    color: 'var(--text2)',
    borderRadius: 10,
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit',
  },

  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px',
    borderRadius: 9,
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  tabCount: {
    fontSize: 10, fontWeight: 600,
    padding: '1px 7px', borderRadius: 99,
  },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  notif: {
    position: 'relative',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12,
    transition: 'all 150ms ease',
  },
  unreadDot: {
    position: 'absolute', top: 16, right: 14,
    width: 7, height: 7, borderRadius: '50%',
    background: 'var(--accent)',
    boxShadow: '0 0 0 3px rgba(139,158,255,0.18)',
  },
  notifHeader: {
    display: 'flex', justifyContent: 'space-between',
    marginBottom: 10, gap: 8,
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 600, flexShrink: 0,
  },
  authorName: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  authorRole: { fontSize: 11, color: 'var(--text3)', fontWeight: 400 },
  authorMeta: { fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 1 },
  typeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 99,
    fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    flexShrink: 0,
  },
  notifText: {
    fontSize: 13, color: 'var(--text)',
    lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  markReadHint: {
    marginTop: 10, paddingTop: 10,
    borderTop: '1px dashed var(--border2)',
    fontSize: 11, color: 'var(--text3)',
    display: 'flex', alignItems: 'center', gap: 6,
  },

  empty: {
    textAlign: 'center', padding: 60,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12,
  },
  emptyIcon: {
    width: 54, height: 54, borderRadius: '50%',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text3)', marginBottom: 14,
  },
};

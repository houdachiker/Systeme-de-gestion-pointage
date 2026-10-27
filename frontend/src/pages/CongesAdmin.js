import { useState, useEffect } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import useResponsive from '../hooks/useResponsive';

/* ============================================================
   PresenceHub — Gestion congés (Console RH)
   ============================================================ */
const STATUS = {
  EN_ATTENTE: { label: 'En attente', bg: 'var(--amber-bg)', fg: 'var(--amber)', dot: 'var(--amber)' },
  VALIDE:     { label: 'Approuvée',  bg: 'var(--green-bg)', fg: 'var(--green)', dot: 'var(--green)' },
  REFUSE:     { label: 'Refusée',    bg: 'var(--red-bg)',   fg: 'var(--red)',   dot: 'var(--red)'   },
};
const TYPE_CONF = {
  ANNUEL:       { label: 'Congés payés', color: 'var(--accent)' },
  MALADIE:      { label: 'Maladie',      color: 'var(--red)' },
  EXCEPTIONNEL: { label: 'Exceptionnel', color: 'var(--amber)' },
  RTT:          { label: 'RTT',          color: 'var(--purple)' },
  FAMILIAL:     { label: 'Familial',     color: 'var(--cyan)' },
};

const FILTERS = [
  { id: 'EN_ATTENTE', label: 'En attente' },
  { id: 'VALIDE',     label: 'Approuvées' },
  { id: 'REFUSE',     label: 'Refusées' },
  { id: 'ALL',        label: 'Toutes' },
];

/* ─── Utils ─────────────────────────────────────────────────────── */
function initials(nom) {
  if (!nom) return '?';
  const parts = nom.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : nom.slice(0, 2).toUpperCase();
}
function avatarColor(str) {
  const palette = ['#d4a574','#7dd3a8','#c4a3c0','#e8b4a0','#b8a08f','#9eb5d4','#d4a8b8'];
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}
function days(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
}
function formatDateShort(d) {
  if (!d) return '—';
  const dd = new Date(d);
  return `${String(dd.getDate()).padStart(2, '0')}/${String(dd.getMonth() + 1).padStart(2, '0')}`;
}
function formatDateFull(d) {
  if (!d) return '—';
  return new Date(d).toISOString().split('T')[0];
}
function timeAgo(d) {
  if (!d) return 'hier';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 3600)   return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'hier';
  return `il y a ${Math.floor(diff / 86400)} j`;
}

/* ─── Component ─────────────────────────────────────────────────── */
export default function CongesAdmin() {
  const { isMobile } = useResponsive();
  const [conges, setConges]       = useState([]);
  const [usersMap, setUsersMap]   = useState({});
  const [filter, setFilter]       = useState('EN_ATTENTE');
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelected] = useState(null);
  /* Mobile: détail affiché en modal plein écran */
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/conge'), api.get('/auth/users')])
      .then(([cRes, uRes]) => {
        setConges(cRes.data);
        const map = {};
        (uRes.data || []).forEach(u => { map[u.id] = u; });
        setUsersMap(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const reload = () => api.get('/conge').then(r => setConges(r.data)).catch(() => {});

  const handleAction = async (id, action) => {
    try {
      await api.put(`/conge/${id}/${action}`);
      reload();
      setSelected(null);
      setShowMobileDetail(false);
    } catch {}
  };

  const handleRowClick = (id) => {
    setSelected(id);
    if (isMobile) setShowMobileDetail(true);
  };

  const filtered = filter === 'ALL' ? conges : conges.filter(c => c.statut === filter);
  const counts = {
    ALL:        conges.length,
    EN_ATTENTE: conges.filter(c => c.statut === 'EN_ATTENTE').length,
    VALIDE:     conges.filter(c => c.statut === 'VALIDE').length,
    REFUSE:     conges.filter(c => c.statut === 'REFUSE').length,
  };

  const now = new Date();
  const thisMonth = conges.filter(c => {
    const d = new Date(c.dateDebut);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const getUser = (uid) => usersMap[uid] || { nom: uid, poste: '—', departement: '—', solde: 0 };
  const selected = conges.find(c => c.id === selectedId);
  const selectedUser = selected ? getUser(selected.userId) : null;

  const statCards = [
    { label: 'Demandes ce mois', val: thisMonth || conges.length, sub: '+12% vs mois dernier',  color: 'var(--text)' },
    { label: 'En attente',       val: counts.EN_ATTENTE,           sub: 'À traiter sous 48h',     color: 'var(--amber)' },
    { label: 'Approuvées',       val: counts.VALIDE,               sub: 'Délai moyen : 6h',       color: 'var(--green)' },
    { label: 'Refusées',         val: counts.REFUSE,
      sub: `Soit ${conges.length ? ((counts.REFUSE/conges.length)*100).toFixed(1) : 0}% du total`,
      color: 'var(--red)' },
  ];

  const pagePad = isMobile ? '14px 12px 40px' : '24px 28px 40px';

  return (
    <Layout title="Gestion congés" subtitle="Demandes et validations">
      <style>{`
        .row-hover { transition: background 120ms ease; cursor: pointer; }
        .row-hover:hover { background: rgba(255,255,255,0.025); }
        .row-active { background: rgba(139,158,255,0.05); }
        .icon-btn {
          background: transparent; border: 1px solid var(--border2);
          color: var(--text2); border-radius: 9px;
          padding: 7px 12px; display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; cursor: pointer; font-family: inherit; font-weight: 500;
        }
        .icon-btn:hover { border-color: var(--border3); color: var(--text); }

        /* Mobile detail modal */
        .mobile-detail-overlay {
          position: fixed; inset: 0; z-index: 900;
          background: rgba(0,0,0,0.65);
          display: flex; align-items: flex-end;
        }
        .mobile-detail-sheet {
          background: var(--surface);
          border-radius: 18px 18px 0 0;
          width: 100%; max-height: 88vh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          animation: slideUp 220ms ease;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>

      <div style={{ ...S.page, padding: pagePad }}>
        {/* Stat cards */}
        <section style={{
          ...S.statsGrid,
          gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
        }}>
          {statCards.map(({ label, val, sub, color }) => (
            <div key={label} style={S.statCard}>
              <div style={S.statLabel}>{label}</div>
              <div style={{ ...S.statValue, color, fontSize: isMobile ? 28 : 36 }}>{val}</div>
              <div style={S.statSub}>{sub}</div>
            </div>
          ))}
        </section>

        {/* Main panel */}
        <section style={S.mainPanel}>
          <div style={{
            ...S.panelHeader,
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
              <h2 style={S.panelTitle}>Demandes de congés</h2>
              {/* Tabs scrollables sur mobile */}
              <div style={{
                display: 'flex', gap: 4,
                overflowX: isMobile ? 'auto' : 'visible',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                paddingBottom: isMobile ? 2 : 0,
              }}>
                {FILTERS.map(({ id, label }) => {
                  const active = filter === id;
                  return (
                    <button
                      key={id}
                      id={`conges-admin-tab-${id.toLowerCase()}`}
                      onClick={() => { setFilter(id); setSelected(null); setShowMobileDetail(false); }}
                      style={{
                        ...S.tab,
                        color: active ? 'var(--text)' : 'var(--text3)',
                        background: active ? 'var(--surface2)' : 'transparent',
                        border: active ? '1px solid var(--border2)' : '1px solid transparent',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {label}
                      {id !== 'ALL' && <span style={{ opacity: 0.5 }}>·</span>}
                      {id !== 'ALL' && <span>{counts[id]}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="icon-btn" id="conges-admin-filter-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {!isMobile && 'Filtres'}
              </button>
              <button className="icon-btn" id="conges-admin-export-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {!isMobile && 'Export'}
              </button>
            </div>
          </div>

          {/* Split view — table only on mobile, side panel on desktop */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : (selected ? '1fr 380px' : '1fr'),
            minHeight: 480,
          }}>
            <div style={{ ...S.tableWrap, borderRight: (!isMobile && selected) ? '1px solid var(--border)' : 'none' }}>
              {loading ? (
                <div style={S.emptyState}><div style={S.emptyText}>Chargement…</div></div>
              ) : filtered.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={S.emptyText}>Aucune demande</div>
                  <div style={S.emptySub}>Aucune demande dans cette catégorie</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ ...S.table, minWidth: isMobile ? 520 : '100%' }}>
                    <thead>
                      <tr>
                        <th style={S.th}>Employé</th>
                        <th style={S.th}>Type</th>
                        <th style={S.th}>Période</th>
                        <th style={{ ...S.th, textAlign: 'center' }}>Jours</th>
                        <th style={S.th}>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => {
                        const conf  = STATUS[c.statut] || {};
                        const tconf = TYPE_CONF[c.type] || { label: c.type, color: 'var(--text3)' };
                        const u     = getUser(c.userId);
                        const isSel = c.id === selectedId;
                        const av    = avatarColor(u.nom);
                        return (
                          <tr key={c.id}
                              id={`conge-row-${c.id}`}
                              onClick={() => handleRowClick(c.id)}
                              className={`row-hover ${isSel ? 'row-active' : ''}`}
                              style={S.tr}>
                            <td style={S.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ ...S.avatar, background: av, color: '#1a1a1a' }}>
                                  {initials(u.nom)}
                                </div>
                                <div>
                                  <div style={S.empName}>{u.nom}</div>
                                  <div style={S.empMeta}>
                                    L-{String(c.id || '0000').slice(-4)} · {timeAgo(c.createdAt || c.dateCreation)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={S.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: tconf.color }} />
                                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{tconf.label}</span>
                              </div>
                            </td>
                            <td style={{ ...S.td, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>
                              {formatDateShort(c.dateDebut)} <span style={{ color: 'var(--text3)' }}>→</span><br />
                              {formatDateShort(c.dateFin)}
                            </td>
                            <td style={{ ...S.td, textAlign: 'center', fontWeight: 500, color: 'var(--text)' }}>
                              {days(c.dateDebut, c.dateFin)}
                            </td>
                            <td style={S.td}>
                              <span style={{
                                ...S.statusBadge,
                                background: conf.bg, color: conf.fg,
                              }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: conf.dot }} />
                                {conf.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Detail panel — sidebar sur desktop seulement */}
            {!isMobile && (
              <div style={S.detailPanel}>
                {selected && selectedUser ? (
                  <DetailView
                    conge={selected}
                    user={selectedUser}
                    onApprove={() => handleAction(selected.id, 'valider')}
                    onReject={() => handleAction(selected.id, 'refuser')}
                  />
                ) : (
                  <div style={S.detailEmpty}>
                    <div style={S.detailIcon}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <div style={S.detailEmptyTitle}>Sélectionnez une demande</div>
                    <div style={S.detailEmptySub}>
                      Cliquez sur une ligne pour voir<br />les détails et agir.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ═══ Mobile bottom sheet pour le détail ═══ */}
      {isMobile && showMobileDetail && selected && selectedUser && (
        <div className="mobile-detail-overlay" onClick={() => setShowMobileDetail(false)}>
          <div className="mobile-detail-sheet" onClick={e => e.stopPropagation()}>
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border2)' }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 20px 12px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Détail de la demande</span>
              <button
                id="conges-admin-detail-close"
                onClick={() => setShowMobileDetail(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <DetailView
              conge={selected}
              user={selectedUser}
              onApprove={() => handleAction(selected.id, 'valider')}
              onReject={() => handleAction(selected.id, 'refuser')}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ─── Detail panel ──────────────────────────────────────────────── */
function DetailView({ conge, user, onApprove, onReject }) {
  const conf  = STATUS[conge.statut] || {};
  const tconf = TYPE_CONF[conge.type] || { label: conge.type, color: 'var(--text3)' };
  const av    = avatarColor(user.nom);
  const isPending = conge.statut === 'EN_ATTENTE';

  return (
    <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', minHeight: 300 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12, fontFamily: 'var(--mono)' }}>
        L-{String(conge.id || '0000').slice(-4)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
        <div style={{ ...S.avatar, width: 44, height: 44, fontSize: 14, background: av, color: '#1a1a1a' }}>
          {initials(user.nom)}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{user.nom}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {user.poste || 'Employé'}{user.departement && ` · ${user.departement}`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 22 }}>
        <DetailRow label="Type">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tconf.color }} />
            <span style={{ color: 'var(--text)', fontSize: 13 }}>{tconf.label}</span>
          </span>
        </DetailRow>
        <DetailRow label="Du"            value={formatDateFull(conge.dateDebut)} />
        <DetailRow label="Au"            value={formatDateFull(conge.dateFin)} />
        <DetailRow label="Durée"         value={`${days(conge.dateDebut, conge.dateFin)} jour(s)`} />
        <DetailRow label="Solde restant" value={`${user.solde ?? 5} j`} />
        <DetailRow label="Soumis"        value={timeAgo(conge.createdAt || conge.dateCreation)} />
        <DetailRow label="Statut">
          <span style={{
            ...S.statusBadge, background: conf.bg, color: conf.fg,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: conf.dot }} />
            {conf.label}
          </span>
        </DetailRow>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={S.detailLabel}>Motif</div>
        <div style={S.motifBox}>
          {conge.motif || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Aucun motif renseigné</span>}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {isPending ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button id="conge-detail-approve" onClick={onApprove} style={S.approveBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Approuver
          </button>
          <button id="conge-detail-reject" onClick={onReject} style={S.rejectBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Refuser
          </button>
        </div>
      ) : (
        <div style={{
          padding: '11px 14px', background: 'var(--surface2)',
          border: '1px solid var(--border)', borderRadius: 9,
          textAlign: 'center', fontSize: 12, color: 'var(--text3)',
        }}>
          Demande déjà traitée
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
      {children || <span style={{ fontSize: 13, color: 'var(--text)' }}>{value}</span>}
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────── */
const S = {
  page: { maxWidth: 1320, margin: '0 auto' },

  statsGrid: {
    display: 'grid', gap: 14,
    marginBottom: 16,
  },
  statCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '20px 22px',
  },
  statLabel: {
    fontSize: 10, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
    fontWeight: 500, marginBottom: 14,
  },
  statValue: { fontWeight: 300, lineHeight: 1, letterSpacing: '-1px', marginBottom: 10 },
  statSub:   { fontSize: 12, color: 'var(--text3)' },

  mainPanel: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    gap: 16, flexWrap: 'wrap',
  },
  panelTitle: {
    fontSize: 15, fontWeight: 500, color: 'var(--text)',
    margin: 0, letterSpacing: '-0.2px',
  },
  tab: {
    padding: '6px 14px', borderRadius: 8,
    fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  },

  tableWrap: { overflowX: 'auto' },

  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '14px 20px', textAlign: 'left',
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '15px 20px', fontSize: 13, color: 'var(--text)', verticalAlign: 'middle' },

  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
  empName: { fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 },
  empMeta: { fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' },
  statusBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 12,
    fontSize: 11, fontWeight: 500,
  },

  detailPanel: {
    background: 'var(--surface)',
    display: 'flex', flexDirection: 'column',
    minHeight: 480,
  },
  detailEmpty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 32px', textAlign: 'center',
  },
  detailIcon: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text3)', marginBottom: 16,
  },
  detailEmptyTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 },
  detailEmptySub:   { fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 },
  detailLabel: {
    fontSize: 10, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
    fontWeight: 500, marginBottom: 8,
  },
  motifBox: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '12px 14px',
    fontSize: 13, color: 'var(--text)', lineHeight: 1.5,
  },
  approveBtn: {
    flex: 1, padding: 11,
    background: 'var(--green-bg)', color: 'var(--green)',
    border: '1px solid var(--green-br)', borderRadius: 10,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    fontFamily: 'inherit',
  },
  rejectBtn: {
    flex: 1, padding: 11,
    background: 'var(--red-bg)', color: 'var(--red)',
    border: '1px solid var(--red-br)', borderRadius: 10,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    fontFamily: 'inherit',
  },
  emptyState: { padding: '80px 20px', textAlign: 'center' },
  emptyText:  { fontSize: 14, color: 'var(--text2)', fontWeight: 500, marginBottom: 6 },
  emptySub:   { fontSize: 12, color: 'var(--text3)' },
};

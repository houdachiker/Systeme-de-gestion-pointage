import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

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
function fullDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TYPE_CONF = {
  INFO:      { label: 'Info',      color: 'var(--accent)', bg: 'var(--accent-soft)', br: 'rgba(139,158,255,0.30)' },
  IMPORTANT: { label: 'Important', color: 'var(--amber)',  bg: 'var(--amber-bg)',    br: 'var(--amber-br)' },
  URGENT:    { label: 'Urgent',    color: 'var(--red)',    bg: 'var(--red-bg)',      br: 'var(--red-br)' },
};

const FILTERS = [
  { id: 'ALL',       label: 'Toutes' },
  { id: 'INFO',      label: 'Info' },
  { id: 'IMPORTANT', label: 'Important' },
  { id: 'URGENT',    label: 'Urgent' },
];

/* ─── Page Annonces (admin) ─────────────────────────────────────────── */
export default function Annonces() {
  const { user } = useAuth();
  const [announcements, setAnn] = useState([]);
  const [annInput, setAnnInput] = useState('');
  const [annType, setAnnType]   = useState('INFO');
  const [filter, setFilter]     = useState('ALL');
  const [loading, setLoading]   = useState(false);
  const [confirm, setConfirm]   = useState(null);

  const load = () => api.get('/announcement').then(r => setAnn(r.data || [])).catch(() => {});
  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  const publish = async () => {
    const text = annInput.trim();
    if (!text || loading) return;
    setLoading(true);
    try {
      await api.post('/announcement', {
        text, type: annType,
        author: user?.nom || 'Administrateur',
        authorId: user?.id || null,
      });
      setAnnInput(''); setAnnType('INFO');
      load();
    } catch {} finally { setLoading(false); }
  };

  const remove = async (id) => {
    try { await api.delete(`/announcement/${id}`); load(); setConfirm(null); }
    catch {}
  };

  const filtered = filter === 'ALL' ? announcements : announcements.filter(a => a.type === filter);
  const counts = {
    ALL:       announcements.length,
    INFO:      announcements.filter(a => a.type === 'INFO').length,
    IMPORTANT: announcements.filter(a => a.type === 'IMPORTANT').length,
    URGENT:    announcements.filter(a => a.type === 'URGENT').length,
  };

  /* Cette semaine */
  const thisWeek = announcements.filter(a => {
    const diff = (Date.now() - new Date(a.createdAt).getTime()) / 86400000;
    return diff <= 7;
  }).length;

  return (
    <Layout title="Annonces" subtitle="Communications internes">
      <style>{`
        .row-hover:hover { background: rgba(255,255,255,0.025); }
      `}</style>

      <div style={s.page}>
        {/* ═══ Stats cards ═══ */}
        <section style={s.statsGrid}>
          <StatCard label="Total annonces"     val={counts.ALL}       sub="Toutes confondues"  color="var(--text)"   />
          <StatCard label="Cette semaine"      val={thisWeek}         sub="7 derniers jours"   color="var(--accent)" />
          <StatCard label="Importantes"        val={counts.IMPORTANT} sub="À surveiller"       color="var(--amber)"  />
          <StatCard label="Urgentes"           val={counts.URGENT}    sub="Niveau critique"    color="var(--red)"    />
        </section>

        {/* ═══ Form publication ═══ */}
        <section style={s.formCard}>
          <div style={s.formHeader}>
            <div>
              <div style={s.formTitle}>Publier une annonce</div>
              <div style={s.formSub}>Le message sera visible par tous les employés</div>
            </div>
            <div style={s.megaphone}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l18-5v12L3 13v-2z" />
                <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
              </svg>
            </div>
          </div>

          <textarea
            placeholder="Tapez votre message ici… (max 500 caractères)"
            value={annInput}
            onChange={e => setAnnInput(e.target.value)}
            maxLength={500}
            rows={4}
            style={s.bigInput}
          />

          <div style={s.formFooter}>
            <div style={s.typePicker}>
              {Object.entries(TYPE_CONF).map(([k, conf]) => {
                const active = annType === k;
                return (
                  <button key={k} type="button" onClick={() => setAnnType(k)} style={{
                    ...s.typeBtn,
                    background:  active ? conf.bg : 'transparent',
                    color:       active ? conf.color : 'var(--text3)',
                    borderColor: active ? conf.br : 'var(--border2)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: conf.color }} />
                    {conf.label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                {annInput.length}/500
              </span>
              <button onClick={publish}
                      disabled={!annInput.trim() || loading}
                      style={{
                        ...s.publishBtn,
                        opacity: (annInput.trim() && !loading) ? 1 : 0.45,
                        cursor:  (annInput.trim() && !loading) ? 'pointer' : 'not-allowed',
                      }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {loading ? 'Publication…' : 'Publier l\'annonce'}
              </button>
            </div>
          </div>
        </section>

        {/* ═══ Liste des annonces ═══ */}
        <section style={s.listCard}>
          <div style={s.listHeader}>
            <div>
              <div style={s.listTitle}>Historique des annonces</div>
              <div style={s.listSub}>
                {filtered.length} annonce{filtered.length > 1 ? 's' : ''} {filter !== 'ALL' && `· filtre : ${TYPE_CONF[filter]?.label}`}
              </div>
            </div>
            <div style={s.tabs}>
              {FILTERS.map(f => {
                const active = filter === f.id;
                return (
                  <button key={f.id} onClick={() => setFilter(f.id)} style={{
                    ...s.tab,
                    color: active ? 'var(--text)' : 'var(--text3)',
                    background: active ? 'var(--surface2)' : 'transparent',
                    border: active ? '1px solid var(--border2)' : '1px solid transparent',
                  }}>
                    {f.label}
                    <span style={{ opacity: 0.5, marginLeft: 4 }}>· {counts[f.id]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={s.empty}>
                <div style={s.emptyIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 11l18-5v12L3 13v-2z" />
                    <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
                  </svg>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>
                  Aucune annonce
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  {filter === 'ALL'
                    ? 'Publiez votre première annonce ci-dessus'
                    : `Aucune annonce de type "${TYPE_CONF[filter]?.label}"`}
                </div>
              </div>
            ) : filtered.map(a => {
              const conf = TYPE_CONF[a.type] || { label: a.type, color: 'var(--text3)', bg: 'var(--surface2)' };
              const av = avatarColor(a.author);
              return (
                <div key={a.id} className="row-hover"
                     style={{ ...s.annItem, borderLeft: `3px solid ${conf.color}` }}>
                  <div style={s.annTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div style={{ ...s.avatar, background: av, color: '#1a1a1a' }}>
                        {initials(a.author)}
                      </div>
                      <div>
                        <div style={s.authorName}>{a.author}</div>
                        <div style={s.authorMeta} title={fullDate(a.createdAt)}>
                          {timeAgo(a.createdAt)}
                          <span style={{ color: 'var(--border3)', margin: '0 6px' }}>·</span>
                          <span style={{ fontFamily: 'var(--mono)' }}>
                            {new Date(a.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        ...s.typeBadge,
                        background: conf.bg, color: conf.color,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: conf.color }} />
                        {conf.label}
                      </span>
                      <button onClick={() => setConfirm(a)} style={s.delBtn} title="Supprimer">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div style={s.annText}>{a.text}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Modal confirmation suppression */}
      {confirm && (
        <div style={s.overlay} onClick={() => setConfirm(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--red)' }}>
                Supprimer cette annonce ?
              </div>
              <button onClick={() => setConfirm(null)} style={s.closeBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: 22 }}>
              <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                Cette action est irréversible. L'annonce sera supprimée pour tous les employés.
              </p>
              <div style={{
                padding: '12px 14px', background: 'var(--bg)',
                border: `1px solid ${TYPE_CONF[confirm.type]?.br || 'var(--border)'}`,
                borderRadius: 10,
                fontSize: 12, color: 'var(--text2)',
                fontStyle: 'italic',
                marginBottom: 18,
              }}>
                « {confirm.text} »
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirm(null)} style={{
                  flex: 1, padding: 10, background: 'var(--bg)',
                  border: '1px solid var(--border2)', color: 'var(--text2)',
                  borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}>Annuler</button>
                <button onClick={() => remove(confirm.id)} style={{
                  flex: 1, padding: 10,
                  background: 'var(--red-bg)', color: 'var(--red)',
                  border: '1px solid var(--red-br)', borderRadius: 9,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ─── Sub: stat card ────────────────────────────────────────────────── */
function StatCard({ label, val, sub, color }) {
  return (
    <div style={s.statCard}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, color }}>{val ?? '—'}</div>
      <div style={s.statSub}>{sub}</div>
    </div>
  );
}

const s = {
  page: { padding: '24px 28px 40px', maxWidth: 1100, margin: '0 auto' },

  /* Stats */
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 },
  statCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '18px 20px',
  },
  statLabel: {
    fontSize: 10, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
    fontWeight: 500, marginBottom: 12,
  },
  statValue: { fontSize: 32, fontWeight: 300, lineHeight: 1, letterSpacing: '-1px', marginBottom: 8 },
  statSub: { fontSize: 12, color: 'var(--text3)' },

  /* Form */
  formCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '22px 24px', marginBottom: 14,
  },
  formHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14,
  },
  formTitle: { fontSize: 16, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.2px' },
  formSub:   { fontSize: 12, color: 'var(--text3)', marginTop: 3 },
  megaphone: {
    width: 40, height: 40, borderRadius: 10,
    background: 'var(--accent-soft)',
    border: '1px solid rgba(139,158,255,0.25)',
    color: 'var(--accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  bigInput: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border2)',
    borderRadius: 11,
    padding: '12px 14px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none', resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    marginBottom: 12,
  },
  formFooter: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 12, flexWrap: 'wrap',
  },
  typePicker: { display: 'flex', gap: 6 },
  typeBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px',
    border: '1px solid',
    borderRadius: 99,
    fontSize: 11, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  publishBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 18px',
    background: 'var(--text)',
    color: 'var(--bg)',
    border: 'none', borderRadius: 10,
    fontSize: 12, fontWeight: 600,
    fontFamily: 'inherit',
  },

  /* Liste */
  listCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, overflow: 'hidden',
  },
  listHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    gap: 12, flexWrap: 'wrap',
  },
  listTitle: { fontSize: 15, fontWeight: 500, color: 'var(--text)' },
  listSub:   { fontSize: 12, color: 'var(--text3)', marginTop: 3 },
  tabs: { display: 'flex', gap: 4 },
  tab: {
    padding: '6px 12px', borderRadius: 8,
    fontSize: 11, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* Item annonce */
  annItem: {
    margin: '10px 14px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '14px 16px',
    transition: 'background 120ms ease',
  },
  annTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, gap: 8,
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 600, flexShrink: 0,
  },
  authorName: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  authorMeta: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  typeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 99,
    fontSize: 10, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  delBtn: {
    background: 'transparent',
    border: '1px solid var(--border2)',
    color: 'var(--text3)',
    borderRadius: 7,
    padding: '5px 7px',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  annText: {
    fontSize: 14,
    color: 'var(--text)',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  empty: { textAlign: 'center', padding: '50px 20px' },
  emptyIcon: {
    width: 50, height: 50, borderRadius: '50%',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text3)', marginBottom: 12,
  },

  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 14, width: 420, overflow: 'hidden',
  },
  modalHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '15px 22px', borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text2)',
    cursor: 'pointer', padding: 4, display: 'flex',
  },
};

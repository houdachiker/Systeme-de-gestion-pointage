import { useState, useEffect } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import useResponsive from '../hooks/useResponsive';

const DEPT_COLORS = {
  'Opérations & Production':    '#e18296',
  'Finance & Comptabilité':     '#e0b074',
  'Ressources Humaines':        '#7dd3a8',
  'Commercial & Marketing':     '#a78bfa',
  'Informatique (IT / DSI)':    '#8b9eff',
  'Juridique & Conformité':     '#9eb5d4',
};
function deptColor(d) { return DEPT_COLORS[d] || 'var(--text3)'; }

const DEPARTEMENTS = Object.keys(DEPT_COLORS);

function generateMatricule() {
  const suffix = Date.now().toString().slice(-6);
  const rand = Math.floor(Math.random() * 90 + 10);
  return `EMP${suffix}${rand}`;
}

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

function Avatar({ nom, size = 36 }) {
  const color = avatarColor(nom);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: '#1a1a1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 600, flexShrink: 0,
    }}>
      {initials(nom)}
    </div>
  );
}

function StatusBadge({ statut }) {
  const cfg = {
    PRESENT:     { label: 'Présent',     color: 'var(--green)',  bg: 'var(--green-bg)' },
    TELETRAVAIL: { label: 'Télétravail', color: 'var(--cyan)',   bg: 'var(--cyan-bg)' },
    CONGE:       { label: 'En congé',    color: 'var(--purple)', bg: 'var(--purple-bg)' },
    ABSENT:      { label: 'Absent',      color: 'var(--amber)',  bg: 'var(--amber-bg)' },
  }[statut] || { label: '—', color: 'var(--text3)', bg: 'var(--surface2)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 500,
      background: cfg.bg, color: cfg.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */
export default function Employes() {
  const { isMobile } = useResponsive();
  const [employes, setEmployes]     = useState([]);
  const [todayEnrichi, setToday]    = useState([]);
  const [conges, setConges]         = useState([]);
  const [search, setSearch]         = useState('');
  const [deptFilter, setDeptFilter] = useState('Tous');
  const [viewMode, setViewMode]     = useState('list');
  const [showModal, setShowModal]   = useState(false);
  const [editModal, setEditModal]   = useState(null);
  const [deleteConfirm, setDelete]  = useState(null);
  const [form, setForm] = useState({ nom: '', email: '', password: '', role: 'EMPLOYE', matricule: '', departement: '' });
  const [editForm, setEditForm] = useState({});
  const [msg, setMsg] = useState(null);

  const load = () => {
    api.get('/auth/users').then(r => setEmployes(r.data)).catch(() => {});
    api.get('/pointage/today/enrichi').then(r => setToday(r.data)).catch(() => {});
    api.get('/conge').then(r => setConges(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const showMsg = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000); };

  const getStatut = (emp) => {
    const today = new Date().toISOString().split('T')[0];
    const enConge = conges.some(c =>
      c.userId === emp.id && c.statut === 'VALIDE' &&
      c.dateDebut && c.dateFin && today >= c.dateDebut && today <= c.dateFin
    );
    if (enConge) return 'CONGE';
    const p = todayEnrichi.find(x => x.userId === emp.id);
    if (p) return p.modeTravail === 'TELETRAVAIL' ? 'TELETRAVAIL' : 'PRESENT';
    return 'ABSENT';
  };

  const depts = ['Tous', ...new Set(employes.map(e => e.departement).filter(Boolean))];

  const filtered = employes.filter(e => {
    const ms = !search ||
      e.nom?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.departement?.toLowerCase().includes(search.toLowerCase()) ||
      e.matricule?.toLowerCase().includes(search.toLowerCase());
    const md = deptFilter === 'Tous' || e.departement === deptFilter;
    return ms && md;
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, matricule: form.matricule?.trim() || generateMatricule() };
      await api.post('/auth/register', payload);
      showMsg(true, 'Employé créé.');
      setShowModal(false);
      setForm({ nom: '', email: '', password: '', role: 'EMPLOYE', matricule: '', departement: '' });
      load();
    } catch (err) {
      showMsg(false, err.response?.data?.message || 'Erreur lors de la création.');
    }
  };

  const openEdit = (emp) => {
    setEditForm({
      nom: emp.nom || '', email: emp.email || '', password: '',
      role: emp.role || 'EMPLOYE',
      matricule: emp.matricule || '',
      departement: emp.departement || '',
    });
    setEditModal(emp);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/auth/users/${editModal.id}`, editForm);
      showMsg(true, 'Employé modifié.');
      setEditModal(null); load();
    } catch (err) {
      showMsg(false, err.response?.data?.message || 'Erreur lors de la modification.');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/auth/users/${deleteConfirm.id}`);
      showMsg(true, `Employé "${deleteConfirm.nom}" supprimé.`);
      setDelete(null); load();
    } catch (err) {
      showMsg(false, err.response?.data?.message || 'Erreur lors de la suppression.');
    }
  };

  const pagePad = isMobile ? '14px 12px 40px' : '24px 28px 40px';

  return (
    <Layout title="Employés" subtitle={`${employes.length} membre${employes.length !== 1 ? 's' : ''} dans l'équipe`}>
      <style>{`
        .row-hover:hover { background: rgba(255,255,255,0.025); }
        .dept-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .dept-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ ...s.page, padding: pagePad }}>
        <div style={{
          ...s.headerActions,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
        }}>
          <div /> {/* spacer */}
          <button
            id="employes-btn-add"
            onClick={() => setShowModal(true)}
            style={{ ...s.btnPrimary, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ajouter un employé
          </button>
        </div>

        {msg && (
          <div style={{
            ...s.msg,
            background: msg.ok ? 'var(--green-bg)' : 'var(--red-bg)',
            color: msg.ok ? 'var(--green)' : 'var(--red)',
            borderColor: msg.ok ? 'var(--green-br)' : 'var(--red-br)',
          }}>
            {msg.text}
          </div>
        )}

        {/* Filtres département — scroll horizontal sur mobile */}
        <div className="dept-scroll" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 6, paddingBottom: 2, minWidth: 'max-content' }}>
            {depts.map(d => {
              const count = d === 'Tous' ? employes.length : employes.filter(e => e.departement === d).length;
              const active = deptFilter === d;
              return (
                <button
                  key={d}
                  id={`dept-filter-${d.replace(/\s+/g, '-').toLowerCase()}`}
                  onClick={() => setDeptFilter(d)}
                  style={{
                    ...s.deptTab,
                    background: active ? 'var(--surface2)' : 'transparent',
                    color:      active ? 'var(--text)' : 'var(--text2)',
                    border:     active ? '1px solid var(--border2)' : '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                >
                  {d !== 'Tous' && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: deptColor(d), marginRight: 6,
                    }} />
                  )}
                  {d} <span style={{ opacity: 0.5, marginLeft: 4 }}>· {count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          ...s.toolbar,
          flexWrap: 'wrap',
          gap: isMobile ? 8 : 10,
        }}>
          <div style={{ ...s.searchBox, maxWidth: isMobile ? '100%' : 380, flex: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="var(--text3)" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              id="employes-search"
              placeholder="Rechercher par nom, e-mail, matricule..."
              style={s.searchInput}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={s.viewToggle}>
            <button
              id="employes-view-list"
              onClick={() => setViewMode('list')}
              title="Vue liste"
              style={{
                ...s.toggleBtn,
                background: viewMode === 'list' ? 'var(--surface2)' : 'transparent',
                color:      viewMode === 'list' ? 'var(--text)' : 'var(--text3)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
            <button
              id="employes-view-grid"
              onClick={() => setViewMode('grid')}
              title="Vue grille"
              style={{
                ...s.toggleBtn,
                background: viewMode === 'grid' ? 'var(--surface2)' : 'transparent',
                color:      viewMode === 'grid' ? 'var(--text)' : 'var(--text3)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Liste / Grille */}
        {viewMode === 'list' ? (
          <div style={s.panel}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ ...s.table, minWidth: isMobile ? 560 : '100%' }}>
                <thead>
                  <tr>
                    {['Employé', 'Email', 'Département', 'Rôle', 'Statut', ''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 60, color: 'var(--text3)', fontSize: 13 }}>
                        Aucun employé trouvé
                      </td>
                    </tr>
                  ) : filtered.map(emp => {
                    const isAdmin = emp.role === 'ADMIN';
                    const dc = deptColor(emp.departement);
                    return (
                      <tr key={emp.id} className="row-hover" style={s.tr}>
                        <td style={s.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <Avatar nom={emp.nom} />
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{emp.nom}</div>
                              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                                {emp.matricule || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...s.td, fontSize: 12, color: 'var(--text2)' }}>{emp.email}</td>
                        <td style={s.td}>
                          {emp.departement ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dc }} />
                              {emp.departement}
                            </span>
                          ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={s.td}>
                          <span style={{
                            fontSize: 11, fontWeight: 500,
                            padding: '3px 10px', borderRadius: 12,
                            background: isAdmin ? 'var(--accent-soft)' : 'var(--green-bg)',
                            color:      isAdmin ? 'var(--accent)' : 'var(--green)',
                          }}>
                            {isAdmin ? 'Admin' : 'Employé'}
                          </span>
                        </td>
                        <td style={s.td}><StatusBadge statut={getStatut(emp)} /></td>
                        <td style={s.td}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              id={`emp-edit-${emp.id}`}
                              onClick={() => openEdit(emp)}
                              style={s.iconBtn}
                              title="Modifier"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                   stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              id={`emp-delete-${emp.id}`}
                              onClick={() => setDelete(emp)}
                              style={{ ...s.iconBtn, color: 'var(--red)', borderColor: 'var(--red-br)', background: 'var(--red-bg)' }}
                              title="Supprimer"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                   stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={s.grid}>
            {filtered.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
                Aucun employé trouvé
              </div>
            ) : filtered.map(emp => {
              const isAdmin = emp.role === 'ADMIN';
              const dc = deptColor(emp.departement);
              return (
                <div key={emp.id} style={s.empCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <Avatar nom={emp.nom} size={44} />
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      padding: '3px 10px', borderRadius: 12,
                      background: isAdmin ? 'var(--accent-soft)' : 'var(--green-bg)',
                      color:      isAdmin ? 'var(--accent)' : 'var(--green)',
                    }}>
                      {isAdmin ? 'Admin' : 'Employé'}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 3 }}>{emp.nom}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{emp.email}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {emp.matricule && <span style={s.metaTag}>#{emp.matricule}</span>}
                    {emp.departement && (
                      <span style={{ ...s.metaTag, background: `${dc}1A`, color: dc, borderColor: `${dc}30` }}>
                        {emp.departement}
                      </span>
                    )}
                  </div>
                  <div style={{ marginBottom: 14 }}><StatusBadge statut={getStatut(emp)} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => openEdit(emp)} style={{
                      padding: 7, borderRadius: 8, cursor: 'pointer',
                      background: 'var(--surface2)', color: 'var(--text2)',
                      border: '1px solid var(--border2)',
                      fontSize: 11, fontWeight: 500,
                    }}>Modifier</button>
                    <button onClick={() => setDelete(emp)} style={{
                      padding: 7, borderRadius: 8, cursor: 'pointer',
                      background: 'var(--red-bg)', color: 'var(--red)',
                      border: '1px solid var(--red-br)',
                      fontSize: 11, fontWeight: 500,
                    }}>Supprimer</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && <EmployeModal
        title="Nouvel employé"
        form={form} setForm={setForm}
        onSubmit={handleCreate}
        onClose={() => setShowModal(false)}
        submitLabel="Créer l'employé"
        showPassword passwordOptional={false} />}

      {editModal && <EmployeModal
        title={`Modifier — ${editModal.nom}`}
        form={editForm} setForm={setEditForm}
        onSubmit={handleEdit}
        onClose={() => setEditModal(null)}
        submitLabel="Enregistrer"
        showPassword passwordOptional />}

      {deleteConfirm && (
        <div style={s.overlay} onClick={() => setDelete(null)}>
          <div style={{ ...s.modal, width: 'min(400px,92vw)' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--red)' }}>Confirmer la suppression</div>
              <button onClick={() => setDelete(null)} style={s.closeBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: 22 }}>
              <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 18, lineHeight: 1.5 }}>
                Êtes-vous sûr de vouloir supprimer <strong style={{ color: 'var(--text)' }}>{deleteConfirm.nom}</strong> ?
                Cette action est irréversible.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDelete(null)} style={{
                  flex: 1, padding: 10, background: 'var(--bg)', color: 'var(--text2)',
                  border: '1px solid var(--border2)', borderRadius: 9,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}>Annuler</button>
                <button
                  id="employes-confirm-delete"
                  onClick={handleDelete}
                  style={{
                    flex: 1, padding: 10,
                    background: 'var(--red-bg)', color: 'var(--red)',
                    border: '1px solid var(--red-br)', borderRadius: 9,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ─── Modal employé ─────────────────────────────────────────────── */
function EmployeModal({ title, form, setForm, onSubmit, onClose, submitLabel, showPassword, passwordOptional }) {
  const s2 = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '0 12px' },
    modal: { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 22px', borderBottom: '1px solid var(--border)' },
    body: { padding: 22 },
    /* Single column on narrow screens, 2-col on wide */
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 18 },
    close: { background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    field: { display: 'flex', flexDirection: 'column', gap: 5 },
    label: { fontSize: 10, fontWeight: 500, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1.2px' },
    input: { background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 9, padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' },
    btn: { width: '100%', padding: 11, background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  };
  return (
    <div style={s2.overlay} onClick={onClose}>
      <div style={s2.modal} onClick={e => e.stopPropagation()}>
        <div style={s2.header}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{title}</div>
          <button onClick={onClose} style={s2.close}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} style={s2.body}>
          <div style={s2.grid}>
            {[
              { k: 'nom',   label: 'Nom complet', ph: 'Prénom Nom', req: true },
              { k: 'email', label: 'Email',       ph: 'email@exemple.com', type: 'email', req: true },
              ...(showPassword ? [{
                k: 'password',
                label: passwordOptional ? 'Mot de passe (optionnel)' : 'Mot de passe',
                ph: '••••••••', type: 'password', req: !passwordOptional,
              }] : []),
            ].map(({ k, label, ph, type = 'text', req }) => (
              <div key={k} style={s2.field}>
                <label style={s2.label}>{label}</label>
                <input type={type} required={req} placeholder={ph} style={s2.input}
                       value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <div style={s2.field}>
              <label style={s2.label}>Département</label>
              <select style={s2.input} value={form.departement || ''} onChange={e => setForm({ ...form, departement: e.target.value })}>
                <option value="">Sélectionner...</option>
                {DEPARTEMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={s2.field}>
              <label style={s2.label}>Rôle</label>
              <select style={s2.input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="EMPLOYE">Employé</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>
          </div>
          <button type="submit" style={s2.btn}>{submitLabel}</button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page: { maxWidth: 1320, margin: '0 auto' },
  headerActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 16px',
    background: 'var(--text)', color: 'var(--bg)',
    border: 'none', borderRadius: 10,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  msg: { padding: '10px 14px', borderRadius: 10, border: '1px solid', fontSize: 12, fontWeight: 500, marginBottom: 16 },
  deptTab: {
    padding: '6px 13px', borderRadius: 20,
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center',
    fontFamily: 'inherit',
  },
  toolbar: { display: 'flex', alignItems: 'center', marginBottom: 16 },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 12px',
  },
  searchInput: { background: 'none', border: 'none', color: 'var(--text)', fontSize: 13, outline: 'none', flex: 1, minWidth: 0 },
  viewToggle: {
    display: 'flex',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 9, overflow: 'hidden', flexShrink: 0,
  },
  toggleBtn: { padding: '7px 11px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  panel: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 18px', textAlign: 'left',
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '14px 18px', fontSize: 13, color: 'var(--text)' },
  iconBtn: {
    padding: '6px 8px',
    background: 'transparent', border: '1px solid var(--border2)',
    color: 'var(--text2)', borderRadius: 7,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 },
  empCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: 18,
  },
  metaTag: {
    fontSize: 11, padding: '2px 8px', borderRadius: 6,
    background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)',
  },

  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  modal: { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 14, maxHeight: '90vh', overflow: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 22px', borderBottom: '1px solid var(--border)' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text2)',
    cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};

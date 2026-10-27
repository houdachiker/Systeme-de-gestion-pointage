import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/Layout';
import useResponsive from '../hooks/useResponsive';

/* ── Jours fériés Maroc ──────────────────────────────────────────── */
function getJoursFeries(year) {
  return [
    { date: `${year}-01-01`, label: "Nouvel An" },
    { date: `${year}-01-11`, label: "Manifeste de l'Indépendance" },
    { date: `${year}-05-01`, label: "Fête du Travail" },
    { date: `${year}-07-30`, label: "Fête du Trône" },
    { date: `${year}-08-14`, label: "Allégeance Oued Eddahab" },
    { date: `${year}-08-20`, label: "Révolution du Roi et du Peuple" },
    { date: `${year}-08-21`, label: "Fête de la Jeunesse" },
    { date: `${year}-11-06`, label: "Marche Verte" },
    { date: `${year}-11-18`, label: "Fête de l'Indépendance" },
  ];
}

const STATUS = {
  EN_ATTENTE: { label: 'En attente', color: 'var(--amber)',  bg: 'var(--amber-bg)',  border: 'var(--amber-br)' },
  VALIDE:     { label: 'Approuvée',  color: 'var(--green)',  bg: 'var(--green-bg)',  border: 'var(--green-br)' },
  REFUSE:     { label: 'Refusée',    color: 'var(--red)',    bg: 'var(--red-bg)',    border: 'var(--red-br)'   },
};
const TYPE_CONF = {
  ANNUEL:       { label: 'Congés payés',  color: 'var(--accent)' },
  MALADIE:      { label: 'Maladie',       color: 'var(--red)' },
  EXCEPTIONNEL: { label: 'Exceptionnel',  color: 'var(--amber)' },
  RTT:          { label: 'RTT',           color: 'var(--purple)' },
  FAMILIAL:     { label: 'Familial',      color: 'var(--cyan)' },
};

/* Jours calendaires (du jour A au jour B inclus) — utile pour info */
function days(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);
}

/* Jours OUVRÉS (Lun-Ven, excluant fériés Maroc) — utilisé pour le solde */
function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return 0;
  const yearsSet = new Set([s.getFullYear(), e.getFullYear()]);
  const feries = new Set();
  yearsSet.forEach(y => getJoursFeries(y).forEach(f => feries.add(f.date)));
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay(); // 0 = dim, 6 = sam
    const iso = cur.toISOString().split('T')[0];
    if (day !== 0 && day !== 6 && !feries.has(iso)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/* Quota par type (en jours ouvrés) */
const QUOTAS = {
  ANNUEL:       18,   // Congés payés annuels
  RTT:          5,    // Récupération temps de travail
  MALADIE:      90,   // Plafond annuel maladie
  EXCEPTIONNEL: 5,    // Congés exceptionnels (mariage, naissance, deuil, etc.)
  FAMILIAL:     3,    // Familial
};
function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtIso(d) {
  if (!d) return '—';
  return new Date(d).toISOString().split('T')[0];
}
function getCongeId(c) { return c?.id || c?._id || ''; }
function overlaps(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 <= b2 && b1 <= a2;
}

/* ── Mini calendrier ─────────────────────────────────────────────── */
function MiniCalendar({ conges }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const feries = getJoursFeries(year);

  const firstDay = new Date(year, month, 1).getDay();
  const offset   = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pendingRanges = conges
    .filter(c => c.statut === 'EN_ATTENTE')
    .map(c => ({ start: c.dateDebut, end: c.dateFin }));
  const validRanges = conges
    .filter(c => c.statut === 'VALIDE')
    .map(c => ({ start: c.dateDebut, end: c.dateFin }));

  function getCellType(day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today.toISOString().split('T')[0];
    const ferie = feries.find(f => f.date === dateStr);
    const inPending = pendingRanges.some(r => r.start && r.end && dateStr >= r.start && dateStr <= r.end);
    const inValid   = validRanges.some(r => r.start && r.end && dateStr >= r.start && dateStr <= r.end);
    return { isToday, ferie, inPending, inValid };
  }

  const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const dayNames = ['L','M','M','J','V','S','D'];
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={cs.card}>
      <div style={cs.head}>
        <span style={cs.section}>CALENDRIER</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={cs.navBtn} aria-label="Précédent">‹</button>
          <span style={cs.month}>{months[month]} {year}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={cs.navBtn} aria-label="Suivant">›</button>
        </div>
      </div>
      <div style={cs.subLabel}>Vos jours posés</div>

      <div style={cs.dayGrid}>
        {dayNames.map((d, i) => <div key={i} style={cs.dayName}>{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const { isToday, ferie, inPending, inValid } = getCellType(day);
          return (
            <div key={day} title={ferie?.label || ''} style={{
              ...cs.dayCell,
              background: isToday
                ? 'var(--accent)'
                : inValid
                  ? 'var(--green-bg)'
                  : ferie
                    ? 'var(--amber-bg)'
                    : inPending
                      ? 'var(--amber-bg)'
                      : 'transparent',
              color: isToday
                ? '#0e0e10'
                : inValid
                  ? 'var(--green)'
                  : ferie
                    ? 'var(--amber)'
                    : inPending
                      ? 'var(--amber)'
                      : 'var(--text2)',
              border: isToday ? 'none' : (ferie || inPending || inValid) ? '1px solid' : '1px solid transparent',
              borderColor: ferie ? 'var(--amber-br)' : inPending ? 'var(--amber-br)' : inValid ? 'var(--green-br)' : 'transparent',
              fontWeight: isToday ? 600 : 400,
              borderRadius: isToday ? '50%' : 6,
            }}>
              {day}
            </div>
          );
        })}
      </div>

      <div style={cs.legend}>
        <span style={cs.legendItem}>
          <span style={{ ...cs.dot, background: 'var(--amber-bg)', border: '1px solid var(--amber-br)' }} />
          Demande en attente
        </span>
        <span style={cs.legendItem}>
          <span style={{ ...cs.dot, background: 'var(--accent)' }} />
          Aujourd'hui
        </span>
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────── */
export default function Conges() {
  const { isMobile } = useResponsive();
  const { user } = useAuth();
  const [conges, setConges]     = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ dateDebut: '', dateFin: '', type: 'ANNUEL', motif: '' });
  const [msg, setMsg]           = useState(null);
  const [submitting, setSub]    = useState(false);
  const [promptMsg, setPrompt]  = useState(null);
  const [editId, setEditId]     = useState(null);

  const load = () => api.get(`/conge/user/${user.id}`).then(r => setConges(r.data)).catch(() => {});
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMessage = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000); };

  const resetForm = () => {
    setForm({ dateDebut: '', dateFin: '', type: 'ANNUEL', motif: '' });
    setEditId(null);
  };

  const openEdit = (c) => {
    setForm({ dateDebut: c.dateDebut || '', dateFin: c.dateFin || '', type: c.type || 'ANNUEL', motif: c.motif || '' });
    setEditId(getCongeId(c));
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.dateDebut || !form.dateFin) {
      showMessage(false, 'Veuillez renseigner les dates.'); return;
    }
    if (new Date(form.dateFin) < new Date(form.dateDebut)) {
      showMessage(false, 'La date de fin doit être après la date de début.'); return;
    }
    const dOuvre = workingDays(form.dateDebut, form.dateFin);
    if (dOuvre === 0) {
      showMessage(false, 'La période sélectionnée ne contient aucun jour ouvré (weekends/fériés uniquement).');
      return;
    }

    /* Validation quota par type */
    const quota = QUOTAS[form.type] || 0;
    const usedSameType = conges
      .filter(c => c.type === form.type)
      .filter(c => c.statut !== 'REFUSE')
      .filter(c => !editId || getCongeId(c) !== editId)
      .reduce((acc, c) => acc + workingDays(c.dateDebut, c.dateFin), 0);
    const restante = Math.max(0, quota - usedSameType);
    if (dOuvre > restante) {
      const typeLbl = TYPE_CONF[form.type]?.label || form.type;
      showMessage(false,
        `Solde insuffisant pour « ${typeLbl} » : ${dOuvre} jour${dOuvre > 1 ? 's' : ''} ouvré${dOuvre > 1 ? 's' : ''} demandé${dOuvre > 1 ? 's' : ''}, ${restante} disponible${restante > 1 ? 's' : ''} sur ${quota}.`
      );
      return;
    }

    const hasOverlap = conges
      .filter(c => c.statut !== 'REFUSE')
      .filter(c => !editId || getCongeId(c) !== editId)
      .some(c => overlaps(form.dateDebut, form.dateFin, c.dateDebut, c.dateFin));
    if (hasOverlap) {
      setPrompt('Ces jours sont indisponibles : vous avez déjà une demande de congé sur cette période.');
      return;
    }
    setSub(true);
    try {
      if (editId) {
        await api.put(`/conge/${editId}`, { ...form, userId: user.id });
        showMessage(true, 'Demande modifiée.');
      } else {
        await api.post('/conge', { ...form, userId: user.id });
        showMessage(true, 'Demande envoyée.');
      }
      setShowForm(false); resetForm(); load();
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      if (serverMsg?.includes('déjà une demande')) setPrompt(`Ces jours sont indisponibles : ${serverMsg}`);
      else showMessage(false, 'Erreur lors de la soumission.');
    } finally { setSub(false); }
  };

  const handleCancel = async (id) => {
    if (!id) { showMessage(false, 'Identifiant introuvable.'); return; }
    try {
      await api.delete(`/conge/${id}/annuler`);
      showMessage(true, 'Demande annulée.');
      load();
    } catch (err) {
      showMessage(false, err.response?.data?.message || "Erreur lors de l'annulation.");
    }
  };

  /* Métriques — calcul en JOURS OUVRÉS (Lun-Ven, hors fériés) */
  /* Solde Congés payés (ANNUEL) */
  const annuelList   = conges.filter(c => c.type === 'ANNUEL');
  const totalValides = annuelList.filter(c => c.statut === 'VALIDE')
    .reduce((a, c) => a + workingDays(c.dateDebut, c.dateFin), 0);
  const totalAttente = annuelList.filter(c => c.statut === 'EN_ATTENTE')
    .reduce((a, c) => a + workingDays(c.dateDebut, c.dateFin), 0);
  const SOLDE_TOTAL  = QUOTAS.ANNUEL;
  const dispo        = Math.max(0, SOLDE_TOTAL - totalValides - totalAttente);
  const pris_pct     = Math.min(100, Math.round((totalValides / SOLDE_TOTAL) * 100));
  const att_pct      = Math.min(100 - pris_pct, Math.round((totalAttente / SOLDE_TOTAL) * 100));

  /* Solde RTT (séparé) */
  const rttList     = conges.filter(c => c.type === 'RTT' && c.statut !== 'REFUSE');
  const rttUsed     = rttList.reduce((a, c) => a + workingDays(c.dateDebut, c.dateFin), 0);
  const dispoRtt    = Math.max(0, QUOTAS.RTT - rttUsed);

  /* Durée demande en cours */
  const dureeOuvree     = workingDays(form.dateDebut, form.dateFin);
  const dureeCalendaire = days(form.dateDebut, form.dateFin);

  /* Solde restant pour le type sélectionné (utile dans le modal) */
  const usedForCurrentType = conges
    .filter(c => c.type === form.type && c.statut !== 'REFUSE')
    .filter(c => !editId || getCongeId(c) !== editId)
    .reduce((a, c) => a + workingDays(c.dateDebut, c.dateFin), 0);
  const quotaCurrent     = QUOTAS[form.type] || 0;
  const restantCurrent   = Math.max(0, quotaCurrent - usedForCurrentType);
  const exceeds          = dureeOuvree > restantCurrent;

  return (
    <Layout title="Mes congés" subtitle="Solde et historique">
      <div style={{ ...s.page, ...(isMobile ? { padding: '12px 4px 30px' } : {}) }}>
        {/* Header actions */}
        <div style={s.headerActions}>
          <div /> {/* spacer */}
          <button onClick={() => setShowForm(true)} style={s.newBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nouvelle demande
          </button>
        </div>

        {msg && (
          <div style={{
            ...s.msgBox,
            background: msg.ok ? 'var(--green-bg)' : 'var(--red-bg)',
            color:      msg.ok ? 'var(--green)' : 'var(--red)',
            borderColor: msg.ok ? 'var(--green-br)' : 'var(--red-br)',
          }}>
            {msg.text}
          </div>
        )}

        {/* Grid solde + calendrier */}
        <div style={{
          ...s.mainGrid,
          gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
        }}>
          {/* Solde */}
          <div style={s.soldeCard}>
            <div style={s.cardSection}>MES DROITS</div>
            <div style={s.cardTitle}>Solde de congés</div>
            <div style={s.cardSub}>
              Année {new Date().getFullYear() - 1}-{new Date().getFullYear()}
            </div>

            <div style={{
              ...s.soldeGrid,
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            }}>
              {[
                { label: 'DISPONIBLES', val: dispo,         sub: `sur ${QUOTAS.ANNUEL}`,  color: 'var(--accent)' },
                { label: 'PRIS',        val: totalValides,  sub: 'validés',               color: 'var(--green)' },
                { label: 'EN ATTENTE',  val: totalAttente,  sub: 'à valider',             color: 'var(--amber)' },
                { label: 'RTT',         val: dispoRtt,      sub: `sur ${QUOTAS.RTT}`,     color: 'var(--purple)' },
              ].map(({ label, val, sub, color }) => (
                <div key={label} style={{ ...s.soldeItem, ...(isMobile ? { padding: '10px' } : {}) }}>
                  <div style={s.soldeLbl}>{label}</div>
                  <div style={{ ...s.soldeNum, color, fontSize: isMobile ? 22 : 30 }}>{val}</div>
                  <div style={s.soldeUnit}>jours</div>
                  {sub && <div style={s.soldeSub}>{sub}</div>}
                </div>
              ))}
            </div>

            <div style={s.barSection}>
              <div style={s.barLabel}>RÉPARTITION DE L'ANNÉE</div>
              <div style={s.barTrack}>
                <div style={{ height: '100%', width: `${pris_pct}%`, background: 'var(--green)' }} />
                <div style={{ height: '100%', width: `${att_pct}%`, background: 'var(--amber)' }} />
                <div style={{ height: '100%', flex: 1, background: 'rgba(255,255,255,0.05)' }} />
              </div>
              <div style={s.barLegend}>
                <span style={s.legChip}><span style={{ ...s.legDot, background: 'var(--green)' }} />Pris {totalValides} j</span>
                <span style={s.legChip}><span style={{ ...s.legDot, background: 'var(--amber)' }} />En attente {totalAttente}j</span>
                <span style={s.legChip}><span style={{ ...s.legDot, background: 'rgba(255,255,255,0.2)' }} />Dispo {dispo} j</span>
              </div>
            </div>
          </div>

          <MiniCalendar conges={conges} />
        </div>

        {/* Historique */}
        <div style={s.histoCard}>
          <div style={s.histoHeader}>
            <span style={s.histoTitle}>Historique des demandes</span>
            <button style={s.exportBtn}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exporter
            </button>
          </div>

          <div className="table-responsive">
            <table style={s.table}>
              <thead>
                <tr>
                  {['DEMANDE','TYPE','PÉRIODE','JOURS OUVRÉS','STATUT',''].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conges.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>Aucune demande de congé</div>
                      <button onClick={() => setShowForm(true)} style={{
                        color: 'var(--accent)', background: 'none', border: 'none',
                        cursor: 'pointer', fontWeight: 500, fontSize: 12, marginTop: 8,
                      }}>
                        Faire une demande →
                      </button>
                    </td>
                  </tr>
                ) : conges.slice().reverse().map((c, i) => {
                  const stat  = STATUS[c.statut]  || {};
                  const tconf = TYPE_CONF[c.type] || { label: c.type, color: 'var(--text3)' };
                  const d     = workingDays(c.dateDebut, c.dateFin);
                  const dCal  = days(c.dateDebut, c.dateFin);
                  const id    = `L-${2387 - i + conges.length - 1}`;
                  const congeId = getCongeId(c);
                  return (
                    <tr key={congeId || i} style={s.tr}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{id}</div>
                        {c.motif && (
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.motif}</div>
                        )}
                      </td>
                      <td style={s.td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text2)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: tconf.color }} />
                          {tconf.label}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>
                        {fmtIso(c.dateDebut)} <span style={{ color: 'var(--text3)' }}>→</span> {fmtIso(c.dateFin)}
                      </td>
                      <td style={{ ...s.td, fontWeight: 500, color: 'var(--text)' }}>
                        <span>{d}</span>
                        <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6, fontFamily: 'var(--mono)' }}>
                          / {dCal}j cal.
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={{
                          ...s.statusBadge,
                          background: stat.bg, color: stat.color, border: `1px solid ${stat.border}`,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: stat.color }} />
                          {stat.label}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        {c.statut === 'EN_ATTENTE' ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button onClick={() => openEdit(c)} style={s.editBtn}>Modifier</button>
                            <button onClick={() => handleCancel(congeId)} style={s.cancelBtn}>Annuler</button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: 16 }}>›</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal demande */}
        {showForm && (
          <div style={s.overlay} onClick={() => { setShowForm(false); resetForm(); }}>
            <div style={{
              ...s.modal,
              width: isMobile ? '92vw' : 500,
            }} onClick={e => e.stopPropagation()}>
              <div style={s.modalHead}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                  {editId ? 'Modifier la demande' : 'Nouvelle demande de congé'}
                </div>
                <button onClick={() => { setShowForm(false); resetForm(); }} style={s.closeBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleSubmit} style={{ padding: isMobile ? '16px' : '22px' }}>
                <div style={s.field}>
                  <label style={s.lbl}>Type de congé</label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
                    gap: 8,
                  }}>
                    {Object.entries(TYPE_CONF).slice(0, 3).map(([k, conf]) => (
                      <button key={k} type="button" onClick={() => setForm({ ...form, type: k })} style={{
                        padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                        background: form.type === k ? `${conf.color}1A` : 'var(--bg)',
                        border: `1px solid ${form.type === k ? conf.color + '60' : 'var(--border2)'}`,
                        color:  form.type === k ? conf.color : 'var(--text2)',
                        fontSize: 12, fontWeight: 500,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: conf.color }} />
                        {conf.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 12,
                  marginBottom: 14,
                }}>
                  {[{ k: 'dateDebut', l: 'Date de début' }, { k: 'dateFin', l: 'Date de fin' }].map(({ k, l }) => (
                    <div key={k} style={s.field}>
                      <label style={s.lbl}>{l}</label>
                      <input type="date" required style={s.input}
                             value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
                    </div>
                  ))}
                </div>
                {dureeOuvree > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    gap: isMobile ? 6 : 10,
                    background: exceeds ? 'var(--red-bg)' : 'var(--accent-soft)',
                    border: `1px solid ${exceeds ? 'var(--red-br)' : 'var(--border2)'}`,
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 14,
                  }}>
                    <span style={{ fontWeight: 600, color: exceeds ? 'var(--red)' : 'var(--accent)', fontSize: 13 }}>
                      📅 {dureeOuvree} jour{dureeOuvree > 1 ? 's' : ''} ouvré{dureeOuvree > 1 ? 's' : ''}
                    </span>
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>
                      du {fmt(form.dateDebut)} au {fmt(form.dateFin)} ({dureeCalendaire}j cal.) • Restant : {restantCurrent}j
                    </span>
                  </div>
                )}

                <div style={{ ...s.field, marginBottom: 20 }}>
                  <label style={s.lbl}>Motif <span style={{ color: 'var(--text3)', fontWeight: 400, textTransform: 'none' }}>(optionnel)</span></label>
                  <textarea style={{ ...s.input, height: 80, resize: 'vertical' }}
                    placeholder="Décrivez brièvement la raison..."
                    value={form.motif} onChange={e => setForm({ ...form, motif: e.target.value })} />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => { setShowForm(false); resetForm(); }} style={{ flex: 1, padding: '11px', background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>Annuler</button>
                  <button type="submit" disabled={submitting || exceeds || dureeOuvree === 0} style={{
                    flex: 2, padding: '11px',
                    background: exceeds ? 'var(--red-bg)' : 'linear-gradient(135deg,#4f7cff,#3b64e8)',
                    color: exceeds ? 'var(--red)' : '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: 14, fontWeight: 700,
                    cursor: (submitting || exceeds || dureeOuvree === 0) ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font)',
                    boxShadow: exceeds ? 'none' : '0 4px 14px rgba(79,124,255,0.3)',
                    opacity: submitting ? 0.7 : 1,
                  }}>
                    {submitting ? 'Envoi...'
                      : exceeds ? 'Solde insuffisant'
                      : dureeOuvree === 0 ? 'Aucun jour ouvré'
                      : editId ? 'Enregistrer' : 'Soumettre'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {promptMsg && (
          <div style={s.overlay} onClick={() => setPrompt(null)}>
            <div style={{ ...s.modal, width: 420 }} onClick={e => e.stopPropagation()}>
              <div style={s.modalHead}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Jours indisponibles</div>
                <button onClick={() => setPrompt(null)} style={s.closeBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div style={{ padding: 22 }}>
                <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>{promptMsg}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                  <button onClick={() => setPrompt(null)} style={s.newBtn}>OK</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

/* ── Styles ───────────────────────────────────────────────────────── */
const cs = {
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: 22,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  section: { fontSize: 10, fontWeight: 500, color: 'var(--text3)', letterSpacing: '1.2px', textTransform: 'uppercase' },
  month: { fontSize: 15, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.2px', margin: '0 4px' },
  navBtn: {
    background: 'none', border: 'none', color: 'var(--text2)',
    cursor: 'pointer', fontSize: 18, padding: '0 6px', borderRadius: 6, lineHeight: 1,
  },
  subLabel: { fontSize: 11, color: 'var(--text3)', marginBottom: 14 },
  dayGrid: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 12 },
  dayName: { fontSize: 11, fontWeight: 500, color: 'var(--text3)', textAlign: 'center', padding: '4px 0' },
  dayCell: {
    fontSize: 12, textAlign: 'center', padding: '6px 2px',
    aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px' },
  legendItem: { fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 3, display: 'inline-block', flexShrink: 0 },
};

const s = {
  page: { padding: '24px 28px 40px', maxWidth: 1320, margin: '0 auto' },
  headerActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  newBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 16px',
    background: 'var(--text)', color: 'var(--bg)',
    border: 'none', borderRadius: 10,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  msgBox: {
    padding: '10px 14px', borderRadius: 10, border: '1px solid',
    fontSize: 12, fontWeight: 500, marginBottom: 16,
  },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, marginBottom: 14 },

  /* Solde card */
  soldeCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: 24,
  },
  cardSection: {
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 6,
  },
  cardTitle: { fontSize: 22, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.4px' },
  cardSub: { fontSize: 12, color: 'var(--text3)', marginBottom: 22 },
  soldeGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22,
  },
  soldeItem: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 11, padding: '14px 14px',
  },
  soldeLbl: {
    fontSize: 9, fontWeight: 500, color: 'var(--text3)',
    letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 10,
  },
  soldeNum: { fontSize: 30, fontWeight: 300, letterSpacing: '-1px', lineHeight: 1 },
  soldeUnit: { fontSize: 11, color: 'var(--text3)', marginTop: 4 },
  soldeSub:  { fontSize: 10, color: 'var(--text3)', marginTop: 6, fontFamily: 'var(--mono)', letterSpacing: '0.5px' },

  barSection: {},
  barLabel: {
    fontSize: 9, fontWeight: 500, color: 'var(--text3)',
    letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 8,
  },
  barTrack: {
    height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.04)',
    display: 'flex', overflow: 'hidden', gap: 1, marginBottom: 10,
  },
  barLegend: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  legChip: { fontSize: 11, color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 6 },
  legDot: { width: 8, height: 8, borderRadius: 2 },

  /* Historique */
  histoCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, overflow: 'hidden',
  },
  histoHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
  },
  histoTitle: { fontSize: 15, fontWeight: 500, color: 'var(--text)' },
  exportBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 12px',
    background: 'transparent', color: 'var(--text2)',
    border: '1px solid var(--border2)', borderRadius: 9,
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 20px', textAlign: 'left',
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '14px 20px', fontSize: 13, color: 'var(--text)' },
  statusBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 11px', borderRadius: 12,
    fontSize: 11, fontWeight: 500,
  },
  editBtn: {
    padding: '5px 10px',
    background: 'transparent', color: 'var(--text2)',
    border: '1px solid var(--border2)', borderRadius: 7,
    fontSize: 11, fontWeight: 500, cursor: 'pointer',
  },
  cancelBtn: {
    padding: '5px 10px',
    background: 'var(--red-bg)', color: 'var(--red)',
    border: '1px solid var(--red-br)', borderRadius: 7,
    fontSize: 11, fontWeight: 500, cursor: 'pointer',
  },

  /* Modal */
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 14, width: 500, maxHeight: '90vh', overflow: 'auto',
  },
  modalHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '15px 22px', borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text2)',
    cursor: 'pointer', padding: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  lbl: {
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
  },
  input: {
    background: 'var(--bg)', border: '1px solid var(--border2)',
    borderRadius: 9, padding: '9px 12px',
    fontSize: 13, color: 'var(--text)', outline: 'none',
    width: '100%',
  },
};

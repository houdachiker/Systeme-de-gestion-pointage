import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCodeLib from 'qrcode';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import useResponsive from '../hooks/useResponsive';

/* ─── Constants ─────────────────────────────────────────────────────── */
const DEPARTEMENTS = [
  'Opérations & Production',
  'Finance & Comptabilité',
  'Ressources Humaines',
  'Commercial & Marketing',
  'Informatique (IT / DSI)',
  'Juridique & Conformité',
];
const DEPT_COLORS = {
  'Opérations & Production':    '#e18296',
  'Finance & Comptabilité':     '#e0b074',
  'Ressources Humaines':        '#7dd3a8',
  'Commercial & Marketing':     '#a78bfa',
  'Informatique (IT / DSI)':    '#8b9eff',
  'Juridique & Conformité':     '#9eb5d4',
};

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

/* ─── Countdown : ms → "HH:MM:SS" + version lisible "5h 23min" ────── */
function formatCountdown(ms) {
  if (ms <= 0) return { compact: '00:00:00', readable: 'Expiré' };
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const compact = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const readable = h > 0 ? `${h}h ${String(m).padStart(2, '0')}min`
                 : m > 0 ? `${m}min ${String(s).padStart(2, '0')}s`
                 : `${s}s`;
  return { compact, readable };
}

function downloadPointagesWorkbook(pointages, selectedDate) {
  const rows = pointages.map((pointage) => ({
    Date: pointage.date || selectedDate,
    Employé: pointage.nom || '',
    Matricule: pointage.matricule || '',
    Département: pointage.departement || '',
    Mode: pointage.modeTravail === 'TELETRAVAIL' ? 'Télétravail' : 'Présentiel',
    Entrée: pointage.heureEntree || '—',
    Sortie: pointage.heureSortie || '—',
    'Heures travaillées': pointage.heuresTravaillees || '—',
    Latitude: pointage.latitude || '—',
    Longitude: pointage.longitude || '—',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 16 },
    { wch: 26 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pointages');
  const fileDate = selectedDate || new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `rapport-pointages-${fileDate}.xlsx`);
}

/* ─── KPI card ───────────────────────────────────────────────────── */
function Kpi({ label, value, sub, trend, color = 'var(--text)' }) {
  return (
    <div style={K.card}>
      <div style={K.row}>
        <div style={K.label}>{label}</div>
        {trend != null && (
          <span style={{
            ...K.trend,
            color: trend >= 0 ? 'var(--green)' : 'var(--red)',
            background: trend >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="3"
                 style={{ transform: trend >= 0 ? 'none' : 'rotate(180deg)' }}>
              <polyline points="18 15 12 9 6 15" />
            </svg>
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div style={{ ...K.value, color }}>{value ?? '—'}</div>
      <div style={K.sub}>{sub}</div>
    </div>
  );
}
const K = {
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  row:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label:{ fontSize: 10, fontWeight: 500, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1.2px' },
  trend:{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99 },
  value:{ fontSize: 32, fontWeight: 300, lineHeight: 1, letterSpacing: '-1px', marginBottom: 8 },
  sub:  { fontSize: 12, color: 'var(--text3)' },
};

/* ──────────────────────────────────────────────────────────────────────
   Dashboard
   ────────────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const todayIso = new Date().toISOString().split('T')[0];
  const dataRequestIdRef = useRef(0);

  const [users, setUsers]         = useState([]);
  const [stats, setStats]         = useState(null);
  const [pointagesToday, setPT]   = useState([]);
  const [conges, setConges]       = useState([]);
  const [qrcodes, setQrcodes]     = useState([]);
  const [qrImages, setQrImages]   = useState({});
  const [now, setNow]             = useState(new Date());

  /* ─── Annonces RH (API backend) ─── */
  const [announcements, setAnnouncements] = useState([]);
  const [annInput, setAnnInput]   = useState('');
  const [annType, setAnnType]     = useState('INFO');
  const [annLoading, setAnnLoad]  = useState(false);

  const loadAnnouncements = () => {
    api.get('/announcement').then(r => setAnnouncements(r.data || [])).catch(() => {});
  };

  useEffect(() => {
    loadAnnouncements();
    const iv = setInterval(loadAnnouncements, 15000);
    return () => clearInterval(iv);
  }, []);

  const publishAnnouncement = async () => {
    const text = annInput.trim();
    if (!text || annLoading) return;
    setAnnLoad(true);
    try {
      await api.post('/announcement', {
        text,
        type: annType,
        author: user?.nom || 'Administrateur',
        authorId: user?.id || null,
      });
      setAnnInput('');
      setAnnType('INFO');
      loadAnnouncements();
    } catch (err) {
      console.error('Erreur publication annonce', err);
    } finally { setAnnLoad(false); }
  };


  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchAll = useCallback(() => {
    const requestId = ++dataRequestIdRef.current;

    setPT([]);

    api.get('/pointage/stats')
      .then(r => { if (dataRequestIdRef.current === requestId) setStats(r.data); })
      .catch(() => { if (dataRequestIdRef.current === requestId) setStats(null); });

    api.get('/pointage/today/enrichi')
      .then(r => { if (dataRequestIdRef.current === requestId) setPT(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (dataRequestIdRef.current === requestId) setPT([]); });

    api.get('/auth/users').then(r => { if (dataRequestIdRef.current === requestId) setUsers(r.data); }).catch(() => {});
    api.get('/conge').then(r => { if (dataRequestIdRef.current === requestId) setConges(r.data); }).catch(() => {});
    api.get('/qrcode').then(r => { if (dataRequestIdRef.current === requestId) setQrcodes(r.data); }).catch(() => {});
  }, []);

  /* Générer thumbnails QR codes */
  useEffect(() => {
    qrcodes.forEach(qr => {
      if (qr.urlPointage && !qrImages[qr.id]) {
        QRCodeLib.toDataURL(qr.urlPointage, {
          width: 120, margin: 1,
          color: { dark: '#f5f5f7', light: '#1c1c22' },
        }).then(url => setQrImages(prev => ({ ...prev, [qr.id]: url }))).catch(() => {});
      }
    });
  }, [qrcodes, qrImages]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  /* ─── Métriques métier ─── */
  const employes      = users.filter(u => u.role === 'EMPLOYE');
  const totalEmp      = employes.length;
  const presents      = stats?.today ?? pointagesToday.length;
  const teletravail   = stats?.teletravail ?? pointagesToday.filter(p => p.modeTravail === 'TELETRAVAIL').length;
  const presentielNb  = presents - teletravail;
  const selectedTeletravail = pointagesToday.filter(p => p.modeTravail === 'TELETRAVAIL').length;
  const selectedPresentiel  = pointagesToday.length - selectedTeletravail;
  const congesEnCours = conges.filter(c => {
    const today = new Date().toISOString().split('T')[0];
    return c.statut === 'VALIDE' && c.dateDebut <= today && c.dateFin >= today;
  }).length;
  const congesAttente = conges.filter(c => c.statut === 'EN_ATTENTE').length;
  const absentsCalc   = Math.max(0, totalEmp - presents - congesEnCours);
  const tauxPresence  = totalEmp ? Math.round((presents / totalEmp) * 100) : 0;

  /* Répartition par département */
  const deptData = DEPARTEMENTS.map(d => ({
    departement: d,
    count: employes.filter(u => u.departement === d).length,
  }));

  /* QR codes actifs avec calcul du temps restant */
  const activeQRs = qrcodes
    .filter(qr => qr.actif && qr.dateExpiration && new Date(qr.dateExpiration) > now)
    .map(qr => {
      const exp = new Date(qr.dateExpiration);
      const gen = new Date(qr.dateGeneration);
      const totalMs = exp - gen;
      const remainingMs = Math.max(0, exp - now);
      const elapsedMs = totalMs - remainingMs;
      const pct = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 0;
      return { ...qr, totalMs, remainingMs, elapsedMs, pct };
    })
    .sort((a, b) => a.remainingMs - b.remainingMs);

  /* Congés à valider (alertes admin) */
  const congesAValider = conges
    .filter(c => c.statut === 'EN_ATTENTE')
    .slice(0, 4);

  /* User name */
  const firstName = (user?.nom || 'Admin').split(' ')[0];

  const exportSelectedPointages = () => {
    if (pointagesToday.length === 0) return;
    downloadPointagesWorkbook(pointagesToday, todayIso);
  };

  /* ── Responsive computed styles ── */
  const kpiCols = isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)';
  const alertCols = isMobile ? '1fr' : '1fr 1fr';
  const pagePad = isMobile ? '14px 12px 40px' : '24px 28px 40px';

  return (
    <Layout topBar={false}>
      <style>{`
        .row-hover:hover { background: rgba(255,255,255,0.025); }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      <div style={{ ...S.page, padding: pagePad }}>
        {/* ═══ HERO ═══ */}
        <div style={{
          ...S.heroCard,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
        }}>
          <div>
            <div style={S.heroEyebrow}>
              <span style={S.heroDot} />
              SUPERVISION RH · CASABLANCA
            </div>
            <h1 style={{ ...S.heroTitle, fontSize: isMobile ? 20 : 24 }}>
              Bonjour <span style={S.heroName}>{firstName}</span>,
            </h1>
            <div style={S.heroDate}>
              {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}
              <span style={{ color: 'var(--text2)' }}>
                {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div style={{
            ...S.heroActions,
            width: isMobile ? '100%' : 'auto',
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            <button
              id="dash-btn-conges"
              onClick={() => navigate('/conges/admin')}
              style={{ ...S.btnOutline, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Demandes ({congesAttente})
            </button>
            <button
              id="dash-btn-add-employe"
              onClick={() => navigate('/employes')}
              style={{ ...S.btnPrimary, width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Ajouter un employé
            </button>
          </div>
        </div>

        {/* ═══ KPIs ═══ */}
        <section style={{ ...S.kpiGrid, gridTemplateColumns: kpiCols }}>
          <Kpi label="Taux de présence"  value={`${tauxPresence}%`}
               sub={`${presents}/${totalEmp} employés présents`} trend={4}
               color="var(--green)" />
          <Kpi label="Présents sur site" value={presentielNb}
               sub={`${teletravail} en télétravail`} color="var(--accent)" />
          <Kpi label="En congé"          value={congesEnCours}
               sub={`${congesAttente} demande${congesAttente > 1 ? 's' : ''} en attente`}
               color="var(--purple)" />
          <Kpi label="Employés absents" value={absentsCalc}
               sub={absentsCalc === 0
                 ? "Aucun absent aujourd'hui"
                 : `${absentsCalc} sur ${totalEmp} non pointé${absentsCalc > 1 ? 's' : ''}`}
               color={absentsCalc > 0 ? 'var(--red)' : 'var(--green)'} />
        </section>

        {/* ═══ Charts row ═══ */}
        <section style={{
          ...S.chartsRow,
          flexDirection: isMobile ? 'column' : 'row',
        }}>
          {/* QR Codes actifs avec countdown live */}
          <div style={{ ...S.panel, flex: isMobile ? 'none' : 1.4 }}>
            <div style={S.panelHead}>
              <div>
                <div style={S.panelTitle}>
                  QR Codes actifs
                  {activeQRs.length > 0 && <span style={S.countBadge}>{activeQRs.length}</span>}
                </div>
                <div style={S.panelSub}>
                  {activeQRs.length === 0
                    ? 'Aucun QR code actif'
                    : `${activeQRs.length} code${activeQRs.length > 1 ? 's' : ''} en cours · validité 24h`}
                </div>
              </div>
              <button id="dash-btn-manage-qr" onClick={() => navigate('/qrcodes')} style={S.linkBtn}>
                Gérer
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {activeQRs.length === 0 ? (
              <div style={S.qrEmpty}>
                <div style={S.qrEmptyIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <path d="M14 14h3v3M17 17h3v3M14 20h3" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, marginBottom: 4 }}>
                  Aucun QR code actif
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14 }}>
                  Générez un QR code pour permettre le pointage
                </div>
                <button id="dash-btn-gen-qr" onClick={() => navigate('/qrcodes')} style={S.btnPrimary}>
                  Générer un QR code
                </button>
              </div>
            ) : (
              <div style={S.qrList}>
                {activeQRs.slice(0, 3).map(qr => {
                  const { compact, readable } = formatCountdown(qr.remainingMs);
                  const urgent = qr.remainingMs < 3600000;
                  const warning = qr.remainingMs < 6 * 3600000;
                  const color = urgent ? 'var(--red)'
                              : warning ? 'var(--amber)'
                              : 'var(--green)';
                  return (
                    <div key={qr.id} style={S.qrCard}>
                      {/* Thumbnail */}
                      <div style={S.qrThumb}>
                        {qrImages[qr.id] ? (
                          <img src={qrImages[qr.id]} alt="QR"
                               style={{ width: 56, height: 56, borderRadius: 6, display: 'block' }} />
                        ) : (
                          <div style={S.qrPlaceholder}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                                 stroke="var(--text3)" strokeWidth="1.6">
                              <rect x="3" y="3" width="7" height="7" />
                              <rect x="14" y="3" width="7" height="7" />
                              <rect x="3" y="14" width="7" height="7" />
                              <path d="M14 14h3v3M17 17h3v3M14 20h3" strokeLinecap="round" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info principale */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.qrTopRow}>
                          <span style={S.qrToken}>
                            #{String(qr.id).slice(-8)}
                          </span>
                          <span style={{
                            ...S.statusBadgeLive,
                            background: urgent ? 'var(--red-bg)' : 'var(--green-bg)',
                            color:      urgent ? 'var(--red)'    : 'var(--green)',
                          }}>
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%',
                              background: urgent ? 'var(--red)' : 'var(--green)',
                              animation: 'pulse 1.5s infinite',
                            }} />
                            {urgent ? 'Expire bientôt' : 'Actif'}
                          </span>
                        </div>

                        <div style={S.qrCountdownRow}>
                          <span style={S.qrCountdownLabel}>Expire dans</span>
                          <span style={{ ...S.qrCountdownVal, color }}>{compact}</span>
                          <span style={S.qrCountdownReadable}>·  {readable}</span>
                        </div>

                        <div style={S.qrBarTrack}>
                          <div style={{
                            height: '100%', width: `${qr.pct}%`,
                            background: color, borderRadius: 99,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {activeQRs.length > 3 && (
                  <button onClick={() => navigate('/qrcodes')} style={S.qrMoreBtn}>
                    + {activeQRs.length - 3} autre{activeQRs.length - 3 > 1 ? 's' : ''} QR code{activeQRs.length - 3 > 1 ? 's' : ''} actif{activeQRs.length - 3 > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Répartition par département */}
          <div style={{ ...S.panel, flex: isMobile ? 'none' : 1 }}>
            <div style={S.panelTitle}>Effectifs par département</div>
            <div style={S.panelSub}>{totalEmp} employé{totalEmp !== 1 ? 's' : ''} actif{totalEmp !== 1 ? 's' : ''}</div>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deptData.map(d => {
                const pct = totalEmp ? Math.round((d.count / totalEmp) * 100) : 0;
                const c = DEPT_COLORS[d.departement];
                return (
                  <div key={d.departement}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                        {d.departement.replace(' &', '').replace(/\(.*\)/, '').trim()}
                      </span>
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>{d.count}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ Alertes + Annonces RH ═══ */}
        <section style={{ ...S.alertRow, gridTemplateColumns: alertCols }}>
          {/* Alertes à traiter */}
          <div style={S.panel}>
            <div style={S.panelHead}>
              <div>
                <div style={S.panelTitle}>
                  Demandes à valider
                  {congesAValider.length > 0 && (
                    <span style={S.countBadge}>{congesAttente}</span>
                  )}
                </div>
                <div style={S.panelSub}>À traiter sous 48h</div>
              </div>
              <button id="dash-btn-voir-conges" onClick={() => navigate('/conges/admin')} style={S.linkBtn}>
                Voir tout
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {congesAValider.length === 0 ? (
              <div style={S.emptyMini}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="var(--text3)" strokeWidth="1.6">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <div style={{ marginTop: 8 }}>Aucune demande en attente</div>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {congesAValider.map((c) => {
                  const u = users.find(x => x.id === c.userId) || {};
                  const av = avatarColor(u.nom);
                  return (
                    <div key={c.id} className="row-hover"
                         onClick={() => navigate('/conges/admin')}
                         style={S.alertRow_item}>
                      <div style={{ ...S.avatar, background: av, color: '#1a1a1a' }}>
                        {initials(u.nom)}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                          {u.nom || 'Employé'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {c.type === 'ANNUEL' ? 'Congés payés' : c.type === 'MALADIE' ? 'Maladie' : c.type === 'RTT' ? 'RTT' : 'Exceptionnel'}
                          {' · '}
                          {c.dateDebut} → {c.dateFin}
                        </div>
                      </div>
                      <span style={S.pendingBadge}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--amber)' }} />
                        En attente
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Annonces RH ─── */}
          <div style={S.panel}>
            <div style={S.panelHead}>
              <div>
                <div style={S.panelTitle}>
                  Annonces RH
                  {announcements.length > 0 && <span style={S.countBadge}>{announcements.length}</span>}
                </div>
                <div style={S.panelSub}>Communications internes · visibles par tous</div>
              </div>
              <span style={S.miniBadge}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l18-5v12L3 13v-2z" />
                  <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
                </svg>
                Tableau d'affichage
              </span>
            </div>

            {/* Form de publication */}
            <div style={S.annForm}>
              <textarea
                id="dash-ann-textarea"
                placeholder="Écrire une annonce pour l'équipe..."
                value={annInput}
                onChange={e => setAnnInput(e.target.value)}
                style={S.annInput}
                maxLength={280}
                rows={2}
              />
              <div style={{ ...S.annFormFooter, flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ ...S.annTypePicker, flexWrap: 'wrap' }}>
                  {[
                    { val: 'INFO',      label: 'Info',      color: 'var(--accent)' },
                    { val: 'IMPORTANT', label: 'Important', color: 'var(--amber)' },
                    { val: 'URGENT',    label: 'Urgent',    color: 'var(--red)' },
                  ].map(t => {
                    const active = annType === t.val;
                    return (
                      <button key={t.val}
                              type="button"
                              id={`dash-ann-type-${t.val.toLowerCase()}`}
                              onClick={() => setAnnType(t.val)}
                              style={{
                                ...S.annTypeBtn,
                                background: active ? `${t.color}1F` : 'transparent',
                                color:      active ? t.color : 'var(--text3)',
                                borderColor: active ? `${t.color}55` : 'var(--border2)',
                              }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: t.color,
                        }} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: isMobile ? 'flex-end' : 'initial' }}>
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                    {annInput.length}/280
                  </span>
                  <button
                    id="dash-ann-publish"
                    onClick={publishAnnouncement}
                    disabled={!annInput.trim() || annLoading}
                    style={{
                      ...S.annPublishBtn,
                      opacity: (annInput.trim() && !annLoading) ? 1 : 0.4,
                      cursor:  (annInput.trim() && !annLoading) ? 'pointer' : 'not-allowed',
                    }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    {annLoading ? 'Envoi…' : 'Publier'}
                  </button>
                </div>
              </div>
            </div>

            {/* Lien rapide vers la page de gestion complète */}
            <div style={S.annLinkRow}>
              <span style={S.annLinkInfo}>
                {announcements.length === 0
                  ? 'Aucune annonce publiée pour le moment.'
                  : `${announcements.length} annonce${announcements.length > 1 ? 's' : ''} publiée${announcements.length > 1 ? 's' : ''}.`}
              </span>
              <button id="dash-ann-history" onClick={() => navigate('/annonces')} style={S.linkBtn}>
                Voir l'historique
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* ═══ Table pointages du jour ═══ */}
        <section style={S.panel}>
          <div style={S.panelHead}>
            <div>
              <div style={S.panelTitle}>Pointages du jour</div>
              <div style={S.panelSub}>
                {pointagesToday.length} employé{pointagesToday.length !== 1 ? 's' : ''} aujourd'hui
                {' · '}
                <span style={{ color: 'var(--green)' }}>{selectedPresentiel} présentiel</span>
                {' · '}
                <span style={{ color: 'var(--cyan)' }}>{selectedTeletravail} télétravail</span>
              </div>
            </div>
            <button
              id="dash-export-pointages"
              onClick={exportSelectedPointages}
              disabled={pointagesToday.length === 0}
              style={{
                ...S.exportBtn,
                opacity: pointagesToday.length === 0 ? 0.45 : 1,
                cursor: pointagesToday.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Excel
            </button>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 14, WebkitOverflowScrolling: 'touch' }}>
            <table style={{ ...S.table, minWidth: 560 }}>
              <thead>
                <tr>
                  {['Employé', 'Département', 'Mode', 'Entrée', 'Sortie', 'Heures'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pointagesToday.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 50, color: 'var(--text3)', fontSize: 13 }}>
                      Aucun pointage enregistré aujourd'hui
                    </td>
                  </tr>
                ) : pointagesToday.map(p => {
                  const isTele = p.modeTravail === 'TELETRAVAIL';
                  const dc = DEPT_COLORS[p.departement] || 'var(--text3)';
                  const av = avatarColor(p.nom);
                  return (
                    <tr key={p.userId} className="row-hover" style={S.tr}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ ...S.avatar, background: av, color: '#1a1a1a' }}>
                            {initials(p.nom)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{p.nom}</div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                              {p.matricule}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={S.td}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dc }} />
                          {p.departement || '—'}
                        </span>
                      </td>
                      <td style={S.td}>
                        <span style={{
                          ...S.badge,
                          background: isTele ? 'var(--cyan-bg)' : 'var(--green-bg)',
                          color:      isTele ? 'var(--cyan)'    : 'var(--green)',
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: isTele ? 'var(--cyan)' : 'var(--green)',
                          }} />
                          {isTele ? 'Télétravail' : 'Présentiel'}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {p.heureEntree
                          ? <span style={{ color: 'var(--green)' }}>{p.heureEntree.substring(0, 5)}</span>
                          : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ ...S.td, fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {p.heureSortie
                          ? <span style={{ color: 'var(--red)' }}>{p.heureSortie.substring(0, 5)}</span>
                          : <span style={{ color: 'var(--text3)' }}>en cours</span>}
                      </td>
                      <td style={{ ...S.td, fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 500 }}>
                        {p.heuresTravaillees !== '-'
                          ? <span style={{ color: 'var(--text)' }}>{p.heuresTravaillees}</span>
                          : <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>
                              {p.heureSortie ? '—' : '...'}
                            </span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */
const S = {
  page: { maxWidth: 1340, margin: '0 auto' },

  /* HERO */
  heroCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '22px 26px',
    display: 'flex', justifyContent: 'space-between',
    gap: 16, flexWrap: 'wrap',
    marginBottom: 14,
  },
  heroEyebrow: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    letterSpacing: '1.4px', marginBottom: 10,
  },
  heroDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--green)',
    animation: 'pulse 1.5s infinite',
  },
  heroTitle: {
    fontWeight: 500, color: 'var(--text)',
    letterSpacing: '-0.6px', margin: 0,
  },
  heroName: {
    fontFamily: '"Georgia", "Times New Roman", serif',
    fontStyle: 'italic', fontWeight: 500,
    background: 'linear-gradient(180deg, var(--text) 0%, var(--text2) 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  heroDate: { fontSize: 13, color: 'var(--text3)', marginTop: 4 },
  heroActions: { display: 'flex', gap: 8 },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', background: 'var(--surface2)',
    border: '1px solid var(--border2)', color: 'var(--text)',
    borderRadius: 9, fontSize: 12, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', background: 'var(--text)', color: 'var(--bg)',
    border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },

  /* KPIs */
  kpiGrid: { display: 'grid', gap: 12, marginBottom: 14 },

  /* Panels */
  panel: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '18px 22px',
  },
  panelHead: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 12, flexWrap: 'wrap',
  },
  panelTitle: {
    fontSize: 14, fontWeight: 500, color: 'var(--text)',
    display: 'inline-flex', alignItems: 'center', gap: 8,
  },
  panelSub: { fontSize: 11, color: 'var(--text3)', marginTop: 3 },
  countBadge: {
    background: 'var(--amber-bg)', color: 'var(--amber)',
    fontSize: 10, fontWeight: 600,
    padding: '1px 7px', borderRadius: 10,
  },
  miniBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 9px', borderRadius: 99,
    fontSize: 10, fontWeight: 500,
    background: 'var(--surface2)', color: 'var(--text2)',
  },
  linkBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'transparent', border: 'none',
    color: 'var(--text2)', fontSize: 11, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  exportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: 'var(--text)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'inherit',
  },

  chartsRow: { display: 'flex', gap: 12, marginBottom: 14 },

  /* ─── QR Codes actifs ─── */
  qrEmpty: {
    padding: '32px 16px 24px', textAlign: 'center',
  },
  qrEmptyIcon: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text3)', marginBottom: 14,
  },
  qrList: {
    marginTop: 14,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  qrCard: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '12px 14px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 11,
  },
  qrThumb: {
    width: 56, height: 56, borderRadius: 7,
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    padding: 3,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  qrPlaceholder: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qrTopRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 8, marginBottom: 6,
  },
  qrToken: {
    fontSize: 12, fontWeight: 500, color: 'var(--text)',
    fontFamily: 'var(--mono)', letterSpacing: '0.3px',
  },
  statusBadgeLive: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 8px', borderRadius: 99,
    fontSize: 10, fontWeight: 600,
  },
  qrCountdownRow: {
    display: 'flex', alignItems: 'baseline', gap: 7,
    marginBottom: 7,
  },
  qrCountdownLabel: {
    fontSize: 10, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1px',
    fontWeight: 500,
  },
  qrCountdownVal: {
    fontSize: 17, fontWeight: 500,
    fontFamily: 'var(--mono)',
    letterSpacing: '-0.3px',
    fontVariantNumeric: 'tabular-nums',
  },
  qrCountdownReadable: {
    fontSize: 11, color: 'var(--text3)',
    fontFamily: 'var(--mono)',
  },
  qrBarTrack: {
    height: 4, background: 'var(--surface2)',
    borderRadius: 99, overflow: 'hidden',
  },
  qrMoreBtn: {
    padding: 9,
    background: 'transparent',
    border: '1px dashed var(--border2)',
    color: 'var(--text3)',
    borderRadius: 9,
    fontSize: 11, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  /* ─── Annonces RH ─── */
  annForm: {
    marginTop: 14,
    padding: 12,
    background: 'var(--bg)',
    border: '1px solid var(--border2)',
    borderRadius: 11,
  },
  annInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'none',
    color: 'var(--text)',
    fontSize: 13,
    fontFamily: 'inherit',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  annFormFooter: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 8,
    marginTop: 8, paddingTop: 8,
    borderTop: '1px dashed var(--border)',
  },
  annTypePicker: { display: 'flex', gap: 5 },
  annTypeBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 9px',
    border: '1px solid',
    borderRadius: 99,
    fontSize: 10, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  annPublishBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px',
    background: 'var(--text)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: 8,
    fontSize: 11, fontWeight: 600,
    fontFamily: 'inherit',
  },
  annLinkRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 10, marginTop: 12, paddingTop: 12,
    borderTop: '1px dashed var(--border2)',
    flexWrap: 'wrap',
  },
  annLinkInfo: {
    fontSize: 11, color: 'var(--text3)',
    fontStyle: 'italic',
  },

  /* Alertes / activité */
  alertRow: { display: 'grid', gap: 12, marginBottom: 14 },
  alertRow_item: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '10px 6px',
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer',
  },
  pendingBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 10, fontWeight: 500,
    padding: '3px 8px', borderRadius: 10,
    background: 'var(--amber-bg)', color: 'var(--amber)',
    flexShrink: 0,
  },
  activityRow: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '9px 4px',
    borderBottom: '1px solid var(--border)',
  },
  emptyMini: {
    textAlign: 'center', color: 'var(--text3)',
    fontSize: 12, padding: '30px 10px',
  },

  /* Avatar */
  avatar: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 600, flexShrink: 0,
  },

  /* Table */
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '12px 16px', textAlign: 'left',
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '13px 16px', fontSize: 13, color: 'var(--text)' },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 10px', borderRadius: 12,
    fontSize: 11, fontWeight: 500,
  },
};

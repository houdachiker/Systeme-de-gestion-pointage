import { useState, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/Layout';
import useResponsive from '../hooks/useResponsive';

/* ──────────────────────────────────────────────────────────────────────
   Pointage — Design pro PresenceHub (3 étapes guidées)
   ────────────────────────────────────────────────────────────────────── */

const GOAL_HOURS   = 9;
const GOAL_SECONDS = GOAL_HOURS * 3600;

/* ─── Helpers temps ─────────────────────────────────────────────────── */
function parseHMS(h) {
  if (!h) return 0;
  const [a = 0, b = 0, c = 0] = h.split(':').map(parseFloat);
  return (a || 0) * 3600 + (b || 0) * 60 + (c || 0);
}
function nowSeconds() {
  const n = new Date();
  return n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
}
function computeTodayWork(pointages) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const list = pointages
    .filter(p => p.date === todayStr)
    .sort((a, b) => parseHMS(a.heure) - parseHMS(b.heure));
  let completedSec = 0, lastEntreeSec = null, sessionCount = 0;
  for (const p of list) {
    if (p.type === 'ENTREE') lastEntreeSec = parseHMS(p.heure);
    else if (p.type === 'SORTIE' && lastEntreeSec !== null) {
      const dur = parseHMS(p.heure) - lastEntreeSec;
      if (dur > 0) { completedSec += dur; sessionCount++; }
      lastEntreeSec = null;
    }
  }
  return { completedSec, lastEntreeSec, sessionCount };
}
/* Format lisible : "2h 34min 15s" / "34min 15s" / "15s" */
function formatDur(sec) {
  if (sec <= 0) return '0s';
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${String(m).padStart(h > 0 ? 2 : 1, '0')}min`);
  parts.push(`${String(s).padStart((m > 0 || h > 0) ? 2 : 1, '0')}s`);
  return parts.join(' ');
}
/* Format compact monospace : "02:34:15" */
function formatDurCompact(sec) {
  if (sec <= 0) return '00:00:00';
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
/* Heure de début depuis secondes (depuis minuit) : "08:34" */
function formatStartTime(secFromMidnight) {
  if (secFromMidnight == null) return '—';
  const h = Math.floor(secFromMidnight / 3600);
  const m = Math.floor((secFromMidnight % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function formatClock(d) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function extractToken(value) {
  if (!value) return '';
  const m = value.match(/\/scan\/([a-zA-Z0-9-]+)/);
  return m ? m[1] : value.trim();
}

/* ─── Scanner QR ────────────────────────────────────────────────────── */
function QRScanner({ onScan, onClose }) {
  const { isMobile } = useResponsive();
  const [camError, setCamError] = useState('');
  const html5QrRef = useRef(null);
  const regionIdRef = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const scannedRef = useRef(false);
  const startedRef = useRef(false);
  const onScanRef = useRef(onScan);

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const stopCamera = useCallback(async () => {
    if (!html5QrRef.current) return;
    try { await html5QrRef.current.stop(); } catch {}
    try { await html5QrRef.current.clear(); } catch {}
    startedRef.current = false;
  }, []);

  const startCamera = useCallback(async () => {
    const secure = window.isSecureContext || window.location.hostname === 'localhost';
    if (!secure) {
      setCamError('La caméra nécessite HTTPS sur mobile. Utilisez une URL sécurisée.');
      return;
    }
    try {
      if (startedRef.current) return;
      startedRef.current = true;
      const cameras = await Html5Qrcode.getCameras().catch((camErr) => {
        console.error('QR camera list error:', camErr);
        return [];
      });
      console.info('QR cameras detected:', cameras);
      if (!cameras || cameras.length === 0) {
        setCamError('Aucune caméra détectée. Vérifiez les permissions du navigateur.');
        startedRef.current = false;
        return;
      }
      const preferredCameraId = (() => {
        const back = cameras.find(cam => /back|rear/i.test(cam.label || ''));
        return (back || cameras[cameras.length - 1]).id;
      })();
      const qr = new Html5Qrcode(regionIdRef.current);
      html5QrRef.current = qr;

      const config = { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 };
      const onSuccess = async (decodedText) => {
        if (scannedRef.current) return;
        scannedRef.current = true;
        await stopCamera();
        onScanRef.current(decodedText);
      };

      const tryStart = async (cameraConfig) =>
        qr.start(cameraConfig, config, onSuccess, () => {});

      try {
        await tryStart({ deviceId: { exact: preferredCameraId } });
      } catch {
        try {
          await tryStart({ facingMode: { ideal: 'environment' } });
        } catch {
          try {
            await tryStart({ facingMode: 'environment' });
          } catch {
            await tryStart({});
          }
        }
      }
    } catch (err) {
      const name = err?.name || 'Erreur';
      const msg = err?.message || 'Impossible d\'accéder à la caméra. Vérifiez les autorisations.';
      const code = err?.code != null ? `code=${err.code}` : 'code=?';
      console.error('QR start error:', err);
      setCamError(`${msg} (${name}, ${code})`);
      startedRef.current = false;
    }
  }, [stopCamera]);

  useEffect(() => {
    scannedRef.current = false;
    startCamera();
    return () => { stopCamera(); };
  }, [startCamera, stopCamera]);

  return (
    <div style={sq.overlay}>
      <div style={{
        ...sq.modal,
        width: isMobile ? '90vw' : 340,
        maxWidth: 340,
      }}>
        <div style={sq.modalHeader}>
          <div style={sq.modalTitle}>Scanner le QR code</div>
          <button onClick={() => { stopCamera(); onClose(); }} style={sq.closeBtn} aria-label="Fermer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {camError ? (
          <div style={sq.camError}>
            <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center' }}>{camError}</p>
          </div>
        ) : (
          <div style={sq.videoWrap}>
            <div id={regionIdRef.current} style={sq.video} />
            <div style={sq.scanFrame}>
              <div style={sq.c1} /><div style={sq.c2} /><div style={sq.c3} /><div style={sq.c4} />
            </div>
            <p style={sq.hint}>Pointez la caméra vers le QR code</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Composant principal
   ────────────────────────────────────────────────────────────────────── */
export default function Pointage() {
  const { isMobile } = useResponsive();
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState('ENTREE');
  const [modeTravail, setModeTravail] = useState('PRESENTIEL');
  const [showScanner, setShowScanner] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [history, setHistory] = useState([]);
  const [allPointages, setAllPointages] = useState([]);
  const [now, setNow] = useState(new Date());
  const [geoInfo, setGeoInfo] = useState('');

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const loadPointages = useCallback(() => {
    if (!user?.id) return;
    api.get(`/pointage/user/${user.id}`)
      .then(r => { setAllPointages(r.data); setHistory(r.data.slice(0, 5)); })
      .catch(() => {});
  }, [user]);

  useEffect(() => { loadPointages(); }, [loadPointages]);

  /* ─── Calculs ─── */
  const { completedSec, lastEntreeSec, sessionCount } = computeTodayWork(allPointages);
  const activeSec = lastEntreeSec !== null ? Math.max(0, nowSeconds() - lastEntreeSec) : 0;
  const totalSec  = completedSec + activeSec;
  const remainSec = Math.max(0, GOAL_SECONDS - totalSec);
  const pct       = Math.min(100, Math.round((totalSec / GOAL_SECONDS) * 100));
  const isActive  = lastEntreeSec !== null;
  const isDone    = totalSec >= GOAL_SECONDS;

  const ringColor = isDone ? 'var(--green)'
                  : pct >= 75 ? 'var(--accent)'
                  : pct >= 40 ? 'var(--amber)'
                  : 'var(--red)';

  /* ─── Pointer ─── */
  const pointer = async (scannedQr = null) => {
    const token = extractToken(scannedQr || qrCode);
    if (!token) { setStatus({ ok: false, msg: 'Veuillez saisir ou scanner le code QR.' }); return; }
    setLoading(true); setStatus(null);
    try {
      // Try geolocation, but make it optional (HTTP on mobile blocks it)
      let latitude = '0', longitude = '0';
      setGeoInfo('');
      try {
        const secure = window.isSecureContext || window.location.hostname === 'localhost';
        if (!secure) {
          setGeoInfo('HTTPS requis');
        } else if (navigator.geolocation) {
          const pos = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, enableHighAccuracy: true })
          );
          latitude = String(pos.coords.latitude);
          longitude = String(pos.coords.longitude);
        } else {
          setGeoInfo('Non supportee');
        }
      } catch (geoErr) {
        // Geolocation failed (HTTP or permission denied) — continue anyway
        const code = geoErr?.code;
        if (code === 1) setGeoInfo('Refusee');
        else if (code === 2) setGeoInfo('Indisponible');
        else if (code === 3) setGeoInfo('Timeout');
        else setGeoInfo('Indisponible');
        console.warn('Geolocalisation non disponible, pointage sans coordonnees.');
      }
      await api.post('/pointage', {
        userId: user.id, type, modeTravail,
        latitude, longitude,
        qrCode: token,
      });
      setStatus({ ok: true, msg: `Pointage "${type === 'ENTREE' ? 'Entrée' : 'Sortie'}" enregistré.` });
      setQrCode(''); loadPointages();
    } catch (err) {
      setStatus({ ok: false, msg: err.response?.data?.message || err.message || 'Erreur inconnue.' });
    } finally { setLoading(false); }
  };

  const handleQrScan = (code) => {
    setShowScanner(false);
    const token = extractToken(code);
    setQrCode(token); pointer(token);
  };

  /* ─── Render ─── */
  const firstName = (user?.nom || '').split(' ')[0] || 'collègue';
  const dateLong = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Layout topBar={false}>
      <style>{`
        .info-list > div:last-child { border-bottom: none !important; }
      `}</style>
      {showScanner && <QRScanner onScan={handleQrScan} onClose={() => setShowScanner(false)} />}

      <div style={{ ...s.page, ...(isMobile ? { padding: '12px 4px 30px' } : {}) }}>
        <div style={{
          ...s.mainGrid,
          gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
        }}>
          {/* ═══════════════════════════════════════════════════════
              COLONNE GAUCHE
              ═══════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ─── HERO : statut + bonjour + horloge ─── */}
            <div style={{
              ...s.heroCard,
              ...(isMobile ? { flexDirection: 'column', alignItems: 'flex-start', gap: 16, padding: '18px 20px' } : {})
            }}>
              <div>
                <div style={s.statusRow}>
                  <span style={{
                    ...s.statusBadge,
                    background: isActive ? 'var(--green-bg)' : 'var(--surface2)',
                    color:      isActive ? 'var(--green)'   : 'var(--text3)',
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: isActive ? 'var(--green)' : 'var(--text3)',
                      animation: isActive ? 'pulse 1.5s infinite' : 'none',
                    }} />
                    {isActive ? 'SESSION ACTIVE' : 'HORS SESSION'}
                  </span>
                  <span style={s.statusDivider}>·</span>
                  <span style={s.statusCity}>CASABLANCA</span>
                </div>
                <h1 style={s.helloTitle}>
                  Bonjour <span style={s.helloName}>{firstName}</span>,
                </h1>
                <div style={s.dateLine}>
                  {dateLong.charAt(0).toUpperCase() + dateLong.slice(1)}
                </div>
              </div>
              <div style={{
                ...s.heroClockWrap,
                ...(isMobile ? { textAlign: 'left' } : {})
              }}>
                <div style={s.heroClock}>{formatClock(now)}</div>
                <div style={s.heroTz}>EUROPE/PARIS · UTC+1</div>
              </div>
            </div>

            {/* ─── LIVE SESSION TIMER (visible après pointage Entrée) ─── */}
            {isActive && (
              <div style={{
                ...s.liveCard,
                ...(isMobile ? { padding: '16px 18px' } : {})
              }}>
                <div style={s.livePulseRing} />
                <div style={s.liveTopRow}>
                  <span style={s.liveBadge}>
                    <span style={s.liveDot} />
                    EN COURS
                  </span>
                  <span style={s.liveMeta}>
                    Démarrée à <strong style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                      {formatStartTime(lastEntreeSec)}
                    </strong>
                  </span>
                </div>

                <div style={{
                  ...s.liveMainRow,
                  gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr auto 1fr',
                  gap: isMobile ? 14 : 14,
                }}>
                  <div style={s.liveBlock}>
                    <div style={s.liveLabel}>VOUS TRAVAILLEZ DEPUIS</div>
                    <div style={s.liveBigVal}>{formatDur(activeSec)}</div>
                    <div style={s.liveTinyMono}>{formatDurCompact(activeSec)}</div>
                  </div>

                  {!isMobile && <div style={s.liveDivider} />}

                  <div style={{
                    ...s.liveBlock,
                    ...(isMobile ? { borderTop: '1px dashed var(--border)', paddingTop: 12 } : {})
                  }}>
                    <div style={s.liveLabel}>TOTAL AUJOURD'HUI</div>
                    <div style={{ ...s.liveBigVal, color: ringColor }}>{formatDur(totalSec)}</div>
                    <div style={s.liveTinyMono}>{formatDurCompact(totalSec)}</div>
                  </div>

                  {!isMobile && <div style={s.liveDivider} />}

                  <div style={{
                    ...s.liveBlock,
                    ...(isMobile ? { borderTop: '1px dashed var(--border)', paddingTop: 12 } : {})
                  }}>
                    <div style={s.liveLabel}>{isDone ? 'OBJECTIF ATTEINT' : 'RESTANT POUR ' + GOAL_HOURS + 'H'}</div>
                    <div style={{
                      ...s.liveBigVal,
                      color: isDone ? 'var(--green)' : 'var(--text2)',
                    }}>
                      {isDone ? '✓ Bravo' : formatDur(remainSec)}
                    </div>
                    {!isDone && <div style={s.liveTinyMono}>{formatDurCompact(remainSec)}</div>}
                  </div>
                </div>

                <div style={s.liveBar}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: ringColor, borderRadius: 99,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={s.liveBarLegend}>
                  <span>0h</span>
                  <span style={{ color: ringColor, fontWeight: 600 }}>{pct}% complété</span>
                  <span>Objectif : {GOAL_HOURS}h</span>
                </div>

                <div style={s.liveHint}>
                  N'oubliez pas de pointer votre <strong style={{ color: 'var(--red)' }}>Sortie</strong> à la fin de votre journée.
                </div>
              </div>
            )}

            {/* ─── ÉTAPE 1 : Type ─── */}
            <div style={{ ...s.stepCard, ...(isMobile ? { padding: '18px 20px' } : {}) }}>
              <StepHeader number="1" eyebrow="DIRECTION" title="Type de pointage"
                          sub="Sélectionnez si vous arrivez ou partez"
                          badge={!isActive ? 'Aucune session' : null} />
              <div style={{
                ...s.cardGrid,
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              }}>
                {[
                  { val: 'ENTREE', eyebrow: 'ARRIVÉE', title: 'Entrée', desc: 'Début de journée',
                    color: 'var(--green)', icon: 'arrowIn' },
                  { val: 'SORTIE', eyebrow: 'DÉPART',  title: 'Sortie', desc: 'Fin de journée',
                    color: 'var(--red)',   icon: 'arrowOut' },
                ].map(o => (
                  <SelectionCard key={o.val}
                    selected={type === o.val}
                    onClick={() => setType(o.val)}
                    {...o} />
                ))}
              </div>
            </div>

            {/* ─── ÉTAPE 2 : Lieu ─── */}
            <div style={{ ...s.stepCard, ...(isMobile ? { padding: '18px 20px' } : {}) }}>
              <StepHeader number="2" eyebrow="LIEU" title="Mode de présence"
                          sub="Où exercez-vous votre activité aujourd'hui ?" />
              <div style={{
                ...s.cardGrid,
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              }}>
                {[
                  { val: 'PRESENTIEL',  eyebrow: 'PRÉSENTIEL', title: 'Sur site',
                    desc: 'Bureau Casablanca · Étage 4', color: 'var(--accent)', icon: 'building' },
                  { val: 'TELETRAVAIL', eyebrow: 'TÉLÉTRAVAIL', title: 'À distance',
                    desc: 'Connexion VPN sécurisée', color: 'var(--cyan)', icon: 'globe' },
                ].map(o => (
                  <SelectionCard key={o.val}
                    selected={modeTravail === o.val}
                    onClick={() => setModeTravail(o.val)}
                    {...o} />
                ))}
              </div>
            </div>

            {/* ─── ÉTAPE 3 : QR + bouton ─── */}
            <div style={{ ...s.stepCard, ...(isMobile ? { padding: '18px 20px' } : {}) }}>
              <StepHeader number="3" eyebrow="VÉRIFICATION" title={<>Code QR <span style={s.tokenInline}>(requis)</span></>}
                          sub="Collez l'URL complète ou uniquement le token" />

              <div style={{
                ...s.qrRow,
                ...(isMobile ? { flexDirection: 'column' } : {})
              }}>
                <div style={s.qrInputWrap}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="var(--text3)" strokeWidth="1.6" style={{ flexShrink: 0 }}>
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <path d="M14 14h3v3M17 17h3v3M14 20h3" />
                  </svg>
                  <input
                    style={s.qrInput}
                    placeholder="Coller l'URL ou le code QR..."
                    value={qrCode}
                    onChange={e => setQrCode(e.target.value)}
                  />
                  {qrCode && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                         stroke="var(--green)" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <button onClick={() => setShowScanner(true)} style={{
                  ...s.scanBtn,
                  ...(isMobile ? { justifyContent: 'center', padding: '12px' } : {})
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="14" rx="2" />
                    <circle cx="12" cy="13" r="3" />
                    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                  Scanner
                </button>
              </div>

              {qrCode && extractToken(qrCode) !== qrCode && (
                <div style={s.tokenPreview}>
                  Token extrait : <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                    {extractToken(qrCode)}
                  </span>
                </div>
              )}

              {status && (
                <div style={{
                  ...s.alert,
                  background: status.ok ? 'var(--green-bg)' : 'var(--red-bg)',
                  borderColor: status.ok ? 'var(--green-br)' : 'var(--red-br)',
                  color: status.ok ? 'var(--green)' : 'var(--red)',
                }}>
                  {status.msg}
                </div>
              )}

              <div style={s.footer}>
                <div style={s.footerInfos}>
                  <span style={s.footerInfo}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="1.6">
                       <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                       <circle cx="12" cy="10" r="3" />
                    </svg>
                    Géolocalisation automatique
                    <span style={geoInfo ? s.warnChip : s.activeChip}>
                      {geoInfo || 'activée'}
                    </span>
                  </span>
                  <span style={s.footerInfo}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="1.6">
                      <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
                    </svg>
                    Réseau certifié
                  </span>
                </div>
                <button onClick={() => pointer()} disabled={loading} style={{
                  ...s.mainBtn,
                  background: type === 'ENTREE' ? 'var(--green)' : 'var(--red)',
                  opacity: loading ? 0.7 : 1,
                  width: isMobile ? '100%' : 'auto',
                  marginTop: isMobile ? 12 : 0,
                  justifyContent: 'center',
                }}>
                  {loading ? (
                    <>
                      <span style={s.spinner} />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                      Pointer ma {type === 'ENTREE' ? 'entrée' : 'sortie'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>


          {/* ═══════════════════════════════════════════════════════
              COLONNE DROITE
              ═══════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>


            {/* ─── Progression du jour ─── */}
            <div style={s.sideCard}>
              <div style={s.eyebrow}>MES HEURES AUJOURD'HUI</div>
              <div style={s.sideTitle}>Progression du jour</div>
              <div style={s.sideSub}>Objectif quotidien · {GOAL_HOURS}h</div>

              <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }}>
                <div style={{ position: 'relative', width: 140, height: 140 }}>
                  <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="70" cy="70" r="60" fill="none" stroke="var(--border2)" strokeWidth="8" />
                    <circle cx="70" cy="70" r="60" fill="none"
                            stroke={ringColor} strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 60}
                            strokeDashoffset={2 * Math.PI * 60 * (1 - pct / 100)}
                            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s' }} />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 300, color: ringColor, letterSpacing: '-1px', lineHeight: 1 }}>
                      {pct}<span style={{ fontSize: 16, marginLeft: 2 }}>%</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>
                      DE {GOAL_HOURS}H
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {isActive ? (
                  /* Pendant la session : infos contextuelles (le live counter est dans la bannière verte) */
                  <>
                    <div style={{ ...s.hStat, borderColor: 'var(--green-br)' }}>
                      <div style={s.hLabel}>DÉBUT</div>
                      <div style={{ ...s.hVal, color: 'var(--green)' }}>
                        {formatStartTime(lastEntreeSec)}
                      </div>
                      <div style={s.hValSub}>arrivée du jour</div>
                    </div>
                    <div style={{ ...s.hStat, borderColor: isDone ? 'var(--green-br)' : 'var(--border2)' }}>
                      <div style={s.hLabel}>{isDone ? 'OBJECTIF' : 'SORTIE PRÉVUE'}</div>
                      <div style={{ ...s.hVal, color: isDone ? 'var(--green)' : 'var(--text)' }}>
                        {isDone ? '✓ Atteint' : formatStartTime((nowSeconds() + remainSec) % 86400)}
                      </div>
                      <div style={s.hValSub}>{isDone ? `${GOAL_HOURS}h atteintes` : `pour ${GOAL_HOURS}h`}</div>
                    </div>
                  </>
                ) : (
                  /* Hors session : on garde le récap travaillé/restant */
                  <>
                    <div style={{ ...s.hStat, borderColor: ringColor }}>
                      <div style={s.hLabel}>TRAVAILLÉ</div>
                      <div style={{ ...s.hVal, color: ringColor }}>{formatDurCompact(totalSec)}</div>
                      <div style={s.hValSub}>{formatDur(totalSec)}</div>
                    </div>
                    <div style={{ ...s.hStat, borderColor: isDone ? 'var(--green-br)' : 'var(--border2)' }}>
                      <div style={s.hLabel}>{isDone ? 'OBJECTIF' : 'RESTANT'}</div>
                      <div style={{ ...s.hVal, color: isDone ? 'var(--green)' : 'var(--text2)' }}>
                        {isDone ? '✓ Atteint' : formatDurCompact(remainSec)}
                      </div>
                      {!isDone && <div style={s.hValSub}>{formatDur(remainSec)}</div>}
                    </div>
                  </>
                )}
              </div>

              <div style={s.barTrack}>
                <div style={{ height: '100%', width: `${pct}%`, background: ringColor, borderRadius: 99 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>0h</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>Objectif : {GOAL_HOURS}h</span>
              </div>
              {sessionCount > 0 && (
                <div style={{
                  marginTop: 12, fontSize: 11, color: 'var(--text3)',
                  textAlign: 'center', padding: '6px 8px',
                  background: 'var(--bg)', borderRadius: 8,
                }}>
                  {sessionCount} session{sessionCount > 1 ? 's' : ''} complétée{sessionCount > 1 ? 's' : ''} aujourd'hui
                </div>
              )}
            </div>

            {/* ─── Guide rapide ─── */}
            <div style={s.sideCard}>
              <div style={s.eyebrow}>GUIDE RAPIDE</div>
              <div style={s.sideTitle}>Comment pointer ?</div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[
                  'Sélectionnez Entrée ou Sortie',
                  'Choisissez votre mode de présence',
                  'Collez ou scannez le QR code admin',
                  'Validez pour enregistrer le pointage',
                ].map((text, i) => (
                  <div key={i} style={s.stepRow}>
                    <div style={s.stepNum}>{i + 1}</div>
                    <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Derniers pointages ─── */}
            <div style={s.sideCard}>
              <div style={s.eyebrow}>AUJOURD'HUI</div>
              <div style={s.sideTitle}>Mes derniers pointages</div>
              {history.length === 0 ? (
                <div style={{ marginTop: 16, padding: '20px 12px', textAlign: 'center' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--surface2)', border: '1px solid var(--border2)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text3)', marginBottom: 10,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 3 }}>
                    Aucun pointage aujourd'hui
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    Commencez par enregistrer votre entrée.
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  {history.map((p, i) => (
                    <div key={i} style={s.histRow}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: p.type === 'ENTREE' ? 'var(--green-bg)' : 'var(--red-bg)',
                        color:      p.type === 'ENTREE' ? 'var(--green)'    : 'var(--red)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, flexShrink: 0,
                      }}>{p.type === 'ENTREE' ? '↑' : '↓'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
                          {p.type === 'ENTREE' ? 'Entrée' : 'Sortie'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
                          {p.heure?.substring(0, 8)}
                        </div>
                      </div>
                      {p.modeTravail && (
                        <span style={{
                          fontSize: 10, fontWeight: 500,
                          color:      p.modeTravail === 'TELETRAVAIL' ? 'var(--cyan)'    : 'var(--accent)',
                          background: p.modeTravail === 'TELETRAVAIL' ? 'var(--cyan-bg)' : 'var(--accent-soft)',
                          padding: '2px 7px', borderRadius: 10,
                        }}>
                          {p.modeTravail === 'TELETRAVAIL' ? 'TT' : 'PR'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

/* ─── Sous-composants ──────────────────────────────────────────────── */
function StepHeader({ number, eyebrow, title, sub, badge }) {
  return (
    <div style={s.stepHeader}>
      <div style={{ flex: 1 }}>
        <div style={s.stepEyebrow}>
          ÉTAPE {number} <span style={{ color: 'var(--text3)' }}>·</span> {eyebrow}
        </div>
        <div style={s.stepTitle}>{title}</div>
        {sub && <div style={s.stepSub}>{sub}</div>}
      </div>
      {badge && (
        <span style={{
          ...s.miniBadge,
          background: 'var(--surface2)', color: 'var(--text3)',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text3)' }} />
          {badge}
        </span>
      )}
    </div>
  );
}

function CardIcon({ name }) {
  const paths = {
    arrowIn:  <><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></>,
    arrowOut: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="9" y1="8" x2="9" y2="8" /><line x1="15" y1="8" x2="15" y2="8" /><line x1="9" y1="12" x2="9" y2="12" /><line x1="15" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="9" y2="16" /><line x1="15" y1="16" x2="15" y2="16" /></>,
    globe:    <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function SelectionCard({ selected, onClick, eyebrow, title, desc, color, icon }) {
  return (
    <button onClick={onClick} style={{
      ...s.selCard,
      borderColor: selected ? color : 'var(--border2)',
      background: selected ? `${color === 'var(--green)' ? 'var(--green-bg)'
                            : color === 'var(--red)' ? 'var(--red-bg)'
                            : color === 'var(--accent)' ? 'var(--accent-soft)'
                            : 'var(--cyan-bg)'}` : 'var(--bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          ...s.selIconWrap,
          background: selected ? `${color}25` : 'var(--surface2)',
          color: selected ? color : 'var(--text2)',
          borderColor: selected ? `${color}40` : 'var(--border2)',
        }}>
          <CardIcon name={icon} />
        </div>
        <div style={{
          ...s.checkCircle,
          background: selected ? color : 'transparent',
          borderColor: selected ? color : 'var(--border2)',
          color: '#0e0e10',
        }}>
          {selected && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
      <div style={{ ...s.selEyebrow, color: selected ? color : 'var(--text3)' }}>{eyebrow}</div>
      <div style={s.selTitle}>{title}</div>
      <div style={s.selDesc}>{desc}</div>
    </button>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */
const s = {
  page: { padding: '24px 28px 40px', maxWidth: 1320, margin: '0 auto' },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14 },

  /* HERO */
  heroCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '22px 26px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, flexWrap: 'wrap',
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '4px 11px', borderRadius: 99,
    fontSize: 10, fontWeight: 600, letterSpacing: '1.2px',
  },
  statusDivider: { color: 'var(--text3)', fontSize: 11 },
  statusCity: {
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    letterSpacing: '1.4px',
  },
  helloTitle: {
    fontSize: 26, fontWeight: 500, color: 'var(--text)',
    letterSpacing: '-0.6px', margin: 0,
  },
  helloName: {
    fontFamily: '"Georgia", "Times New Roman", serif',
    fontStyle: 'italic', fontWeight: 500,
    background: 'linear-gradient(180deg, var(--text) 0%, var(--text2) 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  dateLine: {
    fontSize: 13, color: 'var(--text2)', marginTop: 4,
  },
  heroClockWrap: { textAlign: 'right' },
  heroClock: {
    fontSize: 38, fontWeight: 300, color: 'var(--text)',
    fontFamily: 'var(--mono)', letterSpacing: '-1.5px', lineHeight: 1,
  },
  heroTz: {
    fontSize: 10, color: 'var(--text3)', marginTop: 6,
    letterSpacing: '1.4px', fontFamily: 'var(--mono)',
  },

  /* STEP CARD */
  stepCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '22px 26px',
  },
  stepHeader: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  stepEyebrow: {
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    letterSpacing: '1.4px', marginBottom: 6,
  },
  stepTitle: { fontSize: 16, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.2px' },
  stepSub: { fontSize: 12, color: 'var(--text3)', marginTop: 3 },
  tokenInline: {
    fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 400,
    color: 'var(--text3)', marginLeft: 4,
  },

  /* SELECTION CARDS */
  cardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  selCard: {
    position: 'relative',
    display: 'flex', flexDirection: 'column', gap: 0,
    padding: '16px 18px',
    border: '1px solid',
    borderRadius: 12,
    cursor: 'pointer',
    textAlign: 'left',
    color: 'var(--text)',
  },
  selIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid', flexShrink: 0,
  },
  checkCircle: {
    width: 18, height: 18, borderRadius: '50%',
    border: '1px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  selEyebrow: {
    fontSize: 9, fontWeight: 600,
    letterSpacing: '1.4px',
    marginTop: 12, marginBottom: 6,
  },
  selTitle: { fontSize: 16, fontWeight: 500, color: 'var(--text)', marginBottom: 4 },
  selDesc:  { fontSize: 11, color: 'var(--text3)' },

  /* QR */
  qrRow: { display: 'flex', gap: 10 },
  qrInputWrap: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 9,
    background: 'var(--bg)',
    border: '1px solid var(--border2)',
    borderRadius: 10, padding: '11px 13px',
  },
  qrInput: { flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontSize: 13, outline: 'none' },
  scanBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 16px',
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    color: 'var(--text)',
    borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  tokenPreview: {
    marginTop: 8, fontSize: 11, color: 'var(--text3)',
    padding: '6px 11px', background: 'var(--bg)', borderRadius: 7,
  },
  alert: {
    marginTop: 12, padding: '10px 14px',
    border: '1px solid', borderRadius: 10,
    fontSize: 12, fontWeight: 500,
  },

  /* Footer step 3 */
  footer: {
    marginTop: 14, paddingTop: 16,
    borderTop: '1px solid var(--border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 14, flexWrap: 'wrap',
  },
  footerInfos: { display: 'flex', gap: 18, color: 'var(--text3)', flexWrap: 'wrap' },
  footerInfo: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 },
  activeChip: {
    marginLeft: 4,
    fontSize: 10, fontWeight: 600,
    color: 'var(--green)', background: 'var(--green-bg)',
    padding: '2px 7px', borderRadius: 10,
  },
  warnChip: {
    marginLeft: 4,
    fontSize: 10, fontWeight: 600,
    color: 'var(--amber)', background: 'var(--amber-bg)',
    padding: '2px 7px', borderRadius: 10,
  },
  mainBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '11px 20px',
    border: 'none', borderRadius: 11,
    fontSize: 13, fontWeight: 600,
    color: '#0e0e10',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  spinner: {
    display: 'inline-block', width: 13, height: 13,
    border: '2px solid rgba(0,0,0,0.2)',
    borderTopColor: '#0e0e10',
    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  },

  /* SIDE CARDS */
  sideCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '18px 20px',
  },
  sideHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  eyebrow: {
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    letterSpacing: '1.4px', textTransform: 'uppercase',
  },
  miniBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 9px', borderRadius: 99,
    fontSize: 10, fontWeight: 500,
  },
  sideClock: {
    fontSize: 40, fontWeight: 300, color: 'var(--text)',
    fontFamily: 'var(--mono)', letterSpacing: '-1.5px', lineHeight: 1,
    marginTop: 10,
  },
  sideClockSec: { fontSize: 20, color: 'var(--text3)', marginLeft: 2 },
  sideDate: {
    fontSize: 10, color: 'var(--text3)',
    letterSpacing: '1.4px', marginTop: 8, fontFamily: 'var(--mono)',
  },
  sideTitle: { fontSize: 15, fontWeight: 500, color: 'var(--text)', marginTop: 6 },
  sideSub:   { fontSize: 11, color: 'var(--text3)', marginTop: 3 },

  /* INFO LIST (widget Infos du jour) */
  infoList: {
    marginTop: 14,
    display: 'flex', flexDirection: 'column',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  infoRow: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '11px 12px',
    borderBottom: '1px solid var(--border)',
  },
  infoIcon: {
    width: 26, height: 26, borderRadius: 7,
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    color: 'var(--text2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  infoBody: { flex: 1, overflow: 'hidden' },
  infoLabel: {
    fontSize: 12, fontWeight: 500, color: 'var(--text)',
    lineHeight: 1.2,
  },
  infoSub: {
    fontSize: 10, color: 'var(--text3)', marginTop: 2,
  },
  infoValue: {
    fontSize: 14, fontWeight: 500,
    fontFamily: 'var(--mono)',
    letterSpacing: '-0.2px',
    flexShrink: 0,
  },
  infoBadge: {
    fontSize: 10, fontWeight: 600,
    padding: '3px 8px', borderRadius: 10,
    flexShrink: 0,
  },

  hStat: {
    background: 'var(--bg)', borderRadius: 10,
    padding: '10px 12px', border: '1px solid',
    textAlign: 'center',
  },
  hLabel:  { fontSize: 9, color: 'var(--text3)', letterSpacing: '1.2px', marginBottom: 5, fontWeight: 500 },
  hVal:    { fontSize: 18, fontWeight: 500, fontFamily: 'var(--mono)', letterSpacing: '-0.3px', lineHeight: 1.15 },
  hValSub: { fontSize: 10, color: 'var(--text3)', marginTop: 4 },

  /* ── LIVE TIMER (visible quand session active) ─────────────── */
  liveCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, rgba(110,200,160,0.10) 0%, rgba(110,200,160,0.03) 60%, transparent 100%)',
    border: '1px solid var(--green-br)',
    borderRadius: 14,
    padding: '20px 24px',
    overflow: 'hidden',
  },
  livePulseRing: {
    position: 'absolute', top: -40, right: -40,
    width: 180, height: 180, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(125,211,168,0.18) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  liveTopRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14, position: 'relative', zIndex: 1,
  },
  liveBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '4px 11px', borderRadius: 99,
    fontSize: 10, fontWeight: 700, letterSpacing: '1.4px',
    background: 'var(--green-bg)',
    color: 'var(--green)',
    border: '1px solid var(--green-br)',
  },
  liveDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: 'var(--green)',
    boxShadow: '0 0 0 4px rgba(125,211,168,0.20)',
    animation: 'pulse 1.2s infinite',
  },
  liveMeta: { fontSize: 12, color: 'var(--text3)' },
  liveMainRow: {
    display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr',
    gap: 14, alignItems: 'center',
    marginBottom: 16, position: 'relative', zIndex: 1,
  },
  liveBlock: { textAlign: 'center' },
  liveLabel: {
    fontSize: 9, fontWeight: 500, color: 'var(--text3)',
    letterSpacing: '1.4px', textTransform: 'uppercase',
    marginBottom: 6,
  },
  liveBigVal: {
    fontSize: 22, fontWeight: 500, color: 'var(--text)',
    letterSpacing: '-0.5px', lineHeight: 1.1,
    fontVariantNumeric: 'tabular-nums',
  },
  liveTinyMono: {
    fontSize: 11, color: 'var(--text3)',
    fontFamily: 'var(--mono)', marginTop: 4,
    letterSpacing: '0.5px',
  },
  liveDivider: {
    width: 1, height: 42,
    background: 'var(--border2)',
    margin: '0 auto',
  },
  liveBar: {
    height: 6, background: 'rgba(255,255,255,0.06)',
    borderRadius: 99, overflow: 'hidden',
    position: 'relative', zIndex: 1,
  },
  liveBarLegend: {
    display: 'flex', justifyContent: 'space-between',
    marginTop: 6, fontSize: 10, color: 'var(--text3)',
    fontFamily: 'var(--mono)',
    position: 'relative', zIndex: 1,
  },
  liveHint: {
    marginTop: 12, paddingTop: 12,
    borderTop: '1px dashed var(--border2)',
    fontSize: 11, color: 'var(--text3)', textAlign: 'center',
    position: 'relative', zIndex: 1,
  },
  barTrack: { height: 5, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' },

  stepRow: { display: 'flex', alignItems: 'flex-start', gap: 11 },
  stepNum: {
    width: 22, height: 22, borderRadius: 6,
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    color: 'var(--text2)',
    fontSize: 11, fontWeight: 600, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  histRow: {
    display: 'flex', alignItems: 'center', gap: 11,
    padding: '9px 0',
    borderBottom: '1px solid var(--border)',
  },
};

const sq = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' },
  modal: { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 14, width: 340, overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' },
  modalTitle: { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: 4, display: 'flex' },
  videoWrap: { position: 'relative', padding: 16 },
  video: { width: '100%', borderRadius: 10, display: 'block', background: '#000' },
  scanFrame: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 160, height: 160 },
  c1: { position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTop: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' },
  c2: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTop: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' },
  c3: { position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottom: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' },
  c4: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderBottom: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' },
  hint: { textAlign: 'center', fontSize: 11, color: 'var(--text2)', marginTop: 8 },
  camError: { padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
};

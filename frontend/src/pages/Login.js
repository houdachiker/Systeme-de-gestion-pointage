import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import useResponsive from '../hooks/useResponsive';

/* ──────────────────────────────────────────────────────────────
   Identité de l'application
   ────────────────────────────────────────────────────────────── */
const APP_NAME    = 'WorkPulse';
const APP_TAGLINE = 'Pointage intelligent';
const APP_FULL    = 'Système de gestion de présence';

/* ──────────────────────────────────────────────────────────────
   Génération d'un faux QR-code (pseudo-aléatoire déterministe)
   ────────────────────────────────────────────────────────────── */
function generateQR(seed = 42) {
  const SIZE = 21; // taille QR v1
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

  // 3 finder patterns (les gros carrés des angles)
  const placeFinder = (gx, gy) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isOuter = x === 0 || x === 6 || y === 0 || y === 6;
        const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (isOuter || isInner) grid[gy + y][gx + x] = true;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(SIZE - 7, 0);
  placeFinder(0, SIZE - 7);

  // Timing pattern
  for (let i = 8; i < SIZE - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // PRNG seedé
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

  // Cellules aléatoires (hors zones de finders/timing)
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const inFinder = (x < 8 && y < 8) || (x >= SIZE - 8 && y < 8) || (x < 8 && y >= SIZE - 8);
      if (inFinder || x === 6 || y === 6) continue;
      grid[y][x] = rand() > 0.48;
    }
  }
  return grid;
}

function QRFace({ seed }) {
  const grid = generateQR(seed);
  const N = grid.length;
  return (
    <svg viewBox={`0 0 ${N} ${N}`} width="100%" height="100%"
         preserveAspectRatio="none" shapeRendering="crispEdges">
      <rect width={N} height={N} fill="#ffffff" />
      {grid.flatMap((row, y) =>
        row.map((on, x) => on
          ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#0a0a0c" />
          : null
        )
      )}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   Cube 3D scène
   ────────────────────────────────────────────────────────────── */
const FACE = 280;
const HALF = FACE / 2;

function CubeScene() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={cs.scene}>
      {/* Anneaux concentriques */}
      <div style={cs.rings} />
      {/* Halo lumineux */}
      <div style={cs.glow} />

      {/* Cube rotatif */}
      <div style={cs.cubeWrap}>
        <div style={cs.cube} className="qr-cube">
          <div style={{ ...cs.face, transform: `translateZ(${HALF}px)` }}><QRFace seed={101} /></div>
          <div style={{ ...cs.face, transform: `rotateY(180deg) translateZ(${HALF}px)` }}><QRFace seed={202} /></div>
          <div style={{ ...cs.face, transform: `rotateY(90deg)  translateZ(${HALF}px)` }}><QRFace seed={303} /></div>
          <div style={{ ...cs.face, transform: `rotateY(-90deg) translateZ(${HALF}px)` }}><QRFace seed={404} /></div>
          <div style={{ ...cs.face, transform: `rotateX(90deg)  translateZ(${HALF}px)` }}><QRFace seed={505} /></div>
          <div style={{ ...cs.face, transform: `rotateX(-90deg) translateZ(${HALF}px)` }}><QRFace seed={606} /></div>
        </div>
      </div>

      {/* Badges flottants */}
      <div style={{ ...cs.badge, ...cs.badgeTime }} className="badge-float-top">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {timeStr}
      </div>

      <div style={{ ...cs.badge, ...cs.badgeNFC }} className="badge-float-right">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
        </svg>
        NFC
      </div>

      <div style={{ ...cs.badge, ...cs.badgeID }} className="badge-float-left">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="12" r="2.5" />
          <line x1="14" y1="11" x2="18" y2="11" />
          <line x1="14" y1="14" x2="17" y2="14" />
        </svg>
        ID
      </div>

      <div style={{ ...cs.badge, ...cs.badgeQR }} className="badge-float-bot">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3M17 17h3v3M14 20h3" strokeLinecap="round" />
        </svg>
        QR
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Page Login
   ────────────────────────────────────────────────────────────── */
export default function Login() {
  const { isMobile } = useResponsive();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      login(data);
      navigate(redirectTo || (data.role === 'ADMIN' ? '/dashboard' : '/pointage'));
    } catch (err) {
      setError(err.response?.data?.message || 'Email ou mot de passe incorrect');
    } finally { setLoading(false); }
  };

  return (
    <div style={s.root}>
      <style>{`
        @keyframes cubeRotate {
          0%   { transform: rotateX(-18deg) rotateY(0deg); }
          100% { transform: rotateX(-18deg) rotateY(360deg); }
        }
        @keyframes floatY { 0%,100% { transform: translate(-50%,0); } 50% { transform: translate(-50%,-10px); } }
        @keyframes floatYInv { 0%,100% { transform: translate(-50%,0); } 50% { transform: translate(-50%,10px); } }
        @keyframes floatXR { 0%,100% { transform: translate(0,-50%); } 50% { transform: translate(-8px,-50%); } }
        @keyframes floatXL { 0%,100% { transform: translate(0,-50%); } 50% { transform: translate(8px,-50%); } }
        @keyframes haloPulse { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }

        .qr-cube           { animation: cubeRotate 28s linear infinite; }
        .badge-float-top   { animation: floatY 5s ease-in-out infinite; }
        .badge-float-bot   { animation: floatYInv 5s ease-in-out infinite; }
        .badge-float-right { animation: floatXR 5s ease-in-out infinite; }
        .badge-float-left  { animation: floatXL 5s ease-in-out infinite; }

        @media (max-width: 900px) {
          .login-split { grid-template-columns: 1fr !important; }
          .login-left  { display: none !important; }
        }
      `}</style>

      <div style={s.gridBg} />
      <div style={s.orb} />

      <div className="login-split" style={s.split}>
        {/* ─── GAUCHE : Cube 3D centré ─── */}
        <div className="login-left" style={s.leftPane}>
          <CubeScene />
        </div>

        {/* ─── DROITE : Formulaire ─── */}
        <div style={s.rightPane}>
          <div style={s.rightInner}>

            {/* Logo */}
            <div style={s.logoWrap}>
              <div style={s.logoIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3"  y="3"  width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9" />
                  <rect x="14" y="3"  width="7" height="7" rx="1.5" fill="currentColor" opacity="0.55" />
                  <rect x="3"  y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.7" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.4" />
                </svg>
              </div>
              <div>
                <div style={s.logoText}>{APP_NAME}</div>
                <div style={s.logoSub}>{APP_TAGLINE}</div>
              </div>
            </div>

            {/* Card */}
            <div style={{
              ...s.card,
              ...(isMobile ? { boxShadow: '0 10px 30px rgba(0,0,0,0.3)', border: '1px solid var(--border2)' } : {})
            }}>
              <div style={{
                ...s.cardInner,
                ...(isMobile ? { padding: '24px 20px' } : {})
              }}>
                <h1 style={s.title}>Connexion</h1>
                <p style={s.sub}>Accédez à votre espace de travail</p>

                {error && (
                  <div style={s.error}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={s.field}>
                    <label style={s.label}>Adresse email</label>
                    <div style={s.inputWrap}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                           stroke="var(--text3)" strokeWidth="1.7" strokeLinecap="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <input
                        style={s.input}
                        type="email"
                        placeholder="vous@entreprise.com"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={s.field}>
                    <label style={s.label}>Mot de passe</label>
                    <div style={s.inputWrap}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                           stroke="var(--text3)" strokeWidth="1.7" strokeLinecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      <input
                        style={s.input}
                        type="password"
                        placeholder="••••••••"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
                    {loading ? (
                      <span style={s.btnInner}>
                        <span style={s.spinner} /> Connexion...
                      </span>
                    ) : (
                      <span style={s.btnInner}>
                        Se connecter
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 12 19" />
                        </svg>
                      </span>
                    )}
                  </button>
                </form>

                <div style={s.helpRow}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={s.lockDot} />
                    Connexion chiffrée TLS
                  </span>
                  <a href="#mdp" style={s.helpLink}>Mot de passe oublié ?</a>
                </div>
              </div>
            </div>

            <p style={s.footer}>
              © 2026 {APP_NAME} — {APP_FULL}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Styles
   ────────────────────────────────────────────────────────────── */
const cs = {
  scene: {
    position: 'relative',
    width: '100%', maxWidth: 520, height: 460,
    perspective: '1200px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  rings: {
    position: 'absolute',
    width: 460, height: 460,
    borderRadius: '50%',
    border: '1px solid rgba(139,158,255,0.07)',
    boxShadow: '0 0 0 60px rgba(139,158,255,0.025), 0 0 0 120px rgba(139,158,255,0.04), 0 0 0 200px rgba(139,158,255,0.02)',
    pointerEvents: 'none',
    animation: 'haloPulse 4s ease-in-out infinite',
  },
  glow: {
    position: 'absolute',
    width: 360, height: 360, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,158,255,0.20) 0%, rgba(125,211,168,0.06) 40%, transparent 70%)',
    filter: 'blur(20px)',
    pointerEvents: 'none',
  },
  cubeWrap: {
    position: 'relative',
    width: FACE, height: FACE,
    transformStyle: 'preserve-3d',
    filter: 'drop-shadow(0 0 50px rgba(255,255,255,0.25)) drop-shadow(0 0 90px rgba(139,158,255,0.22))',
  },
  cube: {
    position: 'absolute',
    width: FACE, height: FACE,
    transformStyle: 'preserve-3d',
    transform: 'rotateX(-18deg) rotateY(0deg)',
  },
  face: {
    position: 'absolute',
    width: FACE, height: FACE,
    background: '#fff',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: 'inset 0 0 18px rgba(139,158,255,0.05), 0 0 22px rgba(255,255,255,0.18)',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },

  /* Badges flottants */
  badge: {
    position: 'absolute',
    display: 'inline-flex',
    alignItems: 'center', gap: 6,
    padding: '5px 12px',
    background: 'rgba(15,15,20,0.78)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'var(--text)',
    borderRadius: 99,
    fontSize: 11, fontWeight: 600,
    fontFamily: 'var(--mono)',
    letterSpacing: '0.5px',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 5,
    whiteSpace: 'nowrap',
  },
  badgeTime: {
    top: '6%', left: '50%',
    transform: 'translateX(-50%)',
    color: 'var(--amber)',
    borderColor: 'rgba(217,160,90,0.35)',
    boxShadow: '0 4px 20px rgba(217,160,90,0.18)',
  },
  badgeNFC: {
    top: '50%', right: '4%',
    transform: 'translateY(-50%)',
    color: 'var(--accent)',
    borderColor: 'rgba(139,158,255,0.35)',
    boxShadow: '0 4px 20px rgba(139,158,255,0.18)',
  },
  badgeID: {
    top: '50%', left: '4%',
    transform: 'translateY(-50%)',
    color: 'var(--green)',
    borderColor: 'rgba(125,211,168,0.35)',
    boxShadow: '0 4px 20px rgba(125,211,168,0.18)',
  },
  badgeQR: {
    bottom: '6%', left: '50%',
    transform: 'translateX(-50%)',
    color: 'var(--cyan)',
    borderColor: 'rgba(158,181,212,0.35)',
    boxShadow: '0 4px 20px rgba(158,181,212,0.18)',
  },
};

const s = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
  },
  gridBg: {
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(rgba(139,158,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(139,158,255,0.025) 1px, transparent 1px)
    `,
    backgroundSize: '52px 52px',
    pointerEvents: 'none',
    maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
    WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
  },
  orb: {
    position: 'absolute', top: '-15%', left: '-10%',
    width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,158,255,0.10) 0%, transparent 70%)',
    pointerEvents: 'none',
    filter: 'blur(40px)',
  },

  split: {
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    position: 'relative',
    zIndex: 1,
  },

  /* Pane gauche */
  leftPane: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 30px',
    borderRight: '1px solid var(--border)',
    position: 'relative',
  },
  /* Pane droite */
  rightPane: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '40px 30px',
  },
  rightInner: {
    width: '100%', maxWidth: 380,
    display: 'flex', flexDirection: 'column', gap: 24,
  },

  logoWrap: {
    display: 'flex', alignItems: 'center', gap: 12,
  },
  logoIcon: {
    width: 46, height: 46, borderRadius: 12,
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text)',
    flexShrink: 0,
  },
  logoText: {
    fontSize: 20, fontWeight: 600, color: 'var(--text)',
    letterSpacing: '-0.4px', lineHeight: 1.1,
  },
  logoSub: {
    fontSize: 11, color: 'var(--text3)',
    marginTop: 3, fontFamily: 'var(--mono)', letterSpacing: '0.5px',
  },

  card: {
    width: '100%',
    borderRadius: 16,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  cardInner: { padding: '32px 28px' },
  title: {
    fontSize: 24, fontWeight: 500,
    color: 'var(--text)', letterSpacing: '-0.4px',
    marginBottom: 6,
  },
  sub: { fontSize: 13, color: 'var(--text2)', marginBottom: 24 },
  error: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--red-bg)',
    border: '1px solid var(--red-br)',
    color: 'var(--red)',
    padding: '10px 13px',
    borderRadius: 10,
    fontSize: 12,
    marginBottom: 14,
  },

  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
  },
  inputWrap: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--bg)',
    border: '1px solid var(--border2)',
    borderRadius: 10,
    padding: '10px 13px',
  },
  input: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'var(--text)', fontSize: 13,
  },

  btn: {
    width: '100%',
    padding: '13px',
    background: 'var(--text)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: 10,
    fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    marginTop: 6,
  },
  btnInner: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  spinner: {
    display: 'inline-block', width: 13, height: 13,
    border: '2px solid rgba(0,0,0,0.2)',
    borderTopColor: 'var(--bg)',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },

  helpRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 18, paddingTop: 16,
    borderTop: '1px solid var(--border)',
    fontSize: 11, color: 'var(--text3)',
  },
  lockDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--green)',
    boxShadow: '0 0 0 3px rgba(125,211,168,0.18)',
  },
  helpLink: {
    color: 'var(--text2)', textDecoration: 'none',
    fontWeight: 500,
  },

  footer: {
    fontSize: 11, color: 'var(--text3)', textAlign: 'center',
  },
};

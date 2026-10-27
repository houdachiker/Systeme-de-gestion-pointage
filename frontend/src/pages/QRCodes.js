import { useState, useEffect } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import QRCodeLib from 'qrcode';
import useResponsive from '../hooks/useResponsive';

export default function QRCodes() {
  const { isMobile } = useResponsive();
  const [qrcodes, setQrcodes]     = useState([]);
  const [generating, setGen]      = useState(false);
  const [msg, setMsg]             = useState(null);
  const [qrImages, setQrImages]   = useState({});
  const [copied, setCopied]       = useState(null);

  const load = () => api.get('/qrcode').then(r => setQrcodes(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  useEffect(() => {
    qrcodes.forEach(qr => {
      if (qr.urlPointage && !qrImages[qr.id]) {
        QRCodeLib.toDataURL(qr.urlPointage, {
          width: 180, margin: 2,
          color: { dark: '#f5f5f7', light: '#15151a' },
        }).then(url => setQrImages(prev => ({ ...prev, [qr.id]: url }))).catch(() => {});
      }
    });
  }, [qrcodes, qrImages]);

  const generate = async () => {
    setGen(true); setMsg(null);
    try {
      await api.post('/qrcode/generate');
      setMsg({ ok: true, text: 'Nouveau QR code généré.' });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || 'Erreur lors de la génération.' });
    } finally { setGen(false); }
  };

  const deactivate = async (id) => {
    try { await api.patch(`/qrcode/${id}/deactivate`); load(); } catch {}
  };

  const copyUrl = (url, id) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id); setTimeout(() => setCopied(null), 2000);
    });
  };

  const printQR = (qr) => {
    const img = qrImages[qr.id];
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>QR Code Pointage</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#fff; color:#000; }
        h2 { margin-bottom:8px; font-size:18px; font-weight:500; }
        p  { font-size:12px; color:#666; margin:4px 0; }
        img { margin:16px 0; border:1px solid #e5e7eb; border-radius:12px; padding:12px; background:#fff; }
        .url { font-size:11px; color:#374151; word-break:break-all; max-width:300px; text-align:center; font-family: monospace; }
      </style></head><body>
      <h2>Pointage PresenceHub</h2>
      <p>Scannez ce QR code pour pointer votre présence</p>
      ${img ? `<img src="${img}" width="200" height="200"/>` : ''}
      <div class="url">${qr.urlPointage || ''}</div>
      <p style="margin-top:16px;font-size:11px;color:#9ca3af">Expire : ${formatDate(qr.dateExpiration)}</p>
      <script>window.onload=()=>window.print();</script>
      </body></html>
    `);
    win.document.close();
  };

  const formatDate = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const isExpired = (dt) => dt && new Date(dt) < new Date();

  const pagePad = isMobile ? '14px 12px 40px' : '24px 28px 40px';

  return (
    <Layout title="QR Codes" subtitle="Gestion des QR codes de pointage">
      <div style={{ ...s.page, padding: pagePad }}>
        {/* Header — stacked sur mobile */}
        <div style={{
          ...s.headerActions,
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 10 : 16,
        }}>
          <div style={{
            ...s.infoBanner,
            minWidth: 0,
            flex: 1,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              Chaque QR code est valable <strong style={{ color: 'var(--text)' }}>24 heures</strong>.
              Chaque QR génère une URL unique à partager ou afficher.
            </span>
          </div>
          <button
            id="qrcode-btn-generate"
            onClick={generate}
            disabled={generating}
            style={{
              ...s.btnPrimary,
              width: isMobile ? '100%' : 'auto',
              justifyContent: 'center',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <path d="M14 14h3v3M17 17h3v3M14 20h3" strokeLinecap="round" />
            </svg>
            {generating ? 'Génération...' : 'Générer un QR code'}
          </button>
        </div>

        {msg && (
          <div style={{
            ...s.msg,
            background: msg.ok ? 'var(--green-bg)' : 'var(--red-bg)',
            color:      msg.ok ? 'var(--green)' : 'var(--red)',
            borderColor: msg.ok ? 'var(--green-br)' : 'var(--red-br)',
          }}>
            {msg.text}
          </div>
        )}

        <div style={{
          ...s.grid,
          gridTemplateColumns: isMobile
            ? '1fr'
            : 'repeat(auto-fill,minmax(280px,1fr))',
        }}>
          {qrcodes.length === 0 ? (
            <div style={s.empty}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text3)', marginBottom: 14,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <path d="M14 14h3v3M17 17h3v3M14 20h3" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 4, fontWeight: 500 }}>
                Aucun QR code généré
              </div>
              <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 18 }}>
                Générez votre premier QR code pour permettre le pointage
              </div>
              <button onClick={generate} style={s.btnPrimary}>Générer le premier QR code</button>
            </div>
          ) : qrcodes.map(qr => {
            const expired = isExpired(qr.dateExpiration);
            const active  = qr.actif && !expired;
            return (
              <div key={qr.id} id={`qr-card-${qr.id}`} style={{ ...s.qrCard, opacity: active ? 1 : 0.55 }}>
                <div style={s.qrTop}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 11, fontWeight: 500,
                    padding: '3px 10px', borderRadius: 12,
                    background: active ? 'var(--green-bg)' : 'var(--red-bg)',
                    color:      active ? 'var(--green)' : 'var(--red)',
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: active ? 'var(--green)' : 'var(--red)',
                    }} />
                    {active ? 'Actif' : expired ? 'Expiré' : 'Désactivé'}
                  </span>
                  {active && (
                    <button
                      id={`qr-deactivate-${qr.id}`}
                      onClick={() => deactivate(qr.id)}
                      style={s.deactivateBtn}
                    >
                      Désactiver
                    </button>
                  )}
                </div>

                <div style={s.qrVisual}>
                  {qrImages[qr.id] ? (
                    <img src={qrImages[qr.id]} alt="QR Code"
                         style={{
                           width: isMobile ? 160 : 140,
                           height: isMobile ? 160 : 140,
                           borderRadius: 8,
                           border: '1px solid var(--border2)', padding: 4, background: 'var(--surface)',
                         }} />
                  ) : (
                    <div style={{
                      width: isMobile ? 160 : 140,
                      height: isMobile ? 160 : 140,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text3)', fontSize: 12,
                    }}>Chargement...</div>
                  )}
                </div>

                {qr.urlPointage && (
                  <div style={s.urlBox}>
                    <div style={s.urlLabel}>URL DE POINTAGE</div>
                    <div style={s.urlRow}>
                      {/* wordBreak: break-all prevents URL overflow on narrow cards */}
                      <span style={{ ...s.urlText, wordBreak: 'break-all' }}>{qr.urlPointage}</span>
                      <button
                        id={`qr-copy-${qr.id}`}
                        onClick={() => copyUrl(qr.urlPointage, qr.id)}
                        style={s.copyBtn}
                        aria-label="Copier"
                      >
                        {copied === qr.id ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                               stroke="var(--green)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div style={s.qrMeta}>
                  <div style={s.metaRow}>
                    <span style={{ color: 'var(--text3)' }}>Généré</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                      {formatDate(qr.dateGeneration)}
                    </span>
                  </div>
                  <div style={s.metaRow}>
                    <span style={{ color: 'var(--text3)' }}>Expire</span>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 11,
                      color: expired ? 'var(--red)' : 'var(--text2)',
                    }}>
                      {formatDate(qr.dateExpiration)}
                    </span>
                  </div>
                </div>

                {active && (
                  <button
                    id={`qr-print-${qr.id}`}
                    onClick={() => printQR(qr)}
                    style={s.printBtn}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Imprimer / Afficher
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

const s = {
  page: { maxWidth: 1200, margin: '0 auto' },
  headerActions: {
    display: 'flex', justifyContent: 'space-between',
    marginBottom: 16, flexWrap: 'wrap',
  },
  infoBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--accent-soft)',
    border: '1px solid rgba(139,158,255,0.18)',
    borderRadius: 10,
    padding: '9px 13px',
    fontSize: 12, color: 'var(--text2)',
    lineHeight: 1.5,
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '9px 16px',
    background: 'var(--text)', color: 'var(--bg)',
    border: 'none', borderRadius: 10,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', fontFamily: 'inherit',
    flexShrink: 0,
  },
  msg: { padding: '10px 14px', borderRadius: 10, border: '1px solid', fontSize: 12, fontWeight: 500, marginBottom: 16 },

  grid: { display: 'grid', gap: 14 },
  empty: {
    gridColumn: '1/-1', textAlign: 'center', padding: 60,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
  },

  qrCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: 18,
  },
  qrTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  deactivateBtn: {
    fontSize: 11, padding: '4px 10px',
    background: 'var(--red-bg)', color: 'var(--red)',
    border: '1px solid var(--red-br)', borderRadius: 7,
    cursor: 'pointer', fontWeight: 500,
  },
  qrVisual: { display: 'flex', justifyContent: 'center', padding: '8px 0 14px' },

  urlBox: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 12px', marginBottom: 12,
  },
  urlLabel: {
    fontSize: 9, fontWeight: 500, color: 'var(--text3)',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1.2px',
  },
  urlRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  urlText: { fontSize: 11, color: 'var(--accent)', flex: 1, fontFamily: 'var(--mono)' },
  copyBtn: {
    flexShrink: 0,
    background: 'transparent', border: '1px solid var(--border2)',
    color: 'var(--text2)', borderRadius: 6,
    cursor: 'pointer', padding: 5,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qrMeta: {
    background: 'var(--bg)', borderRadius: 10,
    padding: '9px 12px',
    display: 'flex', flexDirection: 'column', gap: 5,
    marginBottom: 12,
  },
  metaRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', flexWrap: 'wrap', gap: 4 },
  printBtn: {
    width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: 9,
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    color: 'var(--text2)', borderRadius: 9,
    cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
  },
};

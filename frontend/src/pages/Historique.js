import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/Layout';
import useResponsive from '../hooks/useResponsive';

export default function Historique() {
  const { isMobile } = useResponsive();
  const { user } = useAuth();
  const [pointages, setPointages] = useState([]);

  useEffect(() => {
    api.get(`/pointage/user/${user?.id}`).then(r => setPointages(r.data)).catch(() => {});
  }, [user]);

  return (
    <Layout title="Mon historique" subtitle="Tous vos pointages enregistrés">
      <style>{`.row-hover:hover { background: rgba(255,255,255,0.025); }`}</style>

      <div style={{ ...s.page, ...(isMobile ? { padding: '12px 4px 30px' } : {}) }}>
        <div style={s.panel}>
          {pointages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--surface2)', border: '1px solid var(--border)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text3)', marginBottom: 12,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </div>
              <div style={{ color: 'var(--text2)', fontSize: 14, fontWeight: 500 }}>
                Aucun pointage enregistré
              </div>
              <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
                Vos pointages apparaîtront ici
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table style={s.table}>
                <thead>
                  <tr>
                    {['Date & Heure', 'Type', 'Mode', 'Localisation', 'QR Code'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pointages.map(p => (
                    <tr key={p.id} className="row-hover" style={s.tr}>
                      <td style={s.td}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                            {p.date}
                          </span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', marginTop: 2 }}>
                            {p.heure?.substring(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td style={s.td}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500,
                          background: p.type === 'ENTREE' ? 'var(--green-bg)' : 'var(--red-bg)',
                          color:      p.type === 'ENTREE' ? 'var(--green)' : 'var(--red)',
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: p.type === 'ENTREE' ? 'var(--green)' : 'var(--red)',
                          }} />
                          {p.type === 'ENTREE' ? 'Entrée' : 'Sortie'}
                        </span>
                      </td>
                      <td style={s.td}>
                        {p.modeTravail ? (
                          <span style={{
                            fontSize: 11, fontWeight: 500,
                            padding: '3px 9px', borderRadius: 10,
                            background:  p.modeTravail === 'TELETRAVAIL' ? 'var(--cyan-bg)' : 'var(--green-bg)',
                            color:       p.modeTravail === 'TELETRAVAIL' ? 'var(--cyan)'    : 'var(--green)',
                          }}>
                            {p.modeTravail === 'TELETRAVAIL' ? 'Télétravail' : 'Présentiel'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ ...s.td, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                        {p.latitude?.substring(0, 8)}, {p.longitude?.substring(0, 8)}
                      </td>
                      <td style={{ ...s.td, fontSize: 12 }}>
                        {p.qrCode ? (
                          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                            {p.qrCode?.substring(0, 12)}…
                          </span>
                        ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

const s = {
  page: { padding: '24px 28px 40px', maxWidth: 1100, margin: '0 auto' },
  panel: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '13px 18px', textAlign: 'left',
    fontSize: 10, fontWeight: 500, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '1.2px',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '14px 18px', fontSize: 13, color: 'var(--text)' },
};

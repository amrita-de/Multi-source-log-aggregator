/**
 * AlertBanner — fixed top banner for high error rate alerts
 */
export default function AlertBanner({ alert, onDismiss }) {
  if (!alert) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        backgroundColor: '#3d0b0b',
        border: '1px solid #da3633',
        borderTop: 'none',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 16px rgba(248,81,73,0.3)',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>🚨</span>
        <div>
          <div style={{ color: '#f85149', fontWeight: '600', fontSize: '14px' }}>
            HIGH ERROR RATE ALERT
          </div>
          <div style={{ color: '#c9d1d9', fontSize: '13px', marginTop: '2px' }}>
            {alert.message}
            {alert.app_name && (
              <span style={{ color: '#8b949e', marginLeft: '8px' }}>— {alert.app_name}</span>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ color: '#8b949e', fontSize: '12px' }}>
          {alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() : ''}
        </span>
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: '1px solid #da3633',
            borderRadius: '4px',
            color: '#f85149',
            padding: '4px 12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '13px',
          }}
        >
          Dismiss
        </button>
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/**
 * LogDetailModal — full log detail in an overlay modal
 */
import dayjs from 'dayjs';

const LEVEL_STYLE = {
  INFO:  { bg: '#1d3558', color: '#58a6ff', border: '#1f6feb' },
  WARN:  { bg: '#2d2208', color: '#d29922', border: '#9e6a03' },
  ERROR: { bg: '#3d0b0b', color: '#f85149', border: '#da3633' },
  DEBUG: { bg: '#1c1f24', color: '#6e7681', border: '#30363d' },
};

function Row({ label, value, mono = false }) {
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid #21262d',
        padding: '8px 0',
        gap: '16px',
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{ width: '130px', flexShrink: 0, color: '#8b949e', fontSize: '12px', paddingTop: '2px' }}
      >
        {label}
      </span>
      <span
        style={{
          color: '#c9d1d9',
          fontSize: '13px',
          fontFamily: mono ? 'inherit' : 'inherit',
          wordBreak: 'break-all',
        }}
      >
        {value || '—'}
      </span>
    </div>
  );
}

export default function LogDetailModal({ log, onClose }) {
  if (!log) return null;

  const levelStyle = LEVEL_STYLE[log.level] || LEVEL_STYLE.DEBUG;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: '10px',
          width: '600px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span
              style={{
                backgroundColor: levelStyle.bg,
                color: levelStyle.color,
                border: `1px solid ${levelStyle.border}`,
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {log.level}
            </span>
            <span style={{ color: '#8b949e', fontSize: '13px' }}>{log.app_name}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: '#8b949e',
              padding: '4px 10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '13px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Message */}
        <div
          style={{
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#c9d1d9',
            fontSize: '14px',
            lineHeight: '1.6',
          }}
        >
          {log.message}
        </div>

        {/* Fields */}
        <Row label="Log ID"       value={log._id} />
        <Row label="Service"      value={log.app_name} />
        <Row label="Level"        value={log.level} />
        <Row label="Environment"  value={log.environment} />
        <Row label="Timestamp"    value={dayjs(log.timestamp_iso).format('YYYY-MM-DD HH:mm:ss.SSS')} />
        <Row label="Ingested At"  value={dayjs(log.ingested_at).format('YYYY-MM-DD HH:mm:ss.SSS')} />
        <Row label="Unix TS"      value={String(log.timestamp_unix)} mono />
        {log.s3_key && (
          <Row label="S3 Key"     value={log.s3_key} mono />
        )}

        {/* Metadata */}
        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ color: '#8b949e', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Metadata
            </div>
            <pre
              style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '6px',
                padding: '12px 16px',
                color: '#3fb950',
                fontSize: '12px',
                lineHeight: '1.6',
                overflowX: 'auto',
                margin: 0,
                fontFamily: 'inherit',
              }}
            >
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

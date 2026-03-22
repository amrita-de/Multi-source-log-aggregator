/**
 * LogTable — main log data table with pagination
 */
import dayjs from 'dayjs';

const LEVEL_STYLE = {
  INFO:  'badge-INFO',
  WARN:  'badge-WARN',
  ERROR: 'badge-ERROR',
  DEBUG: 'badge-DEBUG',
};

const APP_STYLE = {
  'Payment-Service':   'badge-Payment-Service',
  'Auth-Service':      'badge-Auth-Service',
  'Inventory-Service': 'badge-Inventory-Service',
};

function Badge({ text, className }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${className || ''}`}
      style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
    >
      {text}
    </span>
  );
}

function StatusCode({ code }) {
  if (!code) return <span style={{ color: '#6e7681' }}>—</span>;
  const color = code >= 500 ? '#f85149' : code >= 400 ? '#d29922' : '#3fb950';
  return <span style={{ color, fontSize: '12px' }}>{code}</span>;
}

export default function LogTable({ logs, loading, pagination, onPageChange, onRowClick }) {
  const { total = 0, page = 1, pageSize = 50, totalPages = 1 } = pagination || {};

  const thStyle = {
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: '11px',
    color: '#8b949e',
    borderBottom: '1px solid #30363d',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    backgroundColor: '#161b22',
  };

  const tdStyle = {
    padding: '8px 12px',
    borderBottom: '1px solid #21262d',
    verticalAlign: 'middle',
    fontSize: '13px',
  };

  return (
    <div>
      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #30363d', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Level</th>
              <th style={thStyle}>Service</th>
              <th style={thStyle}>Message</th>
              <th style={thStyle}>Environment</th>
              <th style={thStyle}>Time</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#8b949e', padding: '40px' }}>
                  Loading logs...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#8b949e', padding: '40px' }}>
                  No logs found. Make sure producers are running.
                </td>
              </tr>
            )}
            {!loading && logs.map((log) => {
              const rowBg = log.level === 'ERROR'
                ? 'rgba(248,81,73,0.04)'
                : log.level === 'WARN'
                ? 'rgba(210,153,34,0.04)'
                : 'transparent';

              return (
                <tr
                  key={log._id}
                  style={{ backgroundColor: rowBg, cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#161b22'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBg}
                  onClick={() => onRowClick && onRowClick(log)}
                >
                  <td style={tdStyle}>
                    <Badge text={log.level} className={LEVEL_STYLE[log.level] || ''} />
                  </td>
                  <td style={tdStyle}>
                    <Badge text={log.app_name} className={APP_STYLE[log.app_name] || ''} />
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '380px' }}>
                    <span
                      style={{
                        color: '#c9d1d9',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '380px',
                      }}
                      title={log.message}
                    >
                      {log.message}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: '#8b949e', fontSize: '12px' }}>
                    {log.environment}
                  </td>
                  <td style={{ ...tdStyle, color: '#8b949e', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {dayjs(log.timestamp_iso).format('DD MMM HH:mm:ss')}
                  </td>
                  <td style={tdStyle}>
                    <button
                      style={{
                        background: 'transparent',
                        border: '1px solid #30363d',
                        borderRadius: '4px',
                        color: '#8b949e',
                        padding: '2px 8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                      }}
                      onClick={(e) => { e.stopPropagation(); onRowClick && onRowClick(log); }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3" style={{ color: '#8b949e', fontSize: '13px' }}>
        <span>
          Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} logs
        </span>
        <div className="flex gap-2 items-center">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: page <= 1 ? '#30363d' : '#c9d1d9',
              padding: '4px 12px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              fontSize: '13px',
            }}
          >
            ← Prev
          </button>
          <span>Page {page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: page >= totalPages ? '#30363d' : '#c9d1d9',
              padding: '4px 12px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              fontSize: '13px',
            }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

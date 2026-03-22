/**
 * Multi-Source Log Aggregator — React Dashboard
 * Real-time log viewer with WebSocket updates, filters, and alerting.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { logService } from './services/api';
import { useSocket } from './hooks/useSocket';
import StatsCards      from './components/StatsCards';
import LogFilters      from './components/LogFilters';
import LogTable        from './components/LogTable';
import LogDetailModal  from './components/LogDetailModal';
import AlertBanner     from './components/AlertBanner';

const DEFAULT_FILTERS = {
  search:    '',
  level:     '',
  app_name:  '',
  startDate: '',
  endDate:   '',
};

const DEFAULT_PAGINATION = {
  page:       1,
  pageSize:   50,
  total:      0,
  totalPages: 1,
};

export default function App() {
  const [logs,        setLogs]        = useState([]);
  const [stats,       setStats]       = useState({});
  const [loading,     setLoading]     = useState(false);
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS);
  const [pagination,  setPagination]  = useState(DEFAULT_PAGINATION);
  const [selectedLog, setSelectedLog] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const [liveCount,   setLiveCount]   = useState(0);

  const filtersRef   = useRef(filters);
  const paginationRef = useRef(pagination);
  filtersRef.current   = filters;
  paginationRef.current = pagination;

  const fetchLogs = useCallback(async (page = 1, currentFilters = DEFAULT_FILTERS) => {
    setLoading(true);
    try {
      const params = {
        page,
        pageSize: DEFAULT_PAGINATION.pageSize,
        ...(currentFilters.search    && { search:    currentFilters.search }),
        ...(currentFilters.level     && { level:     currentFilters.level }),
        ...(currentFilters.app_name  && { app_name:  currentFilters.app_name }),
        ...(currentFilters.startDate && { startDate: new Date(currentFilters.startDate).toISOString() }),
        ...(currentFilters.endDate   && { endDate:   new Date(currentFilters.endDate).toISOString() }),
      };
      const res = await logService.getLogs(params);
      setLogs(res.data.data);
      setPagination((p) => ({ ...p, ...res.data.pagination }));
    } catch (err) {
      console.error('Failed to fetch logs:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await logService.getLogStats();
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchLogs(1, DEFAULT_FILTERS);
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs(1, filters);
    setPagination((p) => ({ ...p, page: 1 }));
  }, [filters]);

  const liveCountRef = useRef(0);

  useSocket({
    onNewLog: (newLog) => {
      liveCountRef.current++;
      setLiveCount(liveCountRef.current);

      const f = filtersRef.current;
      const hasFilters = f.search || f.level || f.app_name || f.startDate || f.endDate;
      if (!hasFilters && paginationRef.current.page === 1) {
        setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
        setPagination((p) => ({ ...p, total: p.total + 1 }));
      }
      if (liveCountRef.current % 15 === 0) fetchStats();
    },
    onAlert: (alert) => {
      setActiveAlert(alert);
      fetchStats();
    },
  });

  function handleFilterChange(newFilters) {
    setFilters(newFilters);
  }

  function handlePageChange(newPage) {
    setPagination((p) => ({ ...p, page: newPage }));
    fetchLogs(newPage, filters);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0d1117', fontFamily: "'JetBrains Mono', Consolas, monospace" }}>
      <AlertBanner alert={activeAlert} onDismiss={() => setActiveAlert(null)} />

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: activeAlert ? '64px 24px 24px' : '24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: '#c9d1d9', fontSize: '22px', fontWeight: '600', margin: 0, fontFamily: 'inherit' }}>
              <span style={{ color: '#58a6ff' }}>{'>'}_</span> Multi-Source Log Aggregator
            </h1>
            <p style={{ color: '#8b949e', fontSize: '13px', margin: '6px 0 0', fontFamily: 'inherit' }}>
              Payment-Service · Auth-Service · Inventory-Service → Redis → MongoDB · AWS S3
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {liveCount > 0 && (
              <span style={{
                backgroundColor: '#1a2f1a',
                color: '#3fb950',
                border: '1px solid #238636',
                borderRadius: '20px',
                padding: '3px 12px',
                fontSize: '12px',
                fontFamily: 'inherit',
              }}>
                ● {liveCount} live
              </span>
            )}
            <button
              onClick={() => { fetchLogs(pagination.page, filters); fetchStats(); }}
              style={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '6px',
                color: '#c9d1d9',
                padding: '6px 16px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '13px',
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <StatsCards stats={stats} loading={loading && !logs.length} />
        <LogFilters filters={filters} onChange={handleFilterChange} />
        <LogTable
          logs={logs}
          loading={loading}
          pagination={pagination}
          onPageChange={handlePageChange}
          onRowClick={setSelectedLog}
        />

        <div style={{ marginTop: '32px', color: '#6e7681', fontSize: '11px', textAlign: 'center', paddingBottom: '24px' }}>
          Multi-Source Log Aggregator · Node.js + Express + Redis + MongoDB + Socket.io + AWS S3 + Lambda
        </div>
      </div>

      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}

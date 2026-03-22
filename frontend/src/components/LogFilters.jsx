/**
 * LogFilters — filter bar for the log table
 */
import { useRef } from 'react';

const LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
const APPS   = ['Payment-Service', 'Auth-Service', 'Inventory-Service'];

const inputStyle = {
  backgroundColor: '#161b22',
  color: '#c9d1d9',
  border: '1px solid #30363d',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '13px',
  fontFamily: 'inherit',
  outline: 'none',
};

const selectStyle = { ...inputStyle, cursor: 'pointer' };

export default function LogFilters({ filters, onChange }) {
  const debounceRef = useRef(null);

  function handleSearchChange(e) {
    const value = e.target.value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...filters, search: value });
    }, 400);
  }

  function handleLevelClick(level) {
    onChange({ ...filters, level: filters.level === level ? '' : level });
  }

  function handleDateChange(field, value) {
    onChange({ ...filters, [field]: value });
  }

  const levelColors = {
    INFO:  { active: '#1d3558', border: '#1f6feb', text: '#58a6ff' },
    WARN:  { active: '#2d2208', border: '#9e6a03', text: '#d29922' },
    ERROR: { active: '#3d0b0b', border: '#da3633', text: '#f85149' },
    DEBUG: { active: '#1c1f24', border: '#30363d', text: '#6e7681' },
  };

  return (
    <div className="flex flex-wrap gap-3 mb-4 items-center">
      {/* Search */}
      <input
        type="text"
        placeholder="Search messages..."
        defaultValue={filters.search}
        onChange={handleSearchChange}
        style={{ ...inputStyle, width: '220px' }}
      />

      {/* App Name */}
      <select
        value={filters.app_name || ''}
        onChange={(e) => onChange({ ...filters, app_name: e.target.value })}
        style={{ ...selectStyle, width: '180px' }}
      >
        <option value="">All Services</option>
        {APPS.map((app) => (
          <option key={app} value={app}>{app}</option>
        ))}
      </select>

      {/* Level toggle buttons */}
      <div className="flex gap-1">
        {LEVELS.map((level) => {
          const c = levelColors[level];
          const isActive = filters.level === level;
          return (
            <button
              key={level}
              onClick={() => handleLevelClick(level)}
              style={{
                backgroundColor: isActive ? c.active : '#161b22',
                color:  isActive ? c.text : '#8b949e',
                border: `1px solid ${isActive ? c.border : '#30363d'}`,
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                fontFamily: 'inherit',
                cursor: 'pointer',
                fontWeight: isActive ? '600' : '400',
                transition: 'all 0.15s',
              }}
            >
              {level}
            </button>
          );
        })}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-2 text-xs" style={{ color: '#8b949e' }}>
        <span>From</span>
        <input
          type="datetime-local"
          value={filters.startDate || ''}
          onChange={(e) => handleDateChange('startDate', e.target.value)}
          style={{ ...inputStyle, fontSize: '12px' }}
        />
        <span>To</span>
        <input
          type="datetime-local"
          value={filters.endDate || ''}
          onChange={(e) => handleDateChange('endDate', e.target.value)}
          style={{ ...inputStyle, fontSize: '12px' }}
        />
      </div>

      {/* Clear filters */}
      {(filters.search || filters.level || filters.app_name || filters.startDate || filters.endDate) && (
        <button
          onClick={() => onChange({ search: '', level: '', app_name: '', startDate: '', endDate: '' })}
          style={{
            backgroundColor: 'transparent',
            color: '#8b949e',
            border: '1px solid #30363d',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}

/**
 * StatsCards — 4 stat cards showing aggregate log counts
 */
export default function StatsCards({ stats, loading }) {
  const { total = 0, recentErrors24h = 0, byLevel = {}, byApp = {} } = stats || {};

  const cards = [
    {
      label: 'Total Logs',
      value: total.toLocaleString(),
      icon: '📊',
      color: '#58a6ff',
      bg:    '#1d3558',
    },
    {
      label: 'Errors (24h)',
      value: (recentErrors24h ?? byLevel.ERROR ?? 0).toLocaleString(),
      icon: '🔴',
      color: '#f85149',
      bg:    '#3d0b0b',
    },
    {
      label: 'Warnings',
      value: (byLevel.WARN ?? 0).toLocaleString(),
      icon: '⚠️',
      color: '#d29922',
      bg:    '#2d2208',
    },
    {
      label: 'Active Services',
      value: Object.keys(byApp).length,
      icon: '⚡',
      color: '#3fb950',
      bg:    '#1a2f1a',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border p-4 flex flex-col gap-2"
          style={{ backgroundColor: card.bg, borderColor: card.color + '44' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#8b949e' }}>{card.label}</span>
            <span className="text-lg">{card.icon}</span>
          </div>
          <div
            className="text-3xl font-bold"
            style={{ color: card.color, fontVariantNumeric: 'tabular-nums' }}
          >
            {loading ? '—' : card.value}
          </div>
          {card.label === 'Active Services' && !loading && (
            <div className="text-xs" style={{ color: '#8b949e' }}>
              {Object.entries(byApp).map(([name, count]) => (
                <span key={name} className="mr-2">{name.split('-')[0]}: {count}</span>
              ))}
            </div>
          )}
          {card.label === 'Total Logs' && !loading && (
            <div className="text-xs" style={{ color: '#8b949e' }}>
              {Object.entries(byLevel).map(([lvl, cnt]) => (
                <span key={lvl} className="mr-2">{lvl}: {cnt}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { 
  FileText, DollarSign, Hammer, Truck, CheckCircle2, Clock, 
  AlertCircle, ChevronRight, User, Shield, Filter
} from 'lucide-react';

const TYPE_ICONS = {
  lead: User,
  quote: FileText,
  invoice: DollarSign,
  payment: CheckCircle2,
  project: Hammer,
  logistics: Truck,
  audit: Shield,
  system: AlertCircle,
};

const TYPE_COLORS = {
  lead: 'bg-primary/15 text-primary border-primary/30',
  quote: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  invoice: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  payment: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  project: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  logistics: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  audit: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  system: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Unified Activity Timeline Component for customer and deal history.
 */
export default function ActivityTimeline({ events = [], title = 'Customer Activity Timeline', onEventClick }) {
  const [filterType, setFilterType] = useState('ALL');

  const sortedEvents = useMemo(() => {
    const list = [...events].sort((a, b) => {
      const dateA = new Date(a.timestamp || a.date || 0).getTime();
      const dateB = new Date(b.timestamp || b.date || 0).getTime();
      return dateB - dateA;
    });
    if (filterType === 'ALL') return list;
    return list.filter(e => e.type === filterType);
  }, [events, filterType]);

  const eventTypes = useMemo(() => {
    const types = new Set(events.map(e => e.type).filter(Boolean));
    return ['ALL', ...Array.from(types)];
  }, [events]);

  return (
    <div className="space-y-4">
      {/* Header & Filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest">{title}</h4>
          <span className="text-[10px] text-on-surface-variant font-medium">({sortedEvents.length} events)</span>
        </div>

        {eventTypes.length > 2 && (
          <div className="flex items-center gap-1 flex-wrap">
            {eventTypes.map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase transition-colors border ${
                  filterType === t
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-surface-container text-on-surface-variant/60 border-outline-variant hover:text-on-surface'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Timeline Stream */}
      {sortedEvents.length === 0 ? (
        <div className="p-8 bg-surface-container/40 rounded-xl border border-outline-variant/50 text-center text-xs text-on-surface-variant">
          No interaction history on record yet.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-outline-variant/40">
          {sortedEvents.map((evt, idx) => {
            const Icon = TYPE_ICONS[evt.type] || Clock;
            const style = TYPE_COLORS[evt.type] || TYPE_COLORS.system;

            return (
              <div
                key={evt.id || idx}
                onClick={() => onEventClick && onEventClick(evt)}
                className={`relative group ${onEventClick ? 'cursor-pointer' : ''}`}
              >
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center shadow-[0_0_10px_rgba(0,218,243,0.1)] transition-transform group-hover:scale-110 ${style}`}
                >
                  <Icon size={10} />
                </div>

                {/* Event Card */}
                <div className="bg-surface-container/70 hover:bg-surface-container-high/80 p-3.5 rounded-xl border border-outline-variant transition-all shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-on-surface">{evt.title}</span>
                        {evt.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-surface-container-highest text-on-surface-variant border border-outline-variant">
                            {evt.badge}
                          </span>
                        )}
                      </div>
                      {evt.subtitle && (
                        <p className="text-[10px] text-on-surface-variant">{evt.subtitle}</p>
                      )}
                    </div>
                    <span className="text-[9px] text-on-surface-variant font-mono whitespace-nowrap opacity-75">
                      {formatRelativeTime(evt.timestamp || evt.date)}
                    </span>
                  </div>

                  {evt.details && (
                    <p className="text-[11px] text-on-surface-variant mt-2 p-2 bg-surface-container-low/60 rounded-lg border border-outline-variant/30 leading-relaxed font-mono">
                      {evt.details}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

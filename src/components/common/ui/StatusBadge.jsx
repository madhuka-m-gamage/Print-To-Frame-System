import React from 'react';
import { Check, Clock, AlertCircle, Truck, Package, ShieldCheck } from 'lucide-react';

/**
 * Standardized status and stage badge component across all ERP modules.
 *
 * Colours come from the semantic `status-*` tokens (see src/index.css), which
 * carry a darker text value under [data-theme='light'] so badges stay legible
 * in both themes. Do not reintroduce raw Tailwind palette shades here: the
 * 300/400-level colours used previously sat near 1.8:1 on a light surface.
 */
const DEFAULT_STYLE = {
  colorClasses: 'bg-surface-container-high text-on-surface-variant border-outline-variant',
  dotClass: 'bg-on-surface-variant',
  Icon: null,
};

const STATUS_STYLES = [
  {
    match: ['completed', 'delivered', 'canvas in', 'received', 'paid', 'approved'],
    colorClasses: 'bg-status-success/10 text-status-success-on border-status-success/30',
    dotClass: 'bg-status-success-on',
    Icon: Check,
  },
  {
    match: ['in transit', 'ongoing', 'fabricating', 'processing'],
    colorClasses: 'bg-status-progress/10 text-status-progress-on border-status-progress/30',
    dotClass: 'bg-status-progress-on',
    Icon: Clock,
  },
  {
    match: ['ready', 'ready to load', 'ready for inspection'],
    colorClasses: 'bg-status-ready/10 text-status-ready-on border-status-ready/30',
    dotClass: 'bg-status-ready-on',
    Icon: Package,
  },
  {
    match: ['pending', 'waiting', 'intake', 'awaiting'],
    colorClasses: 'bg-status-warning/10 text-status-warning-on border-status-warning/30',
    dotClass: 'bg-status-warning-on',
    Icon: Clock,
  },
  {
    match: ['revision', 'blocked', 'cancelled', 'error'],
    colorClasses: 'bg-status-danger/10 text-status-danger-on border-status-danger/30',
    dotClass: 'bg-status-danger-on',
    Icon: AlertCircle,
  },
  {
    match: ['75% invoice submitted', 'hand over'],
    colorClasses: 'bg-status-info/10 text-status-info-on border-status-info/30',
    dotClass: 'bg-status-info-on',
    Icon: ShieldCheck,
  },
];

const SIZE_CLASSES = {
  xs: 'text-[9px] px-1.5 py-0.5 font-bold tracking-tight',
  sm: 'text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider',
  md: 'text-xs px-2.5 py-1 font-semibold',
  lg: 'text-sm px-3 py-1.5 font-bold',
};

export default function StatusBadge({
  status,
  size = 'sm',
  showDot = true,
  className = '',
}) {
  if (!status) return null;

  const normalized = String(status).toLowerCase().trim();
  const style = STATUS_STYLES.find(s => s.match.includes(normalized)) || DEFAULT_STYLE;
  const { colorClasses, dotClass } = style;

  const pulse = normalized === 'in transit';
  const Icon = pulse ? Truck : style.Icon;
  const sizeClasses = SIZE_CLASSES[size] || SIZE_CLASSES.sm;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${colorClasses} ${sizeClasses} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotClass} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`} />
        </span>
      )}
      {showDot && !pulse && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      )}
      {Icon && !pulse && <Icon size={size === 'lg' ? 14 : 11} className="opacity-90" />}
      <span>{status}</span>
    </span>
  );
}

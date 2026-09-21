import React from 'react';
import { X } from 'lucide-react';

/**
 * DetailModalHeader - Standardized top bar for all detail pop-ups.
 * Includes module badge, ID, dynamic title, metadata subtitle, and animated close button.
 */
export default function DetailModalHeader({
  title,
  id,
  badge,
  subtitle,
  onClose,
  actions
}) {
  return (
    <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 py-3 sm:py-4.5 flex-shrink-0 border-b border-outline bg-surface-container-high">
      <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0 flex-1">
        {badge && <div className="flex-shrink-0">{badge}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2 flex-wrap">
            <h2 className="text-base sm:text-lg md:text-xl font-black text-on-surface truncate tracking-tight">
              {title}
            </h2>
            {id && (
              <span className="font-mono text-xs font-bold text-on-surface bg-surface-container-highest px-2 py-0.5 rounded-md border border-outline">
                {id}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5 sm:gap-2 mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 flex-shrink-0 ml-2 sm:ml-4">
        {actions}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 bg-surface-container-highest text-on-surface rounded-full hover:bg-primary/20 hover:text-primary transition-all hover:rotate-90 duration-200 border border-outline cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Close Inspector (ESC)"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

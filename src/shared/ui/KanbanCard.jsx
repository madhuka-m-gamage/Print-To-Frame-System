import React from 'react';
import { ArrowLeft, ArrowRight, Trash2, Check } from 'lucide-react';

/**
 * Standardized Kanban Card wrapper component for all modules.
 */
export default function KanbanCard({
  id,
  title,
  subtitle,
  badges,
  metrics,
  details,
  onClick,
  onMoveBack,
  onMoveForward,
  onDelete,
  isAdmin = false,
  customActions,
  isFirstStage = false,
  isLastStage = false,
  moveForwardIcon,
  moveForwardTitle = 'Move to next stage',
  isDragging = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  className = '',
}) {
  const handleKeyDown = (e) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      // Don't trigger card click if the focus is on a nested action button
      if (e.target === e.currentTarget) {
        e.preventDefault();
        onClick(e);
      }
    }
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? "button" : undefined}
      aria-label={`Inspect ${title || 'item'}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-surface-container/90 p-4 sm:p-5 rounded-xl border border-outline-variant shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_24px_rgba(0,218,243,0.08)] hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all cursor-pointer group relative ${
        isDragging ? 'opacity-30 border-dashed border-primary scale-95' : ''
      } ${className}`}
    >
      {/* Top Header: Badges & Date */}
      {badges && (
        <div className="flex justify-between items-start mb-2.5 gap-2 flex-wrap">
          {badges}
        </div>
      )}

      {/* Main Title & Subtitle */}
      <h4 className="font-bold text-on-surface text-sm mb-1 group-hover:text-primary transition-colors leading-snug">
        {title || 'Untitled'}
      </h4>

      {subtitle && (
        <div className="text-xs text-on-surface-variant mb-3 flex items-center flex-wrap gap-1.5">
          {subtitle}
        </div>
      )}

      {/* Optional details (manifest, specs, tags, etc.) */}
      {details && <div className="mb-3">{details}</div>}

      {/* Bottom Footer: Metric on left, Stage Navigation on right */}
      <div className="flex items-center justify-between pt-3.5 border-t border-outline-variant/50 mt-3 min-h-[36px]">
        {/* Metric (Value, Weight, Duration, etc.) */}
        <div className="flex items-center text-on-surface text-xs font-bold">
          {metrics}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
          {onMoveBack && !isFirstStage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveBack();
              }}
              className="p-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-all border border-outline-variant/60 focus-visible:ring-2 focus-visible:ring-primary min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Move backward"
              aria-label={`Move ${title || 'item'} backward to previous stage`}
            >
              <ArrowLeft size={13} />
            </button>
          )}

          {customActions}

          {onMoveForward && !isLastStage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveForward();
              }}
              className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary hover:text-on-primary transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary min-w-[32px] min-h-[32px]"
              title={moveForwardTitle}
              aria-label={moveForwardTitle ? `${moveForwardTitle} for ${title || 'item'}` : `Move ${title || 'item'} forward`}
            >
              {moveForwardIcon || <ArrowRight size={13} />}
            </button>
          )}

          {isAdmin && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-2 rounded-lg bg-error/10 text-error hover:bg-error hover:text-on-error transition-all border border-error/20 focus-visible:ring-2 focus-visible:ring-error min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="Delete (Admin Only)"
              aria-label={`Delete ${title || 'item'} permanently`}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

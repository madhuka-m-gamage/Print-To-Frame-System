import React from 'react';
import { Plus } from 'lucide-react';

/**
 * Standardized Kanban Column component for Leads, Deals, Logistics, and Fabrication.
 */
export default function KanbanColumn({
  title,
  count = 0,
  stageColor = 'primary',
  children,
  onAddNew,
  addNewText = 'Add New',
  isDropTarget = false,
  onDragOver,
  onDrop,
  minWidth = 'w-[82vw] sm:w-[320px] min-w-[280px] sm:min-w-[320px] max-w-[85vw] sm:max-w-sm',
  className = '',
}) {
  const getDotBg = () => {
    switch (stageColor) {
      case 'emerald':
      case 'secondary':
      case 'success':
        return 'bg-secondary';
      case 'amber':
      case 'warning':
        return 'bg-amber-400';
      case 'rose':
      case 'error':
      case 'danger':
        return 'bg-error';
      case 'purple':
      case 'indigo':
        return 'bg-indigo-400';
      case 'cyan':
      case 'primary':
      default:
        return 'bg-primary';
    }
  };

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex flex-col ${minWidth} shrink-0 snap-start bg-surface-container-low/70 rounded-2xl border ${
        isDropTarget
          ? 'border-primary/80 ring-2 ring-primary/20 bg-surface-container-high/40'
          : 'border-outline-variant/60'
      } p-3 sm:p-4 h-full transition-all ${className}`}
    >
      {/* Column Header */}
      <div className="flex justify-between items-center mb-4 px-2 select-none">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getDotBg()} shadow-[0_0_8px_currentColor]`} />
          <h3 className="font-bold text-on-surface uppercase tracking-wider text-xs truncate">
            {title}
          </h3>
          <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full text-[10px] font-bold border border-outline-variant/50">
            {count}
          </span>
        </div>
      </div>

      {/* Cards List Area */}
      <div className="space-y-3.5 overflow-y-auto pr-1 flex-1 custom-scrollbar">
        {children}

        {/* Optional Add New item trigger button */}
        {onAddNew && (
          <button
            onClick={onAddNew}
            className="w-full py-2.5 border-2 border-dashed border-outline-variant/80 rounded-xl text-on-surface-variant hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center space-x-2 group active:scale-[0.99]"
          >
            <Plus size={15} className="group-hover:scale-110 transition-transform text-on-surface-variant group-hover:text-primary" />
            <span className="text-xs font-bold uppercase tracking-tight">{addNewText}</span>
          </button>
        )}
      </div>
    </div>
  );
}

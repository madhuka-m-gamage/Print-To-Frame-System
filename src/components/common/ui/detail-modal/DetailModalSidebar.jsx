import React from 'react';

/**
 * DetailModalSidebar - Scrollable right pane (40% width on desktop)
 * for customer info, assignments, stage transitions, and financial metadata.
 */
export default function DetailModalSidebar({ children, className = '' }) {
  return (
    <div className={`p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 lg:w-[380px] xl:w-[440px] flex-shrink-0 bg-surface-container-low/30 overflow-y-auto custom-scrollbar flex flex-col ${className}`}>
      {children}
    </div>
  );
}

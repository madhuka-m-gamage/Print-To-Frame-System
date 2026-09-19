import React from 'react';

/**
 * DetailModalContent - Scrollable left pane (60% width on desktop)
 * for primary interactive documents (CAD Blueprints, Route Waypoints, Quotation Line Items, Scopes).
 */
export default function DetailModalContent({ children, className = '' }) {
  return (
    <div className={`p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6 flex-1 overflow-y-auto custom-scrollbar border-b lg:border-b-0 lg:border-r border-outline-variant/60 ${className}`}>
      {children}
    </div>
  );
}

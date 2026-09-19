import React from 'react';

/**
 * DetailFieldGroup - Standardized form/display field section with consistent typography and spacing.
 */
export default function DetailFieldGroup({
  label,
  icon: Icon,
  badge,
  action,
  children,
  className = ''
}) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between pb-1.5 border-b border-outline">
          <div className="flex items-center space-x-2">
            {Icon && <Icon size={13} className="text-primary opacity-80" />}
            <span className="text-xs uppercase font-extrabold text-on-surface tracking-wider">
              {label}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {badge}
            {action}
          </div>
        </div>
      )}
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

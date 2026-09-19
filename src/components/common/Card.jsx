import React from 'react';

export default function Card({ children, className = "" }) {
  return (
    <div className={`bg-surface-container rounded-xl shadow-[0_4px_20px_rgba(0,218,243,0.05)] border border-outline-variant ${className}`}>
      {children}
    </div>
  );
}

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * ModalWrapper - Centralized, reusable modal dialog wrapper across all modules
 * (Leads, Deals, Logistics, Fabrication, Customers, Partners, Invoices).
 * 
 * Standardizes:
 * - Backdrop: Consistent dark glassmorphism (bg-black/75 backdrop-blur-md)
 * - Container Box: Consistent 24px/32px rounded corners (rounded-3xl), high-contrast borders (border-outline-variant/70),
 *   and ambient deep shadow (shadow-[0_15px_60px_rgba(0,0,0,0.6)]).
 * - Typography: High-contrast headings and metadata labels.
 * - Accessibility: aria-modal, ESC key dismissal, click-outside-to-close (optional).
 */
export default function ModalWrapper({
  isOpen = true,
  onClose,
  children,
  maxWidth = 'max-w-6xl',
  height = 'h-[90vh] max-h-[920px]',
  ariaLabel = 'Modal Dialog',
  closeOnBackdropClick = true,
  className = ''
}) {
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-0 sm:p-3 md:p-5 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div 
        className={`bg-surface-container-high rounded-t-3xl sm:rounded-3xl w-full ${maxWidth} h-[95dvh] sm:h-[90vh] max-h-none sm:max-h-[920px] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden border-t sm:border border-outline animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 text-on-surface ${className}`}
      >
        {/* Mobile top pull-indicator */}
        <div className="flex sm:hidden justify-center pt-2 pb-1 bg-surface-container-low/60 shrink-0">
          <div className="w-10 h-1 rounded-full bg-outline-variant" />
        </div>
        {children}
      </div>
    </div>
  );
}

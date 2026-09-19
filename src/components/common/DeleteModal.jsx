import React from 'react';
import { Trash2 } from 'lucide-react';
import ModalWrapper from './ui/detail-modal/ModalWrapper';

/**
 * DeleteModal - Centralized confirmation dialog using the unified ModalWrapper
 */
export default function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  message = "Are you sure you want to permanently delete this item? This action cannot be undone."
}) {
  if (!isOpen) return null;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      height="h-auto"
      ariaLabel={title}
    >
      <div className="p-6 sm:p-8">
        <div className="w-12 h-12 bg-error/15 text-error rounded-2xl flex items-center justify-center mb-5 border border-error/20">
          <Trash2 size={24} />
        </div>
        <h3 className="text-xl font-bold text-on-surface mb-2">{title}</h3>
        <p className="text-sm text-on-surface-variant leading-relaxed font-medium mb-8">{message}</p>
        
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-surface-container-high text-on-surface rounded-xl font-bold text-xs hover:bg-surface-container-highest transition-all active:scale-95 border border-outline-variant/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 py-3 bg-error text-on-error rounded-xl font-bold text-xs hover:bg-error/90 transition-all active:scale-95 shadow-md shadow-error/20"
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

import React from 'react';
import ModalWrapper from './ModalWrapper';

/**
 * DetailModalLayout - Unified master container utilizing the centralized ModalWrapper.
 * Enforces standardized viewport heights, backdrop blur, border radii, and keyboard ESC dismiss.
 */
export default function DetailModalLayout({
  isOpen = true,
  onClose,
  children,
  maxWidth = 'max-w-6xl',
  height = 'h-[90vh] max-h-[920px]',
  ariaLabel = 'Detail Inspector',
  className = ''
}) {
  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={maxWidth}
      height={height}
      ariaLabel={ariaLabel}
      className={className}
    >
      {children}
    </ModalWrapper>
  );
}

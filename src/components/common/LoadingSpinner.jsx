import React from 'react';

export default function LoadingSpinner({ message = 'Loading...', fullScreen = false }) {
  const spinnerContent = (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"></div>
        <div className="absolute inset-2 rounded-full border-r-2 border-secondary animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
      </div>
      {message && <p className="text-sm font-bold text-on-surface-variant uppercase tracking-widest animate-pulse">{message}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-surface/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {spinnerContent}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[200px] flex items-center justify-center">
      {spinnerContent}
    </div>
  );
}

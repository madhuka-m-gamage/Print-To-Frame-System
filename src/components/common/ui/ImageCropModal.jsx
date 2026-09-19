import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Check, X, Move, Sparkles, RefreshCw } from 'lucide-react';
import ModalWrapper from './detail-modal/ModalWrapper';

export default function ImageCropModal({
  isOpen,
  imageSrc,
  onCropComplete,
  onClose,
  aspectRatio = 1,
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Reset transform state when a new image is loaded
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  // Handle Drag / Pan with mouse
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle Touch Pan for mobile devices
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      });
    }
  };

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Reset to default
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Perform Canvas crop & export
  const handleApplyCrop = () => {
    const image = imageRef.current;
    if (!image) return;

    const outputSize = 400; // Output dimension for high-res crisp avatar
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Viewport preview dimensions (standardized to 280x280 box)
    const previewBoxSize = 280;

    ctx.save();
    // Fill background with transparent / dark clean tone
    ctx.clearRect(0, 0, outputSize, outputSize);

    // Center translation
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);

    // Calculate scaling ratio between output canvas (400px) and preview container (280px)
    const ratio = outputSize / previewBoxSize;
    const drawX = position.x * ratio;
    const drawY = position.y * ratio;

    // Calculate natural image aspect scaling to fit viewport initially
    const imgAspect = image.naturalWidth / image.naturalHeight;
    let baseWidth = previewBoxSize;
    let baseHeight = previewBoxSize;

    if (imgAspect > 1) {
      baseWidth = previewBoxSize * imgAspect;
    } else {
      baseHeight = previewBoxSize / imgAspect;
    }

    const renderW = baseWidth * ratio;
    const renderH = baseHeight * ratio;

    ctx.drawImage(
      image,
      -renderW / 2 + drawX / scale,
      -renderH / 2 + drawY / scale,
      renderW,
      renderH
    );

    ctx.restore();

    // Export web-optimized JPEG data URL
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onCropComplete(croppedDataUrl);
    onClose();
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      height="h-auto"
      ariaLabel="Adjust Profile Photo"
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Adjust & Crop Photo
          </h3>
          <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">
            Drag to reposition, scale with the slider, or rotate.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Interactive Crop Viewport */}
      <div className="p-6 bg-surface-container flex flex-col items-center select-none">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`w-[280px] h-[280px] rounded-3xl relative overflow-hidden bg-black/70 border-2 border-primary/40 shadow-2xl flex items-center justify-center cursor-${
            isDragging ? 'grabbing' : 'grab'
          }`}
          style={{ touchAction: 'none' }}
        >
          {/* Base Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop target"
            draggable={false}
            className="max-w-none pointer-events-none transition-transform duration-75 ease-out"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />

          {/* Circular Mask Overlay & Crosshairs */}
          <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
          
          {/* Subtle Alignment Crosshair */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25">
            <div className="w-full h-px bg-primary/60 border-dashed" />
            <div className="h-full w-px bg-primary/60 border-dashed absolute" />
          </div>

          {/* Drag instruction overlay badge */}
          <div className="absolute bottom-2 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-bold text-white/80 flex items-center gap-1.5 pointer-events-none border border-white/10">
            <Move size={10} className="text-primary" /> Drag photo to center
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="w-full max-w-[280px] mt-5 space-y-4">
          {/* Zoom Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-on-surface-variant">
              <span className="flex items-center gap-1">
                <ZoomIn size={12} className="text-primary" /> Zoom
              </span>
              <span className="font-mono text-primary">{scale.toFixed(1)}x</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.8, Number((s - 0.1).toFixed(1))))}
                className="p-1 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <input
                type="range"
                min="0.8"
                max="3.0"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(3.0, Number((s + 0.1).toFixed(1))))}
                className="p-1 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </div>

          {/* Secondary Controls: Rotate & Reset */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/40">
            <button
              type="button"
              onClick={handleRotate}
              className="flex-1 py-1.5 px-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-outline-variant/60 active:scale-95"
            >
              <RotateCw size={13} className="text-primary" />
              <span>Rotate 90°</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="py-1.5 px-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-outline-variant/60"
              title="Reset position and zoom"
            >
              <RefreshCw size={12} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Actions Footer */}
      <div className="p-4 sm:p-5 border-t border-outline-variant bg-surface-container-low flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-surface-container-high text-on-surface rounded-xl text-xs font-bold hover:bg-surface-container-highest transition-colors border border-outline-variant/60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApplyCrop}
          className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(0,218,243,0.25)] flex items-center gap-1.5 active:scale-95"
        >
          <Check size={14} />
          <span>Apply Crop</span>
        </button>
      </div>
    </ModalWrapper>
  );
}

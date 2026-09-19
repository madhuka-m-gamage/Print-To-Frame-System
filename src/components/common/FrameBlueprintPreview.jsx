import React from 'react';

/**
 * High-precision CAD & Steel Frame SVG Blueprint visualizer.
 * Built according to canvas-design & theme-factory skill guidelines.
 * Displays structural bounding box, registration crosshairs (⌖),
 * isometric steel depth layers, and dimension callouts.
 */
export default function FrameBlueprintPreview({
  width = 600,
  height = 400,
  depth = 50,
  alloy = "ASTM A36 Galvanized",
  jobNo = "PTF-CAD",
  className = ""
}) {
  // Normalize dimensions to fit viewBox
  const padding = 40;
  const maxW = 320;
  const maxH = 180;
  
  const scale = Math.min(maxW / (width || 600), maxH / (height || 400));
  const renderW = Math.max(80, (width || 600) * scale);
  const renderH = Math.max(60, (height || 400) * scale);
  const renderD = Math.max(12, (depth || 50) * scale * 0.4);

  const startX = padding + (maxW - renderW) / 2;
  const startY = padding + (maxH - renderH) / 2;

  return (
    <div className={`relative bg-surface-container-lowest rounded-xl border border-outline-variant/60 p-3 overflow-hidden ${className}`}>
      {/* Background Technical Grid */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 218, 243, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 218, 243, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '16px 16px'
        }}
      />

      {/* Blueprint Header */}
      <div className="flex items-center justify-between text-[10px] font-mono text-on-surface-variant mb-2 relative z-10">
        <span className="text-primary font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {jobNo} <span className="opacity-60 font-normal">| CAD_BIM</span>
        </span>
        <span className="bg-surface-container px-2 py-0.5 rounded text-[9px] border border-outline-variant/40">
          {alloy}
        </span>
      </div>

      {/* SVG Canvas Drawing */}
      <svg 
        viewBox="0 0 400 240" 
        className="w-full h-auto max-h-48 relative z-10 filter drop-shadow-[0_2px_8px_rgba(0,218,243,0.15)]"
      >
        <defs>
          <linearGradient id="steelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00daf3" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00daf3" stopOpacity="0.02" />
          </linearGradient>
          <pattern id="hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(0, 218, 243, 0.2)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Outer Registration Marks */}
        <g stroke="#00daf3" strokeWidth="0.75" opacity="0.6">
          {/* Top-Left Datum */}
          <line x1={startX - 15} y1={startY} x2={startX - 5} y2={startY} />
          <line x1={startX} y1={startY - 15} x2={startX} y2={startY - 5} />
          <circle cx={startX} cy={startY} r="3" fill="none" strokeWidth="0.5" />
          
          {/* Bottom-Right Datum */}
          <line x1={startX + renderW + renderD + 5} y1={startY + renderH - renderD} x2={startX + renderW + renderD + 15} y2={startY + renderH - renderD} />
          <line x1={startX + renderW + renderD} y1={startY + renderH - renderD + 5} x2={startX + renderW + renderD} y2={startY + renderH - renderD + 15} />
          <circle cx={startX + renderW + renderD} cy={startY + renderH - renderD} r="3" fill="none" strokeWidth="0.5" />
        </g>

        {/* 3D Isometric Steel Frame Depth Projection */}
        {/* Back Frame Face */}
        <polygon 
          points={`
            ${startX + renderD},${startY - renderD} 
            ${startX + renderW + renderD},${startY - renderD} 
            ${startX + renderW + renderD},${startY + renderH - renderD} 
            ${startX + renderD},${startY + renderH - renderD}
          `}
          fill="none"
          stroke="rgba(0, 218, 243, 0.3)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Connecting Depth Extrusion Lines */}
        <line x1={startX} y1={startY} x2={startX + renderD} y2={startY - renderD} stroke="#00daf3" strokeWidth="1" opacity="0.5" />
        <line x1={startX + renderW} y1={startY} x2={startX + renderW + renderD} y2={startY - renderD} stroke="#00daf3" strokeWidth="1" opacity="0.5" />
        <line x1={startX + renderW} y1={startY + renderH} x2={startX + renderW + renderD} y2={startY + renderH - renderD} stroke="#00daf3" strokeWidth="1" opacity="0.5" />
        <line x1={startX} y1={startY + renderH} x2={startX + renderD} y2={startY + renderH - renderD} stroke="#00daf3" strokeWidth="1" opacity="0.3" strokeDasharray="3 3" />

        {/* Front Main Structural Face */}
        <rect 
          x={startX} 
          y={startY} 
          width={renderW} 
          height={renderH} 
          fill="url(#steelGrad)"
          stroke="#00daf3" 
          strokeWidth="1.5"
          rx="2"
        />

        {/* Inner Canvas Mount Area */}
        <rect 
          x={startX + 12} 
          y={startY + 12} 
          width={Math.max(10, renderW - 24)} 
          height={Math.max(10, renderH - 24)} 
          fill="url(#hatch)"
          stroke="rgba(52, 211, 153, 0.6)" 
          strokeWidth="1"
          strokeDasharray="2 2"
          rx="1"
        />

        {/* Center Tension Bracing Cross */}
        <line 
          x1={startX + 12} y1={startY + 12} 
          x2={startX + renderW - 12} y2={startY + renderH - 12} 
          stroke="rgba(0, 218, 243, 0.25)" 
          strokeWidth="0.75" 
          strokeDasharray="4 4" 
        />
        <line 
          x1={startX + renderW - 12} y1={startY + 12} 
          x2={startX + 12} y2={startY + renderH - 12} 
          stroke="rgba(0, 218, 243, 0.25)" 
          strokeWidth="0.75" 
          strokeDasharray="4 4" 
        />

        {/* Dimension Callouts: Width */}
        <g stroke="#98d0da" strokeWidth="0.75" opacity="0.8">
          <line x1={startX} y1={startY + renderH + 14} x2={startX + renderW} y2={startY + renderH + 14} />
          <line x1={startX} y1={startY + renderH + 9} x2={startX} y2={startY + renderH + 19} />
          <line x1={startX + renderW} y1={startY + renderH + 9} x2={startX + renderW} y2={startY + renderH + 19} />
        </g>
        <text 
          x={startX + renderW / 2} 
          y={startY + renderH + 26} 
          fill="#00daf3" 
          fontSize="9" 
          fontFamily="JetBrains Mono, monospace" 
          textAnchor="middle"
          fontWeight="bold"
        >
          {width} mm
        </text>

        {/* Dimension Callouts: Height */}
        <g stroke="#98d0da" strokeWidth="0.75" opacity="0.8">
          <line x1={startX - 14} y1={startY} x2={startX - 14} y2={startY + renderH} />
          <line x1={startX - 19} y1={startY} x2={startX - 9} y2={startY} />
          <line x1={startX - 19} y1={startY + renderH} x2={startX - 9} y2={startY + renderH} />
        </g>
        <text 
          x={startX - 22} 
          y={startY + renderH / 2} 
          fill="#00daf3" 
          fontSize="9" 
          fontFamily="JetBrains Mono, monospace" 
          textAnchor="middle"
          transform={`rotate(-90 ${startX - 22} ${startY + renderH / 2})`}
          fontWeight="bold"
        >
          {height} mm
        </text>

        {/* Depth Callout */}
        <text 
          x={startX + renderW + renderD / 2 + 10} 
          y={startY - renderD / 2} 
          fill="#34d399" 
          fontSize="8" 
          fontFamily="JetBrains Mono, monospace" 
          fontWeight="500"
        >
          D: {depth}mm
        </text>
      </svg>

      {/* Micro Spec Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30 text-[9px] font-mono text-on-surface-variant">
        <span>TOLERANCE: ±0.05mm</span>
        <span className="text-secondary">FABRICATION_READY</span>
      </div>
    </div>
  );
}

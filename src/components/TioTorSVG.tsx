// Helper para valores seguros em <line>
function safeLineVal(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
import React from 'react';

interface TioTorSVGProps {
  size?: number;
  variant?: 'minimal' | 'full' | 'brand';
  className?: string;
}

export const TioTorSVG = React.memo(function TioTorSVG({ size = 200, variant = 'minimal', className }: TioTorSVGProps) {
  const centerX = size / 2;
  const centerY = size / 2;
  const baseRadius = size * 0.15;
  const maxRadius = size * 0.25;
  const barCount = 20;

  // Create audio wave bars - memoized calculation
  const bars = React.useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      const angle = (i * 360) / barCount;
      const radius = variant === 'minimal' ? baseRadius : baseRadius + (maxRadius - baseRadius) * 0.6;
      const x1 = centerX;
      const y1 = centerY;
      const x2 = centerX + Math.cos((angle - 90) * Math.PI / 180) * radius;
      const y2 = centerY + Math.sin((angle - 90) * Math.PI / 180) * radius;
      
      return { x1, y1, x2, y2, angle, index: i };
    });
  }, [centerX, centerY, baseRadius, maxRadius, variant, barCount]);

  // Memoize gradient IDs to prevent conflicts
  const gradientIds = React.useMemo(() => ({
    core: `coreGradient-${size}-${variant}`,
    wave: `waveGradient-${size}-${variant}`,
    glow: `glow-${size}-${variant}`
  }), [size, variant]);

  return (
    <svg 
      width={size} 
      height={variant === 'brand' ? size * 1.2 : size} 
      viewBox={`0 0 ${size} ${variant === 'brand' ? size * 1.2 : size}`} 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={gradientIds.core} cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: '#030213', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#030213', stopOpacity: 0.6 }} />
        </radialGradient>
        <radialGradient id={gradientIds.wave} cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: '#030213', stopOpacity: 0.3 }} />
          <stop offset="100%" style={{ stopColor: '#030213', stopOpacity: 0 }} />
        </radialGradient>
        <filter id={gradientIds.glow}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Background effects for full variant */}
      {(variant === 'full' || variant === 'brand') && (
        <g opacity="0.6">
          {/* Outer wave rings */}
          {[0, 1, 2].map((i) => {
            const radius = (size * 0.4) + (i * size * 0.1);
            return (
              <circle
                key={`ring-${i}`}
                cx={centerX}
                cy={centerY}
                r={radius}
                fill="none"
                stroke={`url(#${gradientIds.wave})`}
                strokeWidth="2"
                opacity={0.3 - i * 0.1}
              />
            );
          })}
          
          {/* Background pulse */}
          <circle
            cx={centerX}
            cy={centerY}
            r={size * 0.3}
            fill={`url(#${gradientIds.wave})`}
            opacity="0.15"
          />
        </g>
      )}

      {/* Audio wave bars */}
      <g opacity="0.8">
        {bars.map((bar) => (
          <line
            key={bar.index}
            x1={safeLineVal(bar.x1)}
            y1={safeLineVal(bar.y1)}
            x2={safeLineVal(bar.x2)}
            y2={safeLineVal(bar.y2)}
            stroke="#030213"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity={0.7 + (bar.index % 3) * 0.1} // Slight variation for depth
          />
        ))}
      </g>

      {/* Central core */}
      <circle
        cx={centerX}
        cy={centerY}
        r="2"
        fill={`url(#${gradientIds.core})`}
        filter={`url(#${gradientIds.glow})`}
      />

      {/* Subtle outer ring */}
      <circle
        cx={centerX}
        cy={centerY}
        r={size * 0.42}
        fill="none"
        stroke="#030213"
        strokeWidth="1"
        opacity="0.2"
      />

      {/* Brand text for brand variant */}
      {variant === 'brand' && (
        <g>
          <text
            x={centerX}
            y={centerY + size * 0.4}
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize={size * 0.08}
            fontWeight="500"
            fill="#030213"
          >
            Tio Tor
          </text>
          <text
            x={centerX}
            y={centerY + size * 0.47}
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize={size * 0.05}
            fill="#717182"
          >
            Interview Coach
          </text>
        </g>
      )}
    </svg>
  );
});

// Export as string for download purposes
export function getTioTorSVGString(size: number = 200, variant: 'minimal' | 'full' | 'brand' = 'minimal'): string {
  const centerX = size / 2;
  const centerY = size / 2;
  const baseRadius = size * 0.15;
  const maxRadius = size * 0.25;
  const barCount = 20;

  let svg = `<svg width="${size}" height="${variant === 'brand' ? size * 1.2 : size}" viewBox="0 0 ${size} ${variant === 'brand' ? size * 1.2 : size}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Add definitions
  svg += `<defs>
    <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#030213;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#030213;stop-opacity:0.6" />
    </radialGradient>
    <radialGradient id="waveGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#030213;stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:#030213;stop-opacity:0" />
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;

  // Background effects for full variant
  if (variant === 'full' || variant === 'brand') {
    svg += '<g opacity="0.6">';
    
    // Outer wave rings
    for (let i = 0; i < 3; i++) {
      const radius = (size * 0.4) + (i * size * 0.1);
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="url(#waveGradient)" stroke-width="2" opacity="${0.3 - i * 0.1}"/>`;
    }
    
    // Background pulse
    svg += `<circle cx="${centerX}" cy="${centerY}" r="${size * 0.3}" fill="url(#waveGradient)" opacity="0.15"/>`;
    svg += '</g>';
  }

  // Audio wave bars
  svg += '<g opacity="0.8">';
  for (let i = 0; i < barCount; i++) {
    const angle = (i * 360) / barCount;
    const radius = variant === 'minimal' ? baseRadius : baseRadius + (maxRadius - baseRadius) * 0.6;
    const x1 = centerX;
    const y1 = centerY;
    const x2 = centerX + Math.cos((angle - 90) * Math.PI / 180) * radius;
    const y2 = centerY + Math.sin((angle - 90) * Math.PI / 180) * radius;
    
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#030213" stroke-width="1.5" stroke-linecap="round" opacity="${0.7 + (i % 3) * 0.1}"/>`;
  }
  svg += '</g>';

  // Central core
  svg += `<circle cx="${centerX}" cy="${centerY}" r="2" fill="url(#coreGradient)" filter="url(#glow)"/>`;

  // Subtle outer ring
  svg += `<circle cx="${centerX}" cy="${centerY}" r="${size * 0.42}" fill="none" stroke="#030213" stroke-width="1" opacity="0.2"/>`;

  // Brand text for brand variant
  if (variant === 'brand') {
    svg += `<text x="${centerX}" y="${centerY + size * 0.4}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.08}" font-weight="500" fill="#030213">Tio Tor</text>`;
    svg += `<text x="${centerX}" y="${centerY + size * 0.47}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${size * 0.05}" fill="#717182">Interview Coach</text>`;
  }

  svg += '</svg>';
  return svg;
}
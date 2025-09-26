import React from 'react';
import { motion } from 'motion/react';

interface TioAvatarProps {
  state: 'idle' | 'listening' | 'speaking' | 'thinking';
  size?: 'sm' | 'md' | 'lg';
  audioLevel?: number; // 0-1 range for audio level visualization
}

export function TioAvatar({ state, size = 'md', audioLevel = 0 }: TioAvatarProps) {
  // All sizes now limited to maximum 60px
  const sizeClasses = {
    sm: 'w-10 h-10', // 40px
    md: 'w-12 h-12', // 48px 
    lg: 'w-15 h-15'  // 60px
  };

  const containerSize = sizeClasses[size];

  // Create circular audio bars - more bars for smoother effect
  const barCount = 20;
  const bars = Array.from({ length: barCount }, (_, i) => ({
    index: i,
    angle: (i * 360) / barCount,
    delay: i * 0.02,
    baseRadius: size === 'lg' ? 16 : size === 'md' ? 13 : 10,
    maxRadius: size === 'lg' ? 24 : size === 'md' ? 19 : 15,
  }));

  const getBarAnimation = (bar: typeof bars[0]) => {
    const { index, baseRadius, maxRadius } = bar;
    
    switch (state) {
      case 'speaking':
        // Dynamic animation values for speaking
        return {
          r: [
            baseRadius + 2,
            baseRadius + (maxRadius - baseRadius) * 0.8,
            baseRadius + (maxRadius - baseRadius) * 0.4,
            baseRadius + (maxRadius - baseRadius) * 0.9,
            baseRadius + 2
          ],
          opacity: [0.4, 0.8, 0.6, 0.9, 0.4],
        };
        
      case 'listening':
        // Audio level responsive animation
        const audioResponse = audioLevel * 0.5;
        return {
          r: [
            baseRadius + 1,
            baseRadius + (maxRadius - baseRadius) * (0.6 + audioResponse),
            baseRadius + (maxRadius - baseRadius) * (0.4 + audioResponse),
            baseRadius + 1
          ],
          opacity: [0.35 + audioResponse * 0.3, 0.7 + audioResponse * 0.2, 0.5 + audioResponse * 0.3, 0.35],
        };
        
      case 'thinking':
        // Slow contemplative wave
        return {
          r: [
            baseRadius + 1,
            baseRadius + (maxRadius - baseRadius) * 0.5,
            baseRadius + (maxRadius - baseRadius) * 0.3,
            baseRadius + 1
          ],
          opacity: [0.3, 0.6, 0.4, 0.3],
        };
        
      default: // idle
        // Gentle breathing effect
        return {
          r: [
            baseRadius + 1,
            baseRadius + (maxRadius - baseRadius) * 0.2,
            baseRadius + 1
          ],
          opacity: [0.25, 0.45, 0.25],
        };
    }
  };

  const getBarPosition = (bar: typeof bars[0], radius: number) => {
    const x = Math.cos((bar.angle - 90) * Math.PI / 180) * radius;
    const y = Math.sin((bar.angle - 90) * Math.PI / 180) * radius;
    return { x, y };
  };

  const centerX = size === 'lg' ? 30 : size === 'md' ? 24 : 20;
  const centerY = size === 'lg' ? 30 : size === 'md' ? 24 : 20;
  const svgSize = size === 'lg' ? 60 : size === 'md' ? 48 : 40;
  const outerRingSize = size === 'lg' ? 56 : size === 'md' ? 44 : 36;

  const isActive = state !== 'idle';

  return (
    <div className={`relative ${containerSize} flex items-center justify-center mx-auto`}>
      {/* Smooth wave pulse layers - always active */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`wave-${i}`}
          className="absolute border rounded-full"
          animate={{
            width: [outerRingSize * 0.4, outerRingSize * 1.6],
            height: [outerRingSize * 0.4, outerRingSize * 1.6],
            opacity: [0.4, 0],
            borderColor: [
              isActive ? 'oklch(0.79044 0 0 / 0.2)' : 'oklch(0.79044 0 0 / 0.15)',
              'oklch(0.79044 0 0 / 0)'
            ],
          }}
          transition={{
            duration: isActive ? 1.8 : 2.5,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * (isActive ? 0.6 : 0.8),
          }}
        />
      ))}

      {/* Subtle outer ring - always visible, smooth transitions */}
      <motion.div
        className="absolute border rounded-full"
        style={{
          width: outerRingSize,
          height: outerRingSize,
        }}
        animate={{
          borderColor: [
            'oklch(0.79044 0 0 / 0.08)', 
            isActive ? 'oklch(0.79044 0 0 / 0.18)' : 'oklch(0.79044 0 0 / 0.12)',
            'oklch(0.79044 0 0 / 0.08)'
          ],
          scale: [1, isActive ? 1.02 : 1.008, 1],
        }}
        transition={{
          duration: isActive ? 2 : 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Inner pulse waves - more subtle */}
      {[0, 1].map((i) => (
        <motion.div
          key={`inner-wave-${i}`}
          className="absolute bg-foreground/8 rounded-full"
          animate={{
            width: [outerRingSize * 0.3, outerRingSize * 1.1],
            height: [outerRingSize * 0.3, outerRingSize * 1.1],
            opacity: [0.3, 0],
          }}
          transition={{
            duration: isActive ? 2.2 : 3,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * (isActive ? 1.1 : 1.5),
          }}
        />
      ))}

      {/* Continuous gentle background pulse */}
      <motion.div
        className="absolute bg-foreground/4 rounded-full"
        style={{
          width: outerRingSize * 0.7,
          height: outerRingSize * 0.7,
        }}
        animate={{
          scale: [0.6, 1.1, 0.9],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          duration: isActive ? 2.5 : 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Central core - always visible, smooth scaling */}
      <motion.div
        className="absolute w-1 h-1 rounded-full bg-foreground"
        animate={{
          scale: [0.8, isActive ? 1.2 : 0.9, 0.8],
          opacity: [0.6, isActive ? 0.9 : 0.7, 0.6],
        }}
        transition={{
          duration: isActive ? 1.8 : 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Circular audio wave bars - smooth and continuous */}
      <svg
        className="absolute"
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
      >
        {bars.map((bar) => {
          const animation = getBarAnimation(bar);
          
          return (
            <motion.line
              key={bar.index}
              x1={centerX}
              y1={centerY}
              x2={centerX}
              y2={centerY}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="text-foreground"
              animate={{
                x2: Array.isArray(animation.r) 
                  ? animation.r.map(r => {
                      const pos = getBarPosition(bar, r);
                      return Number(centerX + pos.x) || 0;
                    })
                  : [Number(centerX + getBarPosition(bar, animation.r).x) || 0],
                y2: Array.isArray(animation.r) 
                  ? animation.r.map(r => {
                      const pos = getBarPosition(bar, r);
                      return Number(centerY + pos.y) || 0;
                    })
                  : [Number(centerY + getBarPosition(bar, animation.r).y) || 0],
                opacity: Array.isArray(animation.opacity) ? animation.opacity : [animation.opacity],
              }}
              transition={{
                duration: state === 'speaking' ? 0.3 + bar.index * 0.02 : 
                         state === 'listening' ? 2 + bar.index * 0.05 :
                         state === 'thinking' ? 4 : 3,
                repeat: Infinity,
                ease: "easeInOut",
                delay: bar.delay,
              }}
            />
          );
        })}
      </svg>

      {/* Thinking orbital element - smooth continuous rotation */}
      {state === 'thinking' && (
        <motion.div
          className="absolute w-2 h-2 rounded-full bg-foreground/30"
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{
            transformOrigin: `${size === 'lg' ? 20 : size === 'md' ? 16 : 12}px center`,
          }}
        />
      )}

      {/* Speaking intensity glow - smooth pulsing */}
      {state === 'speaking' && (
        <motion.div
          className="absolute rounded-full bg-foreground/10"
          animate={{
            scale: [0.9, 1.15, 1.05, 1.2, 0.95],
            opacity: [0.1, 0.25, 0.15, 0.3, 0.1],
          }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            width: size === 'lg' ? 48 : size === 'md' ? 38 : 30,
            height: size === 'lg' ? 48 : size === 'md' ? 38 : 30,
          }}
        />
      )}

      {/* Listening pulse rings - smooth expanding rings */}
      {state === 'listening' && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`pulse-${i}`}
              className="absolute border border-foreground/8 rounded-full"
              animate={{
                width: [8, outerRingSize + 8],
                height: [8, outerRingSize + 8],
                opacity: [0.4, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeOut",
                delay: i * 0.8
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
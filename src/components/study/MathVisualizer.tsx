import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MathObject {
  type: 'line' | 'circle' | 'point' | 'vector' | 'function_plot' | 'arc';
  points?: [number, number][];
  center?: [number, number];
  radius?: number;
  color?: string;
  label?: string;
  animate?: 'draw' | 'fade' | 'scale';
  equation?: string; // For function_plot
}

interface MathVisualizerProps {
  data: MathObject[];
  width?: number;
  height?: number;
}

export function MathVisualizer({ data, width = 600, height = 400 }: MathVisualizerProps) {
  // Coordinate mapping: -10 to 10 maps to SVG coordinates
  const scaleX = width / 20;
  const scaleY = height / 20;
  const centerX = width / 2;
  const centerY = height / 2;

  const toX = (x: number) => centerX + x * scaleX;
  const toY = (y: number) => centerY - y * scaleY; // Invert Y for standard math orientation

  const renderGrid = useMemo(() => {
    const lines = [];
    for (let i = -10; i <= 10; i++) {
      // Vertical lines
      lines.push(
        <line
          key={`v-${i}`}
          x1={toX(i)}
          y1={0}
          x2={toX(i)}
          y2={height}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={i === 0 ? 2 : 1}
        />
      );
      // Horizontal lines
      lines.push(
        <line
          key={`h-${i}`}
          x1={0}
          y1={toY(i)}
          x2={width}
          y2={toY(i)}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={i === 0 ? 2 : 1}
        />
      );
    }
    return lines;
  }, [width, height]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#0f172a] rounded-xl overflow-hidden shadow-2xl border border-white/10">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid Layer */}
        {renderGrid}

        {/* Axes Labels */}
        <text x={width - 20} y={centerY + 15} fill="rgba(255,255,255,0.3)" fontSize="12" fontWeight="bold">x</text>
        <text x={centerX + 10} y={20} fill="rgba(255,255,255,0.3)" fontSize="12" fontWeight="bold">y</text>

        <AnimatePresence>
          {data.map((obj, i) => {
            const color = obj.color || '#3b82f6'; // Default blue-500

            if (obj.type === 'point' && obj.points?.[0]) {
              const [x, y] = obj.points[0];
              return (
                <motion.g
                  key={`point-${i}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ delay: i * 0.1, type: 'spring' }}
                >
                  <circle cx={toX(x)} cy={toY(y)} r="4" fill={color} filter="drop-shadow(0 0 4px var(--tw-shadow-color))" className="shadow-blue-500/50" />
                  {obj.label && (
                    <text x={toX(x) + 8} y={toY(y) - 8} fill="white" fontSize="12" fontWeight="medium">{obj.label}</text>
                  )}
                </motion.g>
              );
            }

            if (obj.type === 'line' && obj.points && obj.points.length >= 2) {
              const [p1, p2] = obj.points;
              return (
                <motion.line
                  key={`line-${i}`}
                  x1={toX(p1[0])}
                  y1={toY(p1[1])}
                  x2={toX(p2[0])}
                  y2={toY(p2[1])}
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ pathLength: 0, opacity: 0 }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: "easeInOut" }}
                />
              );
            }

            if (obj.type === 'vector' && obj.points && obj.points.length >= 2) {
              const [p1, p2] = obj.points;
              const angle = Math.atan2(toY(p2[1]) - toY(p1[1]), toX(p2[0]) - toX(p1[0]));
              const headLen = 12;
              
              return (
                <motion.g key={`vector-${i}`}>
                   <motion.line
                    x1={toX(p1[0])}
                    y1={toY(p1[1])}
                    x2={toX(p2[0])}
                    y2={toY(p2[1])}
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                  />
                  {/* Arrow Head */}
                  <motion.path
                    d={`M ${toX(p2[0]) - headLen * Math.cos(angle - Math.PI/6)} ${toY(p2[1]) - headLen * Math.sin(angle - Math.PI/6)} 
                       L ${toX(p2[0])} ${toY(p2[1])} 
                       L ${toX(p2[0]) - headLen * Math.cos(angle + Math.PI/6)} ${toY(p2[1]) - headLen * Math.sin(angle + Math.PI/6)}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 + 0.6 }}
                  />
                  {obj.label && (
                    <motion.text 
                      x={toX(p2[0]) + 10} 
                      y={toY(p2[1]) - 10} 
                      fill={color} 
                      fontSize="14" 
                      fontWeight="bold"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.1 + 0.8 }}
                    >
                      {obj.label}
                    </motion.text>
                  )}
                </motion.g>
              );
            }

            if (obj.type === 'circle' && obj.center) {
              return (
                <motion.circle
                  key={`circle-${i}`}
                  cx={toX(obj.center[0])}
                  cy={toY(obj.center[1])}
                  r={obj.radius ? obj.radius * scaleX : scaleX}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  initial={{ pathLength: 0, opacity: 0, scale: 0.8 }}
                  animate={{ pathLength: 1, opacity: 1, scale: 1 }}
                  exit={{ pathLength: 0, opacity: 0 }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                />
              );
            }

            if (obj.type === 'function_plot' && obj.equation) {
              // Simple function plotter for basic expressions like "sin(x)", "x*x"
              // For actual safety, we should use a math library, but for now we'll mock a few paths
              const points = [];
              for (let x = -10; x <= 10; x += 0.2) {
                let y = 0;
                try {
                   // Super basic evaluator for common functions
                   const expr = obj.equation.toLowerCase()
                    .replace(/sin/g, 'Math.sin')
                    .replace(/cos/g, 'Math.cos')
                    .replace(/tan/g, 'Math.tan')
                    .replace(/Math.Math./g, 'Math.')
                    .replace(/x/g, `(${x})`);
                   y = eval(expr);
                } catch (e) { y = 0; }
                if (!isNaN(y) && isFinite(y)) {
                  points.push(`${toX(x)},${toY(y)}`);
                }
              }
              const d = `M ${points.join(' L ')}`;
              return (
                <motion.path
                  key={`func-${i}`}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.5, delay: i * 0.1 }}
                />
              );
            }

            return null;
          })}
        </AnimatePresence>
      </svg>

      {/* 3b1b Style Toast/Caption for the current visual */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 pointer-events-none">
        <div className="h-0.5 w-12 bg-primary rounded-full mb-1" />
        <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">Interactive Visualization</span>
      </div>
    </div>
  );
}

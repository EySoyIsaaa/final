/**
 * Epicenter Hi-Fi - Premium Knob Control
 * Diseño minimalista con estética de hardware de audio profesional
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface KnobControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const KnobControl: React.FC<KnobControlProps> = React.memo(({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const size = 80;
  const radius = 32;
  const lineWidth = 3;

  // Dibujar knob
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Fondo del knob
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(centerX, centerY - 10, 0, centerX, centerY, radius);
    gradient.addColorStop(0, '#2a2a2a');
    gradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Borde exterior
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Track de fondo (arco)
    const startAngle = (135 * Math.PI) / 180;
    const endAngle = (405 * Math.PI) / 180;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 8, startAngle, endAngle);
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Progreso
    const normalizedValue = (value - min) / (max - min);
    const progressAngle = startAngle + normalizedValue * (endAngle - startAngle);
    
    if (!disabled && normalizedValue > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 8, startAngle, progressAngle);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Indicador (línea central)
    const indicatorAngle = progressAngle;
    const innerRadius = 12;
    const outerRadius = radius - 14;
    
    const x1 = centerX + Math.cos(indicatorAngle) * innerRadius;
    const y1 = centerY + Math.sin(indicatorAngle) * innerRadius;
    const x2 = centerX + Math.cos(indicatorAngle) * outerRadius;
    const y2 = centerY + Math.sin(indicatorAngle) * outerRadius;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = disabled ? '#52525b' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Punto central
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#3f3f46';
    ctx.fill();

  }, [value, min, max, disabled, size, radius, lineWidth]);

  // Drag handler vertical
  const handleStart = useCallback((clientY: number) => {
    if (disabled) return;
    setIsDragging(true);
    startY.current = clientY;
    startValue.current = value;
  }, [disabled, value]);

  const handleMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    
    const deltaY = startY.current - clientY;
    const range = max - min;
    const sensitivity = range / 150; // píxeles para recorrer todo el rango
    
    let newValue = startValue.current + deltaY * sensitivity;
    newValue = Math.round(newValue / step) * step;
    newValue = Math.max(min, Math.min(max, newValue));
    
    onChange(newValue);
  }, [isDragging, min, max, step, onChange]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse events
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientY);
    const onMouseUp = () => handleEnd();

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onMouseDown={(e) => handleStart(e.clientY)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
        className={`transition-opacity ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-ns-resize'}`}
        data-testid={`knob-${label.toLowerCase()}`}
      />
      <div className="text-center">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-500">
          {label}
        </p>
        <p className="text-sm font-semibold text-white tabular-nums">
          {value.toFixed(0)}{unit}
        </p>
      </div>
    </div>
  );
});

KnobControl.displayName = 'KnobControl';

/**
 * SplashScreen - Pantalla de inicio con animación
 * Muestra el ícono Epicenter y el nombre de la app
 * Fade-in / fade-out profesional
 * 
 * v2.2.0
 */

import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import logoMenuInicial from '../../../logo-menu-inicial.svg';

interface SplashScreenProps {
  onFinish: () => void;
  duration?: number; // duración total en ms
}

export function SplashScreen({ onFinish, duration = 2000 }: SplashScreenProps) {
  const [phase, setPhase] = useState<'fade-in' | 'visible' | 'fade-out'>('fade-in');
  const { t } = useLanguage();

  useEffect(() => {
    // Fase 1: Fade in (400ms)
    const fadeInTimer = setTimeout(() => {
      setPhase('visible');
    }, 400);

    // Fase 2: Visible (mantener)
    // Fase 3: Fade out (empieza 400ms antes de terminar)
    const fadeOutTimer = setTimeout(() => {
      setPhase('fade-out');
    }, duration - 400);

    // Terminar
    const finishTimer = setTimeout(() => {
      onFinish();
    }, duration);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(finishTimer);
    };
  }, [duration, onFinish]);

  const getOpacity = () => {
    switch (phase) {
      case 'fade-in': return 'opacity-0';
      case 'visible': return 'opacity-100';
      case 'fade-out': return 'opacity-0';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
      <div className={`flex flex-col items-center transition-opacity duration-400 ${getOpacity()}`}>
        {/* Epicenter Icon */}
        <div className="relative mb-6">
          <img
            src={logoMenuInicial}
            alt="Epicenter logo"
            className="relative w-56 max-w-[80vw] h-auto drop-shadow-2xl"
          />
        </div>

        {/* App name */}
        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
          EpicenterDSP Player
        </h1>
        <p className="text-sm text-zinc-500 font-medium tracking-widest uppercase">
          Bass Enhancement
        </p>

        {/* Version badge */}
        <div className="mt-8 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800">
          <span className="text-xs text-zinc-500">v{t('app.version')}</span>
        </div>
      </div>

      {/* Bottom branding */}
      <div className={`absolute bottom-12 transition-opacity duration-400 ${getOpacity()}`}>
        <p className="text-xs text-zinc-700">Bass Reconstruction Technology</p>
      </div>
    </div>
  );
}

export default SplashScreen;

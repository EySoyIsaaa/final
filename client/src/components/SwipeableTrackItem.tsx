/**
 * SwipeableTrackItem - Componente de canción con gestos de deslizamiento
 * 
 * - Deslizar izquierda: Agregar a cola
 * - Deslizar derecha: Reproducir siguiente
 * - Long press: Menú de opciones (incluye agregar a playlist)
 * 
 * v1.1.2 - Added addToPlaylist option
 */

import { useState, useRef, useCallback } from 'react';
import { Disc3, ListPlus, PlayCircle, Play, MoreHorizontal, ListMusic, Save } from 'lucide-react';
import { type Track } from '@/hooks/useAudioQueue';
import { AudioQualityBadge } from '@/components/AudioQualityBadge';
import { TrackArtwork } from '@/components/TrackArtwork';
import { useLanguage } from '@/hooks/useLanguage';

interface SwipeableTrackItemProps {
  track: Track;
  onPlayNow: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
  onPersistTrack?: (track: Track) => void;
  showArtist?: boolean;
  compact?: boolean;
}

export function SwipeableTrackItem({
  track,
  onPlayNow,
  onAddToQueue,
  onPlayNext,
  onAddToPlaylist,
  onPersistTrack,
  showArtist = true,
  compact = false,
}: SwipeableTrackItemProps) {
  const { t } = useLanguage();
  const [swipeX, setSwipeX] = useState(0);
  const [isLongPress, setIsLongPress] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 80;
  const LONG_PRESS_DURATION = 500;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    setIsLongPress(false);

    // Iniciar timer de long press
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPress(true);
      setShowMenu(true);
      // Vibración háptica si está disponible
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, LONG_PRESS_DURATION);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Si hay movimiento vertical significativo, cancelar swipe y long press
    if (Math.abs(deltaY) > 30) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      setSwipeX(0);
      return;
    }

    // Si hay movimiento horizontal, cancelar long press
    if (Math.abs(deltaX) > 10 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Limitar el desplazamiento
    const limitedX = Math.max(-120, Math.min(120, deltaX));
    setSwipeX(limitedX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    if (!isLongPress) {
      // Ejecutar acción según el swipe
      if (swipeX < -SWIPE_THRESHOLD) {
        // Swipe izquierda -> Agregar a cola
        onAddToQueue(track);
      } else if (swipeX > SWIPE_THRESHOLD) {
        // Swipe derecha -> Reproducir siguiente
        onPlayNext(track);
      }
    }

    // Reset
    setSwipeX(0);
    touchStartRef.current = null;
  }, [swipeX, isLongPress, track, onAddToQueue, onPlayNext]);

  const handleClick = useCallback(() => {
    if (!isLongPress && Math.abs(swipeX) < 10) {
      onPlayNow(track);
    }
  }, [isLongPress, swipeX, track, onPlayNow]);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
    setIsLongPress(false);
  }, []);

  // Calcular opacidad de los indicadores
  const leftIndicatorOpacity = Math.min(1, Math.max(0, -swipeX / SWIPE_THRESHOLD));
  const rightIndicatorOpacity = Math.min(1, Math.max(0, swipeX / SWIPE_THRESHOLD));

  const swipeProgress = Math.min(1, Math.abs(swipeX) / SWIPE_THRESHOLD);
  const directionHint = swipeX < -8
    ? t('actions.swipeQueueIndicator')
    : swipeX > 8
      ? t('actions.swipeNextIndicator')
      : null;

  return (
    <>
      {/* Menú contextual (long press) */}
      {showMenu && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50" 
            onClick={closeMenu}
          />
          <div 
            className="fixed z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-2 min-w-[200px]"
            style={{ 
              left: '50%', 
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="font-medium text-sm truncate">{track.title}</p>
              <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
            </div>
            <button
              onClick={() => { onPlayNow(track); closeMenu(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
            >
              <Play className="w-5 h-5 text-zinc-400" />
              <span>{t('actions.playNow')}</span>
            </button>
            <button
              onClick={() => { onPlayNext(track); closeMenu(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
            >
              <PlayCircle className="w-5 h-5 text-zinc-400" />
              <span>{t('actions.playNext')}</span>
            </button>
            <button
              onClick={() => { onAddToQueue(track); closeMenu(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
            >
              <ListPlus className="w-5 h-5 text-zinc-400" />
              <span>{t('actions.addToQueue')}</span>
            </button>
            {onAddToPlaylist && (
              <>
                <div className="h-px bg-zinc-800 my-1" />
                <button
                  onClick={() => { onAddToPlaylist(track); closeMenu(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
                >
                  <ListMusic className="w-5 h-5 text-zinc-400" />
                  <span>{t('playlists.addToPlaylist')}</span>
                </button>
              </>
            )}
            {track.isEphemeral && onPersistTrack && (
              <button
                onClick={() => { onPersistTrack(track); closeMenu(); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-left"
              >
                <Save className="w-5 h-5 text-zinc-400" />
                <span>{t('actions.persistTrack')}</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Track Item con swipe */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden rounded-xl"
      >
        {/* Indicador izquierdo (agregar a cola) */}
        <div 
          className="absolute inset-y-0 left-0 w-40 flex items-center justify-center bg-blue-600/90 transition-opacity"
          style={{ opacity: leftIndicatorOpacity }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 border border-white/20">
            <ListPlus className="w-5 h-5 text-white" />
            <span className="text-xs font-semibold text-white">{t('actions.swipeQueueIndicator')}</span>
          </div>
        </div>

        {/* Indicador derecho (reproducir siguiente) */}
        <div 
          className="absolute inset-y-0 right-0 w-44 flex items-center justify-center bg-green-600/90 transition-opacity"
          style={{ opacity: rightIndicatorOpacity }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 border border-white/20">
            <PlayCircle className="w-5 h-5 text-white" />
            <span className="text-xs font-semibold text-white">{t('actions.swipeNextIndicator')}</span>
          </div>
        </div>

        {/* Contenido principal */}
        <div
          className={`flex items-center gap-3 ${compact ? 'p-2' : 'p-3'} bg-black hover:bg-zinc-900/50 transition-all group relative`}
          style={{ 
            transform: `translateX(${swipeX}px)`,
            transition: swipeX === 0 ? 'transform 0.2s ease-out' : 'none'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <div className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0`}>
            <TrackArtwork src={track.coverUrl} alt={track.title} iconClassName={`${compact ? 'w-5 h-5' : 'w-6 h-6'} text-zinc-500`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className={`${compact ? 'text-sm' : ''} font-medium truncate`}>{track.title}</p>
            {showArtist && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-zinc-500 truncate">{track.artist}</p>
                {track.isEphemeral && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {t('actions.sessionOnly')}
                  </span>
                )}
                <AudioQualityBadge 
                  bitDepth={track.bitDepth} 
                  sampleRate={track.sampleRate}
                  bitrate={track.bitrate}
                  isHiRes={track.isHiRes}
                  compact 
                />
              </div>
            )}
          </div>

          {directionHint && (
            <div
              className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/70 border border-white/10 text-[10px] text-zinc-100 pointer-events-none"
              style={{ opacity: 0.55 + swipeProgress * 0.45 }}
            >
              {directionHint}
            </div>
          )}

          {/* Botón de menú para mouse/desktop */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(true); }}
            className="p-2 text-zinc-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
        {track.isEphemeral && onPersistTrack && (
          <div className="px-3 pb-2">
            <button
              onClick={(e) => { e.stopPropagation(); onPersistTrack(track); }}
              className="w-full text-xs px-3 py-2 rounded-lg border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              {t('actions.persistTrack')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default SwipeableTrackItem;

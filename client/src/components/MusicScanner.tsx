/**
 * MusicScanner - Componente profesional para escaneo automático de música
 * Versión 1.2 - Prioriza escaneo automático con botón principal visible
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  FolderOpen, 
  Music2, 
  AlertCircle, 
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useAndroidMusicLibrary, type AndroidMusicFile } from '@/hooks/useAndroidMusicLibrary';
import { useLanguage } from '@/hooks/useLanguage';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface MusicScannerProps {
  onScanComplete: (files: AndroidMusicFile[]) => void;
  onManualImport: () => void;
  isScanning?: boolean;
}

export function MusicScanner({ onScanComplete, onManualImport, isScanning = false }: MusicScannerProps) {
  const { t } = useLanguage();
  const {
    isAndroid,
    scanProgress,
    scanMusicLibrary,
    requestPermissions,
    checkPermissions,
  } = useAndroidMusicLibrary();

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const handleScanClick = async () => {
    try {
      // Verificar permisos primero
      const hasPermission = await checkPermissions();
      
      if (!hasPermission) {
        // Solicitar permisos
        const granted = await requestPermissions();
        setPermissionGranted(granted);
        
        if (!granted) {
          toast.error(t('library.permissionDenied'), {
            description: t('library.permissionDeniedMessage'),
          });
          return;
        }
      }

      // Escanear música
      toast.loading(t('library.scanningDevice'), {
        id: 'scanning',
      });

      const files = await scanMusicLibrary();
      
      toast.dismiss('scanning');
      
      if (files.length === 0) {
        toast.info(t('library.noMusicFound'), {
          description: t('library.noMusicFoundMessage'),
        });
      } else {
        toast.success(t('library.scanComplete'), {
          description: t('library.scanFound', { count: files.length }),
        });
        onScanComplete(files);
      }
    } catch (error) {
      toast.dismiss('scanning');
      toast.error(t('library.scanError'), {
        description: error instanceof Error ? error.message : t('actions.errorAddingSongs'),
      });
    }
  };

  const handleManualImport = () => {
    onManualImport();
  };

  const progress = scanProgress.total > 0 
    ? (scanProgress.current / scanProgress.total) * 100 
    : 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Botón Principal: Escaneo Automático */}
      <Button
        onClick={handleScanClick}
        disabled={isScanning || scanProgress.isScanning || !isAndroid}
        className="w-full h-14 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-semibold text-lg shadow-lg shadow-violet-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/60 hover:scale-[1.02] active:scale-[0.98]"
      >
        {scanProgress.isScanning ? (
          <>
            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            {t('library.scanning')}
          </>
        ) : (
          <>
            <RefreshCw className="w-5 h-5 mr-3" />
            {t('library.scanMusic')}
          </>
        )}
      </Button>

      {/* Progreso del escaneo */}
      {scanProgress.isScanning && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {scanProgress.total > 0
              ? t('library.scanningProgress', {
                  current: scanProgress.current,
                  total: scanProgress.total,
                })
              : t('library.scanning')}
          </p>
        </div>
      )}

      {/* Mensaje de estado */}
      {scanProgress.status === 'complete' && !scanProgress.isScanning && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {t('library.scanComplete')} - {scanProgress.total} {t('library.songs').toLowerCase()}
          </p>
        </div>
      )}

      {scanProgress.status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 dark:text-red-400">
            {t('library.scanError')}
          </p>
        </div>
      )}

      {permissionGranted === false && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {t('library.permissionRequired')}
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              {t('library.permissionMessage')}
            </p>
          </div>
        </div>
      )}

      {/* Divisor visual */}
      <div className="relative flex items-center gap-4 py-2">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          {t('common.or', { defaultValue: 'o' })}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Botón Secundario: Importación Manual */}
      <Button
        onClick={handleManualImport}
        variant="outline"
        className="w-full h-11 border-2 border-dashed hover:border-solid hover:bg-accent/50 transition-all duration-300"
      >
        <FolderOpen className="w-4 h-4 mr-2" />
        <span className="text-sm">{t('library.importManually')}</span>
      </Button>

      {/* Descripción del botón manual */}
      <p className="text-xs text-center text-muted-foreground">
        {t('library.importManuallyDescription')}
      </p>

      {/* Mensaje para dispositivos no Android */}
      {!isAndroid && (
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg mt-2">
          <Music2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {t('library.webVersion', { defaultValue: 'Versión Web' })}
            </p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
              {t('library.webVersionMessage', { 
                defaultValue: 'El escaneo automático solo está disponible en la app de Android. Usa la importación manual para agregar música.' 
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default MusicScanner;

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Music, RefreshCw, Smartphone } from 'lucide-react';
import { useAndroidMusicLibrary, type AndroidMusicFile } from '@/hooks/useAndroidMusicLibrary';
import type { ImportResult } from '@/hooks/useAudioQueue';
import { toast } from 'sonner';

interface AndroidMusicImporterProps {
  onImportTracks: (tracks: AndroidMusicFile[]) => Promise<ImportResult>;
}

export function AndroidMusicImporter({ onImportTracks }: AndroidMusicImporterProps) {
  const { musicFiles, isLoading, error, isAndroid, scanMusicLibrary, requestPermissions } = useAndroidMusicLibrary();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (musicFiles.length > 0) {
      setSelectedFiles(new Set(musicFiles.map((file) => file.id)));
    }
  }, [musicFiles]);

  const handleOpenDialog = async () => {
    if (!isAndroid) {
      toast.error('Esta funcionalidad solo está disponible en Android');
      return;
    }

    setIsOpen(true);

    // Solicitar permisos
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      toast.error('Se requieren permisos para acceder a la música');
      return;
    }

    await scanMusicLibrary();
  };

  const handleRefresh = async () => {
    await scanMusicLibrary();
  };

  const handleToggleFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === musicFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(musicFiles.map(f => f.id)));
    }
  };

  const handleImportSelected = async () => {
    if (selectedFiles.size === 0) {
      toast.error('Selecciona al menos un archivo');
      return;
    }

    setIsImporting(true);
    try {
      const tracksToImport = musicFiles.filter((file) => selectedFiles.has(file.id));

      if (tracksToImport.length === 0) {
        toast.error('No se pudieron cargar los archivos');
        return;
      }

      const result = await onImportTracks(tracksToImport);
      if (result.added > 0) {
        toast.success(`${result.added} canción(es) importada(s)`);
      }
      if (result.duplicates.length > 0) {
        toast.warning(`${result.duplicates.length} duplicado(s) omitido(s)`);
      }
      setSelectedFiles(new Set());
      setIsOpen(false);
    } catch (err) {
      toast.error('Error al importar canciones');
      console.error('Import error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  if (!isAndroid) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleOpenDialog}>
          <Smartphone className="w-4 h-4" />
          Importar del Sistema
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Música del Sistema</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="text-center py-8">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <Button onClick={handleOpenDialog} variant="outline">
              Reintentar
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : musicFiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No se encontraron archivos de música</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Controles */}
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">
                {selectedFiles.size} de {musicFiles.length} seleccionados
              </label>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedFiles.size === musicFiles.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="gap-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refrescar
                </Button>
              </div>
            </div>

            {/* Lista de archivos */}
            <ScrollArea className="h-64 border rounded-lg p-2">
              <div className="space-y-2">
                {musicFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => handleToggleFile(file.id)}
                  >
                    <Checkbox
                      checked={selectedFiles.has(file.id)}
                      onCheckedChange={() => handleToggleFile(file.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Botones de acción */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImportSelected}
                disabled={selectedFiles.size === 0 || isImporting}
                className="flex-1"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Importar'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

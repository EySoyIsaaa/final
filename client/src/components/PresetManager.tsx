import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Save, Download, Upload } from 'lucide-react';
import { usePresetPersistence, type Preset } from '@/hooks/usePresetPersistence';
import { StreamingParams } from '@/hooks/useIntegratedAudioProcessor';
import { toast } from 'sonner';

interface PresetManagerProps {
  currentEQBands: number[];
  currentDSPParams: StreamingParams;
  onLoadPreset: (eqBands: number[], dspParams: StreamingParams) => void;
}

export function PresetManager({
  currentEQBands,
  currentDSPParams,
  onLoadPreset,
}: PresetManagerProps) {
  const { presets, savePreset, deletePreset } = usePresetPersistence();
  const [presetName, setPresetName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast.error('Por favor ingresa un nombre para el preset');
      return;
    }

    const newPreset: Preset = {
      id: `preset_${Date.now()}`,
      name: presetName,
      eqPreset: {
        id: `eq_${Date.now()}`,
        name: presetName,
        bands: currentEQBands,
        timestamp: Date.now(),
      },
      dspPreset: {
        id: `dsp_${Date.now()}`,
        name: presetName,
        params: currentDSPParams,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    try {
      savePreset(newPreset);
      toast.success(`Preset "${presetName}" guardado`);
      setPresetName('');
    } catch (error) {
      toast.error('Error al guardar el preset');
    }
  };

  const handleLoadPreset = (preset: Preset) => {
    onLoadPreset(preset.eqPreset.bands, preset.dspPreset.params);
    toast.success(`Preset "${preset.name}" cargado`);
    setIsOpen(false);
  };

  const handleDeletePreset = (id: string) => {
    try {
      deletePreset(id);
      toast.success('Preset eliminado');
    } catch (error) {
      toast.error('Error al eliminar el preset');
    }
  };

  const handleExportPreset = (preset: Preset) => {
    try {
      const dataStr = JSON.stringify(preset, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${preset.name}_preset.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Preset exportado');
    } catch (error) {
      toast.error('Error al exportar el preset');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Save className="w-4 h-4" />
          Presets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gestor de Presets</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Guardar nuevo preset */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Guardar configuración actual</label>
            <div className="flex gap-2">
              <Input
                placeholder="Nombre del preset"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSavePreset()}
              />
              <Button onClick={handleSavePreset} size="sm">
                Guardar
              </Button>
            </div>
          </div>

          {/* Lista de presets */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Presets guardados ({presets.length})</label>
            <ScrollArea className="h-64 border rounded-lg p-2">
              {presets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay presets guardados
                </div>
              ) : (
                <div className="space-y-2">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(preset.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLoadPreset(preset)}
                          className="h-8 w-8 p-0"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportPreset(preset)}
                          className="h-8 w-8 p-0"
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePreset(preset.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

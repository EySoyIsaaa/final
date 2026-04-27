import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { KnobControl } from "@/components/KnobControl";
import type { DspParamConfig, TranslateFn } from "@/components/home/types";

interface HomeDspViewProps {
  t: TranslateFn;
  epicenterEnabled: boolean;
  params: DspParamConfig[];
  onOpenAutoModal: () => void;
  onToggleEpicenter: () => void;
}

export function HomeDspView({
  t,
  epicenterEnabled,
  params,
  onOpenAutoModal,
  onToggleEpicenter,
}: HomeDspViewProps) {
  return (
    <div className="flex-1 flex flex-col" data-testid="dsp-view">
      <header className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-zinc-900">
        <div>
          <h2 className="text-xl font-bold">{t("dsp.title")}</h2>
          <p className="text-xs text-zinc-600 mt-0.5">{t("dsp.subtitle")}</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            onClick={onOpenAutoModal}
            className="text-xs px-3 py-1.5 h-auto"
          >
            {t("dsp.autoButton")}
          </Button>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                epicenterEnabled
                  ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  : "bg-zinc-700"
              }`}
            />
            <Switch
              checked={epicenterEnabled}
              onCheckedChange={onToggleEpicenter}
            />
          </div>
        </div>
      </header>
      <div className="flex-1 flex flex-col justify-center px-4 py-8">
        <div className="card-elevated rounded-2xl p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            {params.slice(0, 3).map(({ key, ...param }) => (
              <KnobControl key={key} {...param} />
            ))}
          </div>
          <div className="flex justify-center gap-8">
            {params.slice(3).map(({ key, ...param }) => (
              <KnobControl key={key} {...param} />
            ))}
          </div>
        </div>
        <p className="text-center text-xs text-zinc-600 mt-6 px-8">
          {t("dsp.description")}
        </p>
      </div>
    </div>
  );
}

export default HomeDspView;

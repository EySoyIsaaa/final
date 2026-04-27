import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EQVisualizer } from "@/components/EQVisualizer";
import {
  EQ_GAIN_MAX,
  EQ_GAIN_MIN,
  type EqualizerBand,
} from "@/hooks/useIntegratedAudioProcessor";
import type { TranslateFn } from "@/components/home/types";

interface HomeEqViewProps {
  t: TranslateFn;
  eqEnabled: boolean;
  eqBands: EqualizerBand[];
  onToggleEq: (enabled: boolean) => void;
  onOpenAutoModal: () => void;
  onSetEqBandGain: (index: number, gain: number) => void;
  onResetEq: () => void;
}

export function HomeEqView({
  t,
  eqEnabled,
  eqBands,
  onToggleEq,
  onOpenAutoModal,
  onSetEqBandGain,
  onResetEq,
}: HomeEqViewProps) {
  return (
    <div className="flex-1 flex flex-col" data-testid="eq-view">
      <header className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-zinc-900">
        <h2 className="text-xl font-bold">{t("eq.title")}</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={onOpenAutoModal}
            className="text-xs px-3 py-1.5 h-auto"
          >
            {t("eq.autoButton")}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              {eqEnabled ? t("eq.on") : t("eq.off")}
            </span>
            <Switch checked={eqEnabled} onCheckedChange={onToggleEq} />
          </div>
        </div>
      </header>
      <div className="flex-1 px-6 py-8">
        <div className="mb-4 rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-500/10 to-violet-500/10 p-3">
          <p className="text-xs font-semibold text-cyan-200">
            {t("eq.autoBannerTitle")}
          </p>
          <p className="text-[11px] text-zinc-300 mt-1">
            {t("eq.autoBannerDescription")}
          </p>
        </div>
        <p className="text-[11px] text-zinc-500 mb-3">{t("eq.slideHint")}</p>
        <EQVisualizer
          bands={eqBands}
          enabled={eqEnabled}
          onBandChange={onSetEqBandGain}
          minGain={EQ_GAIN_MIN}
          maxGain={EQ_GAIN_MAX}
          horizontalControlLabel={t("eq.horizontalSlider")}
        />
      </div>
      <div className="px-6 pb-8">
        <Button
          variant="outline"
          onClick={onResetEq}
          className="w-full border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900"
        >
          {t("eq.reset")}
        </Button>
      </div>
    </div>
  );
}

export default HomeEqView;

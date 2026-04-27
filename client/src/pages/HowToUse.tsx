import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

export default function HowToUse() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t("settings.howToUse")}
          </p>
          <h1 className="text-2xl font-bold">{t("howToUse.title")}</h1>
          <p className="text-sm text-zinc-400">{t("howToUse.intro")}</p>
        </div>

        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">{t("howToUse.libraryTitle")}</h2>
            <p>{t("howToUse.libraryBody")}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">{t("howToUse.playerTitle")}</h2>
            <p>{t("howToUse.playerBody")}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">{t("howToUse.queueTitle")}</h2>
            <p>{t("howToUse.queueBody")}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">{t("howToUse.eqTitle")}</h2>
            <p>{t("howToUse.eqBody")}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">{t("howToUse.dspTitle")}</h2>
            <p>{t("howToUse.dspBody")}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">{t("howToUse.playlistsTitle")}</h2>
            <p>{t("howToUse.playlistsBody")}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">{t("howToUse.tipsTitle")}</h2>
            <p>{t("howToUse.tipsBody")}</p>
          </div>
        </div>

        <Button asChild variant="secondary" className="w-fit">
          <Link href="/">{t("howToUse.backToSettings")}</Link>
        </Button>
      </div>
    </div>
  );
}

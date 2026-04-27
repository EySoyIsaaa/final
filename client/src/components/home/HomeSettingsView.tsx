import {
  BookOpen,
  ChevronRight,
  Disc3,
  FileText,
  Globe,
  Info,
  Volume2,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { TranslateFn } from "@/components/home/types";

interface HomeSettingsViewProps {
  t: TranslateFn;
  switchable: boolean;
  theme: string;
  toggleTheme?: () => void;
  language: string;
  setLanguage: (language: "es" | "en") => void;
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  onCrossfadeEnabledChange: (enabled: boolean) => void;
  onCrossfadeDurationChange: (duration: number) => void;
}

export function HomeSettingsView({
  t,
  switchable,
  theme,
  toggleTheme,
  language,
  setLanguage,
  crossfadeEnabled,
  crossfadeDuration,
  onCrossfadeEnabledChange,
  onCrossfadeDurationChange,
}: HomeSettingsViewProps) {
  return (
    <div className="flex-1 flex flex-col" data-testid="settings-view">
      <header className="px-6 pt-12 pb-6 border-b border-zinc-900">
        <h2 className="text-xl font-bold">{t("settings.title")}</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {switchable && (
          <div className="bg-zinc-900/50 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-zinc-700/40 flex items-center justify-center">
                <Disc3 className="w-5 h-5 text-zinc-300" />
              </div>
              <div>
                <h3 className="font-semibold">{t("settings.appearance")}</h3>
                <p className="text-xs text-zinc-500">
                  {t("settings.appearanceDescription")}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
              <div>
                <p className="font-medium">{t("settings.theme")}</p>
                <p className="text-xs text-zinc-500">
                  {theme === "dark" ? t("settings.dark") : t("settings.light")}
                </p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={() => toggleTheme?.()}
              />
            </div>
          </div>
        )}

        <div className="bg-zinc-900/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">{t("settings.language")}</h3>
              <p className="text-xs text-zinc-500">
                {t("settings.languageDescription")}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {(
              [
                ["es", "🇪🇸", t("settings.spanish")],
                ["en", "🇺🇸", t("settings.english")],
              ] as const
            ).map(([code, emoji, label]) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                  language === code
                    ? "bg-white/10 border border-white/20"
                    : "bg-zinc-800/50 hover:bg-zinc-800"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-lg">{emoji}</span>
                  <span>{label}</span>
                </span>
                {language === code && (
                  <span className="w-2 h-2 rounded-full bg-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold">{t("settings.playback")}</h3>
              <p className="text-xs text-zinc-500">
                {t("settings.playbackDescription")}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
              <div>
                <p className="font-medium">{t("settings.crossfade")}</p>
                <p className="text-xs text-zinc-500">
                  {t("settings.crossfadeDescription")}
                </p>
              </div>
              <Switch
                checked={crossfadeEnabled}
                onCheckedChange={onCrossfadeEnabledChange}
              />
            </div>
            {crossfadeEnabled && (
              <div className="p-3 bg-zinc-800/30 rounded-xl">
                <p className="text-sm text-zinc-400 mb-3">
                  {t("settings.crossfadeDuration")}
                </p>
                <div className="flex gap-2">
                  {[3, 5, 7, 10].map((seconds) => (
                    <button
                      key={seconds}
                      onClick={() => onCrossfadeDurationChange(seconds)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        crossfadeDuration === seconds
                          ? "bg-white text-black"
                          : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-yellow-600/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold">{t("settings.howToUse")}</h3>
              <p className="text-xs text-zinc-500">
                {t("settings.howToUseDescription")}
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="secondary"
            className="w-full justify-between"
          >
            <Link href="/how-to-use">
              <span>{t("settings.howToUseCta")}</span>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </Link>
          </Button>
        </div>

        <div className="bg-zinc-900/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
              <Info className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold">{t("settings.about")}</h3>
              <p className="text-xs text-zinc-500">
                {t("settings.aboutDescription")}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-xl">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold">{t("app.name")}</h4>
                <p className="text-sm text-zinc-500">
                  {t("settings.version")} {t("app.version")}
                </p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {t("settings.description")}
            </p>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {t("settings.features")}
              </p>
              <ul className="space-y-2 text-sm text-zinc-400">
                {[1, 2, 3, 4].map((index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {t(`settings.feature${index}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold">{t("settings.legal")}</h3>
              <p className="text-xs text-zinc-500">
                {t("settings.legalDescription")}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              ["/privacy", t("settings.privacyPolicy")],
              ["/terms", t("settings.terms")],
            ].map(([href, label]) => (
              <Button
                key={href}
                asChild
                variant="secondary"
                className="w-full justify-between"
              >
                <Link href={href}>
                  <span>{label}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomeSettingsView;

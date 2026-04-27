import { Music2 } from "lucide-react";
import type { TranslateFn } from "@/components/home/types";

interface ImportProgressState {
  isImporting: boolean;
  current: number;
  total: number;
  currentFileName: string;
}

interface HomeImportProgressOverlayProps {
  t: TranslateFn;
  importProgress: ImportProgressState;
}

export function HomeImportProgressOverlay({
  t,
  importProgress,
}: HomeImportProgressOverlayProps) {
  if (!importProgress.isImporting) return null;

  const current = importProgress.current + 1;
  const progressPercentage = Math.round((current / importProgress.total) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
            <Music2 className="w-5 h-5 text-purple-400 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-white">
              {t("actions.importingMusic")}
            </h3>
            <p className="text-sm text-zinc-400">
              {t("actions.ofTotal", { current, total: importProgress.total })}
            </p>
          </div>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
            style={{ width: `${(current / importProgress.total) * 100}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 truncate">
          {importProgress.currentFileName}
        </p>
        <p className="text-center text-2xl font-bold text-white mt-4">
          {progressPercentage}%
        </p>
      </div>
    </div>
  );
}

export default HomeImportProgressOverlay;

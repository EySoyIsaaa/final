import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

export default function TermsOfService() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t("legal.section")}
          </p>
          <h1 className="text-2xl font-bold">{t("legal.termsTitle")}</h1>
          <p className="text-sm text-zinc-400">{t("legal.updated")}</p>
        </div>

        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <p>{t("legal.termsIntro")}</p>
          <p>{t("legal.termsUsage")}</p>
          <p>{t("legal.termsContent")}</p>
          <p>{t("legal.termsAvailability")}</p>
          <p>{t("legal.termsContact")}</p>
        </div>

        <Button asChild variant="secondary" className="w-fit">
          <Link href="/">{t("legal.backToApp")}</Link>
        </Button>
      </div>
    </div>
  );
}

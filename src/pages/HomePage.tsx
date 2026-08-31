import { useEffect, useState } from "react";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import type { Language } from "../lib/types";
import "../home-overrides.css";

type Props = {
  language: Language;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onOpenBrainstorm: () => void;
};

type IconName = "create" | "folder" | "import" | "docs";

function HomeIcon({ name }: { name: IconName }) {
  if (name === "create") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M7 12h10" /></svg>;
  }

  if (name === "folder") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5h6l2-2h3.5l2 2H21v11H3z" /><path d="M3 9.5h18" /></svg>;
  }

  if (name === "import") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11" /><path d="m8 10 4 4 4-4" /><path d="M5 16v4h14v-4" /></svg>;
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h6.5A2.5 2.5 0 0 1 13 7v13a3 3 0 0 0-3-3H4z" /><path d="M20 4.5h-6.5A2.5 2.5 0 0 0 11 7v13a3 3 0 0 1 3-3h6z" /></svg>;
}

export function HomePage({ language, t, onLanguageChange, onOpenBrainstorm }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showDevelopment(label: string) {
    setToast(label);
  }

  return (
    <div className="home-shell">
      <main className="home-main">
        <header className="home-topbar">
          <div className="top-actions">
            <LanguageToggle language={language} onChange={onLanguageChange} />
            <UserBadge connectedLabel={t("common.connected")} />
          </div>
        </header>

        <section className="home-hero home-hero-no-artwork">
          <span className="tech-corner tl" /><span className="tech-corner tr" /><span className="tech-corner bl" /><span className="tech-corner br" />
          <div className="home-title">
            <h1>ORBITAL</h1>
          </div>

          <div className="home-action-grid">
            <button className="home-action-card" onClick={onOpenBrainstorm}><span className="home-card-icon"><HomeIcon name="create" /></span><strong>{t("home.createProject")}</strong><small>{t("home.createProjectDescription")}</small></button>
            <button className="home-action-card disabled" onClick={() => showDevelopment(t("home.openProject"))}><span className="home-card-icon"><HomeIcon name="folder" /></span><strong>{t("home.openProject")}</strong><small>{t("home.openProjectDescription")}</small><em>{t("common.inDevelopment")}</em></button>
            <button className="home-action-card disabled" onClick={() => showDevelopment(t("home.importRequirements"))}><span className="home-card-icon"><HomeIcon name="import" /></span><strong>{t("home.importRequirements")}</strong><small>{t("home.importRequirementsDescription")}</small><em>{t("common.inDevelopment")}</em></button>
            <button className="home-action-card disabled" onClick={() => showDevelopment(t("home.documentation"))}><span className="home-card-icon"><HomeIcon name="docs" /></span><strong>{t("home.documentation")}</strong><small>{t("home.documentationDescription")}</small><em>{t("common.inDevelopment")}</em></button>
          </div>
        </section>
      </main>

      {toast && <div className="toast"><strong>{toast}</strong><span>{t("home.developmentMessage")}</span></div>}
    </div>
  );
}

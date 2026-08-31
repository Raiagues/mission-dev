import { useEffect, useState } from "react";
import { Brand } from "../components/Brand";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import type { Language } from "../lib/types";

type Props = {
  language: Language;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onOpenBrainstorm: () => void;
};

const SATELLITE_FILES = [1, 2, 3].map((index) => `${import.meta.env.BASE_URL}satellites/sat-${index}.jpg.b64.txt`);

function normalizeBase64(payload: string) {
  const clean = payload.replace(/\s+/g, "");
  const firstPadding = clean.indexOf("=");
  if (firstPadding < 0) return clean;
  const paddingLength = clean[firstPadding + 1] === "=" ? 2 : 1;
  return clean.slice(0, firstPadding + paddingLength);
}

export function HomePage({ language, t, onLanguageChange, onOpenBrainstorm }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState(0);
  const [satelliteImages, setSatelliteImages] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSatelliteImages() {
      const images = await Promise.all(SATELLITE_FILES.map(async (file) => {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`Unable to load ${file}`);
        const base64 = normalizeBase64(await response.text());
        return `data:image/jpeg;base64,${base64}`;
      }));

      if (active) setSatelliteImages(images);
    }

    loadSatelliteImages().catch(() => {
      if (active) setSatelliteImages([]);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (satelliteImages.length === 0) return;
    const timer = window.setInterval(() => setView((current) => (current + 1) % satelliteImages.length), 5200);
    return () => window.clearInterval(timer);
  }, [satelliteImages.length]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showDevelopment(label: string) {
    setToast(label);
    setSidebarOpen(false);
  }

  function openCreate() {
    setCreateOpen(true);
    setSidebarOpen(false);
  }

  return (
    <div className="home-shell">
      <aside className={sidebarOpen ? "home-sidebar open" : "home-sidebar"}>
        <Brand />
        <nav className="home-nav">
          <button className="home-nav-item active"><span className="nav-symbol">⌂</span><span>{t("home.start")}</span></button>
          <button className="home-nav-item" onClick={openCreate}><span className="nav-symbol">⊕</span><span>{t("home.createProject")}</span></button>
          <button className="home-nav-item" onClick={() => showDevelopment(t("home.openProject"))}><span className="nav-symbol">▱</span><span>{t("home.openProject")}</span></button>
          <button className="home-nav-item" onClick={() => showDevelopment(t("home.importRequirements"))}><span className="nav-symbol">⇧</span><span>{t("home.importRequirements")}</span></button>
          <button className="home-nav-item" onClick={() => showDevelopment(t("home.documentation"))}><span className="nav-symbol">▤</span><span>{t("home.documentation")}</span></button>
        </nav>
        <div className="home-sidebar-user"><UserBadge connectedLabel={t("common.connected")} /></div>
      </aside>

      <button className={sidebarOpen ? "sidebar-overlay visible" : "sidebar-overlay"} aria-label={t("common.close")} onClick={() => setSidebarOpen(false)} />

      <main className="home-main">
        <header className="home-topbar">
          <button className="square-menu" aria-label={t("brainstorm.menu")} onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="top-actions">
            <LanguageToggle language={language} onChange={onLanguageChange} />
            <UserBadge connectedLabel={t("common.connected")} />
          </div>
        </header>

        <section className="home-hero">
          <span className="tech-corner tl" /><span className="tech-corner tr" /><span className="tech-corner bl" /><span className="tech-corner br" />
          <div className="home-title">
            <h1>{t("common.appName")}</h1>
            <p>{t("home.subtitle")}</p>
          </div>

          <div className="sat-stage image-stage">
            {satelliteImages.map((image, index) => (
              <div className={view === index ? "sat-view image-view active" : "sat-view image-view"} key={index}>
                <img src={image} alt={`${t("common.appName")} technical satellite view ${index + 1}`} draggable={false} />
              </div>
            ))}
            {satelliteImages.length > 0 && (
              <div className="view-dots">
                {satelliteImages.map((_, index) => <button className={view === index ? "active" : ""} aria-label={`View ${index + 1}`} onClick={() => setView(index)} key={index} />)}
              </div>
            )}
          </div>

          <div className="home-action-grid">
            <button className="home-action-card" onClick={openCreate}><span className="home-card-icon circle-plus">+</span><strong>{t("home.createProject")}</strong><small>{t("home.createProjectDescription")}</small></button>
            <button className="home-action-card disabled" onClick={() => showDevelopment(t("home.openProject"))}><span className="home-card-icon">▱</span><strong>{t("home.openProject")}</strong><small>{t("home.openProjectDescription")}</small><em>{t("common.inDevelopment")}</em></button>
            <button className="home-action-card disabled" onClick={() => showDevelopment(t("home.importRequirements"))}><span className="home-card-icon">⇧</span><strong>{t("home.importRequirements")}</strong><small>{t("home.importRequirementsDescription")}</small><em>{t("common.inDevelopment")}</em></button>
            <button className="home-action-card disabled" onClick={() => showDevelopment(t("home.documentation"))}><span className="home-card-icon">▤</span><strong>{t("home.documentation")}</strong><small>{t("home.documentationDescription")}</small><em>{t("common.inDevelopment")}</em></button>
          </div>
        </section>
      </main>

      {createOpen && (
        <div className="modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
          <div className="start-modal">
            <button className="modal-close" onClick={() => setCreateOpen(false)}>×</button>
            <div className="modal-eyebrow">{t("home.createMission")}</div>
            <h2>{t("home.howStart")}</h2>
            <div className="start-options">
              <button className="start-option disabled" onClick={() => showDevelopment(t("home.existingMission"))}><span className="option-number">01</span><span><strong>{t("home.existingMission")}</strong><small>{t("home.existingMissionDescription")}</small></span><em>{t("common.inDevelopment")}</em></button>
              <button className="start-option enabled" onClick={onOpenBrainstorm}><span className="option-number">02</span><span><strong>{t("home.buildFromZero")}</strong><small>{t("home.buildFromZeroDescription")}</small></span><span className="option-arrow">→</span></button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><strong>{toast}</strong><span>{t("home.developmentMessage")}</span></div>}
    </div>
  );
}

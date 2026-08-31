import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { MissionSidebar } from "./components/MissionSidebar";
import { HomePage } from "./pages/HomePage";
import { StudySetupPage } from "./pages/StudySetupPage";
import { BrainstormPage } from "./pages/BrainstormPage";
import { getStoredLanguage, resolveText, setStoredLanguage } from "./lib/i18n";
import { loadProject, prepareProjectForConception, saveProject } from "./lib/projectStore";
import type { MissionProject } from "./lib/projectStore";
import type { Language } from "./lib/types";
import "./mission-sidebar.css";

type Route = "home" | "setup" | "brainstorm";

function getRoute(): Route {
  if (window.location.hash === "#/brainstorming") return "brainstorm";
  if (window.location.hash === "#/study-setup") return "setup";
  return "home";
}

export function App() {
  const [language, setLanguage] = useState<Language>(getStoredLanguage);
  const [project, setProject] = useState<MissionProject>(() => loadProject(getStoredLanguage()));
  const [route, setRoute] = useState<Route>(getRoute);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    function onHashChange() {
      setRoute(getRoute());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => saveProject(project), 180);
    return () => window.clearTimeout(timer);
  }, [project]);

  useLayoutEffect(() => {
    const legacySelectors = [".app-page .home-sidebar", ".app-page .setup-sidebar", ".app-page .brain-sidebar", ".app-page .sidebar-overlay", ".app-page .square-menu", ".app-page .mobile-menu"];
    const legacyElements = document.querySelectorAll<HTMLElement>(legacySelectors.join(","));
    legacyElements.forEach((element) => {
      element.style.setProperty("display", "none", "important");
      element.setAttribute("aria-hidden", "true");
    });
  }, [route]);

  const t = useMemo(() => (path: string) => resolveText(language, path), [language]);
  const currentStep = route === "setup" ? 0 : route === "brainstorm" ? 1 : null;

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setStoredLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage === "pt" ? "pt-BR" : "en";
  }

  function openSetup() {
    window.location.hash = "#/study-setup";
  }

  function openBrainstorm() {
    const prepared = prepareProjectForConception(project, language);
    setProject(prepared);
    window.location.hash = "#/brainstorming";
  }

  function openHome() {
    window.location.hash = "#/";
  }

  function openPipelineStep(step: number) {
    if (step === 0) openSetup();
    if (step === 1) openBrainstorm();
  }

  let page = <HomePage language={language} t={t} onLanguageChange={changeLanguage} onOpenBrainstorm={openSetup} />;
  if (route === "setup") page = <StudySetupPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onProjectChange={setProject} onContinue={openBrainstorm} onHome={openHome} />;
  if (route === "brainstorm") page = <BrainstormPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onProjectChange={setProject} onHome={openHome} onBackSetup={openSetup} />;

  return (
    <div className={sidebarExpanded ? `app-shell route-${route} sidebar-expanded` : `app-shell route-${route}`}>
      <MissionSidebar language={language} currentStep={currentStep} expanded={sidebarExpanded} connectedLabel={t("common.connected")} homeLabel={t("home.start")} onToggle={() => setSidebarExpanded((current) => !current)} onHome={openHome} onStepSelect={openPipelineStep} />
      <div className="app-page">{page}</div>
    </div>
  );
}

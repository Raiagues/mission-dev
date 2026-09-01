import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MissionSidebar } from "./components/MissionSidebar";
import { HomePage } from "./pages/HomePage";
import { StudySetupPage } from "./pages/StudySetupPage";
import { BrainstormPage } from "./pages/BrainstormPage";
import { useAuth } from "./lib/auth";
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
  const auth = useAuth();
  const [language, setLanguage] = useState<Language>(getStoredLanguage);
  const [project, setProject] = useState<MissionProject>(() => loadProject(getStoredLanguage()));
  const [route, setRoute] = useState<Route>(getRoute);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const projectRef = useRef(project);
  const saveTimerRef = useRef<number | null>(null);
  const cloudReadyRef = useRef(false);

  const flushProject = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    projectRef.current = saveProject(projectRef.current);
    if (cloudReadyRef.current) {
      void auth.api("/workspace/project", { method: "PUT", body: JSON.stringify(projectRef.current) }).catch(() => undefined);
    }
  }, [auth.api]);

  const changeProject = useCallback((nextProject: MissionProject) => {
    projectRef.current = nextProject;
    setProject(nextProject);
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushProject, 180);
  }, [flushProject]);

  useEffect(() => {
    let cancelled = false;
    cloudReadyRef.current = false;
    void auth.api<{ project: MissionProject | null }>("/workspace/project")
      .then(async ({ project: remoteProject }) => {
        if (cancelled) return;
        if (remoteProject?.schemaVersion === 2) {
          projectRef.current = remoteProject;
          setProject(saveProject(remoteProject));
        } else {
          await auth.api("/workspace/project", { method: "PUT", body: JSON.stringify(projectRef.current) });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) cloudReadyRef.current = true;
      });
    return () => {
      cancelled = true;
      cloudReadyRef.current = false;
    };
  }, [auth.api, auth.user?.id]);

  useEffect(() => {
    function onHashChange() {
      setRoute(getRoute());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    function saveBeforeLeaving() {
      flushProject();
    }

    function saveWhenHidden() {
      if (document.visibilityState === "hidden") flushProject();
    }

    saveTimerRef.current = window.setTimeout(flushProject, 180);
    window.addEventListener("pagehide", saveBeforeLeaving);
    window.addEventListener("beforeunload", saveBeforeLeaving);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeaving);
      window.removeEventListener("beforeunload", saveBeforeLeaving);
      document.removeEventListener("visibilitychange", saveWhenHidden);
      flushProject();
    };
  }, [flushProject]);

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
    const prepared = prepareProjectForConception(projectRef.current, language);
    changeProject(prepared);
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
  if (route === "setup") page = <StudySetupPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onProjectChange={changeProject} onContinue={openBrainstorm} onHome={openHome} />;
  if (route === "brainstorm") page = <BrainstormPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onProjectChange={changeProject} onHome={openHome} onBackSetup={openSetup} />;

  return (
    <div className={sidebarExpanded ? `app-shell route-${route} sidebar-expanded` : `app-shell route-${route}`}>
      <MissionSidebar language={language} currentStep={currentStep} expanded={sidebarExpanded} connectedLabel={t("common.connected")} homeLabel={t("home.start")} onToggle={() => setSidebarExpanded((current) => !current)} onHome={openHome} onStepSelect={openPipelineStep} />
      <div className="app-page">{page}</div>
    </div>
  );
}

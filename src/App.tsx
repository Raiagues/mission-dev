import { useEffect, useMemo, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { StudySetupPage } from "./pages/StudySetupPage";
import { BrainstormPage } from "./pages/BrainstormPage";
import { getStoredLanguage, resolveText, setStoredLanguage } from "./lib/i18n";
import { loadProject, prepareProjectForConception, saveProject } from "./lib/projectStore";
import type { MissionProject } from "./lib/projectStore";
import type { Language } from "./lib/types";

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

  const t = useMemo(() => (path: string) => resolveText(language, path), [language]);

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

  if (route === "brainstorm") return <BrainstormPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onProjectChange={setProject} onHome={openHome} onBackSetup={openSetup} />;
  if (route === "setup") return <StudySetupPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onProjectChange={setProject} onContinue={openBrainstorm} onHome={openHome} />;
  return <HomePage language={language} t={t} onLanguageChange={changeLanguage} onOpenBrainstorm={openSetup} />;
}
import { useEffect, useMemo, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { BrainstormPage } from "./pages/BrainstormPage";
import { getStoredLanguage, resolveText, setStoredLanguage } from "./lib/i18n";
import type { Language } from "./lib/types";

type Route = "home" | "brainstorm";

function getRoute(): Route {
  return window.location.hash === "#/brainstorming" ? "brainstorm" : "home";
}

export function App() {
  const [language, setLanguage] = useState<Language>(getStoredLanguage);
  const [route, setRoute] = useState<Route>(getRoute);

  useEffect(() => {
    function onHashChange() {
      setRoute(getRoute());
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const t = useMemo(() => (path: string) => resolveText(language, path), [language]);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setStoredLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage === "pt" ? "pt-BR" : "en";
  }

  function openBrainstorm() {
    window.location.hash = "#/brainstorming";
  }

  function openHome() {
    window.location.hash = "#/";
  }

  if (route === "brainstorm") return <BrainstormPage language={language} t={t} onLanguageChange={changeLanguage} onHome={openHome} />;
  return <HomePage language={language} t={t} onLanguageChange={changeLanguage} onOpenBrainstorm={openBrainstorm} />;
}

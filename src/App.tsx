import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MissionSidebar } from "./components/MissionSidebar";
import { HomePage } from "./pages/HomePage";
import { StudySetupPage } from "./pages/StudySetupPage";
import { TeamPage } from "./pages/TeamPage";
import { TeamsHubPage } from "./pages/TeamsHubPage";
import { BrainstormPage } from "./pages/BrainstormPage";
import { ApiError, useAuth } from "./lib/auth";
import { getStoredLanguage, resolveText, setStoredLanguage } from "./lib/i18n";
import { createEmptyProject, loadProject, normalizeProject, prepareProjectForConception, saveProject } from "./lib/projectStore";
import type { MissionProject } from "./lib/projectStore";
import type { ProjectSummary } from "./lib/team";
import type { Language } from "./lib/types";
import "./mission-sidebar.css";

type Route = "home" | "setup" | "teams" | "projectTeam" | "brainstorm";

function getRoute(): Route {
  if (window.location.hash === "#/brainstorming") return "brainstorm";
  if (window.location.hash === "#/study-setup" || window.location.hash === "#/project-setup") return "setup";
  if (window.location.hash === "#/project-team") return "projectTeam";
  if (window.location.hash === "#/teams" || window.location.hash === "#/team") return "teams";
  return "home";
}

function projectSummary(project: MissionProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    programId: project.context.programId,
    teamId: project.context.teamId,
    updatedAt: project.updatedAt,
    memberCount: project.context.assignments.length
  };
}

function hasLocalWork(project: MissionProject): boolean {
  return Boolean(project.name.trim() || project.context.configured || project.board.nodes.length || project.setup.statement.trim());
}

export function App() {
  const auth = useAuth();
  const [language, setLanguage] = useState<Language>(getStoredLanguage);
  const [project, setProject] = useState<MissionProject>(() => loadProject(getStoredLanguage()));
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [route, setRoute] = useState<Route>(getRoute);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const projectRef = useRef(project);
  const saveTimerRef = useRef<number | null>(null);
  const cloudReadyRef = useRef(false);

  const refreshProjects = useCallback(async () => {
    const response = await auth.api<{ projects: ProjectSummary[] }>("/projects");
    setProjects(response.projects);
    return response.projects;
  }, [auth.api]);

  const persistProject = useCallback(async (nextProject: MissionProject) => {
    try {
      await auth.api("/projects/" + nextProject.id, { method: "PUT", body: JSON.stringify(nextProject) });
    } catch (reason) {
      if (!(reason instanceof ApiError) || reason.status !== 404) throw reason;
      await auth.api("/projects", { method: "POST", body: JSON.stringify(nextProject) });
    }
    setProjects((current) => {
      const next = current.filter((item) => item.id !== nextProject.id);
      return [projectSummary(nextProject), ...next];
    });
  }, [auth.api]);

  const flushProject = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const saved = saveProject(projectRef.current);
    projectRef.current = saved;
    if (cloudReadyRef.current && hasLocalWork(saved)) void persistProject(saved).catch(() => undefined);
  }, [persistProject]);

  const changeProject = useCallback((nextProject: MissionProject) => {
    projectRef.current = nextProject;
    setProject(nextProject);
    setProjects((current) => current.map((item) => item.id === nextProject.id ? projectSummary(nextProject) : item));
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushProject, 240);
  }, [flushProject]);

  useEffect(() => {
    let cancelled = false;
    cloudReadyRef.current = false;
    setLoadingProjects(true);

    void refreshProjects()
      .then(async (summaries) => {
        if (cancelled) return;
        if (summaries.length === 0) {
          if (hasLocalWork(projectRef.current)) {
            await auth.api("/projects", { method: "POST", body: JSON.stringify(projectRef.current) });
            if (!cancelled) await refreshProjects();
          }
          return;
        }

        const preferredId = summaries.some((item) => item.id === projectRef.current.id) ? projectRef.current.id : summaries[0].id;
        const response = await auth.api<{ project: MissionProject }>("/projects/" + preferredId);
        if (cancelled || !response.project) return;
        const normalized = normalizeProject(response.project, getStoredLanguage());
        projectRef.current = normalized;
        setProject(saveProject(normalized));
      })
      .catch(() => {
        if (cancelled || !hasLocalWork(projectRef.current)) return;
        setProjects([projectSummary(projectRef.current)]);
      })
      .finally(() => {
        if (!cancelled) {
          cloudReadyRef.current = true;
          setLoadingProjects(false);
        }
      });

    return () => {
      cancelled = true;
      cloudReadyRef.current = false;
    };
  }, [auth.api, auth.user?.id, refreshProjects]);

  useEffect(() => {
    function onHashChange() {
      const nextRoute = getRoute();
      if (window.location.hash === "#/project-setup") {
        window.location.replace("#/study-setup");
        return;
      }
      if (window.location.hash === "#/team") {
        window.location.replace("#/teams");
        return;
      }
      setRoute(nextRoute);
    }

    window.addEventListener("hashchange", onHashChange);
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    function saveBeforeLeaving() {
      flushProject();
    }

    function saveWhenHidden() {
      if (document.visibilityState === "hidden") flushProject();
    }

    window.addEventListener("pagehide", saveBeforeLeaving);
    window.addEventListener("beforeunload", saveBeforeLeaving);
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => {
      window.removeEventListener("pagehide", saveBeforeLeaving);
      window.removeEventListener("beforeunload", saveBeforeLeaving);
      document.removeEventListener("visibilitychange", saveWhenHidden);
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [flushProject]);

  useLayoutEffect(() => {
    const legacySelectors = [".app-page .home-sidebar", ".app-page .setup-sidebar", ".app-page .brain-sidebar", ".app-page .sidebar-overlay", ".app-page .square-menu", ".app-page .mobile-menu"];
    document.querySelectorAll<HTMLElement>(legacySelectors.join(",")).forEach((element) => {
      element.style.setProperty("display", "none", "important");
      element.setAttribute("aria-hidden", "true");
    });
  }, [route]);

  const t = useMemo(() => (path: string) => resolveText(language, path), [language]);
  const currentStep = ["setup", "projectTeam"].includes(route) ? 0 : route === "brainstorm" ? 1 : null;

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setStoredLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage === "pt" ? "pt-BR" : "en";
  }

  async function createProject() {
    flushProject();
    const next = saveProject(createEmptyProject(language));
    projectRef.current = next;
    setProject(next);
    cloudReadyRef.current = false;
    window.location.hash = "#/study-setup";
    try {
      await auth.api("/projects", { method: "POST", body: JSON.stringify(next) });
      await refreshProjects();
    } catch (reason) {
      if (!(reason instanceof ApiError) || reason.status !== 409) {
        setProjects((current) => [projectSummary(next), ...current.filter((item) => item.id !== next.id)]);
      }
    } finally {
      cloudReadyRef.current = true;
      flushProject();
    }
  }

  async function openProject(projectId: string) {
    flushProject();
    try {
      const response = await auth.api<{ project: MissionProject }>("/projects/" + projectId);
      const next = saveProject(normalizeProject(response.project, language));
      projectRef.current = next;
      setProject(next);
      window.location.hash = "#/study-setup";
    } catch {
      const local = projects.find((item) => item.id === projectId);
      if (local && projectRef.current.id === projectId) window.location.hash = "#/study-setup";
    }
  }

  function openMemory() {
    window.location.hash = "#/study-setup";
  }

  function openTeams() {
    window.location.hash = "#/teams";
  }

  function openProjectTeam() {
    window.location.hash = "#/project-team";
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
    if (step === 0) openMemory();
    if (step === 1) openBrainstorm();
  }

  let page = <HomePage language={language} t={t} onLanguageChange={changeLanguage} projects={projects} loadingProjects={loadingProjects} onCreateProject={() => void createProject()} onOpenProject={(id) => void openProject(id)} onOpenTeams={openTeams} />;
  if (route === "setup") page = <StudySetupPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onProjectChange={changeProject} onContinue={openBrainstorm} onHome={openHome} onTeams={openTeams} onManageTeam={openProjectTeam} />;
  if (route === "teams") page = <TeamsHubPage language={language} t={t} onLanguageChange={changeLanguage} onBack={openHome} />;
  if (route === "projectTeam") page = <TeamPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onBack={openMemory} onProjectSetup={openMemory} />;
  if (route === "brainstorm") page = <BrainstormPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onProjectChange={changeProject} onHome={openHome} onBackSetup={openMemory} />;

  return (
    <div className={sidebarExpanded ? "app-shell route-" + route + " sidebar-expanded" : "app-shell route-" + route}>
      <MissionSidebar language={language} currentStep={currentStep} expanded={sidebarExpanded} connectedLabel={t("common.connected")} homeLabel={t("home.start")} teamLabel={language === "pt" ? "Equipes" : "Teams"} homeActive={route === "home"} teamActive={route === "teams"} onToggle={() => setSidebarExpanded((current) => !current)} onHome={openHome} onTeam={openTeams} onStepSelect={openPipelineStep} />
      <div className="app-page">{page}</div>
    </div>
  );
}

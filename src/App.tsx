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
import type { ProjectSummary, TeamRecord } from "./lib/team";
import type { Language } from "./lib/types";
import "./mission-sidebar.css";

type Route = "home" | "setup" | "teams" | "projectTeam" | "brainstorm";

const ACTIVE_PROJECT_KEY = "norte-active-project-v1";
const DEFAULT_TEAM_KEY = "norte-default-team-v1";

function storedPreference(key: string): string {
  return typeof window === "undefined" ? "" : window.localStorage.getItem(key) || "";
}

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
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [route, setRoute] = useState<Route>(getRoute);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(() => storedPreference(ACTIVE_PROJECT_KEY));
  const [defaultTeamId, setDefaultTeamId] = useState(() => storedPreference(DEFAULT_TEAM_KEY));
  const [isDraft, setIsDraft] = useState(false);
  const projectRef = useRef(project);
  const saveTimerRef = useRef<number | null>(null);
  const cloudReadyRef = useRef(false);
  const persistableRef = useRef(false);
  const draftRef = useRef(false);

  const refreshProjects = useCallback(async () => {
    const response = await auth.api<{ projects: ProjectSummary[] }>("/projects");
    setProjects(response.projects);
    return response.projects;
  }, [auth.api]);

  const refreshTeams = useCallback(async () => {
    const response = await auth.api<{ teams: TeamRecord[] }>("/teams");
    setTeams(response.teams);
    setDefaultTeamId((current) => {
      const associated = response.teams.filter((team) => team.membership === "member");
      const next = associated.some((team) => team.id === current) ? current : associated[0]?.id || "";
      if (next) window.localStorage.setItem(DEFAULT_TEAM_KEY, next);
      else window.localStorage.removeItem(DEFAULT_TEAM_KEY);
      return next;
    });
    return response.teams;
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
    setActiveProjectId(nextProject.id);
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, nextProject.id);
  }, [auth.api]);

  const flushProject = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!persistableRef.current || draftRef.current) return;
    const saved = saveProject(projectRef.current);
    projectRef.current = saved;
    if (cloudReadyRef.current && hasLocalWork(saved)) void persistProject(saved).catch(() => undefined);
  }, [persistProject]);

  const changeProject = useCallback((nextProject: MissionProject) => {
    projectRef.current = nextProject;
    setProject(nextProject);
    if (!persistableRef.current || draftRef.current) return;
    setProjects((current) => current.map((item) => item.id === nextProject.id ? projectSummary(nextProject) : item));
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushProject, 240);
  }, [flushProject]);

  useEffect(() => {
    let cancelled = false;
    cloudReadyRef.current = false;
    persistableRef.current = false;
    draftRef.current = false;
    setIsDraft(false);
    setLoadingProjects(true);

    void Promise.all([refreshProjects(), refreshTeams()])
      .then(async ([summaries]) => {
        if (cancelled || draftRef.current) return;
        if (summaries.length === 0) {
          const empty = createEmptyProject(getStoredLanguage());
          const directDraft = ["setup", "projectTeam"].includes(getRoute());
          draftRef.current = directDraft;
          setIsDraft(directDraft);
          projectRef.current = empty;
          setProject(empty);
          setActiveProjectId("");
          window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
          return;
        }

        const storedId = storedPreference(ACTIVE_PROJECT_KEY);
        const preferredId = summaries.some((item) => item.id === storedId)
          ? storedId
          : summaries.some((item) => item.id === projectRef.current.id) ? projectRef.current.id : summaries[0].id;
        const response = await auth.api<{ project: MissionProject }>("/projects/" + preferredId);
        if (cancelled || !response.project) return;
        const normalized = normalizeProject(response.project, getStoredLanguage());
        projectRef.current = normalized;
        setProject(saveProject(normalized));
        persistableRef.current = true;
        setActiveProjectId(normalized.id);
        window.localStorage.setItem(ACTIVE_PROJECT_KEY, normalized.id);
      })
      .catch(() => undefined)
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
  }, [auth.api, auth.user?.id, refreshProjects, refreshTeams]);

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

  function createProject() {
    flushProject();
    const next = createEmptyProject(language);
    draftRef.current = true;
    persistableRef.current = false;
    projectRef.current = next;
    setProject(next);
    setIsDraft(true);
    setActiveProjectId("");
    window.location.hash = "#/study-setup";
  }

  async function openProject(projectId: string) {
    flushProject();
    try {
      const response = await auth.api<{ project: MissionProject }>("/projects/" + projectId);
      const next = saveProject(normalizeProject(response.project, language));
      draftRef.current = false;
      persistableRef.current = true;
      projectRef.current = next;
      setProject(next);
      setIsDraft(false);
      setActiveProjectId(next.id);
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, next.id);
      window.location.hash = next.navigation.lastRoute === "brainstorm" ? "#/brainstorming" : "#/study-setup";
    } catch {
      const local = projects.find((item) => item.id === projectId);
      if (local && projectRef.current.id === projectId) window.location.hash = projectRef.current.navigation.lastRoute === "brainstorm" ? "#/brainstorming" : "#/study-setup";
    }
  }

  async function deleteProject(projectId: string) {
    await auth.api("/projects/" + projectId, { method: "DELETE" });
    const remaining = projects.filter((item) => item.id !== projectId);
    setProjects(remaining);
    if (projectRef.current.id !== projectId && activeProjectId !== projectId) return;

    persistableRef.current = false;
    draftRef.current = false;
    setIsDraft(false);
    const nextId = remaining[0]?.id || "";
    setActiveProjectId(nextId);
    if (nextId) {
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, nextId);
      const response = await auth.api<{ project: MissionProject }>("/projects/" + nextId);
      const next = saveProject(normalizeProject(response.project, language));
      projectRef.current = next;
      setProject(next);
      persistableRef.current = true;
    } else {
      window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
      const empty = createEmptyProject(language);
      projectRef.current = empty;
      setProject(empty);
    }
  }

  function setProjectNavigation(lastRoute: MissionProject["navigation"]["lastRoute"]) {
    const current = projectRef.current;
    if (current.navigation.lastRoute === lastRoute) return current;
    const next = { ...current, navigation: { lastRoute } };
    changeProject(next);
    return next;
  }

  function openMemory() {
    setProjectNavigation("setup");
    window.location.hash = "#/study-setup";
  }

  function openTeams() {
    window.location.hash = "#/teams";
  }

  function openProjectTeam() {
    window.location.hash = "#/project-team";
  }

  async function openBrainstorm() {
    const configured = {
      ...projectRef.current,
      context: { ...projectRef.current.context, configured: true },
      navigation: { lastRoute: "brainstorm" as const }
    };
    const prepared = prepareProjectForConception(configured, language);
    projectRef.current = prepared;
    setProject(prepared);

    if (draftRef.current) {
      await auth.api("/projects", { method: "POST", body: JSON.stringify(prepared) });
      draftRef.current = false;
      persistableRef.current = true;
      setIsDraft(false);
    } else if (persistableRef.current) {
      await persistProject(prepared);
    } else {
      throw new Error(language === "pt" ? "Crie o projeto antes de iniciar a concepção." : "Create the project before starting conception.");
    }

    const saved = prepared;
    projectRef.current = saved;
    setProject(saved);
    setActiveProjectId(saved.id);
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, saved.id);
    setProjects((current) => [projectSummary(saved), ...current.filter((item) => item.id !== saved.id)]);
    window.location.hash = "#/brainstorming";
  }

  function openHome() {
    if (draftRef.current) {
      draftRef.current = false;
      persistableRef.current = false;
      setIsDraft(false);
      const empty = createEmptyProject(language);
      projectRef.current = empty;
      setProject(empty);
      setActiveProjectId("");
    } else {
      flushProject();
    }
    window.location.hash = "#/";
  }

  function selectDefaultTeam(teamId: string) {
    setDefaultTeamId(teamId);
    if (teamId) window.localStorage.setItem(DEFAULT_TEAM_KEY, teamId);
    else window.localStorage.removeItem(DEFAULT_TEAM_KEY);
  }

  function openPipelineStep(step: number) {
    if (step === 0) openMemory();
    if (step === 1) void openBrainstorm();
  }

  let page = <HomePage language={language} t={t} onLanguageChange={changeLanguage} projects={projects} loadingProjects={loadingProjects} onCreateProject={createProject} onOpenProject={(id) => void openProject(id)} onDeleteProject={deleteProject} onOpenTeams={openTeams} />;
  if (route === "setup") page = <StudySetupPage language={language} project={project} isDraft={isDraft} t={t} onLanguageChange={changeLanguage} onProjectChange={changeProject} onContinue={openBrainstorm} onHome={openHome} onTeams={openTeams} onManageTeam={openProjectTeam} />;
  if (route === "teams") page = <TeamsHubPage language={language} t={t} onLanguageChange={changeLanguage} onBack={openHome} initialTeamId={defaultTeamId} onTeamSelect={selectDefaultTeam} onTeamsChanged={() => void refreshTeams()} />;
  if (route === "projectTeam") page = <TeamPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onBack={openMemory} onProjectSetup={openMemory} />;
  if (route === "brainstorm") page = <BrainstormPage language={language} project={project} t={t} onLanguageChange={changeLanguage} onProjectChange={changeProject} onHome={openHome} onBackSetup={openMemory} />;

  return (
    <div className={sidebarExpanded ? "app-shell route-" + route + " sidebar-expanded" : "app-shell route-" + route}>
      <MissionSidebar language={language} currentStep={currentStep} expanded={sidebarExpanded} connectedLabel={t("common.connected")} homeLabel={t("home.start")} teamLabel={language === "pt" ? "Equipes" : "Teams"} homeActive={route === "home"} teamActive={route === "teams"} projects={projects} teams={teams.filter((team) => team.membership === "member")} activeProjectId={activeProjectId} defaultTeamId={defaultTeamId} onToggle={() => setSidebarExpanded((current) => !current)} onHome={openHome} onTeam={openTeams} onProjectSelect={(id) => void openProject(id)} onTeamSelect={selectDefaultTeam} onStepSelect={openPipelineStep} />
      <div className="app-page">{page}</div>
    </div>
  );
}

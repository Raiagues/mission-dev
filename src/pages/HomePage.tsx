import { ArrowRight, FolderOpen, Plus, UsersRound } from "lucide-react";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { referenceProgram } from "../lib/programs";
import type { ProjectSummary } from "../lib/team";
import type { Language } from "../lib/types";
import "../home-overrides.css";

type Props = {
  language: Language;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  projects?: ProjectSummary[];
  loadingProjects?: boolean;
  onCreateProject?: () => void;
  onOpenBrainstorm?: () => void;
  onOpenProject?: (projectId: string) => void;
  onOpenTeams?: () => void;
};

export function HomePage({
  language,
  t,
  onLanguageChange,
  projects = [],
  loadingProjects = false,
  onCreateProject,
  onOpenBrainstorm,
  onOpenProject,
  onOpenTeams
}: Props) {
  const c = language === "pt" ? {
    eyebrow: "ESPAÇO DE TRABALHO",
    title: "Seus projetos",
    subtitle: "Crie uma equipe, inicie um projeto ou retome um trabalho em andamento.",
    teams: "Equipes",
    teamsDescription: "Crie uma equipe, aceite convites e organize as pessoas com quem você trabalha.",
    create: "Novo projeto",
    createDescription: "Comece pela memória do projeto e conecte programa, equipe e referências.",
    open: "Abrir projeto",
    openDescription: "Continue um projeto associado à sua conta.",
    recent: "PROJETOS ASSOCIADOS",
    empty: "Nenhum projeto criado ainda.",
    emptyHint: "Seu primeiro projeto aparecerá aqui assim que você o criar.",
    loading: "Carregando projetos",
    untitled: "Projeto sem nome",
    noProgram: "Programa ainda não selecionado",
    member: "membro",
    members: "membros",
    updated: "Atualizado"
  } : {
    eyebrow: "WORKSPACE",
    title: "Your projects",
    subtitle: "Create a team, start a project, or resume work already in progress.",
    teams: "Teams",
    teamsDescription: "Create a team, accept invitations, and organize the people you work with.",
    create: "New project",
    createDescription: "Begin with project memory and connect the program, team, and references.",
    open: "Open project",
    openDescription: "Continue a project associated with your account.",
    recent: "ASSOCIATED PROJECTS",
    empty: "No projects have been created yet.",
    emptyHint: "Your first project will appear here as soon as you create it.",
    loading: "Loading projects",
    untitled: "Untitled project",
    noProgram: "Program not selected yet",
    member: "member",
    members: "members",
    updated: "Updated"
  };

  const createProject = onCreateProject ?? onOpenBrainstorm ?? (() => undefined);
  const scrollToProjects = () => document.querySelector(".home-projects")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="home-shell home-dashboard-shell">
      <main className="home-main">
        <header className="home-topbar dashboard-topbar">
          <strong className="dashboard-wordmark">NORTE</strong>
          <div className="top-actions">
            <LanguageToggle language={language} onChange={onLanguageChange} />
            <UserBadge connectedLabel={t("common.connected")} />
          </div>
        </header>

        <div className="home-dashboard">
          <header className="dashboard-heading">
            <span>{c.eyebrow}</span>
            <h1>{c.title}</h1>
            <p>{c.subtitle}</p>
          </header>

          <section className="dashboard-actions" aria-label={language === "pt" ? "Ações principais" : "Primary actions"}>
            <button type="button" onClick={onOpenTeams}>
              <span className="dashboard-action-icon"><UsersRound aria-hidden="true" /></span>
              <span><strong>{c.teams}</strong><small>{c.teamsDescription}</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
            <button type="button" onClick={createProject}>
              <span className="dashboard-action-icon"><Plus aria-hidden="true" /></span>
              <span><strong>{c.create}</strong><small>{c.createDescription}</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
            <button type="button" onClick={scrollToProjects} disabled={projects.length === 0}>
              <span className="dashboard-action-icon"><FolderOpen aria-hidden="true" /></span>
              <span><strong>{c.open}</strong><small>{c.openDescription}</small></span>
              <ArrowRight aria-hidden="true" />
            </button>
          </section>

          <section className="home-projects">
            <div className="home-projects-heading"><span>{c.recent}</span><strong>{projects.length}</strong></div>
            {loadingProjects ? <div className="home-project-empty">{c.loading}</div> : projects.length === 0 ? (
              <div className="home-project-empty"><FolderOpen aria-hidden="true" /><strong>{c.empty}</strong><span>{c.emptyHint}</span><button type="button" onClick={createProject}><Plus aria-hidden="true" />{c.create}</button></div>
            ) : (
              <div className="home-project-list">
                {projects.map((project) => {
                  const program = referenceProgram(project.programId);
                  const date = new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(project.updatedAt));
                  return <button type="button" key={project.id} onClick={() => onOpenProject?.(project.id)}>
                    <span className="home-project-symbol"><FolderOpen aria-hidden="true" /></span>
                    <span className="home-project-copy"><strong>{project.name || c.untitled}</strong><small>{program?.name[language] ?? c.noProgram}</small></span>
                    <span className="home-project-meta"><small>{project.memberCount} {project.memberCount === 1 ? c.member : c.members}</small><small>{c.updated} {date}</small></span>
                    <ArrowRight aria-hidden="true" />
                  </button>;
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

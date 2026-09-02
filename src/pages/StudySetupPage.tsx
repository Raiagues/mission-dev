import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  ExternalLink,
  FileCode2,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Link2,
  LoaderCircle,
  GitFork,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Unlink2,
  UserPlus,
  UsersRound,
  X
} from "lucide-react";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { ApiError, useAuth } from "../lib/auth";
import { programCategory, programModality, referenceProgram, REFERENCE_PROGRAMS } from "../lib/programs";
import type { MissionProject, ProjectMemberAssignment } from "../lib/projectStore";
import { memberInitials } from "../lib/team";
import type { ArtifactKind, ArtifactScope, ConnectedArtifact, TeamMember, TeamRecord } from "../lib/team";
import type { Language } from "../lib/types";
import "../project-memory.css";

type Props = {
  language: Language;
  project: MissionProject;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onProjectChange: (project: MissionProject) => void;
  onContinue: () => void;
  onHome: () => void;
  onEditProject: () => void;
  onManageTeam: () => void;
};

type DialogState =
  | { type: "members" }
  | { type: "new-member" }
  | { type: "structure" }
  | { type: "team-artifacts" }
  | { type: "artifact"; scope: ArtifactScope; artifact: ConnectedArtifact | null }
  | null;

type ArtifactFormat = "github" | "pdf" | "csv" | "sheet" | "doc" | "code" | "link";

function artifactFormat(artifact: ConnectedArtifact): ArtifactFormat {
  if (artifact.kind === "repository" || /github\.com/iu.test(artifact.url)) return "github";
  const path = artifact.url.toLocaleLowerCase("en-US").split(/[?#]/u)[0];
  if (path.endsWith(".pdf")) return "pdf";
  if (path.endsWith(".csv")) return "csv";
  if (/\.(xlsx?|ods)$/u.test(path)) return "sheet";
  if (/\.(docx?|odt|rtf)$/u.test(path)) return "doc";
  if (/\.(ino|c|cpp|h|ts|tsx|js|py)$/u.test(path)) return "code";
  return artifact.kind === "link" ? "link" : "doc";
}

function ArtifactIcon({ artifact }: { artifact: ConnectedArtifact }) {
  const format = artifactFormat(artifact);
  if (format === "github") return <span className="pm-format-icon github"><GitBranch aria-hidden="true" /><small>GIT</small></span>;
  if (format === "csv" || format === "sheet") return <span className="pm-format-icon sheet"><FileSpreadsheet aria-hidden="true" /><small>{format === "csv" ? "CSV" : "XLS"}</small></span>;
  if (format === "code") return <span className="pm-format-icon code"><FileCode2 aria-hidden="true" /><small>CODE</small></span>;
  if (format === "link") return <span className="pm-format-icon link"><Link2 aria-hidden="true" /></span>;
  return <span className={"pm-format-icon " + format}><FileText aria-hidden="true" /><small>{format === "pdf" ? "PDF" : "DOC"}</small></span>;
}

function MemoryDialog({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div className="pm-dialog-backdrop" role="presentation" onPointerDown={onClose}>
    <section className="pm-dialog" role="dialog" aria-modal="true" aria-labelledby="pm-dialog-title" onPointerDown={(event) => event.stopPropagation()}>
      <header><div><span>{eyebrow}</span><h2 id="pm-dialog-title">{title}</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button></header>
      {children}
    </section>
  </div>;
}

export function StudySetupPage({ language, project, t, onLanguageChange, onProjectChange, onContinue, onHome, onManageTeam }: Props) {
  const auth = useAuth();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [artifacts, setArtifacts] = useState<ConnectedArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);

  const c = useMemo(() => language === "pt" ? {
    back: "Início",
    eyebrow: "MEMÓRIA DO PROJETO",
    title: "Contexto do projeto",
    subtitle: "Escolha o programa, conecte a equipe e mantenha apenas as referências úteis para este projeto.",
    projectName: "NOME DO PROJETO",
    projectPlaceholder: "Ex.: Missão Aurora",
    referenceProgram: "PROGRAMA DE REFERÊNCIA",
    programHint: "Ao selecionar um programa, as informações e os documentos oficiais são carregados automaticamente.",
    chooseProgram: "Selecione um programa",
    soon: "em breve",
    modality: "Modalidade",
    category: "Categoria",
    officialDocs: "Documentos oficiais",
    milestone: "Próximo marco",
    team: "EQUIPE DO PROJETO",
    teamHint: "Associe uma equipe e escolha quem participará especificamente deste projeto.",
    chooseTeam: "Selecione uma equipe",
    noTeam: "Você ainda não participa de nenhuma equipe.",
    teamsArea: "Abrir equipes",
    viewTeam: "Lista e hierarquia",
    chooseMembers: "Escolher membros",
    addMember: "Nova pessoa",
    projectStructure: "Cargos e setores",
    structureTitle: "Estrutura deste projeto",
    structureHint: "Cargos e setores pertencem somente a este projeto. Os dados acadêmicos continuam no perfil de cada pessoa.",
    roles: "CARGOS",
    sectors: "SETORES",
    addRole: "Adicionar cargo",
    addSector: "Adicionar setor",
    newRole: "Novo cargo",
    newSector: "Novo setor",
    roleInUse: "Este cargo está atribuído e não pode ser removido.",
    role: "Função",
    sector: "Setor",
    noSector: "Sem setor",
    teamArtifacts: "ARTEFATOS DA EQUIPE",
    teamArtifactsHint: "Referências permanentes da equipe vinculadas a esta memória. Remover aqui não apaga o arquivo da equipe.",
    projectArtifacts: "ARTEFATOS DO PROJETO",
    projectArtifactsHint: "Repositórios e documentos criados especificamente para este projeto.",
    selectArtifacts: "Selecionar",
    addArtifact: "Adicionar",
    noArtifacts: "Nenhum artefato vinculado.",
    unlink: "Remover desta memória",
    edit: "Editar",
    delete: "Excluir artefato do projeto",
    open: "Abrir",
    continue: "Começar concepção",
    ready: "A memória essencial está pronta.",
    missing: "Para continuar, complete:",
    missingName: "nome do projeto",
    missingProgram: "programa, modalidade e categoria",
    missingTeam: "equipe do projeto",
    missingMembers: "ao menos uma pessoa",
    loading: "Carregando memória",
    loadError: "Não foi possível carregar a memória do projeto.",
    saved: "Alteração salva.",
    unlinked: "O artefato saiu desta memória, mas continua guardado na equipe.",
    chooseProjectMembers: "Membros deste projeto",
    memberDialogHint: "Marque somente quem participa deste projeto. A equipe completa não será alterada.",
    inviteTitle: "Adicionar pessoa à equipe",
    personName: "Nome",
    personEmail: "E-mail",
    inviteHint: "A pessoa poderá criar a conta normalmente com este e-mail; não é necessário código.",
    teamLibrary: "Biblioteca da equipe",
    teamLibraryHint: "Marque quais referências desta equipe devem aparecer nesta memória.",
    newProjectArtifact: "Novo artefato do projeto",
    editArtifact: "Editar artefato",
    kind: "Tipo",
    artifactName: "Nome",
    url: "Link ou caminho",
    description: "Descrição",
    save: "Salvar",
    remove: "Remover",
    cancel: "Cancelar",
    deleteConfirm: "Excluir este artefato do projeto? Esta ação remove a referência do acervo do projeto.",
    sourceKinds: { document: "Documento", repository: "Repositório GitHub", dataset: "CSV ou planilha", link: "Link" }
  } : {
    back: "Home",
    eyebrow: "PROJECT MEMORY",
    title: "Project context",
    subtitle: "Choose the program, connect the team, and keep only the references useful to this project.",
    projectName: "PROJECT NAME",
    projectPlaceholder: "E.g. Aurora Mission",
    referenceProgram: "REFERENCE PROGRAM",
    programHint: "Selecting a program automatically loads its official information and documents.",
    chooseProgram: "Select a program",
    soon: "coming soon",
    modality: "Modality",
    category: "Category",
    officialDocs: "Official documents",
    milestone: "Next milestone",
    team: "PROJECT TEAM",
    teamHint: "Associate a team and choose who will take part in this specific project.",
    chooseTeam: "Select a team",
    noTeam: "You are not part of a team yet.",
    teamsArea: "Open teams",
    viewTeam: "List and hierarchy",
    chooseMembers: "Choose members",
    addMember: "New person",
    projectStructure: "Roles and sectors",
    structureTitle: "Project structure",
    structureHint: "Roles and sectors belong only to this project. Academic information remains in each person's profile.",
    roles: "ROLES",
    sectors: "SECTORS",
    addRole: "Add role",
    addSector: "Add sector",
    newRole: "New role",
    newSector: "New sector",
    roleInUse: "This role is assigned and cannot be removed.",
    role: "Role",
    sector: "Sector",
    noSector: "No sector",
    teamArtifacts: "TEAM ARTIFACTS",
    teamArtifactsHint: "Long-lived team references linked to this memory. Removing one here does not delete it from the team.",
    projectArtifacts: "PROJECT ARTIFACTS",
    projectArtifactsHint: "Repositories and documents created specifically for this project.",
    selectArtifacts: "Select",
    addArtifact: "Add",
    noArtifacts: "No artifacts linked.",
    unlink: "Remove from this memory",
    edit: "Edit",
    delete: "Delete project artifact",
    open: "Open",
    continue: "Start conception",
    ready: "Essential memory is ready.",
    missing: "To continue, complete:",
    missingName: "project name",
    missingProgram: "program, modality, and category",
    missingTeam: "project team",
    missingMembers: "at least one person",
    loading: "Loading memory",
    loadError: "Project memory could not be loaded.",
    saved: "Change saved.",
    unlinked: "The artifact was removed from this memory but remains in the team library.",
    chooseProjectMembers: "Project members",
    memberDialogHint: "Select only those participating in this project. The full team will not be changed.",
    inviteTitle: "Add a person to the team",
    personName: "Name",
    personEmail: "Email",
    inviteHint: "The person can create an account normally with this email; no code is needed.",
    teamLibrary: "Team library",
    teamLibraryHint: "Select which team references should appear in this memory.",
    newProjectArtifact: "New project artifact",
    editArtifact: "Edit artifact",
    kind: "Type",
    artifactName: "Name",
    url: "Link or path",
    description: "Description",
    save: "Save",
    remove: "Remove",
    cancel: "Cancel",
    deleteConfirm: "Delete this project artifact? This removes the reference from the project library.",
    sourceKinds: { document: "Document", repository: "GitHub repository", dataset: "CSV or spreadsheet", link: "Link" }
  }, [language]);

  const loadMemory = useCallback(async () => {
    setLoading(true);
    try {
      const [teamResponse, memberResponse, artifactResponse] = await Promise.all([
        auth.api<{ teams: TeamRecord[] }>("/teams"),
        auth.api<{ members: TeamMember[] }>("/team/members"),
        auth.api<{ artifacts: ConnectedArtifact[] }>("/artifacts")
      ]);
      setTeams(teamResponse.teams);
      setMembers(memberResponse.members);
      setArtifacts(artifactResponse.artifacts.filter((artifact) => !artifact.official));
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setLoading(false);
    }
  }, [auth.api, c.loadError]);

  useEffect(() => { void loadMemory(); }, [loadMemory]);

  const program = referenceProgram(project.context.programId);
  const modality = programModality(program, project.context.modalityId);
  const category = programCategory(modality, project.context.categoryId);
  const associatedTeams = teams.filter((team) => team.membership === "member" || team.memberIds.includes(auth.user?.memberId || ""));
  const selectedTeam = associatedTeams.find((team) => team.id === project.context.teamId) ?? null;
  const selectedTeamMembers = useMemo(() => selectedTeam ? selectedTeam.memberIds.map((id) => members.find((member) => member.id === id)).filter((member): member is TeamMember => Boolean(member)) : [], [members, selectedTeam]);
  const selectedProjectMembers = useMemo(() => project.context.assignments.map((assignment) => {
    const member = members.find((item) => item.id === assignment.memberId);
    return member ? { member, assignment } : null;
  }).filter((value): value is { member: TeamMember; assignment: ProjectMemberAssignment } => Boolean(value)), [members, project.context.assignments]);
  const availableTeamArtifacts = useMemo(() => selectedTeam ? selectedTeam.artifactIds.map((id) => artifacts.find((artifact) => artifact.id === id)).filter((artifact): artifact is ConnectedArtifact => Boolean(artifact)) : [], [artifacts, selectedTeam]);
  const linkedTeamArtifacts = availableTeamArtifacts.filter((artifact) => project.context.teamArtifactIds.includes(artifact.id));
  const linkedProjectArtifacts = artifacts.filter((artifact) => artifact.scope === "project" && (artifact.ownerId === project.id || project.context.projectArtifactIds.includes(artifact.id)));

  function updateProject(next: Partial<MissionProject>, contextPatch?: Partial<MissionProject["context"]>) {
    onProjectChange({
      ...project,
      ...next,
      context: contextPatch ? { ...project.context, ...contextPatch } : project.context
    });
  }

  function selectProgram(programId: string) {
    const nextProgram = referenceProgram(programId);
    const nextModality = nextProgram?.modalities[0] ?? null;
    const nextCategory = nextModality?.categories[0] ?? null;
    updateProject({}, {
      configured: false,
      programId: nextProgram?.id ?? null,
      modalityId: nextModality?.id ?? null,
      categoryId: nextCategory?.id ?? null
    });
  }

  function selectModality(modalityId: string) {
    const nextModality = program?.modalities.find((item) => item.id === modalityId) ?? null;
    updateProject({}, { configured: false, modalityId: nextModality?.id ?? null, categoryId: nextModality?.categories[0]?.id ?? null });
  }

  function selectTeam(teamId: string) {
    const team = associatedTeams.find((item) => item.id === teamId) ?? null;
    if (!team) {
      updateProject({}, { configured: false, teamId: null, teamName: "", teamArtifactIds: [], assignments: [] });
      return;
    }
    let assignments = project.context.assignments.filter((assignment) => team.memberIds.includes(assignment.memberId));
    if (assignments.length === 0) {
      const preferredMemberId = team.memberIds.includes(auth.user?.memberId || "") ? auth.user?.memberId : team.memberIds[0];
      if (preferredMemberId) assignments = [{ memberId: preferredMemberId, roleId: "captain", sectorId: "" }];
    }
    updateProject({}, { configured: false, teamId: team.id, teamName: team.name, teamArtifactIds: [...team.artifactIds], assignments });
  }

  function toggleMember(memberId: string) {
    const existing = project.context.assignments.find((assignment) => assignment.memberId === memberId);
    const assignments = existing
      ? project.context.assignments.filter((assignment) => assignment.memberId !== memberId)
      : [...project.context.assignments, { memberId, roleId: project.context.assignments.some((assignment) => assignment.roleId === "captain") ? "member" : "captain", sectorId: "" }];
    updateProject({}, { configured: false, assignments });
  }

  function updateAssignment(memberId: string, patch: Partial<ProjectMemberAssignment>) {
    updateProject({}, { assignments: project.context.assignments.map((assignment) => assignment.memberId === memberId ? { ...assignment, ...patch } : assignment) });
  }

  function addStructureItem(kind: "roles" | "sectors") {
    const item = { id: kind.slice(0, -1) + "-" + crypto.randomUUID(), name: kind === "roles" ? c.newRole : c.newSector };
    updateProject({}, { [kind]: [...project.context[kind], item] });
  }

  function renameStructureItem(kind: "roles" | "sectors", id: string, name: string) {
    updateProject({}, { [kind]: project.context[kind].map((item) => item.id === id ? { ...item, name } : item) });
  }

  function removeStructureItem(kind: "roles" | "sectors", id: string) {
    if (kind === "roles" && project.context.assignments.some((assignment) => assignment.roleId === id)) return;
    if (kind === "roles") {
      updateProject({}, { roles: project.context.roles.filter((item) => item.id !== id) });
      return;
    }
    updateProject({}, {
      sectors: project.context.sectors.filter((item) => item.id !== id),
      assignments: project.context.assignments.map((assignment) => assignment.sectorId === id ? { ...assignment, sectorId: "" } : assignment)
    });
  }

  function toggleTeamArtifact(artifactId: string) {
    const linked = project.context.teamArtifactIds.includes(artifactId);
    updateProject({}, { teamArtifactIds: linked ? project.context.teamArtifactIds.filter((id) => id !== artifactId) : [...project.context.teamArtifactIds, artifactId] });
    if (linked) setFeedback(c.unlinked);
  }

  async function addMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeam) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setFeedback("");
    try {
      const response = await auth.api<{ member: TeamMember }>("/team/members", {
        method: "POST",
        body: JSON.stringify({
          teamId: selectedTeam.id,
          displayName: String(data.get("name") || ""),
          email: String(data.get("email") || ""),
          missionRole: "member",
          primaryArea: "systems",
          secondaryAreas: [],
          institution: "",
          course: "",
          academicStage: "",
          skills: [],
          availabilityHours: 0,
          notes: ""
        })
      });
      updateProject({}, { assignments: [...project.context.assignments, { memberId: response.member.id, roleId: "member", sectorId: "" }] });
      setDialog(null);
      await loadMemory();
      setFeedback(c.saved);
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function saveArtifact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || dialog.type !== "artifact") return;
    const data = new FormData(event.currentTarget);
    const current = dialog.artifact;
    const ownerId = dialog.scope === "team" ? selectedTeam?.id : project.id;
    if (!ownerId) return;
    const payload = {
      kind: String(data.get("kind") || "document") as ArtifactKind,
      label: String(data.get("label") || ""),
      url: String(data.get("url") || ""),
      description: String(data.get("description") || ""),
      tags: [],
      scope: dialog.scope,
      ownerId
    };
    setBusy(true);
    setFeedback("");
    try {
      let artifactId = current?.id || "";
      if (current) {
        await auth.api("/artifacts/" + current.id, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        const response = await auth.api<{ artifact: ConnectedArtifact }>("/artifacts", { method: "POST", body: JSON.stringify(payload) });
        artifactId = response.artifact.id;
      }
      if (dialog.scope === "project" && artifactId && !project.context.projectArtifactIds.includes(artifactId)) {
        updateProject({}, { projectArtifactIds: [...project.context.projectArtifactIds, artifactId] });
      }
      if (dialog.scope === "team" && artifactId && !project.context.teamArtifactIds.includes(artifactId)) {
        updateProject({}, { teamArtifactIds: [...project.context.teamArtifactIds, artifactId] });
      }
      setDialog(null);
      await loadMemory();
      setFeedback(c.saved);
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProjectArtifact(artifact: ConnectedArtifact) {
    if (!window.confirm(c.deleteConfirm)) return;
    setBusy(true);
    try {
      await auth.api("/artifacts/" + artifact.id, { method: "DELETE" });
      updateProject({}, { projectArtifactIds: project.context.projectArtifactIds.filter((id) => id !== artifact.id) });
      await loadMemory();
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  const missing = [
    !project.name.trim() ? c.missingName : "",
    !(program && modality && category) ? c.missingProgram : "",
    !selectedTeam ? c.missingTeam : "",
    project.context.assignments.length === 0 ? c.missingMembers : ""
  ].filter(Boolean);

  function continueToConception() {
    if (missing.length > 0) return;
    updateProject({}, { configured: true });
    onContinue();
  }

  function ArtifactRow({ artifact, scope }: { artifact: ConnectedArtifact; scope: ArtifactScope }) {
    const canEdit = scope === "project" || Boolean(selectedTeam?.canManage);
    return <article className="pm-artifact-row">
      <ArtifactIcon artifact={artifact} />
      <div><strong>{artifact.label}</strong><span>{artifact.description || artifact.url}</span></div>
      <div className="pm-artifact-actions">
        <a href={artifact.url} target="_blank" rel="noreferrer" title={c.open} aria-label={c.open}><ExternalLink aria-hidden="true" /></a>
        {canEdit && <button type="button" title={c.edit} aria-label={c.edit} onClick={() => setDialog({ type: "artifact", scope, artifact })}><Pencil aria-hidden="true" /></button>}
        {scope === "team" ? <button type="button" title={c.unlink} aria-label={c.unlink} onClick={() => toggleTeamArtifact(artifact.id)}><Unlink2 aria-hidden="true" /></button> : <button type="button" title={c.delete} aria-label={c.delete} onClick={() => void deleteProjectArtifact(artifact)}><Trash2 aria-hidden="true" /></button>}
      </div>
    </article>;
  }

  return <div className="pm-shell">
    <main className="pm-main">
      <header className="pm-topbar">
        <button type="button" onClick={onHome}><ArrowLeft aria-hidden="true" />{c.back}</button>
        <div className="top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
      </header>

      <div className="pm-workspace">
        <header className="pm-heading">
          <div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.subtitle}</p></div>
          <label className="pm-project-name"><span>{c.projectName}</span><div><Pencil aria-hidden="true" /><input value={project.name} onChange={(event) => updateProject({ name: event.target.value })} placeholder={c.projectPlaceholder} maxLength={120} /></div></label>
        </header>

        {feedback && <div className="pm-feedback" role="status">{feedback}<button type="button" onClick={() => setFeedback("")} aria-label="Fechar"><X aria-hidden="true" /></button></div>}

        <section className="pm-section pm-program-section">
          <header><div><span>01</span><div><h2>{c.referenceProgram}</h2><p>{c.programHint}</p></div></div></header>
          <div className="pm-program-layout">
            <label className="pm-control pm-program-control"><span>{c.referenceProgram}</span><select value={project.context.programId || ""} onChange={(event) => selectProgram(event.target.value)}><option value="">{c.chooseProgram}</option>{REFERENCE_PROGRAMS.map((item) => <option value={item.id} disabled={!item.available} key={item.id}>{item.shortName}{item.available ? "" : " · " + c.soon}</option>)}</select></label>
            {program ? <div className="pm-program-summary"><div>{program.logoSrc ? <img src={program.logoSrc} alt="" /> : <BookOpenCheck aria-hidden="true" />}</div><span><strong>{program.name[language]}</strong><small>{program.description[language]}</small></span></div> : <div className="pm-program-summary empty"><BookOpenCheck aria-hidden="true" /><span>{c.chooseProgram}</span></div>}
            <label className="pm-control"><span>{c.modality}</span><select value={project.context.modalityId || ""} disabled={!program} onChange={(event) => selectModality(event.target.value)}>{program?.modalities.map((item) => <option value={item.id} key={item.id}>{item.label[language]}</option>)}</select></label>
            <label className="pm-control"><span>{c.category}</span><select value={project.context.categoryId || ""} disabled={!modality} onChange={(event) => updateProject({}, { configured: false, categoryId: event.target.value })}>{modality?.categories.map((item) => <option value={item.id} key={item.id}>{item.label[language]}</option>)}</select></label>
            <div className="pm-official-actions">
              {modality?.officialDocuments.slice(0, 1).map((document) => <a href={document.url} target="_blank" rel="noreferrer" key={document.id}><BookOpenCheck aria-hidden="true" /><span><small>{c.officialDocs}</small><strong>{document.label[language]}</strong></span><ExternalLink aria-hidden="true" /></a>)}
              {modality && <a href={modality.milestone.url} target="_blank" rel="noreferrer"><CalendarDays aria-hidden="true" /><span><small>{c.milestone}</small><strong>{modality.milestone.date} · {modality.milestone.label[language]}</strong></span><ExternalLink aria-hidden="true" /></a>}
            </div>
          </div>
        </section>

        <section className="pm-section pm-team-section">
          <header><div><span>02</span><div><h2>{c.team}</h2><p>{c.teamHint}</p></div></div><div className="pm-section-actions"><button type="button" onClick={onManageTeam} disabled={!selectedTeam}><GitFork aria-hidden="true" />{c.viewTeam}</button><button type="button" onClick={() => setDialog({ type: "structure" })} disabled={!selectedTeam}><Settings2 aria-hidden="true" />{c.projectStructure}</button></div></header>
          <div className="pm-team-layout">
            <label className="pm-control pm-team-select"><span>{c.team}</span><select value={project.context.teamId || ""} onChange={(event) => selectTeam(event.target.value)}><option value="">{associatedTeams.length ? c.chooseTeam : c.noTeam}</option>{associatedTeams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
            <div className="pm-members-strip">
              {selectedProjectMembers.map(({ member, assignment }) => <article key={member.id}><div className={member.avatarUrl ? "pm-member-avatar has-photo" : "pm-member-avatar"}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : memberInitials(member.displayName)}</div><div><strong>{member.displayName}</strong><span>{member.email}</span></div><label><span>{c.role}</span><select value={assignment.roleId} onChange={(event) => updateAssignment(member.id, { roleId: event.target.value })}>{project.context.roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label><label><span>{c.sector}</span><select value={assignment.sectorId} onChange={(event) => updateAssignment(member.id, { sectorId: event.target.value })}><option value="">{c.noSector}</option>{project.context.sectors.map((sector) => <option value={sector.id} key={sector.id}>{sector.name}</option>)}</select></label></article>)}
              {selectedTeam && selectedProjectMembers.length === 0 && <p>{c.missingMembers}</p>}
            </div>
            <div className="pm-team-actions"><button type="button" onClick={() => setDialog({ type: "members" })} disabled={!selectedTeam}><UsersRound aria-hidden="true" />{c.chooseMembers}</button><button type="button" onClick={() => setDialog({ type: "new-member" })} disabled={!selectedTeam}><UserPlus aria-hidden="true" />{c.addMember}</button></div>
          </div>
        </section>

        <section className="pm-artifacts-grid">
          <section className="pm-artifact-section">
            <header><div><h2>{c.teamArtifacts}</h2><p>{c.teamArtifactsHint}</p></div><button type="button" onClick={() => setDialog({ type: "team-artifacts" })} disabled={!selectedTeam}><Plus aria-hidden="true" />{c.selectArtifacts}</button></header>
            <div className="pm-artifact-list">{linkedTeamArtifacts.map((artifact) => <ArtifactRow artifact={artifact} scope="team" key={artifact.id} />)}{linkedTeamArtifacts.length === 0 && <div className="pm-artifact-empty"><Link2 aria-hidden="true" /><span>{c.noArtifacts}</span></div>}</div>
          </section>
          <section className="pm-artifact-section">
            <header><div><h2>{c.projectArtifacts}</h2><p>{c.projectArtifactsHint}</p></div><button type="button" onClick={() => setDialog({ type: "artifact", scope: "project", artifact: null })}><Plus aria-hidden="true" />{c.addArtifact}</button></header>
            <div className="pm-artifact-list">{linkedProjectArtifacts.map((artifact) => <ArtifactRow artifact={artifact} scope="project" key={artifact.id} />)}{linkedProjectArtifacts.length === 0 && <div className="pm-artifact-empty"><FileText aria-hidden="true" /><span>{c.noArtifacts}</span></div>}</div>
          </section>
        </section>

        <footer className="pm-footer">
          <div className={missing.length ? "pm-readiness missing" : "pm-readiness"}>{missing.length ? <><span>{c.missing}</span><strong>{missing.join(" · ")}</strong></> : <><Check aria-hidden="true" /><strong>{c.ready}</strong></>}</div>
          <button type="button" onClick={continueToConception} disabled={missing.length > 0 || loading}>{loading ? <LoaderCircle className="pm-spin" aria-hidden="true" /> : null}{c.continue}<ArrowRight aria-hidden="true" /></button>
        </footer>
      </div>
    </main>

    {dialog?.type === "members" && <MemoryDialog eyebrow={c.team} title={c.chooseProjectMembers} onClose={() => setDialog(null)}><div className="pm-dialog-copy">{c.memberDialogHint}</div><div className="pm-selection-list">{selectedTeamMembers.map((member) => { const checked = project.context.assignments.some((assignment) => assignment.memberId === member.id); return <label key={member.id}><input type="checkbox" checked={checked} onChange={() => toggleMember(member.id)} /><span className={member.avatarUrl ? "pm-member-avatar has-photo" : "pm-member-avatar"}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : memberInitials(member.displayName)}</span><span><strong>{member.displayName}</strong><small>{member.email}</small></span><Check aria-hidden="true" /></label>; })}</div><footer><button className="primary" type="button" onClick={() => setDialog(null)}><Check aria-hidden="true" />{c.save}</button></footer></MemoryDialog>}

    {dialog?.type === "new-member" && <MemoryDialog eyebrow={c.team} title={c.inviteTitle} onClose={() => setDialog(null)}><form className="pm-dialog-form" onSubmit={(event) => void addMember(event)}><label><span>{c.personName}</span><input name="name" required maxLength={100} autoFocus /></label><label><span>{c.personEmail}</span><input name="email" type="email" required maxLength={254} /></label><p>{c.inviteHint}</p><footer><button type="button" onClick={() => setDialog(null)}>{c.cancel}</button><button className="primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="pm-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}{c.addMember}</button></footer></form></MemoryDialog>}

    {dialog?.type === "structure" && <MemoryDialog eyebrow={c.team} title={c.structureTitle} onClose={() => setDialog(null)}><div className="pm-dialog-copy">{c.structureHint}</div><div className="pm-structure-editor"><section><header><h3>{c.roles}</h3><button type="button" onClick={() => addStructureItem("roles")}><Plus aria-hidden="true" />{c.addRole}</button></header><div>{project.context.roles.map((role) => { const inUse = project.context.assignments.some((assignment) => assignment.roleId === role.id); return <label key={role.id}><input value={role.name} maxLength={60} onChange={(event) => renameStructureItem("roles", role.id, event.target.value)} /><button type="button" disabled={inUse || project.context.roles.length === 1} title={inUse ? c.roleInUse : c.remove} onClick={() => removeStructureItem("roles", role.id)}><Trash2 aria-hidden="true" /></button></label>; })}</div></section><section><header><h3>{c.sectors}</h3><button type="button" onClick={() => addStructureItem("sectors")}><Plus aria-hidden="true" />{c.addSector}</button></header><div>{project.context.sectors.map((sector) => <label key={sector.id}><input value={sector.name} maxLength={60} onChange={(event) => renameStructureItem("sectors", sector.id, event.target.value)} /><button type="button" title={c.remove} onClick={() => removeStructureItem("sectors", sector.id)}><Trash2 aria-hidden="true" /></button></label>)}{project.context.sectors.length === 0 && <div className="pm-artifact-empty">{c.noSector}</div>}</div></section></div><footer><button className="primary" type="button" onClick={() => setDialog(null)}><Check aria-hidden="true" />{c.save}</button></footer></MemoryDialog>}

    {dialog?.type === "team-artifacts" && <MemoryDialog eyebrow={c.teamArtifacts} title={c.teamLibrary} onClose={() => setDialog(null)}><div className="pm-dialog-copy">{c.teamLibraryHint}</div><div className="pm-selection-list artifacts">{availableTeamArtifacts.map((artifact) => { const checked = project.context.teamArtifactIds.includes(artifact.id); return <label key={artifact.id}><input type="checkbox" checked={checked} onChange={() => toggleTeamArtifact(artifact.id)} /><ArtifactIcon artifact={artifact} /><span><strong>{artifact.label}</strong><small>{artifact.description || artifact.url}</small></span><Check aria-hidden="true" /></label>; })}{availableTeamArtifacts.length === 0 && <div className="pm-artifact-empty">{c.noArtifacts}</div>}</div><footer><button type="button" onClick={() => setDialog({ type: "artifact", scope: "team", artifact: null })}><Plus aria-hidden="true" />{c.addArtifact}</button><button className="primary" type="button" onClick={() => setDialog(null)}><Check aria-hidden="true" />{c.save}</button></footer></MemoryDialog>}

    {dialog?.type === "artifact" && <MemoryDialog eyebrow={dialog.scope === "team" ? c.teamArtifacts : c.projectArtifacts} title={dialog.artifact ? c.editArtifact : c.newProjectArtifact} onClose={() => setDialog(null)}><form className="pm-dialog-form" onSubmit={(event) => void saveArtifact(event)}><label><span>{c.kind}</span><select name="kind" defaultValue={dialog.artifact?.kind || "document"}><option value="document">{c.sourceKinds.document}</option><option value="repository">{c.sourceKinds.repository}</option><option value="dataset">{c.sourceKinds.dataset}</option><option value="link">{c.sourceKinds.link}</option></select></label><label><span>{c.artifactName}</span><input name="label" defaultValue={dialog.artifact?.label || ""} required maxLength={140} autoFocus /></label><label><span>{c.url}</span><input name="url" defaultValue={dialog.artifact?.url || ""} required maxLength={1000} placeholder="https://" /></label><label><span>{c.description}</span><textarea name="description" defaultValue={dialog.artifact?.description || ""} maxLength={500} rows={3} /></label><footer><button type="button" onClick={() => setDialog(null)}>{c.cancel}</button><button className="primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="pm-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{c.save}</button></footer></form></MemoryDialog>}
  </div>;
}

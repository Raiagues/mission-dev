import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
  Pencil,
  Plus,
  Settings2,
  Trash2,
  UsersRound,
  X
} from "lucide-react";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { ApiError, useAuth } from "../lib/auth";
import { programCategory, programModality, referenceProgram } from "../lib/programs";
import type { MissionProject } from "../lib/projectStore";
import { memberInitials } from "../lib/team";
import type { ArtifactKind, ConnectedArtifact, TeamMember } from "../lib/team";
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

type DialogState = ConnectedArtifact | "new" | null;
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
  if (format === "github") return <div className="pm-format-icon github"><GitBranch aria-hidden="true" /><span>GH</span></div>;
  if (["csv", "sheet"].includes(format)) return <div className="pm-format-icon sheet"><FileSpreadsheet aria-hidden="true" /><span>{format === "csv" ? "CSV" : "XLS"}</span></div>;
  if (format === "code") return <div className="pm-format-icon code"><FileCode2 aria-hidden="true" /><span>CODE</span></div>;
  if (format === "link") return <div className="pm-format-icon link"><Link2 aria-hidden="true" /></div>;
  return <div className={`pm-format-icon ${format}`}><FileText aria-hidden="true" /><span>{format === "pdf" ? "PDF" : "DOC"}</span></div>;
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

export function StudySetupPage({ language, project, t, onLanguageChange, onContinue, onEditProject, onManageTeam }: Props) {
  const auth = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [artifacts, setArtifacts] = useState<ConnectedArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);

  const c = useMemo(() => language === "pt" ? {
    title: "MEMÓRIA DO PROJETO",
    subtitle: "Contexto oficial, equipe e referências vivas desta missão.",
    referenceProgram: "PROGRAMA DE REFERÊNCIA",
    edition: "3ª edição",
    edital: "Edital",
    milestone: "Próximo marco oficial",
    sources: "ARTEFATOS DA EQUIPE",
    sourcesHint: "Repositórios, documentos e dados produzidos ou adotados pela equipe.",
    connect: "Conectar fonte",
    edit: "Editar fonte",
    connectedOn: "Conectado em",
    team: "EQUIPE DO PROJETO",
    teamHint: "Pessoas, cargos e setores definidos para este projeto.",
    manageTeam: "Gerenciar equipe",
    continue: "Começar concepção",
    configure: "Configurar projeto",
    emptyTitle: "A memória começa vazia",
    emptyText: "Defina o projeto, o programa de referência e a equipe para construir esta memória.",
    emptySources: "Nenhum artefato conectado.",
    emptyTeam: "Nenhuma pessoa selecionada para este projeto.",
    loading: "Carregando memória",
    save: "Salvar",
    remove: "Remover",
    cancel: "Cancelar",
    kind: "Tipo",
    label: "Nome da fonte",
    url: "Endereço ou caminho",
    description: "Descrição",
    open: "Abrir",
    saved: "Alteração salva.",
    loadError: "Não foi possível carregar a memória do projeto.",
    sourceKinds: { document: "Documento", repository: "Repositório GitHub", dataset: "Planilha ou dados", link: "Link" }
  } : {
    title: "PROJECT MEMORY",
    subtitle: "Official context, team, and living references for this mission.",
    referenceProgram: "REFERENCE PROGRAM",
    edition: "3rd edition",
    edital: "Rules",
    milestone: "Next official milestone",
    sources: "TEAM ARTIFACTS",
    sourcesHint: "Repositories, documents, and data produced or adopted by the team.",
    connect: "Connect source",
    edit: "Edit source",
    connectedOn: "Connected on",
    team: "PROJECT TEAM",
    teamHint: "People, roles, and sectors defined for this project.",
    manageTeam: "Manage team",
    continue: "Start conception",
    configure: "Configure project",
    emptyTitle: "Memory starts empty",
    emptyText: "Define the project, reference program, and team to build this memory.",
    emptySources: "No artifacts connected.",
    emptyTeam: "No people selected for this project.",
    loading: "Loading memory",
    save: "Save",
    remove: "Remove",
    cancel: "Cancel",
    kind: "Type",
    label: "Source name",
    url: "Address or path",
    description: "Description",
    open: "Open",
    saved: "Change saved.",
    loadError: "Project memory could not be loaded.",
    sourceKinds: { document: "Document", repository: "GitHub repository", dataset: "Spreadsheet or data", link: "Link" }
  }, [language]);

  const loadMemory = useCallback(async () => {
    setLoading(true);
    setFeedback("");
    try {
      const [teamResponse, artifactResponse] = await Promise.all([
        auth.api<{ members: TeamMember[] }>("/team/members"),
        auth.api<{ artifacts: ConnectedArtifact[] }>("/artifacts")
      ]);
      setMembers(teamResponse.members);
      setArtifacts(artifactResponse.artifacts.filter((artifact) => !artifact.official));
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setLoading(false);
    }
  }, [auth.api, c.loadError]);

  useEffect(() => { void loadMemory(); }, [loadMemory]);

  const canConnect = auth.user?.accessRole !== "advisor";
  const program = referenceProgram(project.context.programId);
  const modality = programModality(program, project.context.modalityId);
  const category = programCategory(modality, project.context.categoryId);
  const projectMembers = useMemo(() => project.context.assignments.map((assignment) => {
    const member = members.find((item) => item.id === assignment.memberId);
    if (!member) return null;
    return {
      member,
      role: project.context.roles.find((role) => role.id === assignment.roleId)?.name || assignment.roleId,
      sector: project.context.sectors.find((sector) => sector.id === assignment.sectorId)?.name || ""
    };
  }).filter((value): value is NonNullable<typeof value> => Boolean(value)), [members, project.context]);

  function canEditArtifact(artifact: ConnectedArtifact) {
    if (!auth.user) return false;
    return artifact.createdBy === auth.user.id || ["owner_admin", "captain", "manager"].includes(auth.user.accessRole);
  }

  function formattedDate(value: string) {
    return new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  }

  async function saveArtifact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const current = dialog === "new" ? null : dialog;
    const data = new FormData(event.currentTarget);
    const payload = {
      kind: String(data.get("kind") || "document") as ArtifactKind,
      label: String(data.get("label") || ""),
      url: String(data.get("url") || ""),
      description: String(data.get("description") || ""),
      tags: current?.tags || []
    };
    try {
      if (current) await auth.api(`/artifacts/${current.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await auth.api("/artifacts", { method: "POST", body: JSON.stringify(payload) });
      setDialog(null);
      await loadMemory();
      setFeedback(c.saved);
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function removeArtifact(artifact: ConnectedArtifact) {
    setBusy(true);
    try {
      await auth.api(`/artifacts/${artifact.id}`, { method: "DELETE" });
      setDialog(null);
      await loadMemory();
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  if (!project.context.configured || !program || !modality || !category) {
    return <div className="pm-shell"><main className="pm-main"><header className="pm-topbar"><div className="top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div></header><section className="pm-unconfigured"><div className="pm-empty-symbol"><BookOpenCheck aria-hidden="true" /></div><span>{c.title}</span><h1>{c.emptyTitle}</h1><p>{c.emptyText}</p><button type="button" onClick={onEditProject}>{c.configure}<ArrowRight aria-hidden="true" /></button></section></main></div>;
  }

  const edital = modality.officialDocuments[0];

  return <div className="pm-shell">
    <main className="pm-main">
      <header className="pm-topbar"><button type="button" onClick={onEditProject}><Settings2 aria-hidden="true" />{c.configure}</button><div className="top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div></header>
      <div className="pm-workspace">
        <header className="pm-heading"><div><span>{project.name}</span><h1>{c.title}</h1><p>{c.subtitle}</p></div></header>

        <section className="pm-program">
          <div className="pm-program-label">{c.referenceProgram}</div>
          <div className="pm-program-logo">{program.logoSrc ? <img src={program.logoSrc} alt={program.shortName} /> : <BookOpenCheck aria-hidden="true" />}</div>
          <div className="pm-program-copy"><strong>{program.name[language]}</strong><span>{c.edition} · {modality.label[language]} · {category.label[language]}</span><small>{program.description[language]}</small></div>
          <div className="pm-program-actions">
            {edital && <a href={edital.url} target="_blank" rel="noreferrer"><BookOpenCheck aria-hidden="true" /><span>{c.edital}</span><ExternalLink aria-hidden="true" /></a>}
            <a className="pm-milestone" href={modality.milestone.url} target="_blank" rel="noreferrer"><CalendarDays aria-hidden="true" /><span><small>{c.milestone}</small><strong>{modality.milestone.date} · {modality.milestone.label[language]}</strong></span><ExternalLink aria-hidden="true" /></a>
          </div>
        </section>

        <section className="pm-band pm-artifacts">
          <header><div><h2>{c.sources}</h2><p>{c.sourcesHint}</p></div>{canConnect && <button type="button" onClick={() => setDialog("new")}><Plus aria-hidden="true" />{c.connect}</button>}</header>
          <div className="pm-horizontal-track">
            {loading && <div className="pm-loading"><LoaderCircle aria-hidden="true" />{c.loading}</div>}
            {!loading && artifacts.length === 0 && <button className="pm-track-empty" type="button" onClick={() => canConnect && setDialog("new")} disabled={!canConnect}><Link2 aria-hidden="true" /><span>{c.emptySources}</span></button>}
            {!loading && artifacts.map((artifact) => <article className="pm-artifact" key={artifact.id}><a href={artifact.url} target="_blank" rel="noreferrer" aria-label={`${c.open}: ${artifact.label}`}><ArtifactIcon artifact={artifact} /><div><small>{artifact.kind === "official" ? c.sourceKinds.link : c.sourceKinds[artifact.kind]}</small><strong>{artifact.label}</strong><span>{c.connectedOn} {formattedDate(artifact.connectedAt)}</span></div><ExternalLink aria-hidden="true" /></a>{canEditArtifact(artifact) && <button type="button" onClick={() => setDialog(artifact)} aria-label={`${c.edit}: ${artifact.label}`}><Pencil aria-hidden="true" /></button>}</article>)}
          </div>
        </section>

        <section className="pm-band pm-team">
          <header><div><h2>{c.team}</h2><p>{c.teamHint}</p></div><button type="button" onClick={onManageTeam}><UsersRound aria-hidden="true" />{c.manageTeam}</button></header>
          <div className="pm-horizontal-track">
            {loading && <div className="pm-loading"><LoaderCircle aria-hidden="true" />{c.loading}</div>}
            {!loading && projectMembers.length === 0 && <button className="pm-track-empty" type="button" onClick={onEditProject}><UsersRound aria-hidden="true" /><span>{c.emptyTeam}</span></button>}
            {!loading && projectMembers.map(({ member, role, sector }) => <button className="pm-member" type="button" key={member.id} onClick={onManageTeam}><span>{memberInitials(member.displayName)}</span><div><strong>{member.displayName}</strong><small>{[role, sector].filter(Boolean).join(" · ")}</small><em>{member.course || member.institution}</em></div><Pencil aria-hidden="true" /></button>)}
          </div>
        </section>

        <footer className="pm-footer"><span role="status">{feedback}</span><button className="primary" type="button" onClick={onContinue}>{c.continue}<ArrowRight aria-hidden="true" /></button></footer>
      </div>
    </main>

    {dialog && <MemoryDialog eyebrow={c.sources} title={dialog === "new" ? c.connect : c.edit} onClose={() => setDialog(null)}><form className="pm-dialog-form" onSubmit={(event) => void saveArtifact(event)}><div className="pm-form-grid"><label><span>{c.kind}</span><select name="kind" defaultValue={dialog === "new" ? "document" : dialog.kind}>{(["document", "repository", "dataset", "link"] as const).map((kind) => <option key={kind} value={kind}>{c.sourceKinds[kind]}</option>)}</select></label><label><span>{c.label}</span><input name="label" required minLength={2} maxLength={140} defaultValue={dialog === "new" ? "" : dialog.label} /></label><label className="wide"><span>{c.url}</span><input name="url" required maxLength={1000} defaultValue={dialog === "new" ? "" : dialog.url} placeholder="https://..." /></label><label className="wide"><span>{c.description}</span><textarea name="description" maxLength={500} rows={3} defaultValue={dialog === "new" ? "" : dialog.description} /></label></div>{feedback && <div className="pm-dialog-error" role="alert">{feedback}</div>}<footer>{dialog !== "new" && <button className="danger" type="button" disabled={busy} onClick={() => void removeArtifact(dialog)}><Trash2 aria-hidden="true" />{c.remove}</button>}<button type="button" onClick={() => setDialog(null)}>{c.cancel}</button><button className="primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="pm-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{c.save}</button></footer></form></MemoryDialog>}
  </div>;
}

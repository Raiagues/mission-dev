import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  KeyRound,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X
} from "lucide-react";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { ApiError, useAuth } from "../lib/auth";
import {
  ACCESS_ROLES,
  MISSION_ROLES,
  TEAM_AREAS,
  memberInitials,
  missionRoleLabel,
  teamAreaLabel
} from "../lib/team";
import type { AccessRole, ArtifactKind, ConnectedArtifact, MemberStatus, MissionRole, TeamAreaId, TeamMember } from "../lib/team";
import type { Language } from "../lib/types";
import type { MissionProject } from "../lib/projectStore";
import "../setup-memory.css";
import "../setup-memory-source-cards.css";
import "../project-memory.css";

type Props = {
  language: Language;
  project: MissionProject;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onProjectChange: (project: MissionProject) => void;
  onContinue: () => void;
  onHome: () => void;
};

type DialogState =
  | { kind: "member"; value: TeamMember | null }
  | { kind: "artifact"; value: ConnectedArtifact | null }
  | null;

const obsatLogoSrc = `${import.meta.env.BASE_URL}brand/obsat-logo.png`;

function ArtifactIcon({ kind }: { kind: ArtifactKind }) {
  if (kind === "official") return <BookOpenCheck aria-hidden="true" />;
  if (kind === "repository") return <GitBranch aria-hidden="true" />;
  if (kind === "dataset") return <FileSpreadsheet aria-hidden="true" />;
  if (kind === "document") return <FileText aria-hidden="true" />;
  return <Link2 aria-hidden="true" />;
}

function MemoryDialog({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="memory-dialog-backdrop" role="presentation" onPointerDown={onClose}>
      <section className="memory-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-dialog-title" onPointerDown={(event) => event.stopPropagation()}>
        <header className="memory-dialog-head">
          <div><span>{eyebrow}</span><h2 id="memory-dialog-title">{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function StudySetupPage({ language, t, onLanguageChange, onContinue }: Props) {
  const auth = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [artifacts, setArtifacts] = useState<ConnectedArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);

  const c = useMemo(() => language === "pt" ? {
    title: "MEMÓRIA DO PROJETO",
    subtitle: "Contexto, equipe e referências conectadas para esta missão.",
    program: "PROGRAMA / COMPETIÇÃO",
    competition: "3ª Olimpíada Brasileira de Satélites",
    edition: "Modalidade prática · OBSAT MCTI",
    deadline: "Próximo marco oficial: 02–05/09/2026",
    connected: "Conectado",
    sources: "FONTES E ARTEFATOS CONECTADOS",
    source: "FONTE DA MISSÃO",
    addSource: "Conectar fonte",
    editSource: "Editar fonte",
    connectedOn: "Conectado em",
    official: "Oficial",
    team: "EQUIPE",
    addPerson: "Adicionar pessoa",
    editPerson: "Editar perfil",
    demo: "Demonstração",
    invited: "Aguardando conta",
    active: "Conta ativa",
    continue: "Começar concepção",
    loading: "Carregando memória do projeto",
    save: "Salvar",
    remove: "Remover",
    cancel: "Cancelar",
    name: "Nome completo",
    email: "E-mail",
    missionRole: "Função na equipe",
    primaryArea: "Área principal",
    secondaryAreas: "Áreas de apoio",
    institution: "Instituição",
    course: "Curso",
    academicStage: "Período ou etapa",
    skills: "Competências",
    skillsHint: "Separe por vírgulas",
    availability: "Horas disponíveis por semana",
    notes: "Notas para o contexto da missão",
    accessRole: "Acesso ao projeto",
    generateInvite: "Gerar convite",
    inviteReady: "Código de convite válido por 7 dias",
    copyInvite: "Copiar código",
    kind: "Tipo",
    label: "Nome da fonte",
    url: "Endereço ou caminho",
    description: "Descrição",
    tags: "Marcadores",
    tagsHint: "Separe por vírgulas",
    open: "Abrir fonte",
    loadError: "Não foi possível carregar a memória do projeto.",
    saved: "Alteração salva.",
    sourceKinds: { official: "Regulamento oficial", document: "Documento", repository: "Repositório", dataset: "Planilha / dados", link: "Link" }
  } : {
    title: "PROJECT MEMORY",
    subtitle: "Context, team, and connected references for this mission.",
    program: "PROGRAM / COMPETITION",
    competition: "3rd Brazilian Satellite Olympiad",
    edition: "Practical modality · OBSAT MCTI",
    deadline: "Next official milestone: 02–05/09/2026",
    connected: "Connected",
    sources: "CONNECTED SOURCES AND ARTIFACTS",
    source: "MISSION SOURCE",
    addSource: "Connect source",
    editSource: "Edit source",
    connectedOn: "Connected on",
    official: "Official",
    team: "TEAM",
    addPerson: "Add person",
    editPerson: "Edit profile",
    demo: "Demo profile",
    invited: "Awaiting account",
    active: "Active account",
    continue: "Start conception",
    loading: "Loading project memory",
    save: "Save",
    remove: "Remove",
    cancel: "Cancel",
    name: "Full name",
    email: "Email",
    missionRole: "Team role",
    primaryArea: "Primary area",
    secondaryAreas: "Supporting areas",
    institution: "Institution",
    course: "Degree or course",
    academicStage: "Academic stage",
    skills: "Skills",
    skillsHint: "Separate with commas",
    availability: "Available hours per week",
    notes: "Mission context notes",
    accessRole: "Project access",
    generateInvite: "Create invitation",
    inviteReady: "Invitation code valid for 7 days",
    copyInvite: "Copy code",
    kind: "Type",
    label: "Source name",
    url: "Address or path",
    description: "Description",
    tags: "Tags",
    tagsHint: "Separate with commas",
    open: "Open source",
    loadError: "Project memory could not be loaded.",
    saved: "Change saved.",
    sourceKinds: { official: "Official regulation", document: "Document", repository: "Repository", dataset: "Spreadsheet / data", link: "Link" }
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
      setArtifacts(artifactResponse.artifacts);
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setLoading(false);
    }
  }, [auth.api, c.loadError]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  const canManageTeam = Boolean(auth.user && ["owner_admin", "captain", "manager"].includes(auth.user.accessRole));
  const canRemoveMember = Boolean(auth.user && ["owner_admin", "captain"].includes(auth.user.accessRole));
  const canConnectSource = auth.user?.accessRole !== "advisor";

  function canEditMember(member: TeamMember) {
    return canManageTeam || member.id === auth.user?.memberId;
  }

  function canEditArtifact(artifact: ConnectedArtifact) {
    if (!auth.user) return false;
    if (artifact.official) return auth.user.accessRole === "owner_admin";
    return artifact.createdBy === auth.user.id || ["owner_admin", "captain", "manager"].includes(auth.user.accessRole);
  }

  async function saveMember(event: React.FormEvent<HTMLFormElement>, current: TeamMember | null) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    const selectedAccessRole = String(data.get("accessRole") || "") as AccessRole | "";
    const payload = {
      displayName: String(data.get("displayName") || ""),
      email: String(data.get("email") || ""),
      missionRole: String(data.get("missionRole") || "member") as MissionRole,
      primaryArea: String(data.get("primaryArea") || "systems") as TeamAreaId,
      secondaryAreas: data.getAll("secondaryAreas").map(String) as TeamAreaId[],
      institution: String(data.get("institution") || ""),
      course: String(data.get("course") || ""),
      academicStage: String(data.get("academicStage") || ""),
      skills: String(data.get("skills") || "").split(",").map((item) => item.trim()).filter(Boolean),
      availabilityHours: Number(data.get("availabilityHours") || 0),
      notes: String(data.get("notes") || ""),
      accountStatus: (current?.accountStatus || "invited") as MemberStatus,
      ...(selectedAccessRole ? { accessRole: selectedAccessRole } : {})
    };
    try {
      if (current) await auth.api(`/team/members/${current.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else {
        const response = await auth.api<{ invitationCode: string }>("/team/members", { method: "POST", body: JSON.stringify(payload) });
        setInvitationCode(response.invitationCode);
      }
      setDialog(null);
      await loadMemory();
      setFeedback(current ? c.saved : "");
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: TeamMember) {
    setBusy(true);
    setFeedback("");
    try {
      await auth.api(`/team/members/${member.id}`, { method: "DELETE" });
      setDialog(null);
      await loadMemory();
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function generateInvitation(member: TeamMember) {
    setBusy(true);
    setFeedback("");
    try {
      const response = await auth.api<{ invitationCode: string }>(`/team/members/${member.id}/invitation`, { method: "POST" });
      setInvitationCode(response.invitationCode);
      setDialog(null);
      await loadMemory();
      setFeedback("");
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function saveArtifact(event: React.FormEvent<HTMLFormElement>, current: ConnectedArtifact | null) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    const payload = {
      kind: String(data.get("kind") || "document") as ArtifactKind,
      label: String(data.get("label") || ""),
      url: String(data.get("url") || ""),
      description: String(data.get("description") || ""),
      tags: String(data.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean)
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
    setFeedback("");
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

  function statusLabel(status: MemberStatus) {
    if (status === "active") return c.active;
    if (status === "invited") return c.invited;
    return c.demo;
  }

  function formattedDate(value: string) {
    return new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
  }

  return (
    <div className="setup-shell setup-shell-fixed memory-shell project-memory-shell">
      <main className="setup-main setup-main-fixed memory-main project-memory-main">
        <header className="setup-topbar memory-topbar">
          <div className="top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
        </header>

        <div className="memory-screen memory-reference-layout project-memory-layout">
          <div className="memory-heading memory-reference-heading project-memory-heading">
            <h1>{c.title}</h1>
            <p>{c.subtitle}</p>
          </div>

          <section className="memory-program-card project-program-card">
            <div className="memory-program-label">{c.program}</div>
            <div className="memory-program-row">
              <div className="memory-program-badge"><img src={obsatLogoSrc} alt="OBSAT" /></div>
              <div className="memory-program-copy">
                <strong>{c.competition}</strong>
                <span className="project-program-edition">{c.edition}</span>
                <div className="memory-program-meta"><span><CalendarDays aria-hidden="true" />{c.deadline}</span></div>
              </div>
              <a className="memory-program-connected" href="https://wiki.obsat.org.br/books/modalidade-pratica" target="_blank" rel="noreferrer"><i><Check aria-hidden="true" /></i>{c.connected}<ExternalLink aria-hidden="true" /></a>
            </div>
          </section>

          <section className="memory-reference-section project-memory-section">
            <header className="project-section-head">
              <div className="memory-reference-label">{c.sources}</div>
              {canConnectSource && <button type="button" onClick={() => setDialog({ kind: "artifact", value: null })}><Plus aria-hidden="true" />{c.addSource}</button>}
            </header>
            {loading ? <div className="project-memory-loading"><LoaderCircle aria-hidden="true" />{c.loading}</div> : (
              <div className="memory-reference-sources-grid project-sources-grid">
                {artifacts.map((artifact) => (
                  <article className={`memory-reference-source-card project-source-card ${artifact.official ? "official" : ""}`} key={artifact.id}>
                    <a className="project-source-link" href={artifact.url} target="_blank" rel="noreferrer" aria-label={`${c.open}: ${artifact.label}`}>
                      <div className={`memory-reference-source-icon ${artifact.kind}`}><ArtifactIcon kind={artifact.kind} /></div>
                      <div className="memory-reference-source-copy">
                        <small>{artifact.official ? c.official : c.sourceKinds[artifact.kind]}</small>
                        <strong>{artifact.label}</strong>
                        <span><Link2 aria-hidden="true" />{c.connectedOn} {formattedDate(artifact.connectedAt)}</span>
                      </div>
                    </a>
                    {canEditArtifact(artifact) && <button className="project-source-edit" type="button" onClick={() => setDialog({ kind: "artifact", value: artifact })} aria-label={`${c.editSource}: ${artifact.label}`}><Pencil aria-hidden="true" /></button>}
                    <div className="memory-reference-source-check"><Check aria-hidden="true" /></div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="memory-reference-section memory-reference-team-section project-memory-section">
            <header className="project-section-head">
              <div className="memory-reference-label">{c.team}</div>
              {canManageTeam && <button type="button" onClick={() => setDialog({ kind: "member", value: null })}><UserRoundPlus aria-hidden="true" />{c.addPerson}</button>}
            </header>
            {loading ? <div className="project-memory-loading"><LoaderCircle aria-hidden="true" />{c.loading}</div> : (
              <div className="project-team-grid">
                {members.map((member) => (
                  <button className="project-member-card" type="button" key={member.id} onClick={() => canEditMember(member) && setDialog({ kind: "member", value: member })} disabled={!canEditMember(member)}>
                    <div className="memory-reference-avatar">{memberInitials(member.displayName)}</div>
                    <div className="project-member-copy">
                      <strong>{member.displayName}</strong>
                      <span>{missionRoleLabel(member.missionRole, language)} · {teamAreaLabel(member.primaryArea, language)}</span>
                      <small className={`project-member-status ${member.accountStatus}`}><i />{statusLabel(member.accountStatus)}</small>
                    </div>
                    {canEditMember(member) && <Pencil className="project-member-edit" aria-hidden="true" />}
                  </button>
                ))}
                {canManageTeam && <button className="project-member-add" type="button" onClick={() => setDialog({ kind: "member", value: null })}><UsersRound aria-hidden="true" /><span>{c.addPerson}</span><Plus aria-hidden="true" /></button>}
              </div>
            )}
          </section>

          {feedback && <div className="project-memory-feedback" role="status">{feedback}</div>}
          {invitationCode && <div className="project-invitation" role="status"><KeyRound aria-hidden="true" /><div><span>{c.inviteReady}</span><strong>{invitationCode}</strong></div><button type="button" onClick={() => void navigator.clipboard.writeText(invitationCode)} aria-label={c.copyInvite}><Copy aria-hidden="true" /></button><button type="button" onClick={() => setInvitationCode("")} aria-label={c.cancel}><X aria-hidden="true" /></button></div>}

          <div className="memory-next-step memory-reference-next-step project-memory-next-step">
            <button className="technical-button primary memory-primary" onClick={onContinue}>{c.continue}<span aria-hidden="true">→</span></button>
          </div>
        </div>
      </main>

      {dialog?.kind === "member" && (
        <MemoryDialog eyebrow={c.team} title={dialog.value ? c.editPerson : c.addPerson} onClose={() => setDialog(null)}>
          <form className="memory-dialog-form" onSubmit={(event) => void saveMember(event, dialog.value)}>
            <div className="memory-form-grid">
              <label><span>{c.name}</span><input name="displayName" required minLength={2} maxLength={100} defaultValue={dialog.value?.displayName || ""} /></label>
              <label><span>{c.email}</span><input name="email" type="email" required readOnly={Boolean(dialog.value?.accountId)} maxLength={254} defaultValue={dialog.value?.email || ""} /></label>
              <label><span>{c.missionRole}</span><select name="missionRole" defaultValue={dialog.value?.missionRole || "member"}>{MISSION_ROLES.map((role) => <option key={role.id} value={role.id}>{role[language]}</option>)}</select></label>
              <label><span>{c.primaryArea}</span><select name="primaryArea" defaultValue={dialog.value?.primaryArea || "systems"}>{TEAM_AREAS.map((area) => <option key={area.id} value={area.id}>{area[language]}</option>)}</select></label>
              <label><span>{c.institution}</span><input name="institution" required maxLength={160} defaultValue={dialog.value?.institution || ""} /></label>
              <label><span>{c.course}</span><input name="course" maxLength={120} defaultValue={dialog.value?.course || ""} /></label>
              <label><span>{c.academicStage}</span><input name="academicStage" maxLength={80} defaultValue={dialog.value?.academicStage || ""} /></label>
              <label><span>{c.availability}</span><input name="availabilityHours" type="number" min={0} max={80} defaultValue={dialog.value?.availabilityHours ?? 8} /></label>
              {dialog.value?.accountId && auth.user?.accessRole === "owner_admin" && <label><span>{c.accessRole}</span><select name="accessRole" defaultValue={dialog.value.accessRole || "member"}>{ACCESS_ROLES.map((role) => <option key={role.id} value={role.id}>{role[language]}</option>)}</select></label>}
              <label className="memory-form-wide"><span>{c.skills}</span><input name="skills" maxLength={1000} defaultValue={dialog.value?.skills.join(", ") || ""} placeholder={c.skillsHint} /></label>
              <fieldset className="memory-form-wide memory-area-fieldset"><legend>{c.secondaryAreas}</legend><div>{TEAM_AREAS.map((area) => <label key={area.id}><input type="checkbox" name="secondaryAreas" value={area.id} defaultChecked={dialog.value?.secondaryAreas.includes(area.id)} /><span>{area[language]}</span></label>)}</div></fieldset>
              <label className="memory-form-wide"><span>{c.notes}</span><textarea name="notes" maxLength={800} rows={3} defaultValue={dialog.value?.notes || ""} /></label>
            </div>
            {feedback && <div className="memory-dialog-error" role="alert">{feedback}</div>}
            <footer className="memory-dialog-actions">
              {dialog.value && canRemoveMember && !dialog.value.accountId && <button className="danger" type="button" disabled={busy} onClick={() => void removeMember(dialog.value!)}><Trash2 aria-hidden="true" />{c.remove}</button>}
              {dialog.value && canRemoveMember && !dialog.value.accountId && <button type="button" disabled={busy} onClick={() => void generateInvitation(dialog.value!)}><KeyRound aria-hidden="true" />{c.generateInvite}</button>}
              <button type="button" onClick={() => setDialog(null)}>{c.cancel}</button>
              <button className="primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="project-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{c.save}</button>
            </footer>
          </form>
        </MemoryDialog>
      )}

      {dialog?.kind === "artifact" && (
        <MemoryDialog eyebrow={c.sources} title={dialog.value ? c.editSource : c.addSource} onClose={() => setDialog(null)}>
          <form className="memory-dialog-form" onSubmit={(event) => void saveArtifact(event, dialog.value)}>
            <div className="memory-form-grid">
              <label><span>{c.kind}</span><select name="kind" defaultValue={dialog.value?.kind || "document"} disabled={dialog.value?.official}>{(["document", "repository", "dataset", "link", ...(dialog.value?.official ? ["official"] : [])] as ArtifactKind[]).map((kind) => <option key={kind} value={kind}>{c.sourceKinds[kind]}</option>)}</select>{dialog.value?.official && <input type="hidden" name="kind" value="official" />}</label>
              <label><span>{c.label}</span><input name="label" required minLength={2} maxLength={140} defaultValue={dialog.value?.label || ""} /></label>
              <label className="memory-form-wide"><span>{c.url}</span><input name="url" required maxLength={1000} defaultValue={dialog.value?.url || ""} placeholder="https://..." /></label>
              <label className="memory-form-wide"><span>{c.description}</span><textarea name="description" maxLength={500} rows={3} defaultValue={dialog.value?.description || ""} /></label>
              <label className="memory-form-wide"><span>{c.tags}</span><input name="tags" maxLength={600} defaultValue={dialog.value?.tags.join(", ") || ""} placeholder={c.tagsHint} /></label>
            </div>
            {feedback && <div className="memory-dialog-error" role="alert">{feedback}</div>}
            <footer className="memory-dialog-actions">
              {dialog.value && !dialog.value.official && <button className="danger" type="button" disabled={busy} onClick={() => void removeArtifact(dialog.value!)}><Trash2 aria-hidden="true" />{c.remove}</button>}
              <button type="button" onClick={() => setDialog(null)}>{c.cancel}</button>
              <button className="primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="project-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{c.save}</button>
            </footer>
          </form>
        </MemoryDialog>
      )}
    </div>
  );
}

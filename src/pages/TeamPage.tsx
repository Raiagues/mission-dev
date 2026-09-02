import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clipboard,
  GitFork,
  List,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserRoundPlus,
  UsersRound,
  X
} from "lucide-react";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { ApiError, useAuth } from "../lib/auth";
import type { MissionProject } from "../lib/projectStore";
import { memberInitials } from "../lib/team";
import type { TeamMember } from "../lib/team";
import type { Language } from "../lib/types";
import "../team-page.css";

type Props = {
  language: Language;
  project: MissionProject;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onBack: () => void;
  onProjectSetup: () => void;
};

type TeamView = "list" | "chart";
type Invitation = { email: string; code: string; url: string };

function roleName(project: MissionProject, roleId: string, fallback: string) {
  return project.context.roles.find((role) => role.id === roleId)?.name || fallback;
}

function sectorName(project: MissionProject, sectorId: string) {
  return project.context.sectors.find((sector) => sector.id === sectorId)?.name || "";
}

function invitationUrl(email: string, code: string) {
  const url = new URL(window.location.href);
  url.hash = `#/join?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
  return url.toString();
}

function ProfileDialog({ member, language, busy, canRemove, onSave, onRemove, onClose }: {
  member: TeamMember | null;
  language: Language;
  busy: boolean;
  canRemove: boolean;
  onSave: (event: React.FormEvent<HTMLFormElement>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const c = language === "pt" ? {
    eyebrow: member ? "PERFIL" : "CONVITE",
    title: member ? "Editar pessoa" : "Convidar para a equipe",
    inviteNote: "O e-mail identifica a pessoa com segurança. Ao aceitar, os dados acadêmicos virão do perfil dela.",
    name: "Nome",
    nameHint: "Opcional no convite",
    email: "E-mail",
    university: "Universidade",
    course: "Curso",
    semester: "Semestre",
    availability: "Horas disponíveis por semana",
    cancel: "Cancelar",
    save: member ? "Salvar perfil" : "Criar convite",
    remove: "Remover da equipe"
  } : {
    eyebrow: member ? "PROFILE" : "INVITATION",
    title: member ? "Edit person" : "Invite to the team",
    inviteNote: "Email identifies the person reliably. Academic details come from their profile after acceptance.",
    name: "Name",
    nameHint: "Optional for an invitation",
    email: "Email",
    university: "University",
    course: "Course",
    semester: "Semester",
    availability: "Available hours per week",
    cancel: "Cancel",
    save: member ? "Save profile" : "Create invitation",
    remove: "Remove from team"
  };

  return <div className="team-dialog-backdrop" role="presentation" onPointerDown={onClose}>
    <section className="team-dialog" role="dialog" aria-modal="true" aria-labelledby="team-dialog-title" onPointerDown={(event) => event.stopPropagation()}>
      <header><div><span>{c.eyebrow}</span><h2 id="team-dialog-title">{c.title}</h2></div><button type="button" onClick={onClose} aria-label={c.cancel}><X aria-hidden="true" /></button></header>
      <form onSubmit={onSave}>
        {!member && <p className="team-invite-note"><Mail aria-hidden="true" />{c.inviteNote}</p>}
        <div className="team-form-grid">
          <label><span>{c.name}</span><input name="displayName" minLength={2} maxLength={100} required={Boolean(member)} defaultValue={member?.displayName || ""} placeholder={!member ? c.nameHint : ""} /></label>
          <label><span>{c.email}</span><input name="email" type="email" required maxLength={254} readOnly={Boolean(member?.accountId)} defaultValue={member?.email || ""} /></label>
          {member && <label><span>{c.university}</span><input name="institution" required maxLength={160} defaultValue={member.institution || ""} /></label>}
          {member && <label><span>{c.course}</span><input name="course" maxLength={120} defaultValue={member.course || ""} /></label>}
          {member && <label><span>{c.semester}</span><input name="academicStage" maxLength={80} defaultValue={member.academicStage || ""} /></label>}
          {member && <label><span>{c.availability}</span><input name="availabilityHours" type="number" min={0} max={80} defaultValue={member.availabilityHours ?? 0} /></label>}
        </div>
        <footer>
          {member && canRemove && !member.accountId && <button className="danger" type="button" onClick={onRemove} disabled={busy}><Trash2 aria-hidden="true" />{c.remove}</button>}
          <button type="button" onClick={onClose}>{c.cancel}</button>
          <button className="primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="team-spin" aria-hidden="true" /> : member ? <Check aria-hidden="true" /> : <UserRoundPlus aria-hidden="true" />}{c.save}</button>
        </footer>
      </form>
    </section>
  </div>;
}

export function TeamPage({ language, project, t, onLanguageChange, onBack, onProjectSetup }: Props) {
  const auth = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [view, setView] = useState<TeamView>("list");
  const [dialogMember, setDialogMember] = useState<TeamMember | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [invitation, setInvitation] = useState<Invitation | null>(null);

  const c = useMemo(() => language === "pt" ? {
    eyebrow: "EQUIPE",
    title: project.context.teamName || "Equipe do projeto",
    subtitle: "Perfis acadêmicos pertencem às pessoas; cargos e setores pertencem a cada projeto.",
    back: "Voltar ao projeto",
    invite: "Convidar pessoa",
    list: "Lista",
    chart: "Hierarquia",
    person: "Pessoa",
    academic: "Formação",
    availability: "Disponibilidade",
    projectRole: "Papel neste projeto",
    status: "Conta",
    active: "Ativa",
    waiting: "Convite pendente",
    notAssigned: "Fora deste projeto",
    hours: "h/semana",
    empty: "Ainda não há pessoas nesta equipe.",
    configure: "Configurar estrutura do projeto",
    chartEmpty: "Selecione pessoas e atribua cargos na configuração do projeto.",
    invitationReady: "Convite pronto",
    invitationText: "Abra seu e-mail para enviar o link de acesso. O código expira em 7 dias.",
    sendEmail: "Enviar por e-mail",
    copy: "Copiar link",
    copied: "Link copiado.",
    loadError: "Não foi possível carregar a equipe."
  } : {
    eyebrow: "TEAM",
    title: project.context.teamName || "Project team",
    subtitle: "Academic profiles belong to people; roles and sectors belong to each project.",
    back: "Back to project",
    invite: "Invite person",
    list: "List",
    chart: "Hierarchy",
    person: "Person",
    academic: "Education",
    availability: "Availability",
    projectRole: "Role in this project",
    status: "Account",
    active: "Active",
    waiting: "Invitation pending",
    notAssigned: "Not in this project",
    hours: "h/week",
    empty: "There are no people on this team yet.",
    configure: "Configure project structure",
    chartEmpty: "Select people and assign roles in project setup.",
    invitationReady: "Invitation ready",
    invitationText: "Open your email client to send the access link. The code expires in 7 days.",
    sendEmail: "Send by email",
    copy: "Copy link",
    copied: "Link copied.",
    loadError: "The team could not be loaded."
  }, [language, project.context.teamName]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await auth.api<{ members: TeamMember[] }>("/team/members");
      setMembers(response.members);
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setLoading(false);
    }
  }, [auth.api, c.loadError]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  const ownProjectRole = project.context.assignments.find((assignment) => assignment.memberId === auth.user?.memberId)?.roleId;
  const canManage = Boolean(auth.user && (["owner_admin", "captain", "manager"].includes(auth.user.accessRole) || ["captain", "manager"].includes(ownProjectRole || "")));
  const canRemove = Boolean(auth.user && (["owner_admin", "captain"].includes(auth.user.accessRole) || ownProjectRole === "captain"));
  const memberRows = useMemo(() => members.map((member) => {
    const assignment = project.context.assignments.find((item) => item.memberId === member.id);
    return {
      member,
      assignment,
      role: assignment ? roleName(project, assignment.roleId, c.notAssigned) : c.notAssigned,
      sector: assignment ? sectorName(project, assignment.sectorId) : ""
    };
  }), [members, project, c.notAssigned]);
  const assignedRows = memberRows.filter((row) => row.assignment);
  const leadRows = assignedRows.filter((row) => ["captain", "advisor"].includes(row.assignment?.roleId || ""));
  const sectorGroups = project.context.sectors.map((sector) => ({ sector, rows: assignedRows.filter((row) => row.assignment?.sectorId === sector.id) })).filter((group) => group.rows.length > 0);
  const ungroupedRows = assignedRows.filter((row) => !row.assignment?.sectorId && !leadRows.some((lead) => lead.member.id === row.member.id));

  function canEdit(member: TeamMember) {
    return canManage || member.id === auth.user?.memberId;
  }

  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const displayName = String(data.get("displayName") || "").trim() || email.split("@")[0] || "Novo membro";
    try {
      if (dialogMember) {
        await auth.api(`/team/members/${dialogMember.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            displayName,
            email,
            institution: String(data.get("institution") || ""),
            course: String(data.get("course") || ""),
            academicStage: String(data.get("academicStage") || ""),
            availabilityHours: Number(data.get("availabilityHours") || 0)
          })
        });
      } else {
        const response = await auth.api<{ invitationCode: string }>("/team/members", {
          method: "POST",
          body: JSON.stringify({ displayName, email })
        });
        setInvitation({ email, code: response.invitationCode, url: invitationUrl(email, response.invitationCode) });
      }
      setDialogMember(undefined);
      await loadMembers();
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember() {
    if (!dialogMember) return;
    setBusy(true);
    try {
      await auth.api(`/team/members/${dialogMember.id}`, { method: "DELETE" });
      setDialogMember(undefined);
      await loadMembers();
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  function openInvitationEmail() {
    if (!invitation) return;
    const subject = language === "pt" ? "Convite para a equipe no Norte" : "Invitation to the team on Norte";
    const body = language === "pt"
      ? `Você foi convidado(a) para nossa equipe no Norte.\n\nAcesse: ${invitation.url}\n\nCódigo: ${invitation.code}`
      : `You were invited to our team on Norte.\n\nOpen: ${invitation.url}\n\nCode: ${invitation.code}`;
    window.location.href = `mailto:${encodeURIComponent(invitation.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return <div className="team-page-shell">
    <main className="team-page-main">
      <header className="team-page-topbar"><button type="button" onClick={onBack}><ArrowLeft aria-hidden="true" />{c.back}</button><div className="top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div></header>
      <div className="team-page-workspace">
        <header className="team-page-heading"><div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.subtitle}</p></div><div className="team-page-actions"><div className="team-view-switch"><button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")} title={c.list}><List aria-hidden="true" /><span>{c.list}</span></button><button className={view === "chart" ? "active" : ""} type="button" onClick={() => setView("chart")} title={c.chart}><GitFork aria-hidden="true" /><span>{c.chart}</span></button></div>{canManage && <button className="team-invite-button" type="button" onClick={() => setDialogMember(null)}><UserRoundPlus aria-hidden="true" />{c.invite}</button>}</div></header>

        <section className="team-page-surface">
          {loading && <div className="team-page-loading"><LoaderCircle aria-hidden="true" /></div>}
          {!loading && view === "list" && <div className="team-table-wrap"><div className="team-table-head"><span>{c.person}</span><span>{c.academic}</span><span>{c.availability}</span><span>{c.projectRole}</span><span>{c.status}</span><span /></div>{memberRows.map(({ member, role, sector }) => <div className="team-table-row" key={member.id}><div className="team-person"><span>{memberInitials(member.displayName)}</span><div><strong>{member.displayName}</strong><small>{member.email}</small></div></div><div><strong>{member.course || "—"}</strong><small>{[member.institution, member.academicStage].filter(Boolean).join(" · ") || "—"}</small></div><div><strong>{member.availabilityHours ?? 0} {c.hours}</strong></div><div><strong>{role}</strong><small>{sector}</small></div><div><span className={`team-account-status ${member.accountStatus}`}>{member.accountStatus === "active" ? c.active : c.waiting}</span></div><button type="button" disabled={!canEdit(member)} onClick={() => setDialogMember(member)} aria-label={`${language === "pt" ? "Editar" : "Edit"} ${member.displayName}`}><Pencil aria-hidden="true" /></button></div>)}{memberRows.length === 0 && <div className="team-page-empty"><UsersRound aria-hidden="true" /><span>{c.empty}</span>{canManage && <button type="button" onClick={() => setDialogMember(null)}><Plus aria-hidden="true" />{c.invite}</button>}</div>}</div>}

          {!loading && view === "chart" && <div className="team-org-chart">
            {assignedRows.length === 0 ? <div className="team-page-empty"><GitFork aria-hidden="true" /><span>{c.chartEmpty}</span><button type="button" onClick={onProjectSetup}>{c.configure}</button></div> : <>
              <div className="org-level org-leads">{leadRows.map((row) => <article key={row.member.id}><span>{memberInitials(row.member.displayName)}</span><strong>{row.member.displayName}</strong><small>{row.role}</small></article>)}</div>
              {(sectorGroups.length > 0 || ungroupedRows.length > 0) && <div className="org-stem" />}
              <div className="org-groups">{sectorGroups.map(({ sector, rows }) => <section key={sector.id}><h2>{sector.name}</h2><div>{rows.filter((row) => !leadRows.some((lead) => lead.member.id === row.member.id)).map((row) => <article key={row.member.id}><span>{memberInitials(row.member.displayName)}</span><strong>{row.member.displayName}</strong><small>{row.role}</small></article>)}</div></section>)}{ungroupedRows.length > 0 && <section><h2>{language === "pt" ? "Sem setor" : "No sector"}</h2><div>{ungroupedRows.map((row) => <article key={row.member.id}><span>{memberInitials(row.member.displayName)}</span><strong>{row.member.displayName}</strong><small>{row.role}</small></article>)}</div></section>}</div>
            </>}
          </div>}
        </section>
        <footer className="team-page-footer"><span role="status">{feedback}</span><button type="button" onClick={onProjectSetup}>{c.configure}</button></footer>
      </div>
    </main>

    {dialogMember !== undefined && <ProfileDialog member={dialogMember} language={language} busy={busy} canRemove={canRemove} onSave={(event) => void saveMember(event)} onRemove={() => void removeMember()} onClose={() => setDialogMember(undefined)} />}
    {invitation && <div className="invitation-panel" role="dialog" aria-modal="true" aria-labelledby="invitation-title"><header><div><span>{c.invitationReady}</span><h2 id="invitation-title">{invitation.email}</h2></div><button type="button" onClick={() => setInvitation(null)} aria-label="Fechar"><X aria-hidden="true" /></button></header><p>{c.invitationText}</p><code>{invitation.code}</code><footer><button type="button" onClick={() => { void navigator.clipboard.writeText(invitation.url); setFeedback(c.copied); }}><Clipboard aria-hidden="true" />{c.copy}</button><button className="primary" type="button" onClick={openInvitationEmail}><Send aria-hidden="true" />{c.sendEmail}</button></footer></div>}
  </div>;
}

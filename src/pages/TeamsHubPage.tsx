import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FilePlus2,
  FolderGit2,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Send,
  UsersRound,
  X
} from "lucide-react";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { ApiError, useAuth } from "../lib/auth";
import { memberInitials } from "../lib/team";
import type { ArtifactKind, ConnectedArtifact, TeamMember, TeamRecord } from "../lib/team";
import type { Language } from "../lib/types";
import "../teams-hub.css";

type Props = {
  language: Language;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onBack: () => void;
};

type Dialog = "team" | "member" | "artifact" | null;

export function TeamsHubPage({ language, t, onLanguageChange, onBack }: Props) {
  const auth = useAuth();
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [artifacts, setArtifacts] = useState<ConnectedArtifact[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const c = language === "pt" ? {
    eyebrow: "COLABORAÇÃO",
    title: "Equipes",
    subtitle: "Crie uma equipe, encontre as que estão disponíveis e reúna pessoas e referências permanentes.",
    back: "Voltar ao início",
    create: "Criar equipe",
    mine: "MINHAS EQUIPES",
    discover: "OUTRAS EQUIPES",
    empty: "Nenhuma equipe nesta seção.",
    members: "MEMBROS",
    artifacts: "ARTEFATOS DA EQUIPE",
    addMember: "Adicionar pessoa",
    addArtifact: "Adicionar artefato",
    request: "Solicitar entrada",
    requested: "Solicitação enviada",
    member: "pessoa",
    memberCount: "pessoas",
    artifactCount: "referências",
    newTeam: "Nova equipe",
    teamName: "Nome da equipe",
    description: "Descrição",
    personName: "Nome da pessoa",
    personEmail: "E-mail",
    inviteHint: "A pessoa poderá criar a conta normalmente com este e-mail; o perfil será associado à equipe.",
    artifactName: "Nome do artefato",
    artifactUrl: "Link ou caminho",
    artifactType: "Tipo",
    save: "Salvar",
    cancel: "Cancelar",
    created: "Equipe criada.",
    invited: "Pessoa adicionada à equipe.",
    sourceAdded: "Artefato adicionado à equipe.",
    loadError: "Não foi possível carregar as equipes.",
    editTeam: "Editar equipe",
    joinRequests: "SOLICITAÇÕES DE ENTRADA",
    approve: "Aprovar"
  } : {
    eyebrow: "COLLABORATION",
    title: "Teams",
    subtitle: "Create a team, discover available groups, and keep people and long-lived references together.",
    back: "Back home",
    create: "Create team",
    mine: "MY TEAMS",
    discover: "OTHER TEAMS",
    empty: "No teams in this section.",
    members: "MEMBERS",
    artifacts: "TEAM ARTIFACTS",
    addMember: "Add person",
    addArtifact: "Add artifact",
    request: "Request to join",
    requested: "Request sent",
    member: "person",
    memberCount: "people",
    artifactCount: "references",
    newTeam: "New team",
    teamName: "Team name",
    description: "Description",
    personName: "Person name",
    personEmail: "Email",
    inviteHint: "The person can create an account normally with this email; their profile will be linked to the team.",
    artifactName: "Artifact name",
    artifactUrl: "Link or path",
    artifactType: "Type",
    save: "Save",
    cancel: "Cancel",
    created: "Team created.",
    invited: "Person added to the team.",
    sourceAdded: "Artifact added to the team.",
    loadError: "Teams could not be loaded.",
    editTeam: "Edit team",
    joinRequests: "JOIN REQUESTS",
    approve: "Approve"
  };

  const load = useCallback(async () => {
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
      setSelectedId((current) => current && teamResponse.teams.some((team) => team.id === current) ? current : teamResponse.teams.find((team) => team.membership === "member")?.id || teamResponse.teams[0]?.id || "");
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setLoading(false);
    }
  }, [auth.api, c.loadError]);

  useEffect(() => { void load(); }, [load]);

  const selected = teams.find((team) => team.id === selectedId) ?? null;
  const myTeams = teams.filter((team) => team.membership === "member");
  const otherTeams = teams.filter((team) => team.membership !== "member");
  const selectedMembers = useMemo(() => selected ? selected.memberIds.map((id) => members.find((member) => member.id === id)).filter((member): member is TeamMember => Boolean(member)) : [], [members, selected]);
  const selectedArtifacts = useMemo(() => selected ? selected.artifactIds.map((id) => artifacts.find((artifact) => artifact.id === id)).filter((artifact): artifact is ConnectedArtifact => Boolean(artifact)) : [], [artifacts, selected]);
  const joinRequests = useMemo(() => selected ? selected.joinRequests.map((id) => members.find((member) => member.id === id)).filter((member): member is TeamMember => Boolean(member)) : [], [members, selected]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setFeedback("");
    try {
      if (dialog === "team") {
        const response = await auth.api<{ team: TeamRecord }>("/teams", { method: "POST", body: JSON.stringify({ name: String(data.get("name") || ""), description: String(data.get("description") || "") }) });
        setSelectedId(response.team.id);
        setFeedback(c.created);
      } else if (dialog === "member" && selected) {
        await auth.api("/team/members", { method: "POST", body: JSON.stringify({ teamId: selected.id, displayName: String(data.get("name") || ""), email: String(data.get("email") || ""), missionRole: "member", primaryArea: "systems", secondaryAreas: [], institution: "", course: "", academicStage: "", skills: [], availabilityHours: 0, notes: "" }) });
        setFeedback(c.invited);
      } else if (dialog === "artifact" && selected) {
        await auth.api("/artifacts", { method: "POST", body: JSON.stringify({ kind: String(data.get("kind") || "document") as ArtifactKind, label: String(data.get("name") || ""), url: String(data.get("url") || ""), description: String(data.get("description") || ""), tags: [], scope: "team", ownerId: selected.id }) });
        setFeedback(c.sourceAdded);
      }
      setDialog(null);
      await load();
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function requestJoin(team: TeamRecord) {
    setBusy(true);
    try {
      await auth.api(`/teams/${team.id}/join-requests`, { method: "POST" });
      await load();
      setSelectedId(team.id);
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  async function approve(memberId: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await auth.api(`/teams/${selected.id}/members`, { method: "POST", body: JSON.stringify({ memberId }) });
      await load();
    } catch (reason) {
      setFeedback(reason instanceof ApiError ? reason.message : c.loadError);
    } finally {
      setBusy(false);
    }
  }

  function TeamButton({ team }: { team: TeamRecord }) {
    return <button type="button" className={team.id === selectedId ? "active" : ""} onClick={() => setSelectedId(team.id)}>
      <span><UsersRound aria-hidden="true" /></span>
      <span><strong>{team.name}</strong><small>{team.memberIds.length} {team.memberIds.length === 1 ? c.member : c.memberCount} · {team.artifactIds.length} {c.artifactCount}</small></span>
      <ArrowRight aria-hidden="true" />
    </button>;
  }

  return <div className="teams-hub-shell">
    <header className="teams-hub-topbar">
      <button type="button" onClick={onBack}><ArrowLeft aria-hidden="true" />{c.back}</button>
      <div><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
    </header>
    <main className="teams-hub-main">
      <header className="teams-hub-heading"><div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.subtitle}</p></div><button type="button" onClick={() => setDialog("team")}><Plus aria-hidden="true" />{c.create}</button></header>
      {feedback && <div className="teams-hub-feedback" role="status">{feedback}</div>}
      <div className="teams-hub-layout">
        <aside className="teams-hub-list">
          {loading ? <LoaderCircle className="teams-hub-spin" aria-hidden="true" /> : <>
            <section><h2>{c.mine}</h2>{myTeams.map((team) => <TeamButton team={team} key={team.id} />)}{myTeams.length === 0 && <p>{c.empty}</p>}</section>
            <section><h2>{c.discover}</h2>{otherTeams.map((team) => <TeamButton team={team} key={team.id} />)}{otherTeams.length === 0 && <p>{c.empty}</p>}</section>
          </>}
        </aside>

        <section className="teams-hub-detail">
          {!selected ? <div className="teams-hub-placeholder"><UsersRound aria-hidden="true" /><p>{c.empty}</p></div> : <>
            <header><div><span>{selected.membership === "member" ? c.mine : c.discover}</span><h2>{selected.name}</h2><p>{selected.description}</p></div>{selected.membership !== "member" && <button type="button" disabled={selected.membership === "requested" || busy} onClick={() => void requestJoin(selected)}>{selected.membership === "requested" ? <Check aria-hidden="true" /> : <Send aria-hidden="true" />}{selected.membership === "requested" ? c.requested : c.request}</button>}{selected.canManage && <button className="icon-only" type="button" title={c.editTeam} aria-label={c.editTeam}><Pencil aria-hidden="true" /></button>}</header>
            <div className="teams-hub-columns">
              <section><div className="teams-hub-section-title"><h3>{c.members}</h3>{selected.canManage && <button type="button" onClick={() => setDialog("member")}><Plus aria-hidden="true" />{c.addMember}</button>}</div><div className="teams-member-list">{selectedMembers.map((member) => <article key={member.id}><div className={member.avatarUrl ? "teams-avatar has-photo" : "teams-avatar"}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : memberInitials(member.displayName)}</div><div><strong>{member.displayName}</strong><span><Mail aria-hidden="true" />{member.email}</span></div><small>{member.accountStatus === "active" ? "Ativo" : "Convidado"}</small></article>)}</div></section>
              <section><div className="teams-hub-section-title"><h3>{c.artifacts}</h3>{selected.canManage && <button type="button" onClick={() => setDialog("artifact")}><Plus aria-hidden="true" />{c.addArtifact}</button>}</div><div className="teams-artifact-list">{selectedArtifacts.map((artifact) => <a key={artifact.id} href={artifact.url} target="_blank" rel="noreferrer"><span>{artifact.kind === "repository" ? <FolderGit2 aria-hidden="true" /> : <FilePlus2 aria-hidden="true" />}</span><div><strong>{artifact.label}</strong><small>{artifact.description}</small></div><ArrowRight aria-hidden="true" /></a>)}{selectedArtifacts.length === 0 && <p>{c.empty}</p>}</div></section>
            </div>
            {selected.canManage && joinRequests.length > 0 && <section className="teams-join-requests"><h3>{c.joinRequests}</h3>{joinRequests.map((member) => <div key={member.id}><span>{member.displayName} · {member.email}</span><button type="button" onClick={() => void approve(member.id)}><Check aria-hidden="true" />{c.approve}</button></div>)}</section>}
          </>}
        </section>
      </div>
    </main>

    {dialog && <div className="teams-dialog-backdrop" role="presentation" onPointerDown={() => setDialog(null)}><form className="teams-dialog" onSubmit={(event) => void submit(event)} onPointerDown={(event) => event.stopPropagation()}>
      <header><div><span>{c.eyebrow}</span><h2>{dialog === "team" ? c.newTeam : dialog === "member" ? c.addMember : c.addArtifact}</h2></div><button type="button" onClick={() => setDialog(null)} aria-label="Fechar"><X aria-hidden="true" /></button></header>
      {dialog === "team" && <><label><span>{c.teamName}</span><input name="name" required maxLength={100} autoFocus /></label><label><span>{c.description}</span><textarea name="description" maxLength={300} rows={3} /></label></>}
      {dialog === "member" && <><label><span>{c.personName}</span><input name="name" required maxLength={100} autoFocus /></label><label><span>{c.personEmail}</span><input name="email" type="email" required maxLength={254} /></label><p className="teams-dialog-hint">{c.inviteHint}</p></>}
      {dialog === "artifact" && <><label><span>{c.artifactType}</span><select name="kind" defaultValue="document"><option value="document">Documento</option><option value="repository">GitHub</option><option value="dataset">CSV / planilha</option><option value="link">Link</option></select></label><label><span>{c.artifactName}</span><input name="name" required maxLength={120} autoFocus /></label><label><span>{c.artifactUrl}</span><input name="url" required maxLength={2048} placeholder="https://" /></label><label><span>{c.description}</span><textarea name="description" maxLength={300} rows={2} /></label></>}
      <footer><button type="button" onClick={() => setDialog(null)}>{c.cancel}</button><button className="primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="teams-hub-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{c.save}</button></footer>
    </form></div>}
  </div>;
}

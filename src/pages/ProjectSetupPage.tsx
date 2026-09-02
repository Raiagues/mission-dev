import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Layers3,
  LoaderCircle,
  Plus,
  Settings2,
  Trash2,
  UsersRound,
  X
} from "lucide-react";
import { LanguageToggle } from "../components/LanguageToggle";
import { UserBadge } from "../components/UserBadge";
import { ApiError, useAuth } from "../lib/auth";
import { REFERENCE_PROGRAMS, programCategory, programModality, referenceProgram } from "../lib/programs";
import type { MissionProject, ProjectContext, ProjectStructureItem } from "../lib/projectStore";
import { memberInitials } from "../lib/team";
import type { TeamMember } from "../lib/team";
import type { Language } from "../lib/types";
import "../project-context.css";

type Props = {
  language: Language;
  project: MissionProject;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onProjectChange: (project: MissionProject) => void;
  onContinue: () => void;
  onHome: () => void;
  onManageTeam: () => void;
};

type StructureKind = "roles" | "sectors";

function structureId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function StructureDialog({ context, language, onChange, onClose }: {
  context: ProjectContext;
  language: Language;
  onChange: (context: ProjectContext) => void;
  onClose: () => void;
}) {
  const c = language === "pt" ? {
    eyebrow: "ESTRUTURA DO PROJETO",
    title: "Cargos e setores",
    roles: "Cargos",
    sectors: "Setores",
    addRole: "Adicionar cargo",
    addSector: "Adicionar setor",
    rolePlaceholder: "Ex. Líder técnico",
    sectorPlaceholder: "Ex. Eletrônica",
    close: "Concluir"
  } : {
    eyebrow: "PROJECT STRUCTURE",
    title: "Roles and sectors",
    roles: "Roles",
    sectors: "Sectors",
    addRole: "Add role",
    addSector: "Add sector",
    rolePlaceholder: "E.g. Technical lead",
    sectorPlaceholder: "E.g. Electronics",
    close: "Done"
  };

  function updateItem(kind: StructureKind, id: string, name: string) {
    onChange({ ...context, [kind]: context[kind].map((item) => item.id === id ? { ...item, name } : item) });
  }

  function removeItem(kind: StructureKind, id: string) {
    const fallbackRole = context.roles.find((role) => role.id === "member")?.id ?? context.roles.find((role) => role.id !== id)?.id ?? "";
    onChange({
      ...context,
      [kind]: context[kind].filter((item) => item.id !== id),
      assignments: context.assignments.map((assignment) => kind === "roles" && assignment.roleId === id
        ? { ...assignment, roleId: fallbackRole }
        : kind === "sectors" && assignment.sectorId === id
          ? { ...assignment, sectorId: "" }
          : assignment)
    });
  }

  function addItem(event: React.FormEvent<HTMLFormElement>, kind: StructureKind) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const item: ProjectStructureItem = { id: structureId(kind === "roles" ? "role" : "sector"), name };
    onChange({ ...context, [kind]: [...context[kind], item] });
    form.reset();
  }

  return (
    <div className="context-dialog-backdrop" role="presentation" onPointerDown={onClose}>
      <section className="context-dialog" role="dialog" aria-modal="true" aria-labelledby="structure-dialog-title" onPointerDown={(event) => event.stopPropagation()}>
        <header><div><span>{c.eyebrow}</span><h2 id="structure-dialog-title">{c.title}</h2></div><button type="button" onClick={onClose} aria-label={c.close}><X aria-hidden="true" /></button></header>
        <div className="structure-columns">
          {(["roles", "sectors"] as StructureKind[]).map((kind) => (
            <section key={kind}>
              <h3>{kind === "roles" ? c.roles : c.sectors}</h3>
              <div className="structure-list">
                {context[kind].map((item) => (
                  <div className="structure-row" key={item.id}>
                    <input value={item.name} maxLength={60} onChange={(event) => updateItem(kind, item.id, event.target.value)} />
                    <button type="button" onClick={() => removeItem(kind, item.id)} aria-label={`${language === "pt" ? "Excluir" : "Delete"} ${item.name}`}><Trash2 aria-hidden="true" /></button>
                  </div>
                ))}
                {context[kind].length === 0 && <p>{language === "pt" ? "Nenhum item criado." : "No items yet."}</p>}
              </div>
              <form className="structure-add" onSubmit={(event) => addItem(event, kind)}>
                <input name="name" maxLength={60} placeholder={kind === "roles" ? c.rolePlaceholder : c.sectorPlaceholder} />
                <button type="submit" aria-label={kind === "roles" ? c.addRole : c.addSector}><Plus aria-hidden="true" /></button>
              </form>
            </section>
          ))}
        </div>
        <footer><button type="button" onClick={onClose}><Check aria-hidden="true" />{c.close}</button></footer>
      </section>
    </div>
  );
}

export function ProjectSetupPage({ language, project, t, onLanguageChange, onProjectChange, onContinue, onHome, onManageTeam }: Props) {
  const auth = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState(project.name);
  const [context, setContext] = useState<ProjectContext>(project.context);
  const [editingStructure, setEditingStructure] = useState(false);

  useEffect(() => {
    setName(project.name);
    setContext(project.context);
  }, [project.id, project.name, project.context]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void auth.api<{ members: TeamMember[] }>("/team/members")
      .then((response) => {
        if (!cancelled) setMembers(response.members);
      })
      .catch((reason) => {
        if (!cancelled) setFeedback(reason instanceof ApiError ? reason.message : "Não foi possível carregar a equipe.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [auth.api]);

  const c = language === "pt" ? {
    eyebrow: "NOVO PROJETO",
    title: "Defina o ponto de partida",
    subtitle: "Só o contexto essencial. O restante nasce durante a concepção.",
    project: "PROJETO",
    projectName: "Nome do projeto",
    projectPlaceholder: "Ex. Missão Aurora",
    reference: "PROGRAMA DE REFERÊNCIA",
    referenceHint: "O Norte adapta documentos, marcos e objetivos ao programa escolhido.",
    available: "Disponível",
    soon: "Em breve",
    modality: "Modalidade",
    category: "Categoria",
    team: "EQUIPE DO PROJETO",
    teamName: "Nome da equipe",
    teamPlaceholder: "Ex. Zenith Aerospace",
    choosePeople: "Selecione quem participa deste projeto",
    noPeople: "Sua equipe ainda não tem pessoas disponíveis.",
    manageTeam: "Gerenciar equipe",
    structure: "Cargos e setores",
    role: "Cargo",
    sector: "Setor",
    noSector: "Sem setor",
    back: "Voltar",
    continue: "Criar projeto",
    required: "Preencha o nome, programa, modalidade, categoria e selecione ao menos uma pessoa."
  } : {
    eyebrow: "NEW PROJECT",
    title: "Define the starting point",
    subtitle: "Only the essential context. Everything else emerges during conception.",
    project: "PROJECT",
    projectName: "Project name",
    projectPlaceholder: "E.g. Aurora Mission",
    reference: "REFERENCE PROGRAM",
    referenceHint: "Norte adapts documents, milestones, and objectives to the selected program.",
    available: "Available",
    soon: "Coming soon",
    modality: "Modality",
    category: "Category",
    team: "PROJECT TEAM",
    teamName: "Team name",
    teamPlaceholder: "E.g. Zenith Aerospace",
    choosePeople: "Select who participates in this project",
    noPeople: "Your team has no available people yet.",
    manageTeam: "Manage team",
    structure: "Roles and sectors",
    role: "Role",
    sector: "Sector",
    noSector: "No sector",
    back: "Back",
    continue: "Create project",
    required: "Enter a name, program, modality, category, and select at least one person."
  };

  const selectedProgram = referenceProgram(context.programId);
  const selectedModality = programModality(selectedProgram, context.modalityId);
  const selectedCategory = programCategory(selectedModality, context.categoryId);
  const valid = Boolean(name.trim() && selectedProgram && selectedModality && selectedCategory && context.assignments.length > 0);
  const selectedMembers = useMemo(() => context.assignments.map((assignment) => ({
    assignment,
    member: members.find((member) => member.id === assignment.memberId)
  })).filter((item): item is { assignment: ProjectContext["assignments"][number]; member: TeamMember } => Boolean(item.member)), [context.assignments, members]);

  function chooseProgram(programId: string) {
    setContext((current) => ({ ...current, programId, modalityId: null, categoryId: null }));
  }

  function chooseModality(modalityId: string) {
    setContext((current) => ({ ...current, modalityId, categoryId: null }));
  }

  function toggleMember(memberId: string) {
    setContext((current) => {
      const exists = current.assignments.some((assignment) => assignment.memberId === memberId);
      if (exists) return { ...current, assignments: current.assignments.filter((assignment) => assignment.memberId !== memberId) };
      const roleId = current.assignments.length === 0 && current.roles.some((role) => role.id === "captain")
        ? "captain"
        : current.roles.find((role) => role.id === "member")?.id ?? current.roles[0]?.id ?? "";
      return { ...current, assignments: [...current.assignments, { memberId, roleId, sectorId: "" }] };
    });
  }

  function updateAssignment(memberId: string, patch: Partial<ProjectContext["assignments"][number]>) {
    setContext((current) => ({
      ...current,
      assignments: current.assignments.map((assignment) => assignment.memberId === memberId ? { ...assignment, ...patch } : assignment)
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) {
      setFeedback(c.required);
      return;
    }
    onProjectChange({ ...project, name: name.trim(), context: { ...context, configured: true } });
    onContinue();
  }

  function manageTeam() {
    onProjectChange({ ...project, name, context });
    onManageTeam();
  }

  return (
    <div className="context-shell">
      <main className="context-main">
        <header className="context-topbar">
          <button className="context-back" type="button" onClick={onHome}><ArrowLeft aria-hidden="true" />{c.back}</button>
          <div className="top-actions"><LanguageToggle language={language} onChange={onLanguageChange} /><UserBadge connectedLabel={t("common.connected")} /></div>
        </header>

        <form className="context-workspace" onSubmit={submit}>
          <header className="context-heading"><div><span>{c.eyebrow}</span><h1>{c.title}</h1><p>{c.subtitle}</p></div><div className="context-steps" aria-hidden="true"><i className="active">1</i><span /><i>2</i><span /><i>3</i></div></header>

          <div className="context-columns">
            <section className="context-column context-definition">
              <div className="context-section-title"><span>01</span><div><h2>{c.project}</h2></div></div>
              <label className="context-field"><span>{c.projectName}</span><input autoFocus value={name} maxLength={100} placeholder={c.projectPlaceholder} onChange={(event) => setName(event.target.value)} /></label>

              <div className="context-section-title context-reference-title"><span>02</span><div><h2>{c.reference}</h2><p>{c.referenceHint}</p></div></div>
              <div className="program-picker">
                {REFERENCE_PROGRAMS.map((program) => (
                  <button className={context.programId === program.id ? "program-choice selected" : "program-choice"} type="button" key={program.id} disabled={!program.available} onClick={() => chooseProgram(program.id)}>
                    <span className="program-choice-mark">{program.logoSrc ? <img src={program.logoSrc} alt="" /> : <Layers3 aria-hidden="true" />}</span>
                    <span><strong>{program.shortName}</strong><small>{program.name[language]}</small></span>
                    <em>{program.available ? c.available : c.soon}</em>
                    {context.programId === program.id && <Check className="program-choice-check" aria-hidden="true" />}
                  </button>
                ))}
              </div>

              {selectedProgram && <div className="program-details">
                <fieldset><legend>{c.modality}</legend><div className="context-segments">{selectedProgram.modalities.map((modality) => <button className={context.modalityId === modality.id ? "selected" : ""} type="button" key={modality.id} onClick={() => chooseModality(modality.id)}>{modality.label[language]}</button>)}</div></fieldset>
                {selectedModality && <label className="context-field compact"><span>{c.category}</span><div className="context-select"><select value={context.categoryId ?? ""} onChange={(event) => setContext((current) => ({ ...current, categoryId: event.target.value || null }))}><option value="" disabled>{language === "pt" ? "Selecione a categoria" : "Select a category"}</option>{selectedModality.categories.map((category) => <option key={category.id} value={category.id}>{category.label[language]}</option>)}</select><ChevronDown aria-hidden="true" /></div></label>}
              </div>}
            </section>

            <section className="context-column context-team">
              <div className="context-section-title"><span>03</span><div><h2>{c.team}</h2><p>{c.choosePeople}</p></div><button className="context-link-button" type="button" onClick={manageTeam}><UsersRound aria-hidden="true" />{c.manageTeam}</button></div>
              <div className="context-team-tools">
                <label className="context-field"><span>{c.teamName}</span><input value={context.teamName} maxLength={100} placeholder={c.teamPlaceholder} onChange={(event) => setContext((current) => ({ ...current, teamName: event.target.value }))} /></label>
                <button className="context-structure-button" type="button" onClick={() => setEditingStructure(true)}><Settings2 aria-hidden="true" /><span><strong>{c.structure}</strong><small>{context.roles.length} / {context.sectors.length}</small></span></button>
              </div>

              <div className="people-picker">
                {loading && <div className="context-loading"><LoaderCircle aria-hidden="true" /></div>}
                {!loading && members.length === 0 && <button className="context-empty-team" type="button" onClick={manageTeam}><UsersRound aria-hidden="true" /><span>{c.noPeople}</span><strong>{c.manageTeam}</strong></button>}
                {!loading && members.map((member) => {
                  const selected = context.assignments.some((assignment) => assignment.memberId === member.id);
                  return <button className={selected ? "person-choice selected" : "person-choice"} type="button" key={member.id} onClick={() => toggleMember(member.id)}><span>{memberInitials(member.displayName)}</span><div><strong>{member.displayName}</strong><small>{member.course || member.institution || member.email}</small></div><i>{selected && <Check aria-hidden="true" />}</i></button>;
                })}
              </div>

              {selectedMembers.length > 0 && <div className="assignment-list">
                <div className="assignment-head"><span>{language === "pt" ? "Pessoa" : "Person"}</span><span>{c.role}</span><span>{c.sector}</span></div>
                {selectedMembers.map(({ member, assignment }) => <div className="assignment-row" key={member.id}><strong>{member.displayName}</strong><select value={assignment.roleId} onChange={(event) => updateAssignment(member.id, { roleId: event.target.value })}>{context.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><select value={assignment.sectorId} onChange={(event) => updateAssignment(member.id, { sectorId: event.target.value })}><option value="">{c.noSector}</option>{context.sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>)}
              </div>}
            </section>
          </div>

          <footer className="context-footer"><p role="status">{feedback}</p><div><button type="button" onClick={onHome}>{c.back}</button><button className="primary" type="submit" disabled={!valid}>{c.continue}<ArrowRight aria-hidden="true" /></button></div></footer>
        </form>
      </main>
      {editingStructure && <StructureDialog context={context} language={language} onChange={setContext} onClose={() => setEditingStructure(false)} />}
    </div>
  );
}

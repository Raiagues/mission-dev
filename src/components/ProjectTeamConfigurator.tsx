import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Expand,
  GripVertical,
  List,
  Maximize2,
  Minimize2,
  Network,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  UserPlus,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import type { ProjectContext, ProjectMemberAssignment, ProjectStructureItem } from "../lib/projectStore";
import { memberInitials } from "../lib/team";
import type { Language } from "../lib/types";
import type { TeamMember, TeamRecord } from "../lib/team";
import "../project-team-configurator.css";

type Props = {
  language: Language;
  context: ProjectContext;
  team: TeamRecord;
  members: TeamMember[];
  onSave: (patch: Pick<ProjectContext, "roles" | "sectors" | "assignments">) => void;
  onCreateMember: (name: string, email: string) => Promise<TeamMember>;
  onRenameMember: (memberId: string, name: string) => Promise<void>;
  onClose: () => void;
};

type Draft = Pick<ProjectContext, "roles" | "sectors" | "assignments">;
type GroupKind = "sectors" | "roles";
type ViewKind = "list" | "hierarchy";

function cloneDraft(value: Draft): Draft {
  return {
    roles: value.roles.map((item) => ({ ...item })),
    sectors: value.sectors.map((item) => ({ ...item })),
    assignments: value.assignments.map((item) => ({ ...item }))
  };
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function ProjectTeamConfigurator({ language, context, team, members, onSave, onCreateMember, onRenameMember, onClose }: Props) {
  const c = language === "pt" ? {
    description: "Escolha os participantes e organize a estrutura deste projeto. Nada muda até você salvar.",
    sectors: "Setores",
    roles: "Cargos",
    list: "Lista",
    hierarchy: "Hierarquia",
    save: "Salvar configuração",
    cancel: "Cancelar",
    undo: "Desfazer (Ctrl+Z)",
    resetView: "Centralizar",
    fullscreen: "Tela cheia",
    exitFullscreen: "Sair da tela cheia",
    noSector: "Sem setor",
    addSector: "Adicionar setor",
    addRole: "Adicionar cargo",
    newSector: "Novo setor",
    newRole: "Novo cargo",
    manager: "Gerência",
    members: "Participantes",
    addHere: "Adicionar participante aqui",
    edit: "Editar pessoa",
    remove: "Remover do projeto",
    moveQuestion: "Mover esta pessoa para outro setor?",
    confirm: "Confirmar",
    keep: "Manter onde está",
    choose: "Escolha uma pessoa",
    addPerson: "Adicionar nova pessoa",
    name: "Nome",
    email: "E-mail",
    invite: "Adicionar à equipe",
    participating: "No projeto",
    empty: "Nenhuma pessoa neste grupo.",
    deleteGroup: "Excluir grupo",
    cannotDelete: "Este cargo está em uso.",
    role: "Cargo",
    sector: "Setor"
  } : {
    description: "Choose participants and organize this project's structure. Nothing changes until you save.",
    sectors: "Sectors",
    roles: "Roles",
    list: "List",
    hierarchy: "Hierarchy",
    save: "Save configuration",
    cancel: "Cancel",
    undo: "Undo (Ctrl+Z)",
    resetView: "Center",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    noSector: "No sector",
    addSector: "Add sector",
    addRole: "Add role",
    newSector: "New sector",
    newRole: "New role",
    manager: "Management",
    members: "Participants",
    addHere: "Add participant here",
    edit: "Edit person",
    remove: "Remove from project",
    moveQuestion: "Move this person to another sector?",
    confirm: "Confirm",
    keep: "Keep current sector",
    choose: "Choose a person",
    addPerson: "Add a new person",
    name: "Name",
    email: "Email",
    invite: "Add to team",
    participating: "In project",
    empty: "No one in this group.",
    deleteGroup: "Delete group",
    cannotDelete: "This role is in use.",
    role: "Role",
    sector: "Sector"
  };

  const [draft, setDraft] = useState<Draft>(() => cloneDraft(context));
  const [history, setHistory] = useState<Draft[]>([]);
  const [groupKind, setGroupKind] = useState<GroupKind>("sectors");
  const [view, setView] = useState<ViewKind>("list");
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pendingMove, setPendingMove] = useState<{ memberId: string; groupId: string } | null>(null);
  const [pickerGroup, setPickerGroup] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [creating, setCreating] = useState(false);
  const panRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);

  const teamMembers = useMemo(() => team.memberIds.map((id) => members.find((member) => member.id === id)).filter((member): member is TeamMember => Boolean(member)), [members, team.memberIds]);
  const memberById = useMemo(() => new Map(teamMembers.map((member) => [member.id, member])), [teamMembers]);
  const assignedIds = useMemo(() => new Set(draft.assignments.map((item) => item.memberId)), [draft.assignments]);
  const unassigned = teamMembers.filter((member) => !assignedIds.has(member.id));

  function change(next: Draft | ((current: Draft) => Draft)) {
    setDraft((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      setHistory((items) => [...items.slice(-39), cloneDraft(current)]);
      return cloneDraft(resolved);
    });
  }

  function undo() {
    setHistory((items) => {
      const previous = items.at(-1);
      if (previous) setDraft(cloneDraft(previous));
      return previous ? items.slice(0, -1) : items;
    });
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const groups: ProjectStructureItem[] = groupKind === "sectors"
    ? [...draft.sectors, { id: "", name: c.noSector }]
    : draft.roles;

  function assignmentGroup(assignment: ProjectMemberAssignment) {
    return groupKind === "sectors" ? assignment.sectorId : assignment.roleId;
  }

  function toggleMember(memberId: string) {
    change((current) => {
      const existing = current.assignments.find((item) => item.memberId === memberId);
      return {
        ...current,
        assignments: existing
          ? current.assignments.filter((item) => item.memberId !== memberId)
          : [...current.assignments, { memberId, roleId: current.assignments.some((item) => item.roleId === "captain") ? "member" : "captain", sectorId: "" }]
      };
    });
  }

  function updateAssignment(memberId: string, patch: Partial<ProjectMemberAssignment>) {
    change((current) => ({ ...current, assignments: current.assignments.map((item) => item.memberId === memberId ? { ...item, ...patch } : item) }));
  }

  function addGroup(atStart = false) {
    const kind = groupKind === "sectors" ? "sector" : "role";
    const item = { id: uid(kind), name: groupKind === "sectors" ? c.newSector : c.newRole };
    change((current) => ({ ...current, [groupKind]: atStart ? [item, ...current[groupKind]] : [...current[groupKind], item] }));
  }

  function renameGroup(id: string, name: string) {
    change((current) => ({ ...current, [groupKind]: current[groupKind].map((item) => item.id === id ? { ...item, name } : item) }));
  }

  function deleteGroup(id: string) {
    if (!id || (groupKind === "roles" && draft.assignments.some((item) => item.roleId === id))) return;
    change((current) => ({
      ...current,
      [groupKind]: current[groupKind].filter((item) => item.id !== id),
      assignments: groupKind === "sectors" ? current.assignments.map((item) => item.sectorId === id ? { ...item, sectorId: "" } : item) : current.assignments
    }));
  }

  function reorderSector(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    change((current) => {
      const sectors = [...current.sectors];
      const sourceIndex = sectors.findIndex((item) => item.id === sourceId);
      const targetIndex = sectors.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const [source] = sectors.splice(sourceIndex, 1);
      sectors.splice(targetIndex, 0, source);
      return { ...current, sectors };
    });
  }

  function confirmMove() {
    if (!pendingMove) return;
    updateAssignment(pendingMove.memberId, groupKind === "sectors" ? { sectorId: pendingMove.groupId } : { roleId: pendingMove.groupId });
    setPendingMove(null);
  }

  function addExisting(groupId: string, memberId: string) {
    if (!memberId) return;
    change((current) => ({
      ...current,
      assignments: [...current.assignments, {
        memberId,
        roleId: groupKind === "roles" ? groupId : (current.assignments.some((item) => item.roleId === "captain") ? "member" : "captain"),
        sectorId: groupKind === "sectors" ? groupId : ""
      }]
    }));
    setPickerGroup(null);
  }

  async function submitPerson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setCreating(true);
    try {
      const member = await onCreateMember(String(data.get("name") || ""), String(data.get("email") || ""));
      change((current) => ({ ...current, assignments: [...current.assignments, { memberId: member.id, roleId: "member", sectorId: "" }] }));
      setShowNewPerson(false);
    } finally {
      setCreating(false);
    }
  }

  async function saveMemberName(memberId: string) {
    const name = editingName.trim();
    if (name) await onRenameMember(memberId, name);
    setEditingId(null);
  }

  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y };
  }

  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    const start = panRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setPan({ x: start.originX + event.clientX - start.x, y: start.originY + event.clientY - start.y });
  }

  function finishPan() { panRef.current = null; }

  function MemberNode({ assignment }: { assignment: ProjectMemberAssignment }) {
    const member = memberById.get(assignment.memberId);
    if (!member) return null;
    const role = draft.roles.find((item) => item.id === assignment.roleId)?.name || assignment.roleId;
    const sector = draft.sectors.find((item) => item.id === assignment.sectorId)?.name || c.noSector;
    return <article className="ptc-member" draggable onDragStart={(event) => event.dataTransfer.setData("text/member", member.id)}>
      <span className={member.avatarUrl ? "ptc-avatar has-photo" : "ptc-avatar"}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : memberInitials(member.displayName)}</span>
      <span><strong>{member.displayName}</strong><small>{groupKind === "sectors" ? role : sector}</small></span>
      <span className="ptc-member-actions"><button type="button" title={c.edit} onClick={() => { setEditingId(member.id); setEditingName(member.displayName); }}><Pencil aria-hidden="true" /></button><button type="button" title={c.remove} onClick={() => toggleMember(member.id)}><Trash2 aria-hidden="true" /></button></span>
    </article>;
  }

  return <section className={fullscreen ? "ptc-root fullscreen" : "ptc-root"}>
    <div className="ptc-intro">{c.description}</div>
    <div className="ptc-toolbar">
      <div className="ptc-tabs" role="tablist"><button className={groupKind === "sectors" ? "active" : ""} type="button" onClick={() => setGroupKind("sectors")}>{c.sectors}</button><button className={groupKind === "roles" ? "active" : ""} type="button" onClick={() => setGroupKind("roles")}>{c.roles}</button></div>
      <button className="ptc-add-group" type="button" onClick={() => addGroup(false)}><Plus aria-hidden="true" />{groupKind === "sectors" ? c.addSector : c.addRole}</button>
      <div className="ptc-segmented"><button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}><List aria-hidden="true" />{c.list}</button><button className={view === "hierarchy" ? "active" : ""} type="button" onClick={() => setView("hierarchy")}><Network aria-hidden="true" />{c.hierarchy}</button></div>
      <div className="ptc-tools"><button type="button" title={c.undo} disabled={history.length === 0} onClick={undo}><Undo2 aria-hidden="true" /></button>{view === "hierarchy" && <><button type="button" title="Zoom out" onClick={() => setZoom((value) => Math.max(.55, value - .1))}><ZoomOut aria-hidden="true" /></button><span>{Math.round(zoom * 100)}%</span><button type="button" title="Zoom in" onClick={() => setZoom((value) => Math.min(1.6, value + .1))}><ZoomIn aria-hidden="true" /></button><button type="button" title={c.resetView} onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}><RotateCcw aria-hidden="true" /></button><button type="button" title={fullscreen ? c.exitFullscreen : c.fullscreen} onClick={() => setFullscreen((value) => !value)}>{fullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}</button></>}</div>
    </div>

    {pendingMove && <div className="ptc-confirm"><Expand aria-hidden="true" /><span>{c.moveQuestion}</span><button type="button" onClick={() => setPendingMove(null)}>{c.keep}</button><button className="primary" type="button" onClick={confirmMove}><Check aria-hidden="true" />{c.confirm}</button></div>}

    {view === "list" ? <div className="ptc-list-scroll">
      {teamMembers.map((member) => {
        const assignment = draft.assignments.find((item) => item.memberId === member.id);
        return <article className={assignment ? "selected" : ""} key={member.id}>
          <label><input type="checkbox" checked={Boolean(assignment)} onChange={() => toggleMember(member.id)} /><span className={member.avatarUrl ? "ptc-avatar has-photo" : "ptc-avatar"}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : memberInitials(member.displayName)}</span><span><strong>{member.displayName}</strong><small>{member.course || member.email}</small></span><i><Check aria-hidden="true" /></i></label>
          {assignment && <div className="ptc-list-fields">{groupKind === "roles" ? <label><span>{c.role}</span><select value={assignment.roleId} onChange={(event) => updateAssignment(member.id, { roleId: event.target.value })}>{draft.roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label> : <label><span>{c.sector}</span><select value={assignment.sectorId} onChange={(event) => updateAssignment(member.id, { sectorId: event.target.value })}><option value="">{c.noSector}</option>{draft.sectors.map((sector) => <option value={sector.id} key={sector.id}>{sector.name}</option>)}</select></label>}<button type="button" title={c.edit} onClick={() => { setEditingId(member.id); setEditingName(member.displayName); }}><Pencil aria-hidden="true" /></button><button type="button" title={c.remove} onClick={() => toggleMember(member.id)}><Trash2 aria-hidden="true" /></button></div>}
        </article>;
      })}
      <button className="ptc-add-person" type="button" onClick={() => setShowNewPerson((value) => !value)}><UserPlus aria-hidden="true" />{c.addPerson}</button>
      {showNewPerson && <form className="ptc-new-person" onSubmit={(event) => void submitPerson(event)}><label><span>{c.name}</span><input name="name" required maxLength={100} autoFocus /></label><label><span>{c.email}</span><input name="email" type="email" required maxLength={254} /></label><button className="primary" type="submit" disabled={creating}><UserPlus aria-hidden="true" />{c.invite}</button></form>}
    </div> : <div className="ptc-canvas" onPointerDown={startPan} onPointerMove={movePan} onPointerUp={finishPan} onPointerCancel={finishPan}>
      {groupKind === "sectors" && <button className="ptc-add-rail left" type="button" title={c.addSector} onClick={() => addGroup(true)}><Plus aria-hidden="true" /></button>}
      <div className="ptc-stage" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <div className="ptc-team-root"><UsersRoundIcon /><span><strong>{team.name}</strong><small>{draft.assignments.length} {c.participating.toLocaleLowerCase()}</small></span></div>
        <div className="ptc-groups">{groups.map((group) => {
          const grouped = draft.assignments.filter((assignment) => assignmentGroup(assignment) === group.id);
          const managers = grouped.filter((assignment) => assignment.roleId === "manager" || assignment.roleId === "captain");
          const regular = grouped.filter((assignment) => !managers.includes(assignment));
          const inUse = groupKind === "roles" && grouped.length > 0;
          return <section className="ptc-group" key={group.id || "unassigned"} draggable={groupKind === "sectors" && Boolean(group.id)} onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.setData("text/sector", group.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const memberId = event.dataTransfer.getData("text/member"); const sectorId = event.dataTransfer.getData("text/sector"); if (memberId && assignmentGroup(draft.assignments.find((item) => item.memberId === memberId)!) !== group.id) setPendingMove({ memberId, groupId: group.id }); else if (sectorId && groupKind === "sectors") reorderSector(sectorId, group.id); }}>
            <header>{group.id ? <input value={group.name} maxLength={60} onChange={(event) => renameGroup(group.id, event.target.value)} /> : <strong>{group.name}</strong>}<span><GripVertical aria-hidden="true" />{grouped.length}</span>{group.id && <button type="button" title={inUse ? c.cannotDelete : c.deleteGroup} disabled={inUse} onClick={() => deleteGroup(group.id)}><Trash2 aria-hidden="true" /></button>}</header>
            {managers.length > 0 && <div className="ptc-managers"><small>{c.manager}</small>{managers.map((assignment) => <MemberNode assignment={assignment} key={assignment.memberId} />)}</div>}
            <div className="ptc-member-grid">{regular.map((assignment) => <MemberNode assignment={assignment} key={assignment.memberId} />)}{grouped.length === 0 && <span className="ptc-empty">{c.empty}</span>}</div>
            <button className="ptc-add-under" type="button" title={c.addHere} onClick={() => setPickerGroup(group.id)}><Plus aria-hidden="true" /></button>
            {pickerGroup === group.id && <div className="ptc-picker"><select autoFocus defaultValue="" onChange={(event) => addExisting(group.id, event.target.value)}><option value="">{c.choose}</option>{unassigned.map((member) => <option value={member.id} key={member.id}>{member.displayName}</option>)}</select><button type="button" onClick={() => setPickerGroup(null)}><X aria-hidden="true" /></button></div>}
          </section>;
        })}</div>
      </div>
      {groupKind === "sectors" && <button className="ptc-add-rail right" type="button" title={c.addSector} onClick={() => addGroup(false)}><Plus aria-hidden="true" /></button>}
    </div>}

    {editingId && <div className="ptc-inline-editor"><label><span>{c.name}</span><input value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={100} autoFocus /></label><button type="button" onClick={() => setEditingId(null)}>{c.cancel}</button><button className="primary" type="button" onClick={() => void saveMemberName(editingId)}><Save aria-hidden="true" />{c.save}</button></div>}
    <footer><button type="button" onClick={onClose}>{c.cancel}</button><button className="primary" type="button" onClick={() => onSave(cloneDraft(draft))}><Check aria-hidden="true" />{c.save}</button></footer>
  </section>;
}

function UsersRoundIcon() {
  return <Network aria-hidden="true" />;
}

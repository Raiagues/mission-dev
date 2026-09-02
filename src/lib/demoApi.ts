import { createEmptyProject } from "./projectStore";
import type { MissionProject } from "./projectStore";
import type { ConnectedArtifact, DirectoryMember, ProjectSummary, SessionUser, TeamMember, TeamProjectSummary, TeamRecord } from "./team";

const STORAGE_KEY = "norte-pages-demo-v2";
const LEGACY_STORAGE_KEY = "norte-pages-demo-v1";
const DEMO_SCHEMA_VERSION = 5;
const TEAM_ID = "team-aurora";
const PROJECT_ID = "mission-aurora-demo";
const MOCK_MEMBER_IDS = ["aurora-lucas", "aurora-marina", "aurora-rafael"];
const COMMUNITY_MEMBER_IDS = ["zenith-ana", "zenith-caio", "sirius-beatriz", "sirius-matheus"];
const avatarUrl = `${import.meta.env.BASE_URL}profiles/emily-raiane.png`;

type DemoState = {
  schemaVersion: number;
  members: TeamMember[];
  artifacts: ConnectedArtifact[];
  teams: TeamRecord[];
  projects: Record<string, MissionProject>;
  project: MissionProject | null;
  labs: Record<string, unknown>;
};

export const DEMO_USER: SessionUser = {
  id: "pages-demo-owner",
  memberId: "pages-demo-captain",
  name: "Emily Raiane Rodrigues",
  initials: "ER",
  email: "emilyrayannerodrigues@gmail.com",
  accessRole: "owner_admin",
  institution: "Universidade Federal de Santa Maria",
  primaryArea: "systems",
  avatarUrl,
  profileComplete: true
};

function timestamp() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function demoProject(now: string): MissionProject {
  const project = createEmptyProject("pt");
  return {
    ...project,
    id: PROJECT_ID,
    name: "Missão Aurora",
    createdAt: now,
    updatedAt: now,
    context: {
      ...project.context,
      configured: true,
      programId: "obsat",
      modalityId: "practical",
      categoryId: "n3",
      teamId: TEAM_ID,
      teamName: "Equipe Aurora",
      teamArtifactIds: ["team-aurora-report", "team-aurora-lessons"],
      projectArtifactIds: ["norte-aurora-telemetry"],
      sectors: [
        { id: "systems", name: "Sistemas" },
        { id: "electronics", name: "Eletrônica e aviônica" },
        { id: "software", name: "Software de voo" }
      ],
      assignments: [
        { memberId: DEMO_USER.memberId, roleId: "captain", sectorId: "systems" },
        { memberId: MOCK_MEMBER_IDS[0], roleId: "manager", sectorId: "electronics" },
        { memberId: MOCK_MEMBER_IDS[1], roleId: "member", sectorId: "software" },
        { memberId: MOCK_MEMBER_IDS[2], roleId: "member", sectorId: "systems" }
      ]
    }
  };
}

function demoPayloadProject(now: string): MissionProject {
  const project = createEmptyProject("pt");
  return {
    ...project,
    id: "mission-sentinel-demo",
    name: "Payload Sentinel",
    createdAt: now,
    updatedAt: now,
    context: {
      ...project.context,
      configured: true,
      programId: "obsat",
      modalityId: "practical",
      categoryId: "n3",
      teamId: TEAM_ID,
      teamName: "Equipe Aurora",
      sectors: [
        { id: "payload", name: "Payload" },
        { id: "operations", name: "Operações" }
      ],
      assignments: [
        { memberId: DEMO_USER.memberId, roleId: "captain", sectorId: "operations" },
        { memberId: MOCK_MEMBER_IDS[1], roleId: "manager", sectorId: "payload" },
        { memberId: MOCK_MEMBER_IDS[2], roleId: "member", sectorId: "payload" }
      ]
    }
  };
}

function initialState(): DemoState {
  const now = timestamp();
  const project = demoProject(now);
  const payloadProject = demoPayloadProject(now);
  const members: TeamMember[] = [{
    id: DEMO_USER.memberId,
    accountId: DEMO_USER.id,
    displayName: DEMO_USER.name,
    email: DEMO_USER.email,
    missionRole: "captain",
    primaryArea: "systems",
    secondaryAreas: [],
    institution: "Universidade Federal de Santa Maria",
    course: "Engenharia Aeroespacial",
    academicStage: "9º período",
    skills: [],
    availabilityHours: 8,
    notes: "",
    accountStatus: "active",
    accessRole: "owner_admin",
    avatarUrl,
    createdAt: now,
    updatedAt: now
  }, {
    id: MOCK_MEMBER_IDS[0], accountId: null, displayName: "Lucas Ferreira", email: "lucas.ferreira@norte.demo",
    missionRole: "manager", primaryArea: "electronics", secondaryAreas: [], institution: "Universidade Federal de Santa Maria",
    course: "Engenharia Elétrica", academicStage: "7º período", skills: [], availabilityHours: 10, notes: "",
    accountStatus: "invited", accessRole: null, createdAt: now, updatedAt: now
  }, {
    id: COMMUNITY_MEMBER_IDS[0], accountId: "demo-zenith-ana", displayName: "Ana Luiza Prado", email: "ana@norte.demo",
    missionRole: "captain", primaryArea: "systems", secondaryAreas: [], institution: "Universidade Federal de Minas Gerais",
    course: "Engenharia Aeroespacial", academicStage: "6º período", skills: [], availabilityHours: 9, notes: "",
    accountStatus: "active", accessRole: "captain", createdAt: now, updatedAt: now
  }, {
    id: COMMUNITY_MEMBER_IDS[1], accountId: "demo-zenith-caio", displayName: "Caio Mendes", email: "caio@norte.demo",
    missionRole: "member", primaryArea: "flight_software", secondaryAreas: [], institution: "Universidade Federal de Minas Gerais",
    course: "Ciência da Computação", academicStage: "5º período", skills: [], availabilityHours: 7, notes: "",
    accountStatus: "active", accessRole: "member", createdAt: now, updatedAt: now
  }, {
    id: COMMUNITY_MEMBER_IDS[2], accountId: "demo-icarus-beatriz", displayName: "Beatriz Sampaio", email: "beatriz@norte.demo",
    missionRole: "manager", primaryArea: "aerodynamics", secondaryAreas: [], institution: "Universidade Federal de Itajubá",
    course: "Engenharia Mecânica", academicStage: "8º período", skills: [], availabilityHours: 8, notes: "",
    accountStatus: "active", accessRole: "manager", createdAt: now, updatedAt: now
  }, {
    id: COMMUNITY_MEMBER_IDS[3], accountId: "demo-icarus-matheus", displayName: "Matheus Lima", email: "matheus@norte.demo",
    missionRole: "member", primaryArea: "electronics", secondaryAreas: [], institution: "Universidade Federal de Itajubá",
    course: "Engenharia Elétrica", academicStage: "7º período", skills: [], availabilityHours: 6, notes: "",
    accountStatus: "active", accessRole: "member", createdAt: now, updatedAt: now
  }, {
    id: MOCK_MEMBER_IDS[1], accountId: null, displayName: "Marina Costa", email: "marina.costa@norte.demo",
    missionRole: "member", primaryArea: "flight_software", secondaryAreas: [], institution: "Universidade Federal de Santa Maria",
    course: "Engenharia de Computação", academicStage: "6º período", skills: [], availabilityHours: 8, notes: "",
    accountStatus: "invited", accessRole: null, createdAt: now, updatedAt: now
  }, {
    id: MOCK_MEMBER_IDS[2], accountId: null, displayName: "Rafael Nunes", email: "rafael.nunes@norte.demo",
    missionRole: "member", primaryArea: "structures", secondaryAreas: [], institution: "Universidade Federal de Santa Maria",
    course: "Engenharia Mecânica", academicStage: "8º período", skills: [], availabilityHours: 6, notes: "",
    accountStatus: "invited", accessRole: null, createdAt: now, updatedAt: now
  }];
  const artifacts: ConnectedArtifact[] = [
    {
      id: "team-aurora-report", kind: "document", label: "Relatório final · Missão Aurora",
      url: `${import.meta.env.BASE_URL}artifacts/relatorio-final-missao-aurora.md`, description: "Relatório de uma missão anterior da equipe.",
      tags: [], official: false, scope: "team", ownerId: TEAM_ID, createdBy: DEMO_USER.id, connectedAt: now, updatedAt: now
    },
    {
      id: "team-aurora-lessons", kind: "dataset", label: "Lições aprendidas · Missão Aurora",
      url: `${import.meta.env.BASE_URL}artifacts/licoes-aprendidas-missao-aurora.csv`, description: "Registro de decisões e ações corretivas da equipe.",
      tags: [], official: false, scope: "team", ownerId: TEAM_ID, createdBy: DEMO_USER.id, connectedAt: now, updatedAt: now
    },
    {
      id: "norte-aurora-telemetry", kind: "repository", label: "norte-aurora-telemetria",
      url: "https://github.com/Raiagues/norte-aurora-telemetria", description: "Repositório GitHub deste projeto.",
      tags: [], official: false, scope: "project", ownerId: PROJECT_ID, createdBy: DEMO_USER.id, connectedAt: now, updatedAt: now
    }
  ];
  const teams: TeamRecord[] = [{
    id: TEAM_ID,
    name: "Equipe Aurora",
    description: "Equipe universitária de pequenos satélites.",
    memberIds: [DEMO_USER.memberId, ...MOCK_MEMBER_IDS],
    artifactIds: ["team-aurora-report", "team-aurora-lessons"],
    joinRequests: [],
    createdBy: DEMO_USER.id,
    createdAt: now,
    updatedAt: now,
    membership: "member",
    canManage: true
  }, {
    id: "team-zenith",
    name: "Zenith CubeSat",
    description: "Equipe OBSAT dedicada a CubeSats e sistemas embarcados.",
    memberIds: [COMMUNITY_MEMBER_IDS[0], COMMUNITY_MEMBER_IDS[1]],
    artifactIds: [],
    joinRequests: [],
    createdBy: "demo-zenith-ana",
    createdAt: now,
    updatedAt: now,
    membership: "available",
    canManage: false,
    memberCount: 7,
    artifactCount: 0,
    projectCount: 2
  }, {
    id: "team-sirius",
    name: "Sirius Nanosat",
    description: "Equipe OBSAT de instrumentação, telemetria e operação de pequenos satélites.",
    memberIds: [COMMUNITY_MEMBER_IDS[2], COMMUNITY_MEMBER_IDS[3]],
    artifactIds: [],
    joinRequests: [],
    createdBy: "demo-sirius-beatriz",
    createdAt: now,
    updatedAt: now,
    membership: "available",
    canManage: false,
    memberCount: 6,
    artifactCount: 0,
    projectCount: 1
  }, {
    id: "team-caracara",
    name: "Carcará Space",
    description: "Equipe OBSAT voltada a sensoriamento remoto e monitoramento ambiental.",
    memberIds: ["caracara-livia", "caracara-joao", "caracara-noemi"],
    artifactIds: [], joinRequests: [], createdBy: "demo-caracara-livia", createdAt: now, updatedAt: now,
    membership: "available", canManage: false, memberCount: 9, artifactCount: 0, projectCount: 3
  }, {
    id: "team-gauchosat",
    name: "GaúchoSat Lab",
    description: "Equipe OBSAT de comunicação, energia e testes de missão.",
    memberIds: ["gauchosat-aline", "gauchosat-davi", "gauchosat-pedro"],
    artifactIds: [], joinRequests: [], createdBy: "demo-gauchosat-aline", createdAt: now, updatedAt: now,
    membership: "available", canManage: false, memberCount: 8, artifactCount: 0, projectCount: 2
  }];
  return { schemaVersion: DEMO_SCHEMA_VERSION, members, artifacts, teams, projects: { [project.id]: project, [payloadProject.id]: payloadProject }, project, labs: {} };
}

function normalizeState(value: Partial<DemoState>, seedDefaults = false): DemoState {
  const fresh = initialState();
  const migrateMockMembers = Number(value.schemaVersion || 0) < DEMO_SCHEMA_VERSION;
  const projects = value.projects && typeof value.projects === "object" ? value.projects : {};
  if (value.project?.id) projects[value.project.id] = value.project;
  if (Object.keys(projects).length === 0 && Number(value.schemaVersion || 0) < DEMO_SCHEMA_VERSION) projects[fresh.project!.id] = fresh.project!;
  if (migrateMockMembers) {
    for (const project of Object.values(fresh.projects)) if (!projects[project.id]) projects[project.id] = project;
  }
  const members = Array.isArray(value.members) ? value.members : fresh.members;
  const owner = members.find((member) => member.accountId === DEMO_USER.id || member.id === DEMO_USER.memberId);
  if (owner) Object.assign(owner, { displayName: DEMO_USER.name, email: DEMO_USER.email, avatarUrl, accountStatus: "active", accessRole: "owner_admin" });
  else members.unshift(fresh.members[0]);
  if (migrateMockMembers) {
    for (const member of fresh.members.filter((item) => [...MOCK_MEMBER_IDS, ...COMMUNITY_MEMBER_IDS].includes(item.id))) {
      if (!members.some((item) => item.id === member.id)) members.push(member);
    }
  }
  const artifacts = Array.isArray(value.artifacts) ? value.artifacts.filter((artifact) => !artifact.official) : fresh.artifacts;
  if (seedDefaults) {
    for (const artifact of fresh.artifacts) if (!artifacts.some((item) => item.id === artifact.id)) artifacts.push(artifact);
  }
  const teams = Array.isArray(value.teams) ? value.teams.filter((team) => team.id !== "team-icarus") : fresh.teams;
  if (migrateMockMembers) {
    for (const team of fresh.teams) if (!teams.some((item) => item.id === team.id)) teams.push(team);
  }
  const primaryTeam = teams.find((team) => team.id === TEAM_ID);
  if (primaryTeam) {
    primaryTeam.memberIds = [...new Set([...primaryTeam.memberIds, DEMO_USER.memberId])];
    if (migrateMockMembers) primaryTeam.memberIds = [...new Set([...primaryTeam.memberIds, ...MOCK_MEMBER_IDS])];
    const existingArtifactIds = new Set(artifacts.map((artifact) => artifact.id));
    const currentArtifactIds = primaryTeam.artifactIds.filter((artifactId) => existingArtifactIds.has(artifactId));
    primaryTeam.artifactIds = seedDefaults ? [...new Set([...currentArtifactIds, "team-aurora-report", "team-aurora-lessons"])] : currentArtifactIds;
  }
  const activeProject = value.project?.id ? projects[value.project.id] : Object.values(projects)[0];
  return { schemaVersion: DEMO_SCHEMA_VERSION, members, artifacts, teams, projects, project: activeProject || null, labs: value.labs || {} };
}

function readState(): DemoState {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const raw = current || legacy;
    if (raw) {
      const state = normalizeState(JSON.parse(raw) as Partial<DemoState>, !current && Boolean(legacy));
      writeState(state);
      return state;
    }
  } catch {
    // A fresh demo is safer than preserving malformed browser data.
  }
  const state = initialState();
  writeState(state);
  return state;
}

function writeState(state: DemoState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bodyOf(init: RequestInit): Record<string, unknown> {
  return init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
}

function summary(project: MissionProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name || "Projeto sem título",
    programId: project.context.programId,
    teamId: project.context.teamId,
    updatedAt: project.updatedAt,
    memberCount: project.context.assignments.length
  };
}

export async function demoApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const state = readState();
  const method = (init.method || "GET").toUpperCase();
  const body = bodyOf(init);
  const memberMatch = path.match(/^\/team\/members\/([^/]+)$/u);
  const invitationMatch = path.match(/^\/team\/members\/([^/]+)\/invitation$/u);
  const artifactMatch = path.match(/^\/artifacts\/([^/]+)$/u);
  const teamMatch = path.match(/^\/teams\/([^/]+)$/u);
  const teamJoinMatch = path.match(/^\/teams\/([^/]+)\/join-requests$/u);
  const teamMemberMatch = path.match(/^\/teams\/([^/]+)\/members$/u);
  const teamMemberDeleteMatch = path.match(/^\/teams\/([^/]+)\/members\/([^/]+)$/u);
  const teamProjectsMatch = path.match(/^\/teams\/([^/]+)\/projects$/u);
  const projectMatch = path.match(/^\/projects\/([^/]+)$/u);
  const labMatch = path.match(/^\/workspace\/labs\/([^/]+)$/u);

  if (path === "/profile" && method === "GET") return { profile: state.members.find((member) => member.id === DEMO_USER.memberId) } as T;
  if (path === "/profile" && method === "PATCH") {
    const profile = state.members.find((member) => member.id === DEMO_USER.memberId)!;
    Object.assign(profile, body, { updatedAt: timestamp() });
    Object.assign(DEMO_USER, {
      name: profile.displayName,
      initials: profile.displayName.split(/\s+/u).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
      institution: profile.institution,
      avatarUrl: profile.avatarUrl,
      profileComplete: Boolean(profile.institution && profile.course && profile.academicStage)
    });
    writeState(state);
    return { profile, user: DEMO_USER } as T;
  }

  if (path === "/teams" && method === "GET") return { teams: state.teams.map((team) => {
    const membership = team.memberIds.includes(DEMO_USER.memberId) ? "member" : team.joinRequests.includes(DEMO_USER.memberId) ? "requested" : "available";
    const canManage = team.createdBy === DEMO_USER.id || (membership === "member" && DEMO_USER.accessRole === "owner_admin");
    const privateData = membership === "member" || canManage;
    return {
      ...team,
      memberIds: privateData ? team.memberIds : [],
      artifactIds: privateData ? team.artifactIds : [],
      joinRequests: canManage ? team.joinRequests : [],
      createdBy: privateData ? team.createdBy : null,
      memberCount: team.memberCount ?? team.memberIds.length,
      artifactCount: team.artifactIds.length,
      projectCount: team.projectCount ?? Object.values(state.projects).filter((project) => project.context.teamId === team.id).length,
      membership,
      canManage
    };
  }) } as T;
  if (teamProjectsMatch && method === "GET") {
    const team = state.teams.find((item) => item.id === teamProjectsMatch[1]);
    if (!team || !team.memberIds.includes(DEMO_USER.memberId)) throw new Error("Join this team to see its projects.");
    const projects: TeamProjectSummary[] = Object.values(state.projects).filter((project) => project.context.teamId === team.id).map((project) => {
      const roles = new Map(project.context.roles.map((item) => [item.id, item.name]));
      const sectors = new Map(project.context.sectors.map((item) => [item.id, item.name]));
      return {
        ...summary(project),
        participants: project.context.assignments.map((assignment) => {
          const member = state.members.find((item) => item.id === assignment.memberId);
          return {
            memberId: assignment.memberId,
            displayName: member?.displayName || "Membro",
            avatarUrl: member?.avatarUrl,
            roleId: assignment.roleId,
            roleName: roles.get(assignment.roleId) || assignment.roleId,
            sectorId: assignment.sectorId,
            sectorName: sectors.get(assignment.sectorId) || ""
          };
        })
      };
    });
    return { projects } as T;
  }
  if (path === "/directory/members" && method === "GET") {
    const directory: DirectoryMember[] = state.members.filter((member) => member.accountStatus === "active").map((member, index) => ({
      id: member.accountId || member.id,
      displayName: member.displayName,
      institution: member.institution,
      course: member.course,
      avatarUrl: member.avatarUrl,
      presence: member.id === DEMO_USER.memberId || index === 1 ? "online" : index < 4 ? "recent" : "offline"
    }));
    return { members: directory } as T;
  }
  if (path === "/teams" && method === "POST") {
    const now = timestamp();
    const team: TeamRecord = { id: id("team"), name: String(body.name || "Nova equipe"), description: String(body.description || ""), memberIds: [DEMO_USER.memberId], artifactIds: [], joinRequests: [], createdBy: DEMO_USER.id, createdAt: now, updatedAt: now, membership: "member", canManage: true };
    state.teams.push(team);
    writeState(state);
    return { team } as T;
  }
  if (teamMatch && method === "PATCH") {
    const team = state.teams.find((item) => item.id === teamMatch[1]);
    if (team) Object.assign(team, body, { updatedAt: timestamp() });
    writeState(state);
    return { team } as T;
  }
  if (teamMatch && method === "DELETE") {
    const teamId = teamMatch[1];
    if (Object.values(state.projects).some((project) => project.context.teamId === teamId)) throw new Error("Move or delete the projects connected to this team first.");
    const artifactIds = new Set(state.teams.find((team) => team.id === teamId)?.artifactIds || []);
    state.artifacts = state.artifacts.filter((artifact) => !artifactIds.has(artifact.id) && !(artifact.scope === "team" && artifact.ownerId === teamId));
    state.teams = state.teams.filter((team) => team.id !== teamId);
    writeState(state);
    return undefined as T;
  }
  if (teamJoinMatch && method === "POST") {
    const team = state.teams.find((item) => item.id === teamJoinMatch[1]);
    if (team && !team.memberIds.includes(DEMO_USER.memberId)) team.joinRequests = [...new Set([...team.joinRequests, DEMO_USER.memberId])];
    writeState(state);
    return { team } as T;
  }
  if (teamMemberMatch && method === "POST") {
    const team = state.teams.find((item) => item.id === teamMemberMatch[1]);
    if (team) team.memberIds = [...new Set([...team.memberIds, String(body.memberId)])];
    writeState(state);
    return { team } as T;
  }
  if (teamMemberDeleteMatch && method === "DELETE") {
    const team = state.teams.find((item) => item.id === teamMemberDeleteMatch[1]);
    if (team) {
      team.memberIds = team.memberIds.filter((memberId) => memberId !== teamMemberDeleteMatch[2]);
      team.joinRequests = team.joinRequests.filter((memberId) => memberId !== teamMemberDeleteMatch[2]);
      Object.values(state.projects).forEach((project) => {
        if (project.context.teamId === team.id) project.context.assignments = project.context.assignments.filter((assignment) => assignment.memberId !== teamMemberDeleteMatch[2]);
      });
    }
    writeState(state);
    return undefined as T;
  }

  if (path === "/projects" && method === "GET") return { projects: Object.values(state.projects).map(summary).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) } as T;
  if (path === "/projects" && method === "POST") {
    const project = body as unknown as MissionProject;
    state.projects[project.id] = project;
    state.project = project;
    writeState(state);
    return { project, revision: 1 } as T;
  }
  if (projectMatch && method === "GET") return { project: state.projects[projectMatch[1]] || null, revision: 1 } as T;
  if (projectMatch && method === "PUT") {
    const project = body as unknown as MissionProject;
    state.projects[project.id] = project;
    state.project = project;
    writeState(state);
    return { project, revision: 1 } as T;
  }
  if (projectMatch && method === "DELETE") {
    const projectId = projectMatch[1];
    const artifactIds = new Set(state.projects[projectId]?.context.projectArtifactIds || []);
    state.artifacts = state.artifacts.filter((artifact) => !artifactIds.has(artifact.id) && !(artifact.scope === "project" && artifact.ownerId === projectId));
    delete state.projects[projectId];
    delete state.labs[projectId];
    state.project = Object.values(state.projects).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null;
    writeState(state);
    return undefined as T;
  }

  if (path === "/team/members" && method === "GET") return { members: state.members } as T;
  if (path === "/artifacts" && method === "GET") return { artifacts: state.artifacts } as T;
  if (path === "/workspace/project" && method === "GET") return { project: state.project, revision: state.project ? 1 : 0 } as T;
  if (path === "/workspace/project" && method === "PUT") {
    const project = body as unknown as MissionProject;
    state.project = project;
    state.projects[project.id] = project;
    writeState(state);
    return { project, revision: 1 } as T;
  }
  if (labMatch && method === "GET") return { board: state.labs[labMatch[1]] ?? null, revision: state.labs[labMatch[1]] ? 1 : 0 } as T;
  if (labMatch && method === "PUT") {
    state.labs[labMatch[1]] = body;
    writeState(state);
    return { board: body, revision: 1 } as T;
  }

  if (path === "/team/members" && method === "POST") {
    const now = timestamp();
    const email = String(body.email || "");
    let member = state.members.find((item) => item.email.toLowerCase() === email.toLowerCase());
    if (!member) {
      member = {
        id: id("member"), accountId: null, displayName: String(body.displayName || email.split("@")[0] || "Nova pessoa"), email,
        missionRole: "member", primaryArea: "systems", secondaryAreas: [], institution: "", course: "", academicStage: "",
        skills: [], availabilityHours: 0, notes: "", accountStatus: "invited", accessRole: null, avatarUrl: "", createdAt: now, updatedAt: now
      };
      state.members.push(member);
    }
    const team = state.teams.find((item) => item.id === body.teamId);
    if (team) team.memberIds = [...new Set([...team.memberIds, member.id])];
    writeState(state);
    return { member } as T;
  }
  if (invitationMatch && method === "POST") {
    const member = state.members.find((item) => item.id === invitationMatch[1]);
    return { member } as T;
  }
  if (memberMatch && method === "PATCH") {
    const member = state.members.find((item) => item.id === memberMatch[1]);
    if (member) Object.assign(member, body, { updatedAt: timestamp() });
    writeState(state);
    return { member } as T;
  }
  if (memberMatch && method === "DELETE") {
    state.members = state.members.filter((item) => item.id !== memberMatch[1]);
    state.teams.forEach((team) => { team.memberIds = team.memberIds.filter((memberId) => memberId !== memberMatch[1]); });
    writeState(state);
    return undefined as T;
  }

  if (path === "/artifacts" && method === "POST") {
    const now = timestamp();
    const artifact = { ...body, id: id("artifact"), official: false, createdBy: DEMO_USER.id, connectedAt: now, updatedAt: now } as ConnectedArtifact;
    state.artifacts.push(artifact);
    if (artifact.scope === "team") {
      const team = state.teams.find((item) => item.id === artifact.ownerId);
      if (team) team.artifactIds = [...new Set([...team.artifactIds, artifact.id])];
    }
    writeState(state);
    return { artifact } as T;
  }
  if (artifactMatch && method === "PATCH") {
    const artifact = state.artifacts.find((item) => item.id === artifactMatch[1]);
    if (artifact) Object.assign(artifact, body, { updatedAt: timestamp() });
    writeState(state);
    return { artifact } as T;
  }
  if (artifactMatch && method === "DELETE") {
    state.artifacts = state.artifacts.filter((item) => item.id !== artifactMatch[1] || item.official);
    state.teams.forEach((team) => { team.artifactIds = team.artifactIds.filter((artifactId) => artifactId !== artifactMatch[1]); });
    writeState(state);
    return undefined as T;
  }

  throw new Error(`Unsupported Pages demo request: ${method} ${path}`);
}

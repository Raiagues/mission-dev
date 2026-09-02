import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_TEAM_ID = "team-aurora";
const TEAM_ARTIFACT_IDS = ["team-aurora-report", "team-aurora-lessons"];
const MOCK_MEMBER_IDS = ["aurora-lucas", "aurora-marina", "aurora-rafael"];

function defaultMembers(createdAt) {
  return [
    {
      id: MOCK_MEMBER_IDS[0], accountId: null, displayName: "Lucas Ferreira", email: "lucas.ferreira@norte.demo",
      missionRole: "manager", primaryArea: "electronics", secondaryAreas: [], institution: "Universidade Federal de Santa Maria",
      course: "Engenharia Elétrica", academicStage: "7º período", skills: [], availabilityHours: 10, notes: "",
      accountStatus: "invited", accessRole: null, avatarUrl: "", createdAt, updatedAt: createdAt
    },
    {
      id: MOCK_MEMBER_IDS[1], accountId: null, displayName: "Marina Costa", email: "marina.costa@norte.demo",
      missionRole: "member", primaryArea: "flight_software", secondaryAreas: [], institution: "Universidade Federal de Santa Maria",
      course: "Engenharia de Computação", academicStage: "6º período", skills: [], availabilityHours: 8, notes: "",
      accountStatus: "invited", accessRole: null, avatarUrl: "", createdAt, updatedAt: createdAt
    },
    {
      id: MOCK_MEMBER_IDS[2], accountId: null, displayName: "Rafael Nunes", email: "rafael.nunes@norte.demo",
      missionRole: "member", primaryArea: "structures", secondaryAreas: [], institution: "Universidade Federal de Santa Maria",
      course: "Engenharia Mecânica", academicStage: "8º período", skills: [], availabilityHours: 6, notes: "",
      accountStatus: "invited", accessRole: null, avatarUrl: "", createdAt, updatedAt: createdAt
    }
  ];
}

function defaultArtifacts(createdAt) {
  return [
    {
      id: "team-aurora-report",
      kind: "document",
      label: "Relatório final · Missão Aurora",
      url: "artifacts/relatorio-final-missao-aurora.md",
      description: "Relatório de referência produzido pela equipe em uma missão anterior.",
      tags: [],
      official: false,
      scope: "team",
      ownerId: DEFAULT_TEAM_ID,
      createdBy: null,
      connectedAt: createdAt,
      updatedAt: createdAt
    },
    {
      id: "team-aurora-lessons",
      kind: "dataset",
      label: "Lições aprendidas · Missão Aurora",
      url: "artifacts/licoes-aprendidas-missao-aurora.csv",
      description: "Decisões, falhas e ações corretivas registradas pela equipe.",
      tags: [],
      official: false,
      scope: "team",
      ownerId: DEFAULT_TEAM_ID,
      createdBy: null,
      connectedAt: createdAt,
      updatedAt: createdAt
    },
    {
      id: "norte-aurora-telemetry",
      kind: "repository",
      label: "norte-aurora-telemetria",
      url: "https://github.com/Raiagues/norte-aurora-telemetria",
      description: "Repositório GitHub de demonstração conectado ao projeto.",
      tags: [],
      official: false,
      scope: "project",
      ownerId: null,
      createdBy: null,
      connectedAt: createdAt,
      updatedAt: createdAt
    }
  ];
}

function defaultTeams(createdAt) {
  return [{
    id: DEFAULT_TEAM_ID,
    name: "Equipe Aurora",
    description: "Equipe universitária de desenvolvimento de pequenos satélites.",
    memberIds: [...MOCK_MEMBER_IDS],
    artifactIds: [...TEAM_ARTIFACT_IDS],
    joinRequests: [],
    createdBy: null,
    createdAt,
    updatedAt: createdAt
  }];
}

export function createInitialData() {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 6,
    createdAt: timestamp,
    updatedAt: timestamp,
    users: [],
    members: defaultMembers(timestamp),
    artifacts: defaultArtifacts(timestamp),
    teams: defaultTeams(timestamp),
    sessions: [],
    workspace: {
      project: null,
      projects: {},
      labs: {}
    }
  };
}

export function normalizeStoredData(value) {
  if (!value || ![1, 2, 3, 4, 5, 6].includes(value.schemaVersion) || !Array.isArray(value.users) || !Array.isArray(value.members) || !Array.isArray(value.artifacts)) {
    throw new Error("Unsupported Norte data schema.");
  }
  const migratingTeams = !Array.isArray(value.teams);
  const data = structuredClone(value);
  data.schemaVersion = 6;
  data.sessions = Array.isArray(data.sessions) ? data.sessions : [];
  data.workspace = data.workspace && typeof data.workspace === "object" && !Array.isArray(data.workspace)
    ? data.workspace
    : { project: null, projects: {}, labs: {} };
  data.workspace.project ??= null;
  if (!data.workspace.projects || typeof data.workspace.projects !== "object" || Array.isArray(data.workspace.projects)) data.workspace.projects = {};
  if (data.workspace.project?.document?.id) data.workspace.projects[data.workspace.project.document.id] ??= data.workspace.project;
  if (!data.workspace.labs || typeof data.workspace.labs !== "object" || Array.isArray(data.workspace.labs)) data.workspace.labs = {};
  data.members = data.members.filter((member) => member.accountStatus !== "demo" || Boolean(member.accountId));
  if (value.schemaVersion < 5) {
    for (const member of defaultMembers(data.createdAt || new Date().toISOString())) {
      if (!data.members.some((item) => item.id === member.id)) data.members.push(member);
    }
  }
  const retiredSeedLabels = new Set([
    "Edital oficial · Modalidade Prática",
    "Cronograma oficial OBSAT",
    "Lições aprendidas · Aurora",
    "aurora/telemetria-arduino"
  ]);
  if (value.schemaVersion < 4) {
    retiredSeedLabels.add("Relatório final · Missão Aurora");
    retiredSeedLabels.add("Lições aprendidas · Missão Aurora");
  }
  data.artifacts = data.artifacts.filter((artifact) => !artifact.official && !retiredSeedLabels.has(artifact.label)).map((artifact) => ({
    ...artifact,
    url: typeof artifact.url === "string" ? artifact.url.replace(/^\/mission-dev\/artifacts\//u, "artifacts/") : artifact.url
  }));
  if (value.schemaVersion < 4) {
    for (const artifact of defaultArtifacts(data.createdAt || new Date().toISOString())) {
      if (!data.artifacts.some((item) => item.id === artifact.id)) data.artifacts.push(artifact);
    }
  }
  data.artifacts = data.artifacts.map((artifact) => {
    if (TEAM_ARTIFACT_IDS.includes(artifact.id)) return { ...artifact, scope: "team", ownerId: DEFAULT_TEAM_ID };
    return { ...artifact, scope: artifact.scope === "team" ? "team" : "project", ownerId: artifact.ownerId ?? null };
  });

  data.teams = Array.isArray(data.teams) ? data.teams : [];
  if (value.schemaVersion < 6 && !data.teams.some((team) => team.id === DEFAULT_TEAM_ID)) data.teams.unshift(defaultTeams(data.createdAt || new Date().toISOString())[0]);
  const primaryTeam = data.teams.find((team) => team.id === DEFAULT_TEAM_ID);
  if (primaryTeam) {
    primaryTeam.memberIds = [...new Set([...(Array.isArray(primaryTeam.memberIds) ? primaryTeam.memberIds : []), ...(migratingTeams ? data.members.map((member) => member.id) : [])])];
    if (value.schemaVersion < 5) primaryTeam.memberIds = [...new Set([...primaryTeam.memberIds, ...MOCK_MEMBER_IDS])];
    const existingArtifactIds = new Set(data.artifacts.map((artifact) => artifact.id));
    const currentArtifactIds = (Array.isArray(primaryTeam.artifactIds) ? primaryTeam.artifactIds : []).filter((artifactId) => existingArtifactIds.has(artifactId));
    primaryTeam.artifactIds = value.schemaVersion < 4 ? [...new Set([...currentArtifactIds, ...TEAM_ARTIFACT_IDS])] : currentArtifactIds;
    primaryTeam.joinRequests = Array.isArray(primaryTeam.joinRequests) ? primaryTeam.joinRequests : [];
    primaryTeam.createdBy ??= data.users.find((user) => user.accessRole === "owner_admin")?.id ?? null;
  }

  for (const record of Object.values(data.workspace.projects)) {
    const project = record?.document;
    if (!project?.context) continue;
    project.context.teamId ??= project.context.teamName ? DEFAULT_TEAM_ID : null;
    project.context.teamArtifactIds = Array.isArray(project.context.teamArtifactIds)
      ? project.context.teamArtifactIds
      : project.context.teamId === DEFAULT_TEAM_ID ? [...TEAM_ARTIFACT_IDS] : [];
    project.context.projectArtifactIds = Array.isArray(project.context.projectArtifactIds) ? project.context.projectArtifactIds : [];
    if (project.context.teamId === DEFAULT_TEAM_ID && !project.context.teamName) project.context.teamName = primaryTeam?.name || "Equipe Aurora";
  }
  const activeProjectId = data.workspace.project?.document?.id;
  const repository = data.artifacts.find((artifact) => artifact.id === "norte-aurora-telemetry");
  if (repository && activeProjectId && value.schemaVersion < 4) {
    repository.ownerId ??= activeProjectId;
    const project = data.workspace.projects[activeProjectId]?.document;
    if (project?.context && !project.context.projectArtifactIds.includes(repository.id)) project.context.projectArtifactIds.push(repository.id);
  }
  return data;
}

function clone(value) {
  return structuredClone(value);
}

export class JsonDataStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
    this.queue = Promise.resolve();
  }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      this.data = normalizeStoredData(parsed);
      if (parsed.schemaVersion !== this.data.schemaVersion) await this.persist(this.data);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      this.data = createInitialData();
      await this.persist(this.data);
    }
    return this;
  }

  read() {
    if (!this.data) throw new Error("Data store was not initialized.");
    return clone(this.data);
  }

  update(mutator) {
    const operation = this.queue.then(async () => {
      const draft = this.read();
      const result = await mutator(draft);
      draft.updatedAt = new Date().toISOString();
      await this.persist(draft);
      this.data = draft;
      return clone(result);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async persist(data) {
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, this.filePath);
    await chmod(this.filePath, 0o600);
  }

  async close() {}
}

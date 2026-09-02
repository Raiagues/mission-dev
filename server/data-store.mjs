import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

function defaultMembers(createdAt) {
  void createdAt;
  return [];
}

function defaultArtifacts(createdAt) {
  return [
    {
      id: "norte-aurora-telemetry",
      kind: "repository",
      label: "norte-aurora-telemetria",
      url: "https://github.com/Raiagues/norte-aurora-telemetria",
      description: "Repositório GitHub de demonstração conectado à equipe.",
      tags: [],
      official: false,
      createdBy: null,
      connectedAt: createdAt,
      updatedAt: createdAt
    }
  ];
}

export function createInitialData() {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    users: [],
    members: defaultMembers(timestamp),
    artifacts: defaultArtifacts(timestamp),
    sessions: [],
    workspace: {
      project: null,
      labs: {}
    }
  };
}

export function normalizeStoredData(value) {
  if (!value || ![1, 2, 3].includes(value.schemaVersion) || !Array.isArray(value.users) || !Array.isArray(value.members) || !Array.isArray(value.artifacts)) {
    throw new Error("Unsupported Norte data schema.");
  }
  const data = structuredClone(value);
  data.schemaVersion = 3;
  data.sessions = Array.isArray(data.sessions) ? data.sessions : [];
  data.workspace = data.workspace && typeof data.workspace === "object" && !Array.isArray(data.workspace)
    ? data.workspace
    : { project: null, labs: {} };
  data.workspace.project ??= null;
  if (!data.workspace.labs || typeof data.workspace.labs !== "object" || Array.isArray(data.workspace.labs)) data.workspace.labs = {};
  data.members = data.members.filter((member) => member.accountStatus !== "demo" || Boolean(member.accountId));
  const retiredSeedLabels = new Set([
    "Edital oficial · Modalidade Prática",
    "Cronograma oficial OBSAT",
    "Relatório final · Missão Aurora",
    "Lições aprendidas · Aurora",
    "aurora/telemetria-arduino"
  ]);
  data.artifacts = data.artifacts.filter((artifact) => !artifact.official && !retiredSeedLabels.has(artifact.label)).map((artifact) => ({
    ...artifact,
    url: typeof artifact.url === "string" ? artifact.url.replace(/^\/mission-dev\/artifacts\//u, "artifacts/") : artifact.url
  }));
  if (!data.artifacts.some((artifact) => artifact.id === "norte-aurora-telemetry")) {
    data.artifacts.push(defaultArtifacts(data.createdAt || new Date().toISOString())[0]);
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

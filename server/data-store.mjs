import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

function defaultMembers(createdAt) {
  return [
    {
      id: randomUUID(),
      accountId: null,
      displayName: "Emilly Ribeiro",
      email: "emilly@exemplo.invalid",
      missionRole: "captain",
      primaryArea: "systems",
      secondaryAreas: ["project_management", "mission_payload"],
      institution: "Universidade Federal de Exemplo",
      course: "Engenharia Aeroespacial",
      academicStage: "7º período",
      skills: ["engenharia de sistemas", "requisitos", "revisões de projeto"],
      availabilityHours: 10,
      notes: "Perfil demonstrativo para estruturar a equipe inicial.",
      accountStatus: "demo",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: randomUUID(),
      accountId: null,
      displayName: "Lucas Menezes",
      email: "lucas@exemplo.invalid",
      missionRole: "manager",
      primaryArea: "obc_avionics",
      secondaryAreas: ["flight_software", "ait_testing"],
      institution: "Universidade Federal de Exemplo",
      course: "Engenharia de Computação",
      academicStage: "6º período",
      skills: ["C++", "sistemas embarcados", "telemetria"],
      availabilityHours: 8,
      notes: "Perfil demonstrativo de gerente técnico.",
      accountStatus: "demo",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: randomUUID(),
      accountId: null,
      displayName: "Bianca Souza",
      email: "bianca@exemplo.invalid",
      missionRole: "manager",
      primaryArea: "structures_thermal",
      secondaryAreas: ["ait_testing"],
      institution: "Universidade Federal de Exemplo",
      course: "Engenharia Mecânica",
      academicStage: "8º período",
      skills: ["CAD", "análise estrutural", "ensaios ambientais"],
      availabilityHours: 8,
      notes: "Perfil demonstrativo de estruturas e térmica.",
      accountStatus: "demo",
      createdAt,
      updatedAt: createdAt
    }
  ];
}

function defaultArtifacts(createdAt) {
  return [
    {
      id: randomUUID(),
      kind: "official",
      label: "Edital oficial · Modalidade Prática",
      url: "https://wiki.obsat.org.br/books/modalidade-pratica",
      description: "Regulamento vivo da 3ª OBSAT MCTI, mantido pela organização.",
      tags: ["OBSAT", "regulamento", "oficial"],
      official: true,
      createdBy: null,
      connectedAt: createdAt,
      updatedAt: createdAt
    },
    {
      id: randomUUID(),
      kind: "official",
      label: "Cronograma oficial OBSAT",
      url: "https://wiki.obsat.org.br/books/modalidade-pratica/page/cronograma",
      description: "Fases, entregas e datas atualizadas da modalidade prática.",
      tags: ["OBSAT", "cronograma", "oficial"],
      official: true,
      createdBy: null,
      connectedAt: createdAt,
      updatedAt: createdAt
    },
    {
      id: randomUUID(),
      kind: "document",
      label: "Relatório final · Missão Aurora",
      url: "artifacts/relatorio-final-missao-aurora.md",
      description: "Relatório demonstrativo de uma missão universitária anterior.",
      tags: ["mock", "relatório", "missão anterior"],
      official: false,
      createdBy: null,
      connectedAt: createdAt,
      updatedAt: createdAt
    },
    {
      id: randomUUID(),
      kind: "dataset",
      label: "Lições aprendidas · Aurora",
      url: "artifacts/licoes-aprendidas-missao-aurora.csv",
      description: "Registro demonstrativo de decisões, falhas e ações corretivas.",
      tags: ["mock", "lições aprendidas", "CSV"],
      official: false,
      createdBy: null,
      connectedAt: createdAt,
      updatedAt: createdAt
    },
    {
      id: randomUUID(),
      kind: "repository",
      label: "aurora/telemetria-arduino",
      url: "artifacts/arduino/README.md",
      description: "Repositório local demonstrativo para telemetria de um CanSat.",
      tags: ["mock", "Arduino", "telemetria"],
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
    schemaVersion: 2,
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
  if (!value || ![1, 2].includes(value.schemaVersion) || !Array.isArray(value.users) || !Array.isArray(value.members) || !Array.isArray(value.artifacts)) {
    throw new Error("Unsupported Norte data schema.");
  }
  const data = structuredClone(value);
  data.schemaVersion = 2;
  data.sessions = Array.isArray(data.sessions) ? data.sessions : [];
  data.workspace = data.workspace && typeof data.workspace === "object" && !Array.isArray(data.workspace)
    ? data.workspace
    : { project: null, labs: {} };
  data.workspace.project ??= null;
  if (!data.workspace.labs || typeof data.workspace.labs !== "object" || Array.isArray(data.workspace.labs)) data.workspace.labs = {};
  data.artifacts = data.artifacts.map((artifact) => ({
    ...artifact,
    url: typeof artifact.url === "string" ? artifact.url.replace(/^\/mission-dev\/artifacts\//u, "artifacts/") : artifact.url
  }));
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

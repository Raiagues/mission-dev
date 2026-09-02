import type { ConnectedArtifact, SessionUser, TeamMember } from "./team";

const STORAGE_KEY = "norte-pages-demo-v1";

type DemoState = {
  members: TeamMember[];
  artifacts: ConnectedArtifact[];
  project: unknown | null;
  labs: Record<string, unknown>;
};

export const DEMO_USER: SessionUser = {
  id: "pages-demo-owner",
  memberId: "pages-demo-captain",
  name: "Emilly Ribeiro",
  initials: "ER",
  email: "demo@norte.invalid",
  accessRole: "owner_admin",
  institution: "Ambiente local do navegador",
  primaryArea: "systems"
};

function timestamp() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function initialState(): DemoState {
  const now = timestamp();
  return {
    members: [
      {
        id: "pages-demo-captain",
        accountId: DEMO_USER.id,
        displayName: "Emilly Ribeiro",
        email: "emilly@exemplo.invalid",
        missionRole: "captain",
        primaryArea: "systems",
        secondaryAreas: ["project_management", "mission_payload"],
        institution: "Universidade Federal de Exemplo",
        course: "Engenharia Aeroespacial",
        academicStage: "7º período",
        skills: ["engenharia de sistemas", "requisitos"],
        availabilityHours: 10,
        notes: "Perfil demonstrativo.",
        accountStatus: "active",
        accessRole: "owner_admin",
        createdAt: now,
        updatedAt: now
      }
    ],
    artifacts: [
      { id: "norte-aurora-telemetry", kind: "repository", label: "norte-aurora-telemetria", url: "https://github.com/Raiagues/norte-aurora-telemetria", description: "Repositório GitHub de demonstração conectado à equipe.", tags: [], official: false, createdBy: DEMO_USER.id, connectedAt: now, updatedAt: now }
    ],
    project: null,
    labs: {}
  };
}

function readState(): DemoState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as DemoState | null;
    if (parsed && Array.isArray(parsed.members) && Array.isArray(parsed.artifacts)) {
      parsed.members = parsed.members.filter((member) => member.accountStatus !== "demo" || Boolean(member.accountId)).map((member) => member.accountId && member.accountStatus === "demo" ? { ...member, accountStatus: "active" } : member);
      const retiredLabels = new Set(["Relatório final · Missão Aurora", "Lições aprendidas · Aurora", "aurora/telemetria-arduino"]);
      parsed.artifacts = parsed.artifacts.filter((artifact) => !artifact.official && !retiredLabels.has(artifact.label));
      if (!parsed.artifacts.some((artifact) => artifact.id === "norte-aurora-telemetry")) {
        parsed.artifacts.push(initialState().artifacts[0]);
      }
      writeState(parsed);
      return parsed;
    }
  } catch {
    // A fresh demo is safer than keeping malformed browser data.
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

export async function demoApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const state = readState();
  const method = (init.method || "GET").toUpperCase();
  const body = bodyOf(init);
  const memberMatch = path.match(/^\/team\/members\/([^/]+)$/u);
  const invitationMatch = path.match(/^\/team\/members\/([^/]+)\/invitation$/u);
  const artifactMatch = path.match(/^\/artifacts\/([^/]+)$/u);
  const labMatch = path.match(/^\/workspace\/labs\/([^/]+)$/u);

  if (path === "/team/members" && method === "GET") return { members: state.members } as T;
  if (path === "/artifacts" && method === "GET") return { artifacts: state.artifacts } as T;
  if (path === "/workspace/project" && method === "GET") return { project: state.project, revision: state.project ? 1 : 0 } as T;
  if (path === "/workspace/project" && method === "PUT") {
    state.project = body;
    writeState(state);
    return { project: body, revision: 1 } as T;
  }
  if (labMatch && method === "GET") return { board: state.labs[labMatch[1]] ?? null, revision: state.labs[labMatch[1]] ? 1 : 0 } as T;
  if (labMatch && method === "PUT") {
    state.labs[labMatch[1]] = body;
    writeState(state);
    return { board: body, revision: 1 } as T;
  }

  if (path === "/team/members" && method === "POST") {
    const now = timestamp();
    const member = {
      id: id("member"),
      accountId: null,
      displayName: String(body.displayName || String(body.email || "").split("@")[0] || "New member"),
      email: String(body.email || ""),
      missionRole: "member",
      primaryArea: "systems",
      secondaryAreas: [],
      institution: "",
      course: "",
      academicStage: "",
      skills: [],
      availabilityHours: 0,
      notes: "",
      accountStatus: "invited",
      accessRole: null,
      createdAt: now,
      updatedAt: now
    } satisfies TeamMember;
    state.members.push(member);
    writeState(state);
    return { member, invitationCode: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}` } as T;
  }
  if (invitationMatch && method === "POST") return { invitationCode: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}` } as T;
  if (memberMatch && method === "PATCH") {
    const member = state.members.find((item) => item.id === memberMatch[1]);
    if (member) Object.assign(member, body, { updatedAt: timestamp() });
    writeState(state);
    return { member } as T;
  }
  if (memberMatch && method === "DELETE") {
    state.members = state.members.filter((item) => item.id !== memberMatch[1]);
    writeState(state);
    return undefined as T;
  }

  if (path === "/artifacts" && method === "POST") {
    const now = timestamp();
    const artifact = { ...body, id: id("artifact"), official: false, createdBy: DEMO_USER.id, connectedAt: now, updatedAt: now } as ConnectedArtifact;
    state.artifacts.push(artifact);
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
    writeState(state);
    return undefined as T;
  }

  throw new Error(`Unsupported Pages demo request: ${method} ${path}`);
}

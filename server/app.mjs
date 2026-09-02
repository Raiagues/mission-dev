import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import argon2 from "argon2";
import { JsonDataStore } from "./data-store.mjs";
import { PostgresDataStore } from "./postgres-store.mjs";
import { brainstormRequestSchema, createBrainstormAiService } from "./brainstorm-ai.mjs";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 15;
const ACCESS_ROLES = ["owner_admin", "captain", "manager", "member", "advisor"];
const MEMBER_STATUSES = ["demo", "invited", "active"];
const ARTIFACT_KINDS = ["official", "document", "repository", "dataset", "link"];
const COMMON_PASSWORDS = new Set([
  "123456789012345",
  "passwordpassword",
  "senha1234567890",
  "missiondev12345",
  "qwertyuiop12345"
]);

const string = (maxLength, minLength = 0) => ({ type: "string", minLength, maxLength });
const stringList = (maxItems = 12, maxLength = 80) => ({ type: "array", maxItems, items: string(maxLength, 1), uniqueItems: true });

const profileProperties = {
  displayName: string(100, 2),
  email: string(254, 3),
  missionRole: string(60),
  primaryArea: string(80),
  secondaryAreas: stringList(6, 80),
  institution: string(160, 2),
  course: string(120),
  academicStage: string(80),
  skills: stringList(16, 60),
  availabilityHours: { type: "integer", minimum: 0, maximum: 80 },
  notes: string(800),
  accountStatus: { type: "string", enum: MEMBER_STATUSES }
};

const registerBody = {
  type: "object",
  additionalProperties: false,
  required: ["name", "email", "password", "institution"],
  properties: {
    name: string(100, 2),
    email: string(254, 3),
    password: string(128, PASSWORD_MIN_LENGTH),
    institution: string(160, 2),
    course: string(120),
    academicStage: string(80),
    primaryArea: string(80),
    skills: stringList(16, 60),
    availabilityHours: { type: "integer", minimum: 0, maximum: 80 },
    inviteCode: string(80)
  }
};

const memberBody = {
  type: "object",
  additionalProperties: false,
  required: ["email"],
  properties: profileProperties
};

const memberPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: { ...profileProperties, accessRole: { type: "string", enum: ACCESS_ROLES } }
};

const artifactProperties = {
  kind: { type: "string", enum: ARTIFACT_KINDS },
  label: string(140, 2),
  url: string(1000, 1),
  description: string(500),
  tags: stringList(12, 50)
};

const artifactBody = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "label", "url"],
  properties: artifactProperties
};

const artifactPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: artifactProperties
};

function normalizeEmail(email) {
  return email.trim().toLocaleLowerCase("en-US");
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))];
}

function normalizePassword(value) {
  return value.normalize("NFKC");
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
}

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > 128) return false;
  return !COMMON_PASSWORDS.has(password.toLocaleLowerCase("en-US"));
}

function validateArtifactUrl(value) {
  if (/^artifacts\/[a-zA-Z0-9_./-]+$/u.test(value) && !value.includes("..")) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function constantTimeTextEqual(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && timingSafeEqual(a, b);
}

function initials(name) {
  return name.split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function publicUser(user) {
  return {
    id: user.id,
    memberId: user.memberId,
    name: user.name,
    initials: initials(user.name),
    email: user.email,
    accessRole: user.accessRole,
    institution: user.institution,
    primaryArea: user.primaryArea
  };
}

function publicMember(data, member) {
  const safe = { ...member };
  delete safe.invitationCodeHash;
  delete safe.invitationExpiresAt;
  const account = member.accountId ? data.users.find((item) => item.id === member.accountId) : null;
  safe.accessRole = account?.accessRole || null;
  return safe;
}

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function cleanMemberInput(body) {
  const email = normalizeEmail(body.email);
  return {
    displayName: normalizeText(body.displayName || email.split("@")[0] || "New member"),
    email,
    missionRole: body.missionRole || "member",
    primaryArea: body.primaryArea || "systems",
    secondaryAreas: normalizeList(body.secondaryAreas).filter((area) => area !== (body.primaryArea || "systems")),
    institution: normalizeText(body.institution || ""),
    course: normalizeText(body.course || ""),
    academicStage: normalizeText(body.academicStage || ""),
    skills: normalizeList(body.skills),
    availabilityHours: Number.isInteger(body.availabilityHours) ? body.availabilityHours : 0,
    notes: normalizeText(body.notes || ""),
    accountStatus: body.accountStatus || "invited"
  };
}

function cleanArtifactInput(body) {
  const url = normalizeText(body.url);
  if (!validateArtifactUrl(url)) throw httpError(400, "INVALID_URL", "Use an HTTP(S) address or a Norte artifact path.");
  return {
    kind: body.kind,
    label: normalizeText(body.label),
    url,
    description: normalizeText(body.description || ""),
    tags: normalizeList(body.tags)
  };
}

function validProjectDocument(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && value.schemaVersion === 2
    && typeof value.id === "string" && value.id.length > 0 && value.id.length <= 100
    && value.board && typeof value.board === "object"
    && Array.isArray(value.board.nodes) && Array.isArray(value.board.links);
}

function validLabBoard(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && value.schemaVersion === 1
    && Array.isArray(value.nodes) && Array.isArray(value.links)
    && value.nodes.length <= 500 && value.links.length <= 1_000;
}

export async function buildApp(options = {}) {
  const production = process.env.NODE_ENV === "production";
  const cookieName = production ? "__Host-norte_session" : "norte_session";
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  const store = options.store || await (options.storeFile || !databaseUrl
    ? new JsonDataStore(options.storeFile || resolve("var/mission-dev-data.json"))
    : new PostgresDataStore(databaseUrl)).init();
  const ai = createBrainstormAiService(options.ai);
  const logger = options.logger ?? {
    level: process.env.LOG_LEVEL || "info",
    redact: ["req.headers.cookie", "req.headers.authorization", "password", "body.password"]
  };
  const app = Fastify({ logger, bodyLimit: 512 * 1024, trustProxy: production });

  await app.register(cookie);
  await app.register(helmet, {
    global: true,
    crossOriginResourcePolicy: { policy: "same-site" }
  });
  await app.register(rateLimit, { global: false, ipv6Subnet: 64 });
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Norte API",
        version: "1.0.0",
        description: "Contas, equipe e memória de projetos de missões universitárias."
      },
      components: {
        securitySchemes: {
          sessionCookie: { type: "apiKey", in: "cookie", name: cookieName },
          csrfToken: { type: "apiKey", in: "header", name: "x-csrf-token" }
        }
      },
      tags: [
        { name: "System", description: "Saúde e disponibilidade" },
        { name: "Authentication", description: "Cadastro e sessão" },
        { name: "Team", description: "Perfis e responsabilidades" },
        { name: "Artifacts", description: "Fontes conectadas à missão" }
      ]
    }
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: false },
    staticCSP: true,
    transformStaticCSP: (header) => header
  });

  async function setSession(reply, userId) {
    const token = randomBytes(32).toString("base64url");
    const session = {
      id: randomUUID(),
      userId,
      tokenHash: hashToken(token),
      csrfToken: randomBytes(24).toString("base64url"),
      expiresAt: Date.now() + SESSION_TTL_MS
    };
    await store.update((data) => {
      data.sessions = data.sessions.filter((item) => item.expiresAt > Date.now());
      data.sessions.push(session);
      return null;
    });
    reply.setCookie(cookieName, token, {
      path: "/",
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      maxAge: Math.floor(SESSION_TTL_MS / 1000)
    });
    return session;
  }

  async function clearSession(request, reply) {
    const token = request.cookies[cookieName];
    if (token) {
      const tokenHash = hashToken(token);
      await store.update((data) => {
        data.sessions = data.sessions.filter((item) => item.tokenHash !== tokenHash && item.expiresAt > Date.now());
        return null;
      });
    }
    reply.clearCookie(cookieName, { path: "/", secure: production, sameSite: "strict" });
  }

  function getSessionUser(request) {
    const token = request.cookies[cookieName];
    if (!token) return null;
    const data = store.read();
    const session = data.sessions.find((item) => item.tokenHash === hashToken(token) && item.expiresAt > Date.now());
    if (!session) return null;
    const user = data.users.find((item) => item.id === session.userId && item.active);
    if (!user) return null;
    return { session, user };
  }

  async function requireAuth(request) {
    const auth = getSessionUser(request);
    if (!auth) throw httpError(401, "AUTH_REQUIRED", "Authentication is required.");
    request.auth = auth;
  }

  async function requireCsrf(request) {
    if (!request.auth) await requireAuth(request);
    const received = request.headers["x-csrf-token"];
    if (typeof received !== "string" || !constantTimeTextEqual(received, request.auth.session.csrfToken)) {
      throw httpError(403, "CSRF_INVALID", "The request verification token is missing or invalid.");
    }
  }

  function requireRole(user, allowed) {
    if (!allowed.includes(user.accessRole)) throw httpError(403, "FORBIDDEN", "Your project role cannot perform this action.");
  }

  function requireTeamRole(user, allowedAccessRoles, allowedProjectRoles) {
    if (allowedAccessRoles.includes(user.accessRole)) return;
    const assignments = store.read().workspace.project?.document?.context?.assignments;
    const assignment = Array.isArray(assignments) ? assignments.find((item) => item.memberId === user.memberId) : null;
    if (!assignment || !allowedProjectRoles.includes(assignment.roleId)) {
      throw httpError(403, "FORBIDDEN", "Your project role cannot perform this action.");
    }
  }

  app.addHook("onRequest", async (request) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    const allowedOrigins = new Set((process.env.NORTE_ALLOWED_ORIGINS || process.env.MISSION_ALLOWED_ORIGINS || "http://127.0.0.1:5173,http://localhost:5173").split(",").map((item) => item.trim()));
    const forwardedHost = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(",")[0].trim();
    const sameHost = (() => {
      try {
        return new URL(origin).host === forwardedHost;
      } catch {
        return false;
      }
    })();
    if (!sameHost && !allowedOrigins.has(origin)) throw httpError(403, "ORIGIN_REJECTED", "Request origin is not allowed.");
  });

  app.get("/api/health", {
    schema: { tags: ["System"], summary: "Check API health" }
  }, async () => {
    await store.health?.();
    return { status: "ok", version: "1.0.0", storage: databaseUrl ? "postgresql" : "local" };
  });

  app.get("/api/auth/session", {
    schema: { tags: ["Authentication"], summary: "Read the current session" }
  }, async (request) => {
    const auth = getSessionUser(request);
    const hasOwner = store.read().users.some((user) => user.accessRole === "owner_admin" && user.active);
    if (!auth) return { authenticated: false, hasOwner };
    return { authenticated: true, hasOwner, user: publicUser(auth.user), csrfToken: auth.session.csrfToken };
  });

  app.post("/api/auth/register", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    schema: { tags: ["Authentication"], summary: "Create an account", body: registerBody }
  }, async (request, reply) => {
    const body = request.body;
    const email = normalizeEmail(body.email);
    const password = normalizePassword(body.password);
    const inviteCode = normalizeText(body.inviteCode || "").toUpperCase();
    if (!validateEmail(email)) throw httpError(400, "INVALID_EMAIL", "Enter a valid email address.");
    if (!validatePassword(password)) throw httpError(400, "WEAK_PASSWORD", `Use a passphrase with at least ${PASSWORD_MIN_LENGTH} characters.`);
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1
    });

    const user = await store.update((data) => {
      if (data.users.some((item) => item.email === email)) throw httpError(409, "EMAIL_EXISTS", "An account already uses this email.");
      const timestamp = new Date().toISOString();
      const isFirstAccount = !data.users.some((item) => item.accessRole === "owner_admin" && item.active);
      const invitedMember = isFirstAccount ? null : data.members.find((item) => item.email === email && !item.accountId);
      if (!isFirstAccount) {
        const invitationValid = invitedMember?.invitationCodeHash
          && invitedMember.invitationExpiresAt > timestamp
          && constantTimeTextEqual(invitedMember.invitationCodeHash, hashToken(inviteCode));
        if (!invitationValid) throw httpError(403, "INVITATION_REQUIRED", "Use the active invitation code for this email address.");
      }
      const memberId = invitedMember?.id || randomUUID();
      const nextUser = {
        id: randomUUID(),
        memberId,
        name: normalizeText(body.name),
        email,
        passwordHash,
        accessRole: isFirstAccount ? "owner_admin" : invitedMember?.missionRole === "advisor" ? "advisor" : "member",
        institution: normalizeText(body.institution),
        primaryArea: invitedMember?.primaryArea || body.primaryArea || "systems",
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastLoginAt: timestamp
      };
      data.users.push(nextUser);
      if (invitedMember) {
        invitedMember.accountId = nextUser.id;
        invitedMember.displayName = nextUser.name;
        invitedMember.institution = nextUser.institution;
        invitedMember.course = normalizeText(body.course || invitedMember.course || "");
        invitedMember.academicStage = normalizeText(body.academicStage || invitedMember.academicStage || "");
        invitedMember.skills = normalizeList(body.skills).length ? normalizeList(body.skills) : invitedMember.skills;
        invitedMember.availabilityHours = Number.isInteger(body.availabilityHours) ? body.availabilityHours : invitedMember.availabilityHours;
        invitedMember.accountStatus = "active";
        invitedMember.updatedAt = timestamp;
        delete invitedMember.invitationCodeHash;
        delete invitedMember.invitationExpiresAt;
      } else {
        data.members.push({
          id: memberId,
          accountId: nextUser.id,
          displayName: nextUser.name,
          email,
          missionRole: "captain",
          primaryArea: body.primaryArea || "systems",
          secondaryAreas: [],
          institution: nextUser.institution,
          course: normalizeText(body.course || ""),
          academicStage: normalizeText(body.academicStage || ""),
          skills: normalizeList(body.skills),
          availabilityHours: Number.isInteger(body.availabilityHours) ? body.availabilityHours : 0,
          notes: "",
          accountStatus: "active",
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
      return nextUser;
    });
    const session = await setSession(reply, user.id);
    reply.code(201);
    return { user: publicUser(user), csrfToken: session.csrfToken };
  });

  app.post("/api/auth/login", {
    config: { rateLimit: { max: 8, timeWindow: "15 minutes" } },
    schema: {
      tags: ["Authentication"],
      summary: "Start a secure session",
      body: {
        type: "object",
        additionalProperties: false,
        required: ["email", "password"],
        properties: { email: string(254, 3), password: string(128, 1) }
      }
    }
  }, async (request, reply) => {
    const email = normalizeEmail(request.body.email);
    const password = normalizePassword(request.body.password);
    const user = store.read().users.find((item) => item.email === email && item.active);
    const valid = user ? await argon2.verify(user.passwordHash, password).catch(() => false) : false;
    if (!valid) throw httpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    await store.update((data) => {
      const storedUser = data.users.find((item) => item.id === user.id);
      if (storedUser) {
        storedUser.lastLoginAt = new Date().toISOString();
        storedUser.updatedAt = storedUser.lastLoginAt;
      }
      return null;
    });
    const session = await setSession(reply, user.id);
    return { user: publicUser(user), csrfToken: session.csrfToken };
  });

  app.post("/api/auth/logout", {
    preHandler: [requireAuth, requireCsrf],
    schema: { tags: ["Authentication"], summary: "End the current session", security: [{ sessionCookie: [], csrfToken: [] }] }
  }, async (request, reply) => {
    await clearSession(request, reply);
    reply.code(204).send();
  });

  app.get("/api/team/members", {
    preHandler: [requireAuth],
    schema: { tags: ["Team"], summary: "List mission team profiles", security: [{ sessionCookie: [] }] }
  }, async () => {
    const data = store.read();
    return { members: data.members.map((member) => publicMember(data, member)) };
  });

  app.post("/api/team/members", {
    preHandler: [requireAuth, requireCsrf],
    schema: { tags: ["Team"], summary: "Add or invite a team profile", security: [{ sessionCookie: [], csrfToken: [] }], body: memberBody }
  }, async (request, reply) => {
    requireTeamRole(request.auth.user, ["owner_admin", "captain", "manager"], ["captain", "manager"]);
    const input = cleanMemberInput(request.body);
    if (!validateEmail(input.email)) throw httpError(400, "INVALID_EMAIL", "Enter a valid email address.");
    if (request.auth.user.accessRole === "manager" && input.missionRole !== "member") throw httpError(403, "FORBIDDEN", "Managers can invite members only.");
    const invitationCode = randomBytes(9).toString("base64url").toUpperCase();
    const member = await store.update((data) => {
      if (data.members.some((item) => item.email === input.email)) throw httpError(409, "MEMBER_EXISTS", "A team profile already uses this email.");
      const timestamp = new Date().toISOString();
      const next = {
        id: randomUUID(),
        accountId: null,
        ...input,
        accountStatus: "invited",
        invitationCodeHash: hashToken(invitationCode),
        invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: timestamp,
        updatedAt: timestamp
      };
      data.members.push(next);
      return next;
    });
    reply.code(201);
    return { member: publicMember(store.read(), member), invitationCode };
  });

  app.post("/api/team/members/:id/invitation", {
    preHandler: [requireAuth, requireCsrf],
    schema: {
      tags: ["Team"],
      summary: "Create a one-time account invitation",
      security: [{ sessionCookie: [], csrfToken: [] }],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: string(80, 1) } }
    }
  }, async (request) => {
    requireTeamRole(request.auth.user, ["owner_admin", "captain"], ["captain"]);
    const invitationCode = randomBytes(9).toString("base64url").toUpperCase();
    const member = await store.update((data) => {
      const existing = data.members.find((item) => item.id === request.params.id);
      if (!existing) throw httpError(404, "MEMBER_NOT_FOUND", "Team member was not found.");
      if (existing.accountId) throw httpError(409, "ACCOUNT_EXISTS", "This profile already has an account.");
      existing.accountStatus = "invited";
      existing.invitationCodeHash = hashToken(invitationCode);
      existing.invitationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      existing.updatedAt = new Date().toISOString();
      return existing;
    });
    return { member: publicMember(store.read(), member), invitationCode };
  });

  app.patch("/api/team/members/:id", {
    preHandler: [requireAuth, requireCsrf],
    schema: {
      tags: ["Team"],
      summary: "Update a team profile",
      security: [{ sessionCookie: [], csrfToken: [] }],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: string(80, 1) } },
      body: memberPatchBody
    }
  }, async (request) => {
    const currentUser = request.auth.user;
    const isSelf = currentUser.memberId === request.params.id;
    if (!isSelf) requireTeamRole(currentUser, ["owner_admin", "captain", "manager"], ["captain", "manager"]);
    const member = await store.update((data) => {
      const existing = data.members.find((item) => item.id === request.params.id);
      if (!existing) throw httpError(404, "MEMBER_NOT_FOUND", "Team member was not found.");
      const body = request.body;
      if (body.email !== undefined) {
        const email = normalizeEmail(body.email);
        if (!validateEmail(email)) throw httpError(400, "INVALID_EMAIL", "Enter a valid email address.");
        if (existing.accountId && email !== existing.email) throw httpError(409, "ACCOUNT_EMAIL_LOCKED", "Change an active account email through the account security flow.");
        if (data.members.some((item) => item.id !== existing.id && item.email === email)) throw httpError(409, "MEMBER_EXISTS", "A team profile already uses this email.");
        existing.email = email;
      }
      const ownEditable = ["displayName", "primaryArea", "secondaryAreas", "institution", "course", "academicStage", "skills", "availabilityHours", "notes"];
      const managerEditable = [...ownEditable, "missionRole", "accountStatus"];
      const editable = isSelf && !["owner_admin", "captain", "manager"].includes(currentUser.accessRole) ? ownEditable : managerEditable;
      for (const key of editable) {
        if (body[key] === undefined) continue;
        existing[key] = ["secondaryAreas", "skills"].includes(key) ? normalizeList(body[key]) : normalizeText(body[key]);
      }
      if (existing.secondaryAreas) existing.secondaryAreas = existing.secondaryAreas.filter((area) => area !== existing.primaryArea);
      if (existing.accountId) {
        const account = data.users.find((item) => item.id === existing.accountId);
        if (account) {
          account.name = existing.displayName;
          account.institution = existing.institution;
          account.updatedAt = new Date().toISOString();
        }
      }
      if (body.accessRole !== undefined) {
        requireRole(currentUser, ["owner_admin"]);
        if (!existing.accountId) throw httpError(409, "ACCOUNT_REQUIRED", "This profile does not have an account yet.");
        const account = data.users.find((item) => item.id === existing.accountId);
        if (account?.accessRole === "owner_admin" && body.accessRole !== "owner_admin" && data.users.filter((item) => item.active && item.accessRole === "owner_admin").length === 1) {
          throw httpError(409, "LAST_OWNER", "The team must keep at least one owner administrator.");
        }
        if (account) account.accessRole = body.accessRole;
      }
      existing.updatedAt = new Date().toISOString();
      return existing;
    });
    return { member: publicMember(store.read(), member) };
  });

  app.delete("/api/team/members/:id", {
    preHandler: [requireAuth, requireCsrf],
    schema: {
      tags: ["Team"],
      summary: "Remove an unlinked team profile",
      security: [{ sessionCookie: [], csrfToken: [] }],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: string(80, 1) } }
    }
  }, async (request, reply) => {
    requireTeamRole(request.auth.user, ["owner_admin", "captain"], ["captain"]);
    await store.update((data) => {
      const index = data.members.findIndex((item) => item.id === request.params.id);
      if (index < 0) throw httpError(404, "MEMBER_NOT_FOUND", "Team member was not found.");
      if (data.members[index].accountId) throw httpError(409, "MEMBER_HAS_ACCOUNT", "Deactivate the account before removing this profile.");
      data.members.splice(index, 1);
      return null;
    });
    reply.code(204).send();
  });

  app.get("/api/artifacts", {
    preHandler: [requireAuth],
    schema: { tags: ["Artifacts"], summary: "List connected mission sources", security: [{ sessionCookie: [] }] }
  }, async () => ({ artifacts: store.read().artifacts }));

  app.post("/api/artifacts", {
    preHandler: [requireAuth, requireCsrf],
    schema: { tags: ["Artifacts"], summary: "Connect a source or artifact", security: [{ sessionCookie: [], csrfToken: [] }], body: artifactBody }
  }, async (request, reply) => {
    if (request.auth.user.accessRole === "advisor") throw httpError(403, "FORBIDDEN", "Advisors have read-only access to connected sources.");
    const input = cleanArtifactInput(request.body);
    const artifact = await store.update((data) => {
      const timestamp = new Date().toISOString();
      const next = { id: randomUUID(), ...input, official: false, createdBy: request.auth.user.id, connectedAt: timestamp, updatedAt: timestamp };
      data.artifacts.push(next);
      return next;
    });
    reply.code(201);
    return { artifact };
  });

  app.patch("/api/artifacts/:id", {
    preHandler: [requireAuth, requireCsrf],
    schema: {
      tags: ["Artifacts"],
      summary: "Update a connected source",
      security: [{ sessionCookie: [], csrfToken: [] }],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: string(80, 1) } },
      body: artifactPatchBody
    }
  }, async (request) => {
    const artifact = await store.update((data) => {
      const existing = data.artifacts.find((item) => item.id === request.params.id);
      if (!existing) throw httpError(404, "ARTIFACT_NOT_FOUND", "Connected source was not found.");
      if (existing.official) requireRole(request.auth.user, ["owner_admin"]);
      else if (existing.createdBy !== request.auth.user.id) requireRole(request.auth.user, ["owner_admin", "captain", "manager"]);
      const merged = cleanArtifactInput({ ...existing, ...request.body });
      Object.assign(existing, merged, { updatedAt: new Date().toISOString() });
      return existing;
    });
    return { artifact };
  });

  app.delete("/api/artifacts/:id", {
    preHandler: [requireAuth, requireCsrf],
    schema: {
      tags: ["Artifacts"],
      summary: "Disconnect a non-official source",
      security: [{ sessionCookie: [], csrfToken: [] }],
      params: { type: "object", additionalProperties: false, required: ["id"], properties: { id: string(80, 1) } }
    }
  }, async (request, reply) => {
    await store.update((data) => {
      const index = data.artifacts.findIndex((item) => item.id === request.params.id);
      if (index < 0) throw httpError(404, "ARTIFACT_NOT_FOUND", "Connected source was not found.");
      const artifact = data.artifacts[index];
      if (artifact.official) throw httpError(409, "OFFICIAL_SOURCE", "Official mission references cannot be disconnected.");
      if (artifact.createdBy !== request.auth.user.id) requireRole(request.auth.user, ["owner_admin", "captain", "manager"]);
      data.artifacts.splice(index, 1);
      return null;
    });
    reply.code(204).send();
  });

  app.get("/api/brainstorm-ai/status", {
    preHandler: [requireAuth],
    schema: { tags: ["System"], summary: "Check the private organization engine", security: [{ sessionCookie: [] }] }
  }, async () => ai.status());

  app.post("/api/brainstorm-ai/analyze", {
    preHandler: [requireAuth, requireCsrf],
    config: { rateLimit: { max: 20, timeWindow: "1 hour" } },
    schema: {
      tags: ["System"],
      summary: "Analyze or organize a brainstorming map",
      security: [{ sessionCookie: [], csrfToken: [] }],
      body: brainstormRequestSchema
    }
  }, async (request) => ai.analyze(request.body));

  app.get("/api/workspace/project", {
    preHandler: [requireAuth],
    schema: { tags: ["System"], summary: "Read the shared mission project", security: [{ sessionCookie: [] }] }
  }, async () => {
    const record = store.read().workspace.project;
    return { project: record?.document ?? null, revision: record?.revision ?? 0, updatedAt: record?.updatedAt ?? null };
  });

  app.put("/api/workspace/project", {
    preHandler: [requireAuth, requireCsrf],
    schema: {
      tags: ["System"],
      summary: "Persist the shared mission project",
      security: [{ sessionCookie: [], csrfToken: [] }],
      body: { type: "object", additionalProperties: true }
    }
  }, async (request) => {
    if (request.auth.user.accessRole === "advisor") throw httpError(403, "FORBIDDEN", "Advisors have read-only access to the project workspace.");
    if (!validProjectDocument(request.body)) throw httpError(400, "INVALID_PROJECT", "The project document is invalid or unsupported.");
    const currentContext = store.read().workspace.project?.document?.context;
    if (!isDeepStrictEqual(currentContext, request.body.context)) {
      requireTeamRole(request.auth.user, ["owner_admin", "captain", "manager"], ["captain", "manager"]);
    }
    return store.update((data) => {
      const previous = data.workspace.project;
      const record = {
        document: request.body,
        revision: (previous?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: request.auth.user.id
      };
      data.workspace.project = record;
      return { project: record.document, revision: record.revision, updatedAt: record.updatedAt };
    });
  });

  const labParams = {
    type: "object",
    additionalProperties: false,
    required: ["projectId"],
    properties: {
      projectId: {
        type: "string",
        minLength: 1,
        maxLength: 100,
        pattern: "^(?!__proto__$)(?!constructor$)(?!prototype$)[A-Za-z0-9._:-]+$"
      }
    }
  };

  app.get("/api/workspace/labs/:projectId", {
    preHandler: [requireAuth],
    schema: { tags: ["System"], summary: "Read a shared exploration map", security: [{ sessionCookie: [] }], params: labParams }
  }, async (request) => {
    const record = store.read().workspace.labs[request.params.projectId];
    return { board: record?.document ?? null, revision: record?.revision ?? 0, updatedAt: record?.updatedAt ?? null };
  });

  app.put("/api/workspace/labs/:projectId", {
    preHandler: [requireAuth, requireCsrf],
    schema: {
      tags: ["System"],
      summary: "Persist a shared exploration map",
      security: [{ sessionCookie: [], csrfToken: [] }],
      params: labParams,
      body: { type: "object", additionalProperties: true }
    }
  }, async (request) => {
    if (request.auth.user.accessRole === "advisor") throw httpError(403, "FORBIDDEN", "Advisors have read-only access to the project workspace.");
    if (!validLabBoard(request.body)) throw httpError(400, "INVALID_LAB_BOARD", "The exploration map is invalid or unsupported.");
    return store.update((data) => {
      const previous = data.workspace.labs[request.params.projectId];
      const record = {
        document: request.body,
        revision: (previous?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: request.auth.user.id
      };
      data.workspace.labs[request.params.projectId] = record;
      return { board: record.document, revision: record.revision, updatedAt: record.updatedAt };
    });
  });

  if (options.serveStatic ?? production) {
    await app.register(fastifyStatic, { root: resolve("dist"), prefix: "/" });
  }

  app.setErrorHandler((error, request, reply) => {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (statusCode >= 500) request.log.error({ err: error }, "request failed");
    const validation = error.validation ? "The submitted data is incomplete or invalid." : null;
    reply.code(statusCode).send({
      error: error.validation ? "VALIDATION_ERROR" : error.code || "INTERNAL_ERROR",
      message: validation || (statusCode < 500 ? error.message : "The server could not complete this request.")
    });
  });

  app.decorate("missionStore", store);
  app.addHook("onClose", async () => store.close?.());
  return app;
}

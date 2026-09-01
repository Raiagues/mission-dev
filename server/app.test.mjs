import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { buildApp } from "./app.mjs";

function cookieFrom(response) {
  return response.headers["set-cookie"].split(";")[0];
}

test("first registration creates an owner session and protects mutations", async (t) => {
  const storeFile = join(tmpdir(), `mission-dev-${randomUUID()}.json`);
  const app = await buildApp({ storeFile, logger: false });
  t.after(async () => {
    await app.close();
    await rm(storeFile, { force: true });
  });

  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: "Marina Costa",
      email: "marina@example.edu.br",
      password: "uma frase longa para a missao",
      institution: "Universidade de Exemplo",
      course: "Engenharia Aeroespacial",
      academicStage: "5º período",
      primaryArea: "systems",
      skills: ["requisitos"]
    }
  });

  assert.equal(registration.statusCode, 201);
  assert.equal(registration.json().user.accessRole, "owner_admin");
  assert.match(registration.headers["set-cookie"], /HttpOnly/i);
  assert.match(registration.headers["set-cookie"], /SameSite=Strict/i);

  const cookie = cookieFrom(registration);
  const session = await app.inject({ method: "GET", url: "/api/auth/session", headers: { cookie } });
  assert.equal(session.json().authenticated, true);

  const rejected = await app.inject({
    method: "POST",
    url: "/api/team/members",
    headers: { cookie },
    payload: {
      displayName: "João Lima",
      email: "joao@example.edu.br",
      missionRole: "member",
      primaryArea: "flight_software",
      institution: "Universidade de Exemplo"
    }
  });
  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.json().error, "CSRF_INVALID");

  const accepted = await app.inject({
    method: "POST",
    url: "/api/team/members",
    headers: { cookie, "x-csrf-token": registration.json().csrfToken },
    payload: {
      displayName: "João Lima",
      email: "joao@example.edu.br",
      missionRole: "member",
      primaryArea: "flight_software",
      institution: "Universidade de Exemplo"
    }
  });
  assert.equal(accepted.statusCode, 201);

  const persisted = await readFile(storeFile, "utf8");
  assert.doesNotMatch(persisted, /uma frase longa para a missao/);
  assert.match(persisted, /\$argon2id\$/);
});

test("later registrations receive member access and invalid credentials are rejected", async (t) => {
  const storeFile = join(tmpdir(), `mission-dev-${randomUUID()}.json`);
  const app = await buildApp({ storeFile, logger: false });
  t.after(async () => {
    await app.close();
    await rm(storeFile, { force: true });
  });

  const base = {
    password: "outra frase longa e segura",
    institution: "Universidade de Exemplo",
    primaryArea: "communications_ground"
  };
  const owner = await app.inject({ method: "POST", url: "/api/auth/register", payload: { ...base, name: "Primeira Pessoa", email: "owner@example.edu.br" } });
  const invitation = await app.inject({
    method: "POST",
    url: "/api/team/members",
    headers: { cookie: cookieFrom(owner), "x-csrf-token": owner.json().csrfToken },
    payload: {
      displayName: "Segunda Pessoa",
      email: "member@example.edu.br",
      missionRole: "member",
      primaryArea: "communications_ground",
      institution: "Universidade de Exemplo"
    }
  });
  assert.equal(invitation.statusCode, 201);
  assert.ok(invitation.json().invitationCode);
  assert.equal("invitationCodeHash" in invitation.json().member, false);

  const withoutInvitation = await app.inject({ method: "POST", url: "/api/auth/register", payload: { ...base, name: "Sem Convite", email: "sem-convite@example.edu.br" } });
  assert.equal(withoutInvitation.statusCode, 403);
  assert.equal(withoutInvitation.json().error, "INVITATION_REQUIRED");

  const second = await app.inject({ method: "POST", url: "/api/auth/register", payload: { ...base, name: "Segunda Pessoa", email: "member@example.edu.br", inviteCode: invitation.json().invitationCode } });
  assert.equal(second.statusCode, 201);
  assert.equal(second.json().user.accessRole, "member");

  const secondCookie = cookieFrom(second);
  const team = await app.inject({ method: "GET", url: "/api/team/members", headers: { cookie: secondCookie } });
  assert.equal(team.statusCode, 200);
  assert.equal(team.json().members.filter((member) => member.email === "member@example.edu.br").length, 1);
  assert.doesNotMatch(JSON.stringify(team.json()), /invitationCodeHash/);

  const memberCannotInvite = await app.inject({
    method: "POST",
    url: "/api/team/members",
    headers: { cookie: secondCookie, "x-csrf-token": second.json().csrfToken },
    payload: {
      displayName: "Terceira Pessoa",
      email: "third@example.edu.br",
      missionRole: "member",
      primaryArea: "flight_software",
      institution: "Universidade de Exemplo"
    }
  });
  assert.equal(memberCannotInvite.statusCode, 403);

  const unsafeArtifact = await app.inject({
    method: "POST",
    url: "/api/artifacts",
    headers: { cookie: secondCookie, "x-csrf-token": second.json().csrfToken },
    payload: { kind: "link", label: "Unsafe", url: "javascript:alert(1)" }
  });
  assert.equal(unsafeArtifact.statusCode, 400);

  const artifact = await app.inject({
    method: "POST",
    url: "/api/artifacts",
    headers: { cookie: secondCookie, "x-csrf-token": second.json().csrfToken },
    payload: { kind: "repository", label: "Mission firmware", url: "https://github.com/example/mission", tags: ["firmware"] }
  });
  assert.equal(artifact.statusCode, 201);

  const lastOwner = await app.inject({
    method: "PATCH",
    url: `/api/team/members/${owner.json().user.memberId}`,
    headers: { cookie: cookieFrom(owner), "x-csrf-token": owner.json().csrfToken },
    payload: { accessRole: "member" }
  });
  assert.equal(lastOwner.statusCode, 409);
  assert.equal(lastOwner.json().error, "LAST_OWNER");

  const invalidLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "member@example.edu.br", password: "senha incorreta e comprida" } });
  assert.equal(invalidLogin.statusCode, 401);
  assert.equal(invalidLogin.json().error, "INVALID_CREDENTIALS");
});

test("sessions and shared workspaces survive a server restart", async (t) => {
  const storeFile = join(tmpdir(), `norte-${randomUUID()}.json`);
  let app = await buildApp({ storeFile, logger: false, ai: { apiKey: "" } });
  t.after(async () => {
    await app.close().catch(() => undefined);
    await rm(storeFile, { force: true });
  });

  const registration = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: "Equipe Norte",
      email: "owner@norte.example",
      password: "uma frase segura para o norte",
      institution: "Universidade de Exemplo",
      primaryArea: "systems"
    }
  });
  const cookie = cookieFrom(registration);
  const csrf = registration.json().csrfToken;
  const project = { schemaVersion: 2, id: "mission-persistence", board: { nodes: [], links: [] } };
  const lab = { schemaVersion: 1, nodes: [], links: [] };

  assert.equal((await app.inject({ method: "PUT", url: "/api/workspace/project", headers: { cookie, "x-csrf-token": csrf }, payload: project })).statusCode, 200);
  assert.equal((await app.inject({ method: "PUT", url: "/api/workspace/labs/mission-persistence", headers: { cookie, "x-csrf-token": csrf }, payload: lab })).statusCode, 200);
  const aiStatus = await app.inject({ method: "GET", url: "/api/brainstorm-ai/status", headers: { cookie } });
  assert.equal(aiStatus.statusCode, 200);
  assert.equal(aiStatus.json().configured, false);

  await app.close();
  app = await buildApp({ storeFile, logger: false, ai: { apiKey: "" } });

  const session = await app.inject({ method: "GET", url: "/api/auth/session", headers: { cookie } });
  assert.equal(session.json().authenticated, true);
  const restoredProject = await app.inject({ method: "GET", url: "/api/workspace/project", headers: { cookie } });
  assert.equal(restoredProject.json().project.id, project.id);
  const restoredLab = await app.inject({ method: "GET", url: "/api/workspace/labs/mission-persistence", headers: { cookie } });
  assert.equal(restoredLab.json().board.schemaVersion, 1);
});

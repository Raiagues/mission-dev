/* global document, getComputedStyle, innerHeight, innerWidth, localStorage, location */
import { chromium } from "playwright-core";

const baseUrl = process.env.NORTE_URL || "http://127.0.0.1:5175/norte/";
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome-stable", headless: true, args: ["--no-sandbox"] });

async function measure(page, label) {
  return page.evaluate((name) => {
    const body = document.body;
    const visible = [...document.querySelectorAll("button, input, select, h1, h2, p, strong, small")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== "hidden";
      });
    const sizes = visible.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)).filter(Number.isFinite);
    return {
      label: name,
      hash: location.hash,
      viewport: [innerWidth, innerHeight],
      bodyOverflowX: body.scrollWidth - innerWidth,
      smallestVisibleText: sizes.length ? Math.min(...sizes) : 0,
      title: document.querySelector("h1")?.textContent?.trim() || ""
    };
  }, label);
}

async function acceptNextDialog(page) {
  page.once("dialog", (dialog) => dialog.accept());
}

const context = await browser.newContext({ viewport: { width: 1920, height: 924 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await page.screenshot({ path: "/tmp/norte-home-desktop.png", fullPage: true });
const homeActions = page.locator(".home-action-grid > button");
if (await homeActions.count() !== 3) throw new Error("Home should expose exactly three square actions.");
if ((await homeActions.nth(0).innerText()).includes("Abrir projeto") === false) throw new Error("Open project should appear before new project.");
if ((await homeActions.nth(1).innerText()).includes("Novo projeto") === false) throw new Error("New project should be the second action.");
if (await page.getByText("PROJETOS ASSOCIADOS", { exact: true }).count()) throw new Error("Associated projects must not be permanently visible on home.");
if ((await page.locator("h1").innerText()) !== "NORTE") throw new Error("Home should keep NORTE as its only heading.");
const avatarLoaded = await page.locator(".home-landing-topbar .account-badge-trigger .avatar img").evaluate((image) => image.complete && image.naturalWidth > 0);
if (!avatarLoaded) throw new Error("The demo profile image did not load.");
const results = [await measure(page, "home-desktop")];
await page.locator(".mission-sidebar-toggle").click();
if (await page.locator(".mission-context-switcher select").count() !== 2) throw new Error("Expanded navigation should provide project and default team selectors.");
await page.screenshot({ path: "/tmp/norte-sidebar-expanded.png", fullPage: true });
await page.locator(".mission-sidebar-toggle").click();

await homeActions.first().click();
await page.locator(".home-project-dialog").waitFor();
const initialProjectCount = await page.locator(".home-project-picker-row").count();
if (initialProjectCount < 1) throw new Error("Open project should list the demo account projects inside a dialog.");
await page.locator(".home-project-open").first().click();
await page.waitForURL(/#\/study-setup$/u);
await page.screenshot({ path: "/tmp/norte-memory-populated.png", fullPage: true });
if (await page.locator(".pm-artifact-card").count() < 3) throw new Error("Project memory should show linked team and project artifacts.");
results.push(await measure(page, "memory-populated"));

const teamArtifactRows = page.locator(".pm-artifact-band").first().locator(".pm-artifact-card");
const initialTeamArtifactCount = await teamArtifactRows.count();
await teamArtifactRows.first().locator(".pm-artifact-actions button").last().click();
if (await teamArtifactRows.count() !== initialTeamArtifactCount - 1) throw new Error("Unlinking should remove only the artifact from project memory.");
await page.locator(".pm-artifact-band").first().getByRole("button", { name: "Selecionar" }).click();
await page.locator(".pm-selection-list.artifacts label").first().click();
await page.locator(".pm-dialog").getByRole("button", { name: "Salvar" }).click();
if (await teamArtifactRows.count() !== initialTeamArtifactCount) throw new Error("A team artifact should be linkable again.");

await page.locator(".pm-team-band").getByRole("button", { name: "Configurar equipe" }).click();
if (await page.locator(".ptc-list-scroll > article").count() < 4) throw new Error("The demo team should expose the captain and three mock members.");
await page.getByRole("button", { name: "Hierarquia", exact: true }).click();
if (await page.locator(".ptc-member").count() < 4) throw new Error("The roles hierarchy should show project participants and responsibilities.");
await page.screenshot({ path: "/tmp/norte-team-config-roles.png", fullPage: true });
await page.getByRole("button", { name: "Setores", exact: true }).click();
if (await page.locator(".ptc-sector-node").count() < 3) throw new Error("The sectors hierarchy should show persisted organizational units.");
if (await page.locator(".ptc-member").count() !== 0) throw new Error("The sectors hierarchy must not render project members.");
await page.screenshot({ path: "/tmp/norte-team-config-sectors.png", fullPage: true });
await page.locator(".pm-dialog").getByRole("button", { name: "Fechar" }).click();

await page.locator(".pm-topbar .account-badge-trigger").click();
await page.getByRole("button", { name: /Ver e editar perfil/u }).click();
await page.locator(".profile-dialog").waitFor();
const profilePhotoLoaded = await page.locator(".profile-avatar-editor img").evaluate((image) => image.complete && image.naturalWidth > 0);
if (!profilePhotoLoaded) throw new Error("The profile dialog image did not load.");
await page.screenshot({ path: "/tmp/norte-profile.png", fullPage: true });
await page.locator(".profile-dialog").getByRole("button", { name: "Fechar" }).click();

await page.goto(baseUrl + "#/teams", { waitUntil: "networkidle" });
await page.locator(".teams-hub-layout").waitFor();
if (await page.locator(".teams-hub-tabs > button").count() !== 2) throw new Error("Teams should separate private teams and the OBSAT community.");
if (await page.locator(".teams-project-list > article").count() < 2) throw new Error("A private team should show its associated projects.");
await page.screenshot({ path: "/tmp/norte-teams-private.png", fullPage: true });

await page.getByRole("button", { name: /Comunidade/u }).click();
await page.locator(".teams-private-notice").waitFor();
if (await page.locator(".teams-member-list article").count()) throw new Error("Public team profiles must not expose the private member list.");
if (await page.locator(".teams-artifact-list article").count()) throw new Error("Public team profiles must not expose private artifacts.");
await page.screenshot({ path: "/tmp/norte-teams-community.png", fullPage: true });

await page.getByRole("button", { name: /Minhas equipes/u }).click();
await page.locator(".teams-hub-layout").waitFor();
await page.getByRole("button", { name: "Criar equipe" }).click();
await page.locator('.teams-dialog input[name="name"]').fill("Equipe Temporária");
await page.locator('.teams-dialog textarea[name="description"]').fill("Equipe criada para validar o ciclo de exclusão.");
await page.locator(".teams-dialog").getByRole("button", { name: "Salvar" }).click();
await page.locator(".teams-hub-detail h2", { hasText: "Equipe Temporária" }).waitFor();
await acceptNextDialog(page);
await page.locator('.teams-detail-actions button[aria-label="Excluir equipe"]').click();
await page.locator(".teams-hub-detail h2", { hasText: "Equipe Aurora" }).waitFor();

await page.locator(".teams-hub-list section > button", { hasText: "Equipe Aurora" }).click();
const artifactCountBeforeUpload = await page.locator(".teams-artifact-list article").count();
await page.getByRole("button", { name: "Adicionar documento" }).click();
await page.locator('.teams-dialog input[name="name"]').fill("Matriz de decisões");
await page.locator(".teams-dialog").getByRole("button", { name: "Arquivo" }).click();
await page.locator(".artifact-file-input").setInputFiles({ name: "decisoes.csv", mimeType: "text/csv", buffer: Buffer.from("decisao,responsavel\nTeste,Equipe\n") });
await page.locator(".artifact-file-ready").waitFor();
await page.locator(".teams-dialog").getByRole("button", { name: "Salvar" }).click();
if (await page.locator(".teams-artifact-list article").count() !== artifactCountBeforeUpload + 1) throw new Error("A dropped local file should persist in the team library.");
const uploadedArtifact = page.locator(".teams-artifact-list article", { hasText: "Matriz de decisões" });
await acceptNextDialog(page);
await uploadedArtifact.getByRole("button", { name: /Excluir documento/u }).click();
await uploadedArtifact.waitFor({ state: "detached" });
results.push(await measure(page, "teams-desktop"));

await page.goto(baseUrl + "#/", { waitUntil: "networkidle" });
await page.locator(".home-action-card.accent-create").click();
await page.waitForURL(/#\/study-setup$/u);
const projectCountWhileDraft = await page.evaluate(() => {
  const state = JSON.parse(localStorage.getItem("norte-pages-demo-v2") || "{}" );
  return Object.keys(state.projects || {}).length;
});
if (projectCountWhileDraft !== initialProjectCount) throw new Error("Clicking New project must not persist an untitled project.");
const createProjectButton = page.locator(".pm-footer > button", { hasText: "Criar projeto e começar" });
await createProjectButton.waitFor();
if (await createProjectButton.count() !== 1) throw new Error("A draft should clearly require final project creation.");

await page.locator(".pm-project-name input").fill("Projeto de validação");
await page.locator(".pm-empty-program").click();
await page.locator('.pm-program-picker [role="radio"]').filter({ hasText: "OBSAT" }).click();
if (await page.locator(".pm-official-library a").count() < 2) throw new Error("Program details should expose official documents and the next milestone.");
await page.locator(".pm-dialog").getByRole("button", { name: "Salvar" }).click();
await page.locator(".pm-team-band .pm-track-empty").click();
await page.locator(".pm-team-config > label select").selectOption("team-aurora");
const memberChoices = page.locator(".ptc-list-scroll > article:not(.selected) > label");
while (await memberChoices.count()) await memberChoices.first().click();
await page.locator(".pm-dialog").getByRole("button", { name: /Salvar configuração/u }).click();
if (await page.locator(".pm-footer > button").isDisabled()) throw new Error("A complete project memory should enable project creation.");
await page.screenshot({ path: "/tmp/norte-memory-new.png", fullPage: true });
await page.locator(".pm-footer > button").click();
await page.waitForURL(/#\/brainstorming$/u);

const conceptionTabs = page.locator(".brain-mode-tabs > button");
if (await conceptionTabs.count() !== 3) throw new Error("Conception should expose timeline, discovery, and consolidated system tabs.");
if ((await conceptionTabs.nth(0).innerText()).includes("Cronograma") === false) throw new Error("Timeline should be the first conception view.");
if ((await conceptionTabs.nth(1).innerText()).includes("Descoberta") === false || (await conceptionTabs.nth(1).innerText()).includes("BETA") === false) throw new Error("Discovery should be the first map and remain marked as beta.");
await page.locator(".lab-canvas").waitFor();
await page.waitForTimeout(1800);
await page.getByRole("button", { name: "Nova ideia", exact: true }).click();
const discoveryComposer = page.locator(".lab-composer textarea");
await discoveryComposer.waitFor();
await discoveryComposer.fill("Observar queimadas na Amazônia");
await discoveryComposer.press("Enter");
await discoveryComposer.fill("Detectar focos durante a noite");
await discoveryComposer.press("Enter");
await discoveryComposer.fill("Usar câmera térmica");
await discoveryComposer.press("Enter");
await discoveryComposer.press("Escape");
await page.waitForTimeout(1100);
if (await page.locator(".lab-node").count() !== 3) throw new Error("Discovery should create ideas continuously with Enter.");
await page.getByRole("button", { name: "Estruturar missão", exact: true }).click();
await page.locator(".lab-domain").first().waitFor();
await page.waitForTimeout(1000);
if (await page.locator(".lab-domain").count() < 2) throw new Error("Mission structure should separate ideas into contextual areas.");
if (await page.locator(".lab-gap").count() < 1) throw new Error("Disconnected hierarchy fragments should expose a question instead of inventing a relation.");
await page.screenshot({ path: "/tmp/norte-discovery-structured.png", fullPage: true });

await page.locator(".lab-node").first().locator(".lab-node-head button").click();
await page.locator(".lab-card-menu").getByRole("button", { name: "Decidida", exact: true }).click();
await page.waitForFunction(() => [...document.querySelectorAll(".brain-mode-tabs .tab-count")].some((element) => element.textContent?.trim() === "1"));
await page.getByRole("tab", { name: /Sistema consolidado/u }).click();
await page.locator(".mission-node-title", { hasText: "Observar queimadas na Amazônia" }).waitFor();
await page.screenshot({ path: "/tmp/norte-system-consolidated.png", fullPage: true });

await page.getByRole("tab", { name: /Cronograma/u }).click();
await page.locator(".conception-timeline").waitFor();
if (await page.locator(".timeline-phase-list > a").count() < 5) throw new Error("The OBSAT timeline should expose the official conception phases.");
if (await page.locator(".gantt-bar").count() < 5) throw new Error("The official schedule should render every phase as a Gantt bar.");
const ganttWidths = await page.locator(".gantt-bar").evaluateAll((bars) => bars.map((bar) => Math.round(bar.getBoundingClientRect().width)));
if (new Set(ganttWidths).size < 3) throw new Error("Gantt phase bars should reflect different schedule durations.");
await page.screenshot({ path: "/tmp/norte-conception-timeline.png", fullPage: true });

await page.getByRole("tab", { name: /Descoberta/u }).click();
await page.locator(".lab-domain").first().waitFor();
for (let index = 0; index < 7; index += 1) await page.getByRole("button", { name: "Diminuir zoom", exact: true }).click();
await page.locator(".lab-canvas.semantic-overview").waitFor();
const overviewNodeOpacity = await page.locator(".lab-canvas.semantic-overview .lab-node").first().evaluate((element) => getComputedStyle(element).opacity);
if (overviewNodeOpacity !== "0") throw new Error("Semantic overview should summarize domains instead of rendering every idea.");
await page.screenshot({ path: "/tmp/norte-discovery-overview.png", fullPage: true });
await page.getByRole("button", { name: /Abrir área:/u }).first().click();
await page.locator(".lab-canvas:not(.semantic-overview)").waitFor();
await page.screenshot({ path: "/tmp/norte-discovery-domain.png", fullPage: true });

await page.goto(baseUrl + "#/", { waitUntil: "networkidle" });
await page.locator(".home-action-card.accent-open").click();
if (await page.locator(".home-project-picker-row").count() !== initialProjectCount + 1) throw new Error("A project should appear only after final confirmation.");
await page.locator(".home-project-picker-row", { hasText: "Projeto de validação" }).locator(".home-project-open").click();
await page.waitForURL(/#\/brainstorming$/u);
await page.goto(baseUrl + "#/", { waitUntil: "networkidle" });
await page.locator(".home-action-card.accent-open").click();
const createdProjectRow = page.locator(".home-project-picker-row", { hasText: "Projeto de validação" });
await acceptNextDialog(page);
await createdProjectRow.locator(".home-project-delete").click();
await createdProjectRow.waitFor({ state: "detached" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobile.goto(baseUrl + "#/", { waitUntil: "networkidle" });
await mobile.screenshot({ path: "/tmp/norte-home-mobile.png", fullPage: true });
results.push(await measure(mobile, "home-mobile"));

const laptop = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
await laptop.goto(baseUrl + "#/study-setup", { waitUntil: "networkidle" });
await laptop.locator(".pm-workspace").waitFor();
await laptop.screenshot({ path: "/tmp/norte-memory-laptop.png", fullPage: true });
results.push(await measure(laptop, "memory-laptop"));

const laptopConception = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
await laptopConception.goto(baseUrl + "?view=discovery#/brainstorming", { waitUntil: "networkidle" });
await laptopConception.locator(".brainstorm-lab").waitFor();
const conceptionLayout = await laptopConception.evaluate(() => {
  const tabs = document.querySelector(".brain-mode-tabs")?.getBoundingClientRect();
  const toolbar = document.querySelector(".lab-toolbar")?.getBoundingClientRect();
  return {
    tabsRight: tabs?.right ?? 0,
    toolbarRight: toolbar?.right ?? 0,
    toolbarBottom: toolbar?.bottom ?? 0
  };
});
if (conceptionLayout.tabsRight > 1366 || conceptionLayout.toolbarRight > 1366 || conceptionLayout.toolbarBottom > 768) {
  throw new Error("The conception navigation or toolbar does not fit a 1366x768 notebook viewport.");
}
await laptopConception.screenshot({ path: "/tmp/norte-conception-laptop.png", fullPage: true });
results.push(await measure(laptopConception, "conception-laptop"));

const mobileTeams = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobileTeams.goto(baseUrl + "#/teams", { waitUntil: "networkidle" });
await mobileTeams.locator(".teams-hub-tabs").waitFor();
await mobileTeams.screenshot({ path: "/tmp/norte-teams-mobile.png", fullPage: true });
results.push(await measure(mobileTeams, "teams-mobile"));

const mobileConception = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobileConception.goto(baseUrl + "?view=timeline#/brainstorming", { waitUntil: "networkidle" });
await mobileConception.locator(".brain-mode-tabs").waitFor();
await mobileConception.screenshot({ path: "/tmp/norte-conception-mobile.png", fullPage: true });
results.push(await measure(mobileConception, "conception-mobile"));

for (const result of results) {
  if (result.bodyOverflowX > 1) throw new Error(`${result.label} overflows horizontally by ${result.bodyOverflowX}px.`);
}

console.log(JSON.stringify({ homeActionCount: await homeActions.count(), initialProjectCount, initialTeamArtifactCount, results }, null, 2));
await browser.close();

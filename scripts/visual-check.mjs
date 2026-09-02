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

const context = await browser.newContext({ viewport: { width: 1920, height: 924 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await page.screenshot({ path: "/tmp/norte-home-desktop.png", fullPage: true });
const homeActions = await page.locator(".dashboard-actions > button").count();
if (homeActions !== 3) throw new Error("Home should expose exactly three main actions.");
const projectRows = await page.locator(".home-project-list > button").count();
if (projectRows < 1) throw new Error("The demo account should have an associated project.");
const avatarLoaded = await page.locator(".dashboard-topbar .account-badge-trigger .avatar img").evaluate((image) => image.complete && image.naturalWidth > 0);
if (!avatarLoaded) throw new Error("The demo profile image did not load.");
const results = [await measure(page, "home-desktop")];

await page.locator(".home-project-list > button").first().click();
await page.waitForURL(/#\/study-setup$/u);
await page.screenshot({ path: "/tmp/norte-memory-populated.png", fullPage: true });
if (await page.locator(".pm-artifact-row").count() < 3) throw new Error("Project memory should show linked team and project artifacts.");
results.push(await measure(page, "memory-populated"));

const teamArtifactRows = page.locator(".pm-artifact-section").first().locator(".pm-artifact-row");
const initialTeamArtifactCount = await teamArtifactRows.count();
await teamArtifactRows.first().locator(".pm-artifact-actions button").last().click();
if (await teamArtifactRows.count() !== initialTeamArtifactCount - 1) throw new Error("Unlinking should remove only the artifact from project memory.");
await page.locator(".pm-artifact-section").first().getByRole("button", { name: "Selecionar" }).click();
await page.locator(".pm-selection-list.artifacts label").first().click();
await page.locator(".pm-dialog").getByRole("button", { name: "Salvar" }).click();
if (await teamArtifactRows.count() !== initialTeamArtifactCount) throw new Error("A team artifact should be linkable again.");

await page.locator(".pm-section-actions").getByRole("button", { name: "Cargos e setores" }).click();
await page.locator(".pm-structure-editor").waitFor();
await page.getByRole("button", { name: "Adicionar setor" }).click();
const sectorInput = page.locator(".pm-structure-editor > section").nth(1).locator("input").last();
await sectorInput.fill("Operações");
await page.locator(".pm-dialog").getByRole("button", { name: "Salvar" }).click();
if (await page.locator(".pm-members-strip label").last().locator("select option", { hasText: "Operações" }).count() !== 1) throw new Error("The new project sector should be available to members.");

await page.locator(".pm-topbar .account-badge-trigger").click();
await page.getByRole("button", { name: /Ver e editar perfil/u }).click();
await page.locator(".profile-dialog").waitFor();
const profilePhotoLoaded = await page.locator(".profile-avatar-editor img").evaluate((image) => image.complete && image.naturalWidth > 0);
if (!profilePhotoLoaded) throw new Error("The profile dialog image did not load.");
await page.screenshot({ path: "/tmp/norte-profile.png", fullPage: true });
await page.locator(".profile-dialog").getByRole("button", { name: "Fechar" }).click();

await page.goto(baseUrl + "#/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Novo projeto/u }).first().click();
await page.waitForURL(/#\/study-setup$/u);
const nameInput = page.locator(".pm-project-name input");
await nameInput.fill("Projeto de validação");
await page.locator(".pm-program-control select").selectOption("obsat");
await page.locator(".pm-team-select select").selectOption("team-aurora");
await page.waitForTimeout(350);
if (await page.locator(".pm-artifact-section").first().locator(".pm-artifact-row").count() < 2) throw new Error("Selecting a team should import its artifacts.");
if (await page.locator(".pm-members-strip article").count() < 1) throw new Error("Selecting a team should select a project member.");
if (await page.locator(".pm-footer > button").isDisabled()) throw new Error("A complete project memory should enable conception.");
await page.screenshot({ path: "/tmp/norte-memory-new.png", fullPage: true });
results.push(await measure(page, "memory-new"));

await page.goto(baseUrl + "#/teams", { waitUntil: "networkidle" });
await page.locator(".teams-hub-layout").waitFor();
await page.screenshot({ path: "/tmp/norte-teams.png", fullPage: true });
results.push(await measure(page, "teams-desktop"));

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobile.goto(baseUrl + "#/", { waitUntil: "networkidle" });
await mobile.screenshot({ path: "/tmp/norte-home-mobile.png", fullPage: true });
results.push(await measure(mobile, "home-mobile"));

const laptop = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
await laptop.goto(baseUrl + "#/study-setup", { waitUntil: "networkidle" });
await laptop.locator(".pm-workspace").waitFor();
await laptop.screenshot({ path: "/tmp/norte-memory-laptop.png", fullPage: true });
results.push(await measure(laptop, "memory-laptop"));

const mobileMemory = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobileMemory.goto(baseUrl + "#/study-setup", { waitUntil: "networkidle" });
await mobileMemory.locator(".pm-workspace").waitFor();
await mobileMemory.screenshot({ path: "/tmp/norte-memory-mobile.png", fullPage: true });
results.push(await measure(mobileMemory, "memory-mobile"));

const mobileTeams = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobileTeams.goto(baseUrl + "#/teams", { waitUntil: "networkidle" });
await mobileTeams.locator(".teams-hub-layout").waitFor();
await mobileTeams.screenshot({ path: "/tmp/norte-teams-mobile.png", fullPage: true });
results.push(await measure(mobileTeams, "teams-mobile"));

console.log(JSON.stringify({ homeActions, projectRows, initialTeamArtifactCount, results }, null, 2));
await browser.close();

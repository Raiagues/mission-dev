import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("shared mission sidebar architecture", () => {
  it("renders one persistent sidebar from the app shell", () => {
    const app = source("src/App.tsx");
    expect((app.match(/<MissionSidebar\b/g) ?? []).length).toBe(1);
    expect(app).toContain("const [sidebarExpanded, setSidebarExpanded] = useState(false)");
  });

  it("does not render page-specific sidebars on home or project memory", () => {
    expect(source("src/pages/HomePage.tsx")).not.toContain("home-sidebar");
    expect(source("src/pages/StudySetupPage.tsx")).not.toContain("setup-sidebar");
  });

  it("suppresses the remaining legacy conception sidebar before paint", () => {
    const app = source("src/App.tsx");
    expect(app).toContain(".app-page .brain-sidebar");
    expect(app).toContain("useLayoutEffect");
  });

  it("keeps distinct complete, current and locked visual states", () => {
    const css = source("src/mission-sidebar.css");
    expect(css).toContain(".mission-phase.complete");
    expect(css).toContain(".mission-phase.current");
    expect(css).toContain(".mission-phase.locked");
    expect(css).toContain(".mission-phase-check");
    expect(css).toContain(".mission-phase-lock");
  });
});

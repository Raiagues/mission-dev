import { describe, expect, it } from "vitest";
import { buildVirtualProjectFiles, createBoardFromSetup, createEmptyProject, strongestStateForNodeIds } from "../src/lib/projectStore";

describe("mission project model", () => {
  it("creates a versioned exportable project", () => {
    const project = createEmptyProject("en");
    expect(project.schemaVersion).toBe(2);
    expect(buildVirtualProjectFiles(project).map((file) => file.path)).toContain("/config/progress.json");
    expect(buildVirtualProjectFiles(project).map((file) => file.path)).toContain("/studies/inconsistencies.json");
  });

  it("seeds a problem study without selecting spacecraft hardware", () => {
    const project = createEmptyProject("en");
    project.setup.intent = "problem";
    project.setup.statement = "Reduce the delay in detecting new wildfire outbreaks.";
    const board = createBoardFromSetup(project, "en");
    expect(board.nodes[0].title).toContain("wildfire");
    expect(board.nodes.some((node) => (node.title ?? "").toLowerCase().includes("antenna"))).toBe(false);
    expect(board.nodes.some((node) => (node.title ?? "").toLowerCase().includes("orbit"))).toBe(false);
  });

  it("derives custom criterion state from project evidence", () => {
    const project = createEmptyProject("en");
    const board = createBoardFromSetup(project, "en");
    const ids = [board.nodes[0].id];
    expect(strongestStateForNodeIds(board.nodes, ids)).toBe("defined");
  });
});
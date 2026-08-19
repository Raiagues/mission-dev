import { describe, expect, it } from "vitest";
import { canCloseProblemPhase, countWords, createInitialLinks, createInitialNodes, getIssues, getProgress, getVisibleNodeIds, limitWords } from "../src/lib/missionModel";

describe("mission conception model", () => {
  it("limits card text to 24 words", () => {
    const text = Array.from({ length: 30 }, (_, index) => `w${index + 1}`).join(" ");
    expect(countWords(limitWords(text))).toBe(24);
  });

  it("detects the initial coverage and latency tension", () => {
    const issues = getIssues(createInitialNodes());
    expect(issues.some((issue) => issue.key === "coverage-latency")).toBe(true);
  });

  it("does not allow the Problem phase to close before mandatory evidence is defined", () => {
    expect(canCloseProblemPhase(createInitialNodes())).toBe(false);
  });

  it("computes conception progress from evidence states", () => {
    expect(getProgress(createInitialNodes())).toBeGreaterThan(0);
    expect(getProgress(createInitialNodes())).toBeLessThan(100);
  });

  it("returns descendants for focused pages", () => {
    const visible = getVisibleNodeIds(2, createInitialNodes(), createInitialLinks());
    expect(visible.has(2)).toBe(true);
    expect(visible.has(6)).toBe(true);
    expect(visible.has(4)).toBe(false);
  });
});

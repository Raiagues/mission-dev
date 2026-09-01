import { describe, expect, it } from "vitest";
import {
  appendLabAction,
  computeGentleLabLayout,
  createLabAction,
  createEmptyLabBoard,
  createLabLink,
  createLabNode,
  deriveLabGroups,
  deriveLabSuggestions,
  labStorageKey,
  loadLabBoard,
  saveLabBoard
} from "../src/lib/brainstormLab";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

describe("experimental brainstorm board", () => {
  it("keeps its data isolated per project", () => {
    const storage = memoryStorage();
    const board = createEmptyLabBoard();
    board.nodes.push(createLabNode("Detectar queimadas mais rápido", 300, 200, "idea-a"));
    saveLabBoard("mission-a", board, storage);

    expect(loadLabBoard("mission-a", storage).nodes[0].text).toContain("queimadas");
    expect(loadLabBoard("mission-b", storage).nodes).toHaveLength(0);
    expect(storage.getItem(labStorageKey("mission-a"))).not.toBeNull();
  });

  it("persists team memory and AI insights with the canvas", () => {
    const storage = memoryStorage();
    let board = createEmptyLabBoard();
    board.nodes = [createLabNode("Baixo consumo", 120, 160, "energy")];
    board = appendLabAction(board, createLabAction("created", "Created without AI.", ["energy"], "team", "action-1", "2026-09-01T00:00:00.000Z"));
    board.insights = [{
      id: "needs-context:energy",
      kind: "needs-context",
      nodeIds: ["energy"],
      title: "Precisa de contexto",
      detail: "Definir uma meta mensurável.",
      question: "Qual é o limite?",
      source: "gemini",
      updatedAt: "2026-09-01T00:00:01.000Z"
    }];

    saveLabBoard("mission-memory", board, storage);
    const loaded = loadLabBoard("mission-memory", storage);
    expect(loaded.teamMemory[0]).toMatchObject({ kind: "created", source: "team" });
    expect(loaded.insights[0]).toMatchObject({ kind: "needs-context", nodeIds: ["energy"] });
  });

  it("suggests contextual relationships without confirming them", () => {
    const board = createEmptyLabBoard();
    board.nodes = [
      createLabNode("Precisa funcionar à noite", 300, 200, "night", "2026-01-01T00:00:00.000Z"),
      createLabNode("Usar câmera térmica", 720, 260, "thermal", "2026-01-01T00:00:01.000Z")
    ];

    const suggestions = deriveLabSuggestions(board);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ from: "night", to: "thermal", kind: "related" });
    expect(board.links).toHaveLength(0);

    board.links.push(createLabLink("night", "thermal", "confirmed"));
    expect(deriveLabSuggestions(board)).toHaveLength(0);
  });

  it("recognizes provisional groups from raw ideas", () => {
    const board = createEmptyLabBoard();
    board.nodes = [
      createLabNode("Detectar queimadas", 100, 100, "one"),
      createLabNode("Monitorar incêndios", 400, 100, "two"),
      createLabNode("Avisar a equipe", 700, 100, "three")
    ];
    expect(deriveLabGroups(board, "pt").some((group) => group.label === "Queimadas" && group.nodeIds.length === 2)).toBe(true);
  });

  it("moves ideas gently while preserving manually positioned cards", () => {
    const board = createEmptyLabBoard();
    board.nodes = [
      { ...createLabNode("Operar à noite", 100, 100, "pinned"), pinned: true },
      createLabNode("Câmera térmica", 850, 100, "moving")
    ];
    const beforeDistance = board.nodes[1].x - board.nodes[0].x;
    const arranged = computeGentleLabLayout(board, deriveLabSuggestions(board), "moving");
    const afterDistance = arranged[1].x - arranged[0].x;

    expect(arranged[0]).toMatchObject({ x: 100, y: 100, pinned: true });
    expect(afterDistance).toBeLessThan(beforeDistance);
    expect(Math.abs(arranged[1].x - board.nodes[1].x)).toBeLessThanOrEqual(64);
  });
});

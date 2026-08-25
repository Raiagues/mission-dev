import { useEffect, useRef } from "react";
import { BrainstormPage } from "./BrainstormPage";
import type { MissionProject } from "../lib/projectStore";
import type { Language } from "../lib/types";

type Props = {
  language: Language;
  project: MissionProject;
  t: (path: string) => string;
  onLanguageChange: (language: Language) => void;
  onProjectChange: (project: MissionProject) => void;
  onHome: () => void;
  onBackSetup: () => void;
};

type DragState = {
  pointerId: number;
  nodeId: number;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  element: HTMLElement;
};

export function BrainstormPageFixed(props: Props) {
  const projectRef = useRef(props.project);
  const onProjectChangeRef = useRef(props.onProjectChange);

  projectRef.current = props.project;
  onProjectChangeRef.current = props.onProjectChange;

  useEffect(() => {
    let drag: DragState | null = null;

    function worldPoint(clientX: number, clientY: number) {
      const canvas = document.querySelector<HTMLElement>(".mission-canvas");
      const world = document.querySelector<HTMLElement>(".canvas-world");
      if (!canvas || !world) return null;

      const canvasRect = canvas.getBoundingClientRect();
      const transformValue = getComputedStyle(world).transform;
      const matrix = new DOMMatrixReadOnly(transformValue === "none" ? undefined : transformValue);
      const inverse = matrix.inverse();
      const local = new DOMPoint(clientX - canvasRect.left, clientY - canvasRect.top).matrixTransform(inverse);
      return { x: local.x, y: local.y };
    }

    function onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const nodeElement = target?.closest<HTMLElement>(".mission-node[data-node-id]");
      if (!nodeElement) return;
      if (target?.closest("button, .node-connector")) return;

      const nodeId = Number(nodeElement.dataset.nodeId);
      const node = projectRef.current.board.nodes.find((item) => item.id === nodeId);
      const point = worldPoint(event.clientX, event.clientY);
      if (!node || !point) return;

      event.preventDefault();
      drag = {
        pointerId: event.pointerId,
        nodeId,
        offsetX: point.x - node.x,
        offsetY: point.y - node.y,
        x: node.x,
        y: node.y,
        element: nodeElement
      };

      nodeElement.setPointerCapture?.(event.pointerId);
      nodeElement.classList.add("dragging");
      document.body.classList.add("workspace-interacting");
    }

    function onPointerMove(event: PointerEvent) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const point = worldPoint(event.clientX, event.clientY);
      if (!point) return;

      event.preventDefault();
      const x = Math.max(0, Math.min(2360, point.x - drag.offsetX));
      const y = Math.max(0, Math.min(1480, point.y - drag.offsetY));
      drag.x = x;
      drag.y = y;
      drag.element.style.left = `${x}px`;
      drag.element.style.top = `${y}px`;
    }

    function finishDrag(event: PointerEvent) {
      if (!drag || drag.pointerId !== event.pointerId) return;

      const finished = drag;
      drag = null;
      finished.element.classList.remove("dragging");
      document.body.classList.remove("workspace-interacting");

      const current = projectRef.current;
      const nodes = current.board.nodes.map((node) => node.id === finished.nodeId ? { ...node, x: finished.x, y: finished.y } : node);
      onProjectChangeRef.current({ ...current, board: { ...current.board, nodes } });
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      document.body.classList.remove("workspace-interacting");
    };
  }, []);

  return <BrainstormPage {...props} />;
}

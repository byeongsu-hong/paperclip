import { useEffect, useRef } from "react";
import { ArrowRightToLine, ArrowDownToLine, GripVertical, GripHorizontal, X, SquareTerminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "../context/SidebarContext";
import { useTerminalPanel } from "../context/TerminalPanelContext";
import { TerminalPane } from "./TerminalPane";
import { cn } from "../lib/utils";

export function GlobalTerminalPanel() {
  const { isMobile } = useSidebar();
  const {
    visible,
    hasActivated,
    position,
    width,
    height,
    commandRequest,
    closeTerminalPanel,
    setTerminalPanelPosition,
    setTerminalPanelWidth,
    setTerminalPanelHeight,
  } = useTerminalPanel();
  const dragStateRef = useRef<
    | { kind: "width"; startX: number; startWidth: number }
    | { kind: "height"; startY: number; startHeight: number }
    | null
  >(null);

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/api/terminal`;

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const drag = dragStateRef.current;
      if (!drag) return;
      if (drag.kind === "width") {
        setTerminalPanelWidth(drag.startWidth + (drag.startX - event.clientX));
      } else {
        setTerminalPanelHeight(drag.startHeight + (drag.startY - event.clientY));
      }
    }

    function onPointerUp() {
      dragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [setTerminalPanelHeight, setTerminalPanelWidth]);

  function startWidthResize(clientX: number) {
    dragStateRef.current = { kind: "width", startX: clientX, startWidth: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function startHeightResize(clientY: number) {
    dragStateRef.current = { kind: "height", startY: clientY, startHeight: height };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }

  if (isMobile || !hasActivated) return null;

  return (
    <aside
      className={cn(
        "absolute z-30 hidden md:flex overflow-hidden rounded-tl-xl border border-border bg-card shadow-2xl transition-[transform,opacity,height,width] duration-200 ease-in-out",
        position === "right"
          ? "right-0 top-0 bottom-0 border-r-0 border-b-0"
          : "bottom-0 left-0 right-0 border-l-0 border-r-0 border-b-0",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
        visible
          ? "translate-x-0 translate-y-0"
          : position === "right"
            ? "translate-x-8"
            : "translate-y-8",
      )}
      style={
        position === "right"
          ? { width: visible ? width : 0 }
          : { height: visible ? height : 0 }
      }
    >
      {position === "right" ? (
        <button
          type="button"
          aria-label="Resize terminal panel width"
          className="absolute left-0 top-0 bottom-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize items-center justify-center bg-transparent"
          onPointerDown={(event) => startWidthResize(event.clientX)}
        >
          <span className="h-16 w-1 rounded-full bg-border/80" />
        </button>
      ) : (
        <button
          type="button"
          aria-label="Resize terminal panel height"
          className="absolute left-0 right-0 top-0 z-10 flex h-3 -translate-y-1/2 cursor-row-resize items-center justify-center bg-transparent"
          onPointerDown={(event) => startHeightResize(event.clientY)}
        >
          <span className="h-1 w-16 rounded-full bg-border/80" />
        </button>
      )}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          position === "right" ? "w-full min-w-0" : "h-full min-h-0",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SquareTerminal className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium">Terminal</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Persistent workspace shell for CLI auth and debugging.</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={position === "right" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setTerminalPanelPosition("right")}
              title="Dock right"
            >
              <ArrowRightToLine className="h-4 w-4" />
            </Button>
            <Button
              variant={position === "bottom" ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => setTerminalPanelPosition("bottom")}
              title="Dock bottom"
            >
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
            <div className="px-1 text-muted-foreground">
              {position === "right" ? <GripVertical className="h-4 w-4" /> : <GripHorizontal className="h-4 w-4" />}
            </div>
            <Button variant="ghost" size="icon-xs" onClick={closeTerminalPanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-black">
          <TerminalPane wsUrl={wsUrl} commandRequest={commandRequest} />
        </div>
      </div>
    </aside>
  );
}

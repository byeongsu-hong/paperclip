import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "paperclip:terminal-panel-visible";
const POSITION_STORAGE_KEY = "paperclip:terminal-panel-position";
const WIDTH_STORAGE_KEY = "paperclip:terminal-panel-width";
const HEIGHT_STORAGE_KEY = "paperclip:terminal-panel-height";
const DEFAULT_PANEL_WIDTH = 440;
const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 900;
const DEFAULT_PANEL_HEIGHT = 280;
const MIN_PANEL_HEIGHT = 180;
const MAX_PANEL_HEIGHT = 700;

export type TerminalPanelPosition = "right" | "bottom";

export interface TerminalCommandRequest {
  id: number;
  command: string;
}

interface TerminalPanelContextValue {
  visible: boolean;
  hasActivated: boolean;
  position: TerminalPanelPosition;
  width: number;
  height: number;
  commandRequest: TerminalCommandRequest | null;
  openTerminalPanel: (opts?: { command?: string }) => void;
  closeTerminalPanel: () => void;
  setTerminalPanelVisible: (visible: boolean) => void;
  setTerminalPanelPosition: (position: TerminalPanelPosition) => void;
  setTerminalPanelWidth: (width: number) => void;
  setTerminalPanelHeight: (height: number) => void;
  toggleTerminalPanel: () => void;
  runTerminalCommand: (command: string) => void;
}

const TerminalPanelContext = createContext<TerminalPanelContextValue | null>(null);

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writePreference(visible: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(visible));
  } catch {
    // Ignore storage failures.
  }
}

function readPositionPreference(): TerminalPanelPosition {
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
    return raw === "bottom" ? "bottom" : "right";
  } catch {
    return "right";
  }
}

function writePositionPreference(position: TerminalPanelPosition) {
  try {
    window.localStorage.setItem(POSITION_STORAGE_KEY, position);
  } catch {
    // Ignore storage failures.
  }
}

function clampWidth(width: number) {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width)));
}

function clampHeight(height: number) {
  return Math.min(MAX_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, Math.round(height)));
}

function readWidthPreference(): number {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    if (!raw) return DEFAULT_PANEL_WIDTH;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampWidth(parsed) : DEFAULT_PANEL_WIDTH;
  } catch {
    return DEFAULT_PANEL_WIDTH;
  }
}

function writeWidthPreference(width: number) {
  try {
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(clampWidth(width)));
  } catch {
    // Ignore storage failures.
  }
}

function readHeightPreference(): number {
  try {
    const raw = window.localStorage.getItem(HEIGHT_STORAGE_KEY);
    if (!raw) return DEFAULT_PANEL_HEIGHT;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampHeight(parsed) : DEFAULT_PANEL_HEIGHT;
  } catch {
    return DEFAULT_PANEL_HEIGHT;
  }
}

function writeHeightPreference(height: number) {
  try {
    window.localStorage.setItem(HEIGHT_STORAGE_KEY, String(clampHeight(height)));
  } catch {
    // Ignore storage failures.
  }
}

export function TerminalPanelProvider({ children }: { children: ReactNode }) {
  const [visible, setVisibleState] = useState(readPreference);
  const [hasActivated, setHasActivated] = useState(readPreference);
  const [position, setPositionState] = useState<TerminalPanelPosition>(readPositionPreference);
  const [width, setWidthState] = useState(readWidthPreference);
  const [height, setHeightState] = useState(readHeightPreference);
  const [commandRequest, setCommandRequest] = useState<TerminalCommandRequest | null>(null);

  const setTerminalPanelVisible = useCallback((nextVisible: boolean) => {
    setVisibleState(nextVisible);
    if (nextVisible) setHasActivated(true);
    writePreference(nextVisible);
  }, []);

  const setTerminalPanelWidth = useCallback((nextWidth: number) => {
    const clamped = clampWidth(nextWidth);
    setWidthState(clamped);
    writeWidthPreference(clamped);
  }, []);

  const setTerminalPanelHeight = useCallback((nextHeight: number) => {
    const clamped = clampHeight(nextHeight);
    setHeightState(clamped);
    writeHeightPreference(clamped);
  }, []);

  const setTerminalPanelPosition = useCallback((nextPosition: TerminalPanelPosition) => {
    setPositionState(nextPosition);
    writePositionPreference(nextPosition);
  }, []);

  const openTerminalPanel = useCallback((opts?: { command?: string }) => {
    setVisibleState(true);
    setHasActivated(true);
    writePreference(true);
    if (opts?.command) {
      setCommandRequest({ id: Date.now(), command: opts.command });
    }
  }, []);

  const runTerminalCommand = useCallback((command: string) => {
    setVisibleState(true);
    setHasActivated(true);
    writePreference(true);
    setCommandRequest({ id: Date.now(), command });
  }, []);

  const closeTerminalPanel = useCallback(() => {
    setVisibleState(false);
    writePreference(false);
  }, []);

  const toggleTerminalPanel = useCallback(() => {
    setVisibleState((prev) => {
      const nextVisible = !prev;
      if (nextVisible) setHasActivated(true);
      writePreference(nextVisible);
      return nextVisible;
    });
  }, []);

  const value = useMemo<TerminalPanelContextValue>(() => ({
    visible,
    hasActivated,
    position,
    width,
    height,
    commandRequest,
    openTerminalPanel,
    closeTerminalPanel,
    setTerminalPanelVisible,
    setTerminalPanelPosition,
    setTerminalPanelWidth,
    setTerminalPanelHeight,
    toggleTerminalPanel,
    runTerminalCommand,
  }), [
    visible,
    hasActivated,
    position,
    width,
    height,
    commandRequest,
    openTerminalPanel,
    closeTerminalPanel,
    setTerminalPanelVisible,
    setTerminalPanelPosition,
    setTerminalPanelWidth,
    setTerminalPanelHeight,
    toggleTerminalPanel,
    runTerminalCommand,
  ]);

  return (
    <TerminalPanelContext.Provider value={value}>
      {children}
    </TerminalPanelContext.Provider>
  );
}

export function useTerminalPanel() {
  const ctx = useContext(TerminalPanelContext);
  if (!ctx) {
    throw new Error("useTerminalPanel must be used within TerminalPanelProvider");
  }
  return ctx;
}

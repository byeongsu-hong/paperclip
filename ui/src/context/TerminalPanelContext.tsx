import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "paperclip:terminal-panel-visible";

export interface TerminalCommandRequest {
  id: number;
  command: string;
}

interface TerminalPanelContextValue {
  visible: boolean;
  hasActivated: boolean;
  commandRequest: TerminalCommandRequest | null;
  openTerminalPanel: (opts?: { command?: string }) => void;
  closeTerminalPanel: () => void;
  setTerminalPanelVisible: (visible: boolean) => void;
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

export function TerminalPanelProvider({ children }: { children: ReactNode }) {
  const [visible, setVisibleState] = useState(readPreference);
  const [hasActivated, setHasActivated] = useState(readPreference);
  const [commandRequest, setCommandRequest] = useState<TerminalCommandRequest | null>(null);

  const setTerminalPanelVisible = useCallback((nextVisible: boolean) => {
    setVisibleState(nextVisible);
    if (nextVisible) setHasActivated(true);
    writePreference(nextVisible);
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
    commandRequest,
    openTerminalPanel,
    closeTerminalPanel,
    setTerminalPanelVisible,
    toggleTerminalPanel,
    runTerminalCommand,
  }), [
    visible,
    hasActivated,
    commandRequest,
    openTerminalPanel,
    closeTerminalPanel,
    setTerminalPanelVisible,
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

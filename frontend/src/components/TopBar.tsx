import { CircleHelp, Maximize2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { Tab } from "../types";
import { YukiMark } from "./YukiMark";

interface TopBarProps {
  tab: Tab;
  tabs: { id: Tab; label: string }[];
  online: boolean;
  checking: boolean;
  canExpand: boolean;
  demo: boolean;
  connect: () => void;
  expand: () => void;
  openGuide: () => void;
  projectSwitch: ReactNode;
}

export function TopBar({
  tab,
  tabs,
  online,
  checking,
  canExpand,
  demo,
  connect,
  expand,
  openGuide,
  projectSwitch,
}: TopBarProps) {
  const currentTab =
    tabs.find((t) => t.id === tab)?.label || "Chat";

  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          <span className="mobile-brand">
            <YukiMark size="sm" />
          </span>
          <span>Yuki</span>
          <span className="slash">/</span>
          <strong>{currentTab}</strong>
        </div>
        {projectSwitch}
        <div className="top-actions">
          <span
            className={`status-pill ${online ? "connected" : ""}`}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden="true" />
            {checking
              ? "Verificando…"
              : online
                ? "Backend local ativo"
                : "Modo desconectado"}
          </span>
          <button
            type="button"
            className="icon-button narrow-hidden"
            title="Conhecendo o Yuki (Guia)"
            aria-label="Abrir guia do Yuki"
            onClick={openGuide}
          >
            <CircleHelp size={16} />
          </button>
          <button
            type="button"
            className="icon-button narrow-hidden"
            title="Verificar conexão"
            aria-label="Verificar conexão"
            disabled={checking}
            onClick={connect}
          >
            <RefreshCw size={16} className={checking ? "spin" : ""} />
          </button>
          {canExpand && (
            <button
              type="button"
              className="icon-button"
              title="Abrir página ampla"
              aria-label="Abrir página ampla"
              onClick={expand}
            >
              <Maximize2 size={16} />
            </button>
          )}
        </div>
      </header>
      {demo && (
        <div className="demo-banner" role="note">
          Demonstração visual · dados de exemplo · nenhuma conta ou IA
          conectada
        </div>
      )}
    </>
  );
}

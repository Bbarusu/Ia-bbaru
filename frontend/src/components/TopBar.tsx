import { Maximize2, RefreshCw } from "lucide-react";
import { Mark } from "./Mark";
import type { Tab } from "../types";

interface TopBarProps {
  tab: Tab;
  tabs: { id: Tab; label: string }[];
  online: boolean;
  checking: boolean;
  canExpand: boolean;
  demo: boolean;
  connect: () => void;
  expand: () => void;
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
}: TopBarProps) {
  const currentTab =
    tabs.find((t) => t.id === tab)?.label || "Área de trabalho";

  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          <span className="mobile-brand">
            <Mark small />
          </span>
          <span>Meu espaço</span>
          <span className="slash">/</span>
          <strong>{currentTab}</strong>
        </div>
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
            className="icon-button"
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

import {
  BookOpen,
  CircleHelp,
  Clock,
  Download,
  SlidersHorizontal,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Settings2,
  SquarePen,
  Workflow,
} from "lucide-react";
import type { Conversation, Tab } from "../types";
import { Menu } from "./Menu";

interface ChatHeaderProps {
  online: boolean;
  checking: boolean;
  tab: Tab;
  setTab: (tab: Tab) => void;
  openProject: () => void;
  newChat: () => void;
  canNewChat: boolean;
  openGuide: () => void;
  canExpand: boolean;
  expand: () => void;
  sourceCount: number;
  conversations: Conversation[];
  conversationId: string;
  switchConversation: (id: string) => void;
  canSwitch: boolean;
}

/** Conversas recentes como itens de menu (sem seletor fixo no topo, como na referência). */
export function ConversationItems({
  conversations,
  conversationId,
  pick,
  disabled,
}: {
  conversations: Conversation[];
  conversationId: string;
  pick: (id: string) => void;
  disabled: boolean;
}) {
  if (!conversations.length) return null;
  return (
    <>
      <span className="header-menu-label">Conversas recentes</span>
      {conversations.slice(0, 6).map((c) => (
        <button
          type="button"
          key={c.id}
          disabled={disabled}
          aria-current={c.id === conversationId ? "true" : undefined}
          title={c.title}
          onClick={() => pick(c.id)}
        >
          <MessageSquare size={14} aria-hidden="true" />
          <span className="conversation-item-title">{c.title}</span>
        </button>
      ))}
    </>
  );
}

const AREAS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "workspace", label: "Chat", icon: MessageSquare },
  { id: "library", label: "Biblioteca", icon: BookOpen },
  { id: "history", label: "Atividade", icon: Workflow },
  { id: "connections", label: "Conexões", icon: Settings2 },
];
const BROWSER: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: "web-history", label: "Histórico", icon: Clock },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "settings", label: "Ajustes", icon: SlidersHorizontal },
];

/** Topo do painel lateral (até 700 px): só ícones, como na referência. */
export function ChatHeader({
  online,
  checking,
  tab,
  setTab,
  openProject,
  newChat,
  canNewChat,
  openGuide,
  canExpand,
  expand,
  sourceCount,
  conversations,
  conversationId,
  switchConversation,
  canSwitch,
}: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <span className="sr-only" role="status" aria-live="polite">
        {checking ? "Verificando…" : online ? "Backend local ativo" : "Modo desconectado"}
      </span>
      {canExpand && (
        <button
          type="button"
          className="header-icon"
          aria-label="Abrir página ampla"
          title="Abrir página ampla"
          onClick={expand}
        >
          <Maximize2 size={15} aria-hidden="true" />
        </button>
      )}

      <div className="chat-header-actions">
        <button
          type="button"
          className="header-icon"
          aria-label="Novo chat"
          title="Novo chat (esta conversa continua na lista)"
          disabled={!canNewChat}
          onClick={() => {
            setTab("workspace");
            newChat();
          }}
        >
          <SquarePen size={16} aria-hidden="true" />
        </button>

        <Menu
          label="Mais opções"
          title="Conversas, biblioteca, atividade e conexões"
          triggerClass="header-icon"
          menuClass="header-menu"
          trigger={<MoreHorizontal size={16} aria-hidden="true" />}
        >
          {(close) => {
            const choose = (action: () => void) => () => {
              close();
              action();
            };
            return (
              <>
                {AREAS.map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    aria-current={tab === id ? "page" : undefined}
                    onClick={choose(() => setTab(id))}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{label}</span>
                    {id === "library" && sourceCount > 0 && (
                      <small>
                        {sourceCount} {sourceCount === 1 ? "material" : "materiais"}
                      </small>
                    )}
                  </button>
                ))}
                <hr className="header-menu-divider" />
                <span className="header-menu-label">Navegador</span>
                {BROWSER.map(({ id, label, icon: Icon }) => (
                  <button
                    type="button"
                    key={id}
                    aria-current={tab === id ? "page" : undefined}
                    onClick={choose(() => setTab(id))}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
                <hr className="header-menu-divider" />
                <ConversationItems
                  conversations={conversations}
                  conversationId={conversationId}
                  disabled={!canSwitch}
                  pick={(id) => {
                    close();
                    setTab("workspace");
                    switchConversation(id);
                  }}
                />
                {conversations.length > 0 && <hr className="header-menu-divider" />}
                <button type="button" onClick={choose(openProject)}>
                  <Plus size={14} aria-hidden="true" />
                  <span>Novo projeto</span>
                </button>
                <button type="button" onClick={choose(openGuide)}>
                  <CircleHelp size={14} aria-hidden="true" />
                  <span>Conhecendo o Yuki</span>
                </button>
              </>
            );
          }}
        </Menu>
      </div>
    </header>
  );
}

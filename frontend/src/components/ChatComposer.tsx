import { useEffect, useState, type FormEvent, type RefObject } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  Camera,
  ChevronDown,
  FileText,
  Folder,
  Globe,
  Image as ImageIcon,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { RESPONSE_PROFILES, isResponseProfile, shortModelName } from "../logic.mjs";
import type { Capture, Model, Project } from "../types";
import type { CaptureMediaKind } from "./SourceModal";
import { Menu } from "./Menu";

interface ChatComposerProps {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  changeText: (value: string) => void;
  draftReady: boolean;
  submit: (event: FormEvent) => void;
  canSubmit: boolean;
  busy: boolean;
  online: boolean;
  checking: boolean;
  eligibleModels: Model[];
  chatChoice: string;
  setChatChoice: (id: string) => void;
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  capture: Capture | null;
  captureStale: boolean;
  attachPage: () => void;
  attachPageVisual: () => void;
  attachImages: () => void;
  imagesSupported: boolean;
  removeCapture: () => void;
  selectedSourcesCount: number;
  clearSelectedSources: () => void;
  attachSelection: () => void;
  openSource: (mode?: CaptureMediaKind) => void;
  hasEarlierTurns: boolean;
}

export function ChatComposer({
  inputRef,
  text,
  changeText,
  draftReady,
  submit,
  canSubmit,
  busy,
  online,
  checking,
  eligibleModels,
  chatChoice,
  setChatChoice,
  projects,
  projectId,
  setProjectId,
  capture,
  captureStale,
  attachPage,
  attachPageVisual,
  attachImages,
  imagesSupported,
  removeCapture,
  selectedSourcesCount,
  clearSelectedSources,
  attachSelection,
  openSource,
  hasEarlierTurns,
}: ChatComposerProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!capture) setPreviewOpen(false);
  }, [capture]);

  const captureText = typeof capture?.text === "string" ? capture.text : "";
  const captureTitle = capture?.title?.trim() || "Trecho da página";
  const imageNote = imagesSupported
    ? "Fica na biblioteca; pode ir ao Claude (experimental)"
    : "Fica na biblioteca; o modelo escolhido não analisa imagens";
  const status = checking ? "Verificando…" : online ? "Conectado" : "Desconectado";

  return (
    <form className="chat-composer" onSubmit={submit}>
      <div className="composer-box">
        {(capture || selectedSourcesCount > 0) && (
          <div className="composer-context" aria-label="Contexto que será enviado">
            {capture && (
              <span className={`context-chip ${captureStale ? "stale" : ""}`}>
                <button
                  type="button"
                  className="context-chip-title"
                  aria-expanded={previewOpen}
                  title={`Ver o ${capture.kind === "page" ? "texto da página" : "trecho"} que será enviado (${captureText.length.toLocaleString("pt-BR")} caracteres)${capture.url ? ` · ${capture.url}` : ""}`}
                  onClick={() => setPreviewOpen((open) => !open)}
                >
                  <span aria-hidden="true">🌐 </span>
                  {captureTitle}
                  <small>
                    {capture.kind === "page" ? " · página" : " · trecho"}
                    {captureStale && " · a aba mudou desde a captura"}
                  </small>
                </button>
                <button
                  type="button"
                  className="context-chip-remove"
                  aria-label="Remover trecho da página"
                  title="Remover trecho da página"
                  onClick={removeCapture}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            )}
            {selectedSourcesCount > 0 && (
              <span className="context-chip">
                <span className="context-chip-title">
                  <span aria-hidden="true">📄 </span>
                  {selectedSourcesCount}{" "}
                  {selectedSourcesCount === 1
                    ? "material da biblioteca"
                    : "materiais da biblioteca"}
                </span>
                <button
                  type="button"
                  className="context-chip-remove"
                  aria-label="Não enviar materiais da biblioteca"
                  title="Não enviar materiais da biblioteca"
                  onClick={clearSelectedSources}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        )}

        {capture && previewOpen && (
          <div className="context-preview">
            {capture.url && <small>{capture.url}</small>}
            <p>{captureText || "Este trecho não tem texto."}</p>
          </div>
        )}

        <label htmlFor="instruction" className="sr-only">
          Mensagem para o Claude
        </label>
        <textarea
          id="instruction"
          ref={inputRef}
          rows={1}
          placeholder={
            hasEarlierTurns
              ? "Continue a conversa"
              : "Pergunte ao Claude"
          }
          value={text}
          maxLength={8000}
          disabled={!draftReady}
          onChange={(event) => changeText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (canSubmit) event.currentTarget.form?.requestSubmit();
          }}
        />

        <div className="composer-bar">
          <Menu
            label="Anexar contexto"
            triggerClass="attach-button"
            menuClass="attach-menu"
            disabled={!online || busy}
            trigger={<Plus size={17} aria-hidden="true" />}
          >
            {(close) => {
              const choose = (action: () => void) => () => {
                close();
                action();
              };
              return (
                <>
                  <button type="button" onClick={choose(attachPage)}>
                    <Globe size={14} aria-hidden="true" />
                    <span>
                      Usar página atual
                      <small>Texto visível da aba, até 38.000 caracteres</small>
                    </span>
                  </button>
                  <button type="button" onClick={choose(attachImages)} disabled={!imagesSupported}>
                    <ImageIcon size={14} aria-hidden="true" /><span>Imagens nesta conversa<small>PNG/JPEG até 480 KB; sem salvar na biblioteca</small></span>
                  </button>
                  <button type="button" onClick={choose(attachPageVisual)}>
                    <ImageIcon size={14} aria-hidden="true" />
                    <span>
                      Print da página inteira
                      <small>{imageNote}</small>
                    </span>
                  </button>
                  <button type="button" onClick={choose(attachSelection)}>
                    <ArrowDownToLine size={14} aria-hidden="true" />
                    <span>
                      Usar seleção da aba
                      <small>Só o trecho selecionado vai junto</small>
                    </span>
                  </button>
                  <button type="button" onClick={choose(() => openSource("screenshot"))}>
                    <Camera size={14} aria-hidden="true" />
                    <span>
                      Capturar print da tela
                      <small>{imageNote}</small>
                    </span>
                  </button>
                  <button type="button" onClick={choose(() => openSource("image"))}>
                    <ImageIcon size={14} aria-hidden="true" />
                    <span>
                      Importar imagem local
                      <small>{imageNote}</small>
                    </span>
                  </button>
                  <button type="button" onClick={choose(() => openSource("text"))}>
                    <FileText size={14} aria-hidden="true" />
                    <span>
                      Adicionar anotação de texto
                      <small>Salva na biblioteca do projeto</small>
                    </span>
                  </button>
                </>
              );
            }}
          </Menu>

          <label
            className="composer-chip"
            title={`Perfil de resposta ou modelo Claude · ${status}. O perfil só indica preferência de modelo; a escolha pelo nome prevalece.`}
          >
            <span
              className={`status-dot ${checking ? "wait" : online ? "on" : "off"}`}
              aria-hidden="true"
            />
            <select
              aria-label="Modelo Claude"
              value={
                isResponseProfile(chatChoice) || eligibleModels.some((m) => m.id === chatChoice)
                  ? chatChoice
                  : "normal"
              }
              disabled={!eligibleModels.length}
              onChange={(event) => setChatChoice(event.target.value)}
            >
              {!eligibleModels.length && <option value="normal">Sem modelo</option>}
              {eligibleModels.length > 0 && (
                <optgroup label="Perfil de resposta">
                  {RESPONSE_PROFILES.map((p) => (
                    <option key={p.id} value={p.id} title={`${p.hint}, entre os modelos disponíveis`}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {eligibleModels.length > 0 && (
                <optgroup label="Escolher modelo">
                  {eligibleModels.map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                      title={/fable/i.test(m.id) ? "Pode exigir créditos de uso adicionais" : m.label}
                    >
                      {shortModelName(m)}
                      {/fable/i.test(m.id) ? " (créditos?)" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>

          <label className="composer-chip" title="Projeto onde a conversa fica guardada">
            <Folder size={13} aria-hidden="true" />
            <select
              id="project"
              aria-label="Projeto atual"
              value={projectId}
              disabled={!projects.length || busy}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="" disabled>
                {projects.length ? "Escolha um projeto" : "Sem projeto"}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <ChevronDown size={12} aria-hidden="true" />
          </label>

          <button
            type="submit"
            className="send-button"
            aria-label="Enviar"
            title="Enviar (Enter). Shift+Enter quebra linha."
            disabled={!canSubmit}
          >
            {busy ? (
              <Loader2 size={17} className="spin" aria-hidden="true" />
            ) : (
              <ArrowUp size={17} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

import {
  useState,
  useRef,
  type FormEvent,
  type ClipboardEvent,
  type ChangeEvent,
} from "react";
import { Camera, FileText, Image as ImageIcon, Link2, Loader2, Plus, Upload } from "lucide-react";
import { Dialog } from "./Dialog";
import { sourceContent } from "../logic.mjs";
import type { Capture, Project, Media } from "../types";

export type CaptureMediaKind = "text" | "screenshot" | "image";

interface SourceModalProps {
  capture: Capture | null;
  queuedCapture: Capture | null;
  projects: Project[];
  projectId: string;
  setProjectId: (id: string) => void;
  title: string;
  setTitle: (title: string) => void;
  content: string;
  setContent: (content: string) => void;
  close: () => void;
  saveSource: (e: FormEvent, media?: Media) => Promise<void>;
  discardCapture: (captureId: string) => Promise<void>;
  replaceWithQueuedCapture?: () => void;
  busy: boolean;
  online: boolean;
  error?: string;
  initialMode?: CaptureMediaKind;
}

async function compressImageToDataUrl(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10000000)
    throw new Error("Use PNG, JPEG ou WebP de até 10 MB.");
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const img = new window.Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Imagem inválida; nenhum arquivo foi salvo."));
    img.src = raw;
  });
  if (img.width * img.height > 16000000) throw new Error("A imagem excede 16 megapixels.");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem.");
  let width = Math.min(1920, img.width);
  for (;;) {
    canvas.width = width;
    canvas.height = Math.max(1, Math.round(img.height * width / img.width));
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [.9, .75, .6]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= 640000) return { dataUrl, width: canvas.width, height: canvas.height };
    }
    if (width <= 160) break;
    width = Math.max(160, Math.floor(width * .75));
  }
  throw new Error("A imagem excede o limite local; use uma captura menor.");
}

export function SourceModal({
  capture,
  queuedCapture,
  projects,
  projectId,
  setProjectId,
  title,
  setTitle,
  content,
  setContent,
  close,
  saveSource,
  discardCapture,
  replaceWithQueuedCapture,
  busy,
  online,
  error,
  initialMode = "text",
}: SourceModalProps) {
  const [mode, setMode] = useState<CaptureMediaKind>(capture?.media?.kind || initialMode);
  const [mediaPreview, setMediaPreview] = useState<string>(capture?.media?.data_url || "");
  const [mediaError, setMediaError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const originUrl = capture?.url || "";
  const formattedContent = sourceContent(title, originUrl, content) || "";
  const charCount = formattedContent.length;
  const isOverLimit = charCount > 40000;

  async function applyImageFile(file: File, targetMode: CaptureMediaKind) {
    const tag = targetMode === "screenshot" ? "[PRINT CAPTURADO]" : "[IMAGEM CAPTURADA]";
    const defaultTitle =
      targetMode === "screenshot"
        ? `Print: ${file.name || "Tela capturada"}`
        : `Imagem: ${file.name || "Figura da página"}`;
    const { dataUrl, width, height } = await compressImageToDataUrl(file);
    setMediaPreview(dataUrl);
    if (!title?.trim()) {
      setTitle(defaultTitle.slice(0, 120));
    }
    setContent(`Captura local (${width}×${height}px). Descrição: `);
  }

  async function importImage(file: File, targetMode: CaptureMediaKind) {
    setPreparing(true); setMediaError("");
    if (!content?.trim()) setContent("Preparando imagem local. Descrição: ");
    try { await applyImageFile(file, targetMode); }
    catch (error) { setMediaError((error as Error).message); }
    finally { setPreparing(false); }
  }

  function handlePaste(e: ClipboardEvent) {
    if (preparing || busy) { e.preventDefault(); return; }
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const nextMode = mode === "text" ? "screenshot" : mode;
          setMode(nextMode);
          void importImage(file, nextMode);
          return;
        }
      }
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (preparing || busy) return;
    const file = e.target.files?.[0];
    if (!file) return;
    void importImage(file, mode === "text" ? "image" : mode);
  }


  return (
    <Dialog
      title={
        capture?.media ? "Revisar captura visual" : capture
          ? "Revisar trecho selecionado"
          : mode === "screenshot"
            ? "Capturar print para o projeto"
            : mode === "image"
              ? "Capturar imagem para o projeto"
              : "Adicionar material"
      }
      close={() => { if (!preparing && !busy) close(); }}
    >
      <form onSubmit={(event) => saveSource(event, mediaPreview ? {
        kind: mode === "screenshot" ? "screenshot" : "image", data_url: mediaPreview,
      } : undefined)} onPaste={handlePaste}>
        <div
          className="capture-mode-tabs"
          role="group"
          aria-label="Tipo de captura"
        >
          <button
            type="button"
            className={`capture-tab-btn ${mode === "text" ? "active" : ""}`}
            onClick={() => setMode("text")}
          >
            <FileText size={14} aria-hidden="true" />
            Texto / Trecho
          </button>
          <button
            type="button"
            className={`capture-tab-btn ${mode === "screenshot" ? "active" : ""}`}
            onClick={() => setMode("screenshot")}
          >
            <Camera size={14} aria-hidden="true" />
            Print da Tela
          </button>
          <button
            type="button"
            className={`capture-tab-btn ${mode === "image" ? "active" : ""}`}
            onClick={() => setMode("image")}
          >
            <ImageIcon size={14} aria-hidden="true" />
            Imagem
          </button>
        </div>

        {capture && (
          <div className="capture-origin">
            <Link2 size={14} aria-hidden="true" />
            <span>{capture.url}</span>
          </div>
        )}

        {queuedCapture && replaceWithQueuedCapture && (
          <div
            className="queued-capture-inline"
            role="region"
            aria-label="Captura em espera"
          >
            <span>
              Outro trecho ({queuedCapture.title}) foi capturado e ficou em
              espera para não apagar sua edição atual.
            </span>
            <button
              type="button"
              className="subtle"
              disabled={busy}
              onClick={replaceWithQueuedCapture}
            >
              Substituir pela captura em espera
            </button>
          </div>
        )}

        {(mode === "screenshot" || mode === "image") && (
          <div className="media-capture-box">
            <div className="media-capture-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                hidden
              />
              <button
                type="button"
                className="subtle"
                onClick={() => fileInputRef.current?.click()}
                disabled={preparing || busy}
              >
                <Upload size={14} aria-hidden="true" />
                {mode === "screenshot"
                  ? "Selecionar print ou colar (Ctrl+V)"
                  : "Selecionar imagem ou colar (Ctrl+V)"}
              </button>

            </div>
            {mediaPreview && (
              <div className="media-preview-frame">
                <img
                  src={mediaPreview}
                  alt="Pré-visualização da captura"
                />
              </div>
            )}
          </div>
        )}

        {mediaPreview && <p className="small-note">A prévia será armazenada localmente, separada do texto. Os agentes atuais não recebem imagens. Para consultar seu conteúdo, adicione uma descrição em um material de texto.</p>}
        <label>
          Projeto
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
          >
            <option value="">Escolha um projeto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>

        {!projects.length && (
          <p className="small-note">
            Crie um projeto antes de salvar. O trecho continua aguardando
            revisão.
          </p>
        )}

        <label>
          Título
          <input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label>
          Conteúdo
          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={mode === "text" ? 7 : 5}
            maxLength={40000}
          />
        </label>

        <p className={`small-note ${isOverLimit ? "error" : ""}`}>
          {charCount.toLocaleString("pt-BR")} / 40.000 caracteres · Revise antes
          de salvar.
        </p>

        <div className="dialog-actions">
          {capture && (
            <button
              type="button"
              className="subtle"
              onClick={() => discardCapture(capture.id)}
              disabled={busy}
            >
              Descartar trecho
            </button>
          )}
          <button
            type="submit"
            className="primary"
            disabled={
              busy || preparing || Boolean(mediaError) ||
              !online ||
              !projectId ||
              !title?.trim() ||
              !content?.trim() ||
              isOverLimit
            }
          >
            {busy ? (
              <Loader2 size={16} className="spin" aria-hidden="true" />
            ) : (
              <Plus size={16} aria-hidden="true" />
            )}{" "}
            Salvar no projeto
          </button>
        </div>
      </form>
      {mediaError && <p role="alert" className="dialog-error">{mediaError}</p>}
      {error && (
        <p role="alert" className="dialog-error">
          {error}
        </p>
      )}
    </Dialog>
  );
}

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
import type { Capture, Project } from "../types";

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
  saveSource: (e: FormEvent) => Promise<void>;
  discardCapture: (captureId: string) => Promise<void>;
  replaceWithQueuedCapture?: () => void;
  busy: boolean;
  online: boolean;
  error?: string;
  initialMode?: CaptureMediaKind;
}

function compressImageToDataUrl(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const raw = String(reader.result || "");
      const img = new window.Image();
      img.onerror = () => resolve({ dataUrl: raw.slice(0, 32000), width: 0, height: 0 });
      img.onload = () => {
        try {
          const maxW = 520;
          const scale = img.width > maxW ? maxW / img.width : 1;
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ dataUrl: raw.slice(0, 32000), width: img.width, height: img.height });
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.72);
          resolve({
            dataUrl: compressed.length <= 34000 ? compressed : canvas.toDataURL("image/jpeg", 0.5),
            width: img.width,
            height: img.height,
          });
        } catch {
          resolve({ dataUrl: raw.slice(0, 32000), width: img.width, height: img.height });
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
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
  const [mode, setMode] = useState<CaptureMediaKind>(initialMode);
  const [mediaPreview, setMediaPreview] = useState<string>("");
  const [imageUrlInput, setImageUrlInput] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const originUrl = capture?.url || "";
  const formattedContent = sourceContent(title, originUrl, content);
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
    if (!title.trim()) {
      setTitle(defaultTitle.slice(0, 120));
    }
    const dimText = width && height ? ` (${width}×${height}px)` : "";
    const header = `${tag}${dimText}\nArquivo: ${file.name || "colado da área de transferência"}\nAnexoVisual: ${dataUrl}\n\nNotas sobre a captura:\n`;
    setContent(header.slice(0, 38500));
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const nextMode = mode === "text" ? "screenshot" : mode;
          setMode(nextMode);
          applyImageFile(file, nextMode).catch(() => {});
          return;
        }
      }
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageFile(file, mode === "text" ? "image" : mode).catch(() => {});
  }

  function applyExternalImageUrl() {
    const clean = imageUrlInput.trim();
    if (!clean) return;
    const tag = mode === "screenshot" ? "[PRINT CAPTURADO]" : "[IMAGEM CAPTURADA]";
    setMediaPreview(clean);
    if (!title.trim()) {
      setTitle(mode === "screenshot" ? "Print da página" : "Imagem da página");
    }
    setContent(`${tag}\nAnexoVisual: ${clean}\n\nDescrição / contexto da imagem:\n`);
  }

  return (
    <Dialog
      title={
        capture
          ? "Revisar trecho selecionado"
          : mode === "screenshot"
            ? "Capturar print para o projeto"
            : mode === "image"
              ? "Capturar imagem para o projeto"
              : "Adicionar material"
      }
      close={close}
    >
      <form onSubmit={saveSource} onPaste={handlePaste}>
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
                accept="image/*"
                onChange={handleFileChange}
                hidden
              />
              <button
                type="button"
                className="subtle"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} aria-hidden="true" />
                {mode === "screenshot"
                  ? "Selecionar print ou colar (Ctrl+V)"
                  : "Selecionar imagem ou colar (Ctrl+V)"}
              </button>
              <div className="media-url-row">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Ou cole o endereço (https://...) da imagem da aba"
                />
                <button
                  type="button"
                  className="subtle"
                  onClick={applyExternalImageUrl}
                >
                  Anexar URL
                </button>
              </div>
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
              busy ||
              !online ||
              !projectId ||
              !title.trim() ||
              !content.trim() ||
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
      {error && (
        <p role="alert" className="dialog-error">
          {error}
        </p>
      )}
    </Dialog>
  );
}

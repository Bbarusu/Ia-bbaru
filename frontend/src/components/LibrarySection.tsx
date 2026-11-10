import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  Check,
  FileText,
  Image as ImageIcon,
  Link2,
  Plus,
  Search,
} from "lucide-react";
import type { Project, Source } from "../types";
import type { CaptureMediaKind } from "./SourceModal";

interface LibrarySectionProps {
  project: Project | undefined;
  sources: Source[];
  filteredSources: Source[];
  selectedSources: string[];
  toggleSource: (id: string) => void;
  openSource: (mode?: CaptureMediaKind) => void;
  openProject: () => void;
  captureSelection: () => void;
  viewSource: (source: Source) => void;
  search: string;
  setSearch: (search: string) => void;
  sourceNext: number | null;
  loadMoreSources: () => void;
  online: boolean;
  busy: boolean;
}

function detectSourceKind(source: Source): "screenshot" | "image" | "text" {
  if (source.media) return source.media.kind;
  const sample = `${source.title} ${source.preview || ""} ${source.content || ""}`;
  if (sample.includes("[PRINT CAPTURADO]") || /^Print:/i.test(source.title)) {
    return "screenshot";
  }
  if (sample.includes("[IMAGEM CAPTURADA]") || /^Imagem:/i.test(source.title)) {
    return "image";
  }
  return "text";
}

export function LibrarySection({
  project,
  sources,
  filteredSources,
  selectedSources,
  toggleSource,
  openSource,
  openProject,
  captureSelection,
  viewSource,
  search,
  setSearch,
  sourceNext,
  loadMoreSources,
  online,
  busy,
}: LibrarySectionProps) {
  return (
    <section className="library-section">
      <div className="section-title">
        <div>
          <h2>
            Contexto do projeto <span>{sources.length} materiais</span>
          </h2>
          <p>
            {project
              ? `Textos, prints e imagens reunidos em ${project.title}.`
              : "Crie um projeto para começar sua biblioteca."}
          </p>
        </div>
        <div className="section-actions">
          <button
            type="button"
            className="subtle"
            onClick={captureSelection}
            disabled={busy}
          >
            <ArrowDownToLine size={15} aria-hidden="true" /> Capturar seleção
          </button>
          <button
            type="button"
            className="subtle"
            onClick={() => openSource("screenshot")}
            disabled={!online || !project || busy}
          >
            <Camera size={15} aria-hidden="true" /> Capturar print
          </button>
          <button
            type="button"
            className="subtle"
            onClick={() => openSource("image")}
            disabled={!online || !project || busy}
          >
            <ImageIcon size={15} aria-hidden="true" /> Capturar imagem
          </button>
          <button
            type="button"
            className="subtle"
            onClick={() => openSource("text")}
            disabled={!online || !project || busy}
          >
            <Plus size={15} aria-hidden="true" /> Adicionar texto
          </button>
        </div>
      </div>

      {sources.length > 0 && (
        <div className="search-field">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Buscar materiais"
            value={search}
            placeholder="Buscar textos, prints ou imagens neste projeto…"
            onChange={(e) => setSearch(e.target.value)}
          />
          <span>{selectedSources.length} selecionados</span>
        </div>
      )}

      {filteredSources.length > 0 ? (
        <div className="sources-grid">
          {filteredSources.map((s) => {
            const isSelected = selectedSources.includes(s.id);
            const charCount = s.char_count || s.content?.length || 0;
            const kind = detectSourceKind(s);
            const kindLabel =
              kind === "screenshot"
                ? "Print"
                : kind === "image"
                  ? "Imagem"
                  : "Texto";
            return (
              <article
                key={s.id}
                className={`source-card card ${isSelected ? "selected" : ""}`}
              >
                <label className="source-check">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={Boolean(s.media)}
                    title={s.media ? "Captura armazenada localmente; o gateway atual recebe apenas texto." : undefined}
                    onChange={() => toggleSource(s.id)}
                    aria-label={`Usar ${s.title} no pedido`}
                  />
                  <span aria-hidden="true">
                    {isSelected && <Check size={12} />}
                  </span>
                </label>
                <span className="file-icon" aria-hidden="true">
                  {kind === "screenshot" ? (
                    <Camera size={19} />
                  ) : kind === "image" ? (
                    <ImageIcon size={19} />
                  ) : (
                    <FileText size={19} />
                  )}
                </span>
                <button
                  type="button"
                  className="source-open"
                  onClick={() => viewSource(s)}
                >
                  <h3>{s.title}</h3>
                  <p>{s.preview || s.content?.slice(0, 160)}</p>
                </button>
                <div className="source-bottom">
                  <span>
                    {kindLabel} · {charCount.toLocaleString("pt-BR")} caracteres
                  </span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-library card">
          <div className="empty-files" aria-hidden="true">
            <FileText size={23} />
            <Camera size={21} />
            <ImageIcon size={21} />
            <Link2 size={20} />
            <BookOpen size={22} />
          </div>
          <h3>
            {search
              ? "Nenhum material encontrado."
              : "Toda boa resposta começa com contexto."}
          </h3>
          <p>
            {search
              ? "Experimente outro termo."
              : "Capture um trecho, print da tela ou imagem da página no navegador."}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={project ? () => openSource("text") : openProject}
            disabled={!online}
          >
            {project
              ? "Adicionar primeiro material"
              : "Criar meu primeiro projeto"}{" "}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {sourceNext !== null && (
        <button
          type="button"
          className="load-more subtle"
          disabled={busy}
          onClick={loadMoreSources}
        >
          Carregar mais materiais
        </button>
      )}
    </section>
  );
}

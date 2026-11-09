import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  Link2,
  Plus,
  Search,
} from "lucide-react";
import type { Project, Source } from "../types";

interface LibrarySectionProps {
  project: Project | undefined;
  sources: Source[];
  filteredSources: Source[];
  selectedSources: string[];
  toggleSource: (id: string) => void;
  openSource: () => void;
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
              ? `Tudo o que você reuniu em ${project.title}.`
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
            onClick={openSource}
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
            placeholder="Buscar neste projeto…"
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
            return (
              <article
                key={s.id}
                className={`source-card card ${isSelected ? "selected" : ""}`}
              >
                <label className="source-check">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSource(s.id)}
                    aria-label={`Usar ${s.title} no pedido`}
                  />
                  <span aria-hidden="true">
                    {isSelected && <Check size={12} />}
                  </span>
                </label>
                <span className="file-icon" aria-hidden="true">
                  <FileText size={19} />
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
                    Texto · {charCount.toLocaleString("pt-BR")} caracteres
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
              : "Adicione uma anotação ou selecione um trecho de uma página no navegador."}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={project ? openSource : openProject}
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

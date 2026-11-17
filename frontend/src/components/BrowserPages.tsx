import { useState, type ReactNode } from "react";
import { Download, FileText, Puzzle, Settings2, Shield, SlidersHorizontal, Trash2, X } from "lucide-react";
import {
  dayLabel,
  hostOf,
  pruneHistory,
  useStored,
  useStoredList,
  type Bookmark,
  type HistoryEntry,
} from "../browserStore";

/**
 * Páginas do navegador no painel (Histórico, Downloads, Ajustes), no desenho do
 * Canvas. O que já funciona usa os dados da barra; o que depende do runtime fica
 * desativado com "Em integração" e `data-codex` (docs/PEDIDO_VISAO_E_NAVEGADOR.md).
 */
function Pending({ id }: { id: string }) {
  return (
    <span className="pending-tag" title={`Depende do runtime (Codex): ${id}`}>
      Em integração
    </span>
  );
}

function ClearHistory({ onClear }: { onClear: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button type="button" className="outline-button" onClick={() => setAsking(true)}>
        Limpar histórico…
      </button>
    );
  return (
    <span className="inline-confirm" role="group" aria-label="Confirmar limpeza do histórico">
      <span>Apagar todo o histórico de navegação?</span>
      <button
        type="button"
        className="dark-button"
        onClick={() => {
          onClear();
          setAsking(false);
        }}
      >
        Apagar
      </button>
      <button type="button" className="plain-button" onClick={() => setAsking(false)}>
        Cancelar
      </button>
    </span>
  );
}

export function WebHistoryPage() {
  const [items, setItems] = useStoredList<HistoryEntry>("yuki:history");
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("pt-BR");
  const shown = items.filter(
    (item) => !q || `${item.title} ${item.url}`.toLocaleLowerCase("pt-BR").includes(q),
  );
  const groups = new Map<string, HistoryEntry[]>();
  for (const item of shown) {
    const label = dayLabel(item.at);
    groups.set(label, [...(groups.get(label) || []), item]);
  }

  return (
    <section className="browser-page" aria-label="Histórico de navegação">
      <div className="browser-page-bar">
        <label htmlFor="history-search" className="sr-only">
          Buscar no histórico
        </label>
        <input
          id="history-search"
          type="search"
          placeholder="Buscar no histórico"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {items.length > 0 && <ClearHistory onClear={() => setItems([])} />}
      </div>

      {!items.length ? (
        <p className="browser-empty">Nenhuma página visitada ainda. As páginas web que você abrir aparecem aqui.</p>
      ) : !shown.length ? (
        <p className="browser-empty">Nada encontrado para “{query}”.</p>
      ) : (
        [...groups].map(([label, entries]) => (
          <div key={label} className="history-group">
            <h2>{label}</h2>
            <ul className="history-list">
              {entries.map((item) => (
                <li key={item.url}>
                  <span className="history-time">{item.time || ""}</span>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>
                    {item.title}
                  </a>
                  <span className="history-host">{hostOf(item.url)}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Apagar do histórico: ${item.title}`}
                    title="Apagar do histórico"
                    onClick={() => setItems(items.filter((other) => other.url !== item.url))}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <p className="browser-note">
        Guarda as últimas 25 páginas web visitadas neste computador. Clicar abre a página numa nova aba.
      </p>
    </section>
  );
}

export function DownloadsPage() {
  return (
    <section className="browser-page" aria-label="Downloads">
      <div className="browser-page-bar">
        <span className="browser-page-title">
          <Download size={16} aria-hidden="true" /> Downloads
        </span>
        <button type="button" className="outline-button" disabled data-codex="downloads.clear">
          Limpar
        </button>
      </div>
      <div className="browser-card downloads-empty">
        <FileText size={22} aria-hidden="true" />
        <div>
          <strong>Nenhum download.</strong>
          <p>
            Este navegador bloqueia downloads por segurança: nenhum arquivo é baixado. A lista, o
            progresso, “Mostrar na pasta” e “Cancelar” aparecem aqui quando a integração estiver
            pronta. <Pending id="N3" />
          </p>
        </div>
      </div>
      <p className="browser-note">Arquivos baixados nunca abrem sozinhos.</p>
    </section>
  );
}

type Section = "geral" | "personalizacao" | "privacidade" | "extensoes";
const SECTIONS: { id: Section; label: string; icon: typeof Settings2 }[] = [
  { id: "geral", label: "Geral", icon: Settings2 },
  { id: "personalizacao", label: "Personalização", icon: SlidersHorizontal },
  { id: "privacidade", label: "Privacidade", icon: Shield },
  { id: "extensoes", label: "Extensões", icon: Puzzle },
];

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span className="settings-label">{label}</span>}
      <div className="settings-control">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const [section, setSection] = useState<Section>("geral");
  const [retention, setRetention] = useStored("yuki:history-retention");
  const [showBookmarks, setShowBookmarks] = useStored("yuki:show-bookmarks");
  const [bookmarks, setBookmarks] = useStoredList<Bookmark>("yuki:bookmarks");
  const [history, setHistory] = useStoredList<HistoryEntry>("yuki:history");

  return (
    <section className="browser-page settings-page" aria-label="Ajustes do navegador">
      <nav className="settings-tabs" aria-label="Seções dos ajustes">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="browser-card settings-pane">
        {section === "geral" && (
          <>
            <Row label="Ao abrir o Yuki" htmlFor="set-startup">
              <select id="set-startup" disabled data-codex="settings.startup">
                <option>Nova aba</option>
                <option>Abas da última sessão</option>
              </select>
              <Pending id="N5" />
            </Row>
            <Row label="Novas abas abrem com" htmlFor="set-newtab">
              <select id="set-newtab" disabled data-codex="settings.newTab">
                <option>Página inicial do Yuki</option>
                <option>Página em branco</option>
              </select>
              <Pending id="N5" />
            </Row>
            <Row label="Remover itens do histórico" htmlFor="set-retention">
              <select
                id="set-retention"
                value={retention || ""}
                onChange={(event) => {
                  const days = event.target.value;
                  setRetention(days || null);
                  if (days) setHistory(pruneHistory(history, Number(days)));
                }}
              >
                <option value="">Manualmente</option>
                <option value="1">Após um dia</option>
                <option value="7">Após uma semana</option>
                <option value="30">Após um mês</option>
              </select>
            </Row>
            <Row label="Pasta dos downloads" htmlFor="set-downloads">
              <select id="set-downloads" disabled data-codex="settings.downloadFolder">
                <option>Downloads</option>
              </select>
              <Pending id="N3" />
            </Row>
            <Row label="Painel do Claude">
              <span className="settings-text">
                Largura em “⋯ → Largura”, na barra do navegador. Atalho: Ctrl+Shift+L.
              </span>
            </Row>
          </>
        )}

        {section === "personalizacao" && (
          <>
            <Row label="Barra de favoritos">
              <label className="consent-check">
                <input
                  id="set-bookmarks-bar"
                  type="checkbox"
                  checked={showBookmarks !== "0"}
                  onChange={(event) => setShowBookmarks(event.target.checked ? null : "0")}
                />
                <span>Mostrar abaixo do endereço</span>
              </label>
            </Row>
            <Row label="Favoritos">
              {bookmarks.length ? (
                <ul className="bookmark-list">
                  {bookmarks.map((bookmark) => (
                    <li key={bookmark.url}>
                      <span title={bookmark.url}>{bookmark.title}</span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remover favorito: ${bookmark.title}`}
                        title="Remover favorito"
                        onClick={() => setBookmarks(bookmarks.filter((b) => b.url !== bookmark.url))}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="settings-text">Nenhum favorito. Use ★ na barra de endereço.</span>
              )}
            </Row>
            <Row label="Fundo da nova aba">
              <div className="swatches" role="radiogroup" aria-label="Fundo da nova aba">
                {["Gelo", "Neve", "Liso"].map((name, index) => (
                  <label key={name} className={`swatch swatch-${index}`}>
                    <input type="radio" name="newtab-bg" disabled defaultChecked={index === 1} data-codex="settings.newTabBackground" />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
              <Pending id="N5" />
            </Row>
            <Row label="Na nova aba, mostrar">
              {["Favoritos", "Mensagem de boas-vindas", "Botão “Perguntar ao Claude”"].map((name) => (
                <label key={name} className="consent-check">
                  <input type="checkbox" disabled defaultChecked data-codex="settings.newTabSections" />
                  <span>{name}</span>
                </label>
              ))}
              <Pending id="N5" />
            </Row>
          </>
        )}

        {section === "privacidade" && (
          <>
            <Row label="Histórico de navegação">
              {history.length ? (
                <ClearHistory onClear={() => setHistory([])} />
              ) : (
                <span className="settings-text">Vazio.</span>
              )}
            </Row>
            <Row label="Cookies e dados de sites">
              <button type="button" className="outline-button" disabled data-codex="privacy.clearSiteData">
                Limpar dados de sites…
              </button>
              <Pending id="N5" />
            </Row>
            <Row label="Permissões de sites">
              <span className="settings-text">
                Câmera, microfone, localização e notificações: sempre recusados.
              </span>
            </Row>
            <Row label="Downloads">
              <span className="settings-text">Bloqueados neste navegador.</span>
            </Row>
          </>
        )}

        {section === "extensoes" && (
          <div className="extensions">
            <div className="browser-card extensions-list">
              <strong>Extensões instaladas</strong>
              <p className="browser-empty">Nenhuma extensão instalada.</p>
              <button type="button" className="outline-button" disabled data-codex="extensions.loadUnpacked">
                Carregar pasta descompactada…
              </button>
            </div>
            <div>
              <h2>
                Extensões no Yuki <Pending id="N4" />
              </h2>
              <p>
                O Yuki usa o Chromium pelo Electron. Ele só carrega extensões a partir de uma pasta
                descompactada, com parte das APIs do Chrome, e não instala pela Chrome Web Store.
              </p>
              <ul>
                <li>Cada extensão roda só nas abas web, nunca no painel do Claude.</li>
                <li>As permissões pedidas aparecem antes de carregar.</li>
                <li>Desativar ou remover vale na hora.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

import { useState, type ReactNode } from "react";
import { Download, Puzzle, Settings2, Shield, SlidersHorizontal, Trash2, X } from "lucide-react";
import {
  browserAction, useBrowserData, reportBrowserError,
  dayLabel,
  hostOf,
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
        Guarda as últimas 5.000 páginas web visitadas neste computador. Clicar abre a página numa nova aba.
      </p>
    </section>
  );
}

export function DownloadsPage() {
  const data = useBrowserData();
  const run = (operation: string, params = {}) => { void browserAction(operation, params).catch(reportBrowserError); };
  const labels: Record<string, string> = { choosing: "Escolha onde salvar", progressing: "Baixando", paused: "Pausado", completed: "Concluído", cancelled: "Cancelado", interrupted: "Interrompido" };
  return (
    <section className="browser-page" aria-label="Downloads">
      <div className="browser-page-bar">
        <span className="browser-page-title"><Download size={16} aria-hidden="true" /> Downloads</span>
        <button type="button" className="outline-button" disabled={!data?.downloads.length} onClick={() => run("downloads.clear")}>Limpar lista</button>
      </div>
      {!data?.downloads.length && <p className="browser-empty">Nenhum download. Ao baixar um arquivo, escolha onde salvá-lo no diálogo do sistema.</p>}
      {data?.downloads.map(row => (
        <div className="browser-card" key={row.id}>
          <strong>{row.name}</strong><p>{labels[row.state] || row.state} · {(row.received / 1024).toFixed(0)} KB{row.total > 0 ? ` / ${(row.total / 1024).toFixed(0)} KB` : ""}</p>
          <progress aria-label={`Progresso: ${row.name}`} max={row.total || 1} value={row.total ? row.received : undefined} />
          {["choosing", "progressing", "paused"].includes(row.state) && <button type="button" className="outline-button" onClick={() => run("downloads.cancel", { id: row.id })}>Cancelar</button>}
          {row.state === "completed" && <button type="button" className="outline-button" onClick={() => run("downloads.show", { id: row.id })}>Mostrar na pasta</button>}
        </div>
      ))}
      <p className="browser-note">Arquivos nunca abrem sozinhos. Limpar a lista não apaga os arquivos. Downloads interrompidos não reiniciam automaticamente.</p>
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
  const [startup, setStartup] = useStored("yuki:startup");
  const [newTab, setNewTab] = useStored("yuki:new-tab");
  const [background, setBackground] = useStored("yuki:new-tab-background");
  const [welcome, setWelcome] = useStored("yuki:home-welcome");
  const [homeBookmarks, setHomeBookmarks] = useStored("yuki:home-bookmarks");
  const [ask, setAsk] = useStored("yuki:home-ask");
  const [engine, setEngine] = useStored("yuki:search-engine");
  const [zoom, setZoom] = useStored("yuki:default-zoom");
  const data = useBrowserData();
  const run = (operation: string) => { void browserAction(operation).catch(reportBrowserError); };

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
              <select id="set-startup" value={startup || "new"} onChange={event => setStartup(event.target.value)}>
                <option value="new">Nova aba</option>
                <option value="restore">Abas da última sessão</option>
              </select>
            </Row>
            <Row label="Novas abas abrem com" htmlFor="set-newtab">
              <select id="set-newtab" value={newTab || "home"} onChange={event => setNewTab(event.target.value)}>
                <option value="home">Página inicial do Yuki</option>
                <option value="blank">Página em branco</option>
              </select>
            </Row>
            <Row label="Remover itens do histórico" htmlFor="set-retention">
              <select
                id="set-retention"
                value={retention || ""}
                onChange={(event) => {
                  const days = event.target.value;
                  setRetention(days || null);
                  // Retention is enforced by the main process, including on startup.
                }}
              >
                <option value="">Manualmente</option>
                <option value="1">Após um dia</option>
                <option value="7">Após uma semana</option>
                <option value="30">Após um mês</option>
              </select>
            </Row>
            <Row label="Pasta dos downloads" htmlFor="set-downloads">
              <span className="settings-text">{data?.downloadFolder || "Downloads do sistema"}</span>
              <button id="set-downloads" type="button" className="outline-button" onClick={() => run("downloads.folder")}>Escolher pasta…</button>
            </Row>
            <Row label="Busca" htmlFor="set-search">
              <select id="set-search" value={engine || "google"} onChange={event => setEngine(event.target.value)}>
                <option value="google">Google</option><option value="bing">Bing</option><option value="duckduckgo">DuckDuckGo</option>
              </select>
            </Row>
            <Row label="Zoom de novas abas" htmlFor="set-zoom">
              <select id="set-zoom" value={zoom || "100"} onChange={event => setZoom(event.target.value)}>
                {[80,90,100,110,125,150].map(value => <option key={value} value={value}>{value}%</option>)}
              </select>
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
                    <input type="radio" name="newtab-bg" checked={(background || "neve") === name.toLowerCase()} onChange={() => setBackground(name.toLowerCase())} />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            </Row>
            <Row label="Na nova aba, mostrar">
              {[{name: "Favoritos", value: homeBookmarks, set: setHomeBookmarks}, {name: "Mensagem de boas-vindas", value: welcome, set: setWelcome}, {name: "Botão “Perguntar ao Claude”", value: ask, set: setAsk}].map(item => (
                <label key={item.name} className="consent-check">
                  <input type="checkbox" checked={item.value !== "0"} onChange={event => item.set(event.target.checked ? "1" : "0")} />
                  <span>{item.name}</span>
                </label>
              ))}
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
              <button type="button" className="outline-button" onClick={() => run("privacy.clearSiteData")}>
                Limpar dados de sites…
              </button>
            </Row>
            <Row label="Permissões de sites">
              <span className="settings-text">
                Câmera, microfone, localização e notificações: sempre recusados.
              </span>
            </Row>
            <Row label="Downloads">
              <span className="settings-text">Destino confirmado antes de salvar; sem abertura automática.</span>
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
              <p>Extensões adiadas nesta etapa por decisão do usuário. Nenhuma extensão é carregada; o botão permanece desativado.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

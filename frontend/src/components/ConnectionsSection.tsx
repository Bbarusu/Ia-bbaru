import { ArrowUpRight, Link2, Loader2, RefreshCw } from "lucide-react";
import {
  formatBilling,
  formatCancellation,
  formatOutputLimit,
  formatUnavailableReason,
} from "../logic.mjs";
import type { Model, Connection } from "../types";

interface ConnectionsSectionProps {
  connections: Connection[];
  diagnosticError: string;
  inFirefox: boolean;
  inDesktop: boolean;
  demo: boolean;
  host: boolean;
  online: boolean;
  checking: boolean;
  catalogVersion: string;
  availableModels: Model[];
  models: Model[];
  connectionError: string;
  modelError: string;
  connect: () => void;
  guideUrl: string;
}

export function ConnectionsSection({
  connections,
  diagnosticError,
  inFirefox,
  inDesktop,
  demo,
  host,
  online,
  checking,
  catalogVersion,
  availableModels,
  models,
  connectionError,
  modelError,
  connect,
  guideUrl,
}: ConnectionsSectionProps) {
  return (
    <div className="connections-grid">
      <section className="card connection-details">
        {connections.map((connection) => (
          <div className="connection-line" key={connection.provider}>
            <span>Claude Code · {connection.version || "versão não identificada"}</span>
            <span>{!connection.configured ? "Nenhum modelo configurado" : connection.ready ? "Pronto" : formatUnavailableReason(connection.reason, connection.provider)}</span>
          </div>
        ))}
        {diagnosticError && <p className="small-note">{diagnosticError}</p>}
        <h2>Conexão com seu computador</h2>
        <p>Seu espaço usa um componente local para acessar os projetos.</p>

        <div className="connection-line">
          <span>{inDesktop ? "Navegador Chromium" : "Extensão Firefox"}</span>
          <span className={inFirefox || inDesktop ? "good" : ""}>
            {inFirefox || inDesktop
              ? "Disponível"
              : demo
                ? "Demonstração"
                : "Abra no navegador Yuki"}
          </span>
        </div>

        <div className="connection-line">
          <span>Componente local</span>
          <span className={host ? "good" : ""}>
            {host ? "Respondendo" : "Não conectado"}
          </span>
        </div>

        <div className="connection-line">
          <span>Backend</span>
          <span className={online ? "good" : ""}>
            {online ? "Disponível" : "Não conectado"}
          </span>
        </div>

        <div className="connection-line">
          <span>Contrato do gateway</span>
          <span>{online ? `v${catalogVersion}` : "—"}</span>
        </div>

        <div className="connection-line">
          <span>Modelos Claude disponíveis</span>
          <span>{availableModels.length}</span>
        </div>

        {(connectionError || modelError) && (
          <p className="connection-message" role="alert">
            {connectionError || modelError}
          </p>
        )}

        <button
          type="button"
          className="primary"
          onClick={connect}
          disabled={checking}
        >
          {checking ? (
            <Loader2 className="spin" size={15} aria-hidden="true" />
          ) : (
            <RefreshCw size={15} aria-hidden="true" />
          )}{" "}
          Verificar novamente
        </button>
      </section>

      <section className="card connection-details">
        <span className="card-icon blue" aria-hidden="true">
          <Link2 size={21} />
        </span>
        <h2>Conecte seu espaço local.</h2>
        <p>
          Seus materiais ficam guardados no computador; os agentes recebem
          apenas o contexto escolhido para cada tarefa. Fazer login em um site
          nas abas do navegador não conecta uma conta automaticamente ao
          gateway.
        </p>

        {models.length > 0 && (
          <div className="catalog-diagnostics" aria-label="Catálogo de agentes">
            {models.map((m) => (
              <div key={m.id} className="catalog-item">
                <div className="catalog-item-head">
                  <strong>{m.label}</strong>
                  <span className={m.available ? "good" : "muted-tag"}>
                    {m.available
                      ? "Disponível"
                      : formatUnavailableReason(m.unavailable_reason)}
                  </span>
                </div>
                {m.capabilities && (
                  <p className="catalog-item-meta">
                    {formatBilling(m.capabilities.billing)} ·{" "}
                    {formatOutputLimit(
                      m.capabilities.output_limit,
                      m.max_output_tokens,
                    )}{" "}
                    · {formatCancellation(m.capabilities.cancellation)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <a
          className="subtle"
          href={guideUrl}
          target="_blank"
          rel="noreferrer"
        >
          Abrir guia de instalação <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <p className="small-note">
          No navegador Chromium, abra um plano e confirme a execução para usar
          os agentes conectados. O planejamento sozinho não consome geração.
        </p>
      </section>
    </div>
  );
}

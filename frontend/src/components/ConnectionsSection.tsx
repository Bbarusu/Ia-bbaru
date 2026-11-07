import { ArrowUpRight, Link2, Loader2, RefreshCw } from "lucide-react";
import type { Model } from "../types";

interface ConnectionsSectionProps {
  inFirefox: boolean;
  demo: boolean;
  host: boolean;
  online: boolean;
  checking: boolean;
  availableModels: Model[];
  models: Model[];
  connectionError: string;
  modelError: string;
  connect: () => void;
  guideUrl: string;
}

export function ConnectionsSection({
  inFirefox,
  demo,
  host,
  online,
  checking,
  availableModels,
  connectionError,
  modelError,
  connect,
  guideUrl,
}: ConnectionsSectionProps) {
  return (
    <div className="connections-grid">
      <section className="card connection-details" aria-labelledby="conn-status-title">
        <h2 id="conn-status-title">Conexão com seu computador</h2>
        <p>A extensão usa um componente local para acessar seus projetos.</p>
        <div className="connection-line">
          <span>Extensão Firefox</span>
          <span className={inFirefox ? "good" : ""}>
            {inFirefox
              ? "Disponível"
              : demo
                ? "Demonstração"
                : "Abra no Firefox"}
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
          <span>Agentes disponíveis</span>
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

      <section className="card connection-details" aria-labelledby="conn-guide-title">
        <span className="card-icon blue" aria-hidden="true">
          <Link2 size={21} />
        </span>
        <h2 id="conn-guide-title">Conecte seu espaço local.</h2>
        <p>
          Instale o componente local e inicie o backend. Seus materiais ficam no
          computador; os agentes recebem apenas o contexto escolhido para uma
          tarefa.
        </p>
        <a
          className="subtle"
          href={guideUrl}
          target="_blank"
          rel="noreferrer"
        >
          Abrir guia de instalação <ArrowUpRight size={15} aria-hidden="true" />
        </a>
        <p className="small-note">
          Nesta versão, você pode organizar materiais e criar planos. Executar
          uma IA pelo painel será habilitado quando a execução independente do
          painel estiver pronta.
        </p>
      </section>
    </div>
  );
}

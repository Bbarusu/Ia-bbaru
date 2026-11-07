import { Layers3 } from "lucide-react";

export function ContextGuideCard() {
  return (
    <section className="context-card card">
      <div className="section-top">
        <div>
          <span className="eyebrow muted">POR ONDE COMEÇAR</span>
          <h2>Um lugar para suas ideias.</h2>
        </div>
        <span className="orbit-icon" aria-hidden="true">
          <Layers3 size={22} />
        </span>
      </div>
      <p>O contexto acompanha o projeto, mesmo quando o agente muda.</p>
      <div className="steps">
        <div>
          <span>01</span>
          <p>
            <strong>Reúna o que importa</strong>
            <small>Trechos, anotações e referências.</small>
          </p>
        </div>
        <div>
          <span>02</span>
          <p>
            <strong>Escolha quem participa</strong>
            <small>Um agente ou uma segunda opinião.</small>
          </p>
        </div>
        <div>
          <span>03</span>
          <p>
            <strong>Continue de onde parou</strong>
            <small>Planos e resultados no mesmo lugar.</small>
          </p>
        </div>
      </div>
    </section>
  );
}

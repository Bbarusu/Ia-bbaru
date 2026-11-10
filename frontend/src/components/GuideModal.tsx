import { useEffect, useRef, useState } from "react";

interface GuideModalProps {
  close: () => void;
}

const STEPS = [
  {
    chips: [
      { text: "❄ Navegador Real", variant: "accent" },
      { text: "Prints · Imagens · Textos", variant: "default" },
      { text: "❄ Agentes + SQLite Local", variant: "default" },
    ],
    title: "Oi, esse é o Yuki",
    description:
      "Um navegador Chromium em desenvolvimento pensado para estudar, pesquisar e acionar agentes de IA direto na barra lateral — com interface própria, guardando seus projetos, prints, imagens e textos localmente em SQLite.",
    rowTitle: "Seu contexto fica no seu PC",
    rowSub:
      "Projetos, biblioteca multimodal e planos ficam salvos localmente e continuam lá quando você reabre o Yuki.",
    tag: "SQLite local",
  },
  {
    chips: [
      { text: "📝 Texto", variant: "default" },
      { text: "📸 Print", variant: "default" },
      { text: "🖼 Imagem", variant: "default" },
      { text: "❄ Perguntar ao Yuki", variant: "accent" },
    ],
    title: "Capture textos, prints e imagens num clique",
    description:
      "Use a barra de favoritos limpa para abrir seus sites rápidos, busque na página (Ctrl+F), ajuste o zoom e capture textos selecionados, prints da tela ou imagens da página direto para o projeto antes de acionar um agente.",
    rowTitle: "Rascunho protegido contra perda",
    rowSub:
      "Se outra captura chegar enquanto você edita um material, ela entra em espera sem apagar seu trabalho.",
    tag: "Fila segura",
  },
  {
    chips: [
      { text: "App Yuki: R$ 0", variant: "good" },
      { text: "Chave de API: removida", variant: "default" },
    ],
    title: "Quanto custa usar? Nada por fora",
    description:
      "O Yuki não tem mensalidade, não vende créditos e não usa chaves de API pagas por token escondidas. No adaptador do Claude Code, variáveis de chave de API são removidas do processo de propósito para nunca cair em cobrança por uso sem você querer.",
    rowTitle: "Zero chamadas automáticas em segundo plano",
    rowSub:
      "Nenhuma geração acontece sem a sua ação e nenhuma chamada com falha é repetida sozinha.",
    tag: "Sem taxas",
  },
  {
    chips: [
      { text: "Assinatura (cota da conta)", variant: "accent" },
      { text: "Limite indicativo", variant: "default" },
      { text: "Cancelamento local", variant: "default" },
    ],
    title: "Impacto na sua assinatura de IA",
    description:
      "Quando você conecta um agente oficial (como o Claude Code logado na sua conta), cada geração usa a cota normal da sua assinatura — igual a mandar mensagem no site. Como o CLI trata o teto de tokens como indicativo e fechar o processo local não devolve cota no servidor, o Yuki mostra isso claro e pede seu aceite por tarefa.",
    rowTitle: "Saída parcial nunca é descartada",
    rowSub:
      "Se a resposta atingir o limite ou não confirmar término, o texto recebido fica salvo para leitura e a revisão para na hora.",
    tag: "Contrato 1.1",
  },
  {
    chips: [
      { text: "Aba Web (Isolada)", variant: "default" },
      { text: "≠", variant: "accent" },
      { text: "Gateway Local (CLI Oficial)", variant: "default" },
    ],
    title: "Abas web isoladas dos agentes locais",
    description:
      "Entrar no Claude, ChatGPT, Gemini ou NotebookLM pelas abas do navegador serve para você usar os sites normalmente e capturar trechos. Por segurança, o Yuki nunca lê seus cookies nem sessões web: os agentes do painel só conectam pelo CLI oficial instalado no PC.",
    rowTitle: "Isolamento total nas páginas web",
    rowSub:
      "Sites abertos nas abas não têm acesso ao Node, ao seu banco de dados nem à ponte de agentes.",
    tag: "Sandbox ativo",
  },
];

export function GuideModal({ close }: GuideModalProps) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    return () => {
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function"
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  const current = STEPS[step];

  return (
    <dialog
      ref={dialogRef}
      className="kinfo-guide-dialog"
      onCancel={close}
      onClose={close}
      aria-labelledby="guide-dialog-title"
    >
      <div className="guide-modal-top">
        <span className="guide-modal-count">
          ❄ Conhecendo o Yuki · {step + 1} de {STEPS.length}
        </span>
        <button
          type="button"
          className="guide-skip-btn"
          onClick={close}
          aria-label="Pular guia"
        >
          Pular
        </button>
      </div>

      <div className="guide-modal-mesa" aria-hidden="true">
        <div className="guide-modal-pill">
          {current.chips.map((c, idx) => (
            <span key={idx} className={`guide-modal-chip ${c.variant}`}>
              {c.text}
            </span>
          ))}
        </div>
      </div>

      <h2 id="guide-dialog-title" className="guide-modal-title">
        {current.title}
      </h2>
      <p className="guide-modal-text">{current.description}</p>

      <div className="guide-modal-item">
        <div>
          <strong>{current.rowTitle}</strong>
          <small>{current.rowSub}</small>
        </div>
        <span className="guide-modal-tag">{current.tag}</span>
      </div>

      <div className="guide-modal-footer">
        <div className="guide-modal-dots" role="tablist" aria-label="Passos do guia">
          {STEPS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={idx === step}
              aria-label={`Passo ${idx + 1}: ${s.title}`}
              className={`guide-dot ${idx === step ? "active" : ""}`}
              onClick={() => setStep(idx)}
            />
          ))}
        </div>

        <div className="guide-modal-actions">
          {step > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Voltar
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (step === STEPS.length - 1) close();
              else setStep((s) => s + 1);
            }}
          >
            {step === STEPS.length - 1 ? "Pronto!" : "Próximo"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

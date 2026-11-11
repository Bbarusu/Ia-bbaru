# Entrega do Frontend — Navegador Yuki Exclusivo para Claude

Data: 11/11/2026  
Branch: `gemini/chromium-ui`  
Base integrada: `origin/codex/browser-capture-clis` (PR #7)  
Referência: `docs/PROMPT_GEMINI_CLAUDE_ONLY.md`, `docs/DIRECAO_CLAUDE_ONLY.md`, `docs/STATUS.md` e `docs/CONTRATO_CAPTURAS.md`.

---

## 1. Mudanças Implementadas

### A. Integração com a branch do Codex
- A branch `origin/codex/browser-capture-clis` foi incorporada na `gemini/chromium-ui`.
- Preservadas as implementações do runtime do Chromium (`desktop/main.cjs`), do transporte IPC, das capturas nativas e da persistência de mídias (`backend/media.py` / `source_media`).

### B. Seletores e Semântica de Contexto (`context-*` e `data-context`)
- Atualizados e padronizados todos os seletores e classes para o padrão unificado:
  - `desktop/ui/index.html`: `#context-actions`, `.context-actions`, `.context-chip`, `data-context="summarize|print|image"`.
  - `desktop/ui/shell.css`: regras de estilo `.context-actions` e `.context-chip`.
  - `desktop/ui/shell.js`: manipuladores de clique consultando `[data-context]`.
  - `desktop/ui/home.html` e `desktop/ui/home.css`: `.context-hub-strip`, `.context-pill-card`, `.context-pill-icon`.
  - `frontend/src/style.css` e `WorkspaceComposer.tsx`: `.context-composer-bar`, `.context-bar-title`, `.context-bar-btns`, `.context-mini-btn`, `.context-agent-pill`.
- Preservados os recursos reais de busca na página (`Ctrl+F`), controle de zoom, reabertura de aba fechada (`Ctrl+Shift+T`), histórico local e capturas de texto, print e imagem. Sem recriação de sub-abas.

### C. Catálogo Real e Seleção de Modelos Claude
- **Somente modelos reais do catálogo:** A UI não renderiza quatro cartões estáticos fixos. Apenas os modelos Claude configurados e retornados pela rota de catálogo são exibidos; caso nenhum esteja configurado, é exibido apenas o placeholder de instrução "Claude Code — Conexão a configurar".
- **Identificação de Perfis:** Cada cartão de modelo exibe suas categorias de especialização (`m.task_kinds`), modalidade de cobrança (`formatBilling`), limites de tokens e garantias de cancelamento.
- **Destaque de Adequação ao Tipo de Tarefa:** Quando o perfil de um modelo inclui o tipo de tarefa selecionado no compositor (`kind`), a UI exibe o chip `Perfil: <categoria>`, informando a compatibilidade sem rotulá-lo arbitrariamente como "melhor modelo".
- **Aviso e Proteção sobre o Fable:** Quando configurado no catálogo, o Fable exibe aviso explícito (`⚠️ Fable pode exigir créditos adicionais de uso no Claude Code. Não selecionado por padrão.`) e nunca é selecionado por padrão.

### D. Seleção de Papéis: Resposta Principal e Revisor Claude
- Implementada a função pura e testada `resolveEffectiveRoles` em `frontend/src/logic.mjs`.
- Adicionado painel de controles de papéis (`.model-role-selectors`) quando há modelos autorizados selecionados:
  - **Resposta principal (`preferred_model_id`):** Permite manter em "Automático (por perfil de <tipo>)" ou escolher explicitamente um dos modelos Claude autorizados.
  - **Revisão por outro modelo Claude (`reviewer_model_id`):** Ao ativar a revisão (e havendo ao menos 2 modelos autorizados), permite manter em "Automático (outro modelo Claude autorizado)" ou selecionar explicitamente o modelo revisor (excluindo o modelo responsável pela resposta).
- Cartões dos modelos recebem badges visuais dinâmicos indicando seu papel na tarefa (`[Resposta principal]`, `[Resposta principal (auto)]`, `[Revisão]`, `[Revisão (auto)]`).
- O payload de `tasks.plan` passa a enviar `preferred_model_id` e `reviewer_model_id` conforme a seleção do usuário, preservando o contrato do backend (`TaskInput`).

### E. Preservação de Contratos e Integridade de Dados
- Mantidos o aceite de limite indicativo (`allow_unenforced_output_limit`), a confirmação explícita antes da execução durável, a proteção de rascunhos, a fila de captura pendente e a exibição de respostas parciais com erro sanitizado (`completion_unconfirmed`).
- Imagens mantidas exclusivamente em `Source.media` (`source_media`), sem envio como texto ou base64 ao gateway.
- Nenhum dado, histórico de projetos ou favoritos do usuário foram apagados.

---

## 2. Testes e Validação Executados

Todas as suítes passaram sem erros:

1. **Frontend Unit Tests:**
   - Comando: `npm --prefix frontend test`
   - Resultado: 12/12 testes aprovados (incluindo testes de ordenação e separação de papéis em `resolveEffectiveRoles`).
2. **Desktop Unit Tests:**
   - Comando: `npm --prefix desktop test`
   - Resultado: 3/3 testes de isolamento e limites aprovados.
3. **Build de Produção do Frontend & Extensão:**
   - Comando: `npm --prefix frontend run build`
   - Resultado: TypeScript sem erros (`tsc --noEmit`), bundle Vite gerado e extensão pronta.
4. **Smoke Test Gráfico Chromium (Electron):**
   - Comando: `npm --prefix desktop run test:ui`
   - Resultado: Aprovado (`Chromium UI passed: navigation, isolation, real backend, capture, draft preservation and restart persistence.`). Verificação de viewport 900x640 e ausência de transbordo horizontal aprovada.
5. **Verificação de UI (Firefox & Backend Real):**
   - Comando: `python scripts/verify_ui.py`
   - Resultado: Aprovado (`Firefox UI checks passed: real backend/library/capture, draft persistence, unavailable gateway, 360px layout, labelled demo plan.`).
6. **Backend e Integrações Python:**
   - Comando: `python -m unittest discover -s tests -p "*.py"`
   - Resultado: 67/67 testes aprovados.

---

## 3. Dependências e Pendências

- **CLI Claude Code no Windows:** Para execução durável com geração real, o operador deve possuir o Claude Code instalado e autenticado (`claude` no terminal), e inicializar o aplicativo com os modelos autorizados via `iniciar-ia-bbaru.ps1 -Models "sonnet,haiku,opus"`.
- **Entrada visual no Gateway:** O suporte a visão/multimodalidade nos agentes continua dependente de definição e implementação do contrato no gateway (hoje as imagens são armazenadas apenas localmente).

# Estado atual — Yuki, Chromium e Claude

Atualizado em 17/11/2026. Branch codex/browser-capture-clis, PR #7, fora da main.
PR #11 integrada até b2735ca; análise da CLI integrada até 856cfa5.

- Produto somente Electron/Chromium. Extensão, instalador e guia Firefox removidos;
  a ponte native_host permanece porque o desktop a usa. Dados antigos preservados.
- Único provedor: Claude Code por assinatura. Fable explícito, sem troca automática
  de modelo; login não prova acesso a cada modelo.
- Correção da perda de blocos: stream-json interno recompõe a última resposta e
  verifica result/modelo/ferramentas. HTTP continua sem entrega incremental.
- Erros classificados por api_error conhecido, com fallback textual; diagnósticos
  sanitizados coerentes e versão last_verified. Sem repetição automática de cota,
  teto, timeout, erro final ou resultado incerto. Fonte citada por título.
- Contrato1.2 publicado: modelo servido e imagem tipada; 1/1.1 preservados.
- Backend de conversas: histórico, aceite revogável, contexto por turno,
  projeto implícito, envio idempotente/atômico pela fila existente. Tabela
  conversation_turns com upgrade não destrutivo de chat_turns. Fontes únicas no
  histórico e orçamento JSON/reserva compartilhado com o gateway, inclusive revisão.
- Captura textual de página inteira disponível no IPC, limitada a38.000 caracteres,
  com identidade de documento, tab_id e documentVersion. Foco/atalho/largura
  disponíveis no runtime; menu antigo não captura seleção após navegar.
- Captura visual inteira via capture.page.visual: CDP privado, HTTP(S), máximo
  8.000 px por lado/16 MP/480KB, erro explícito acima do limite. Preserva print
  da área visível, recorte de imagem e importação. Comando maximize disponível.
- Visão experimental: modelo explicitamente configurado, uma PNG/JPEG até480KB,
  aceite separado, hash/eco da CLI. Testada com dublês; sem validação real da conta.
- Ícones .ico/.icns gerados do PNG aprovado e configurados para empacotamento.
  Instalador assinado/publicado não foi produzido.

## Integração de interface ainda necessária

A UI aprovada da PR11 foi preservada e integrada. Ela ainda usa tarefas independentes,
aceite por mensagem e capturas de seleção. O Claude de interface deve ligar as
operações novas; isso não está marcado como concluído. Prompt fechado em
[PROMPT_CLAUDE_FRONTEND_CHAT.md](PROMPT_CLAUDE_FRONTEND_CHAT.md), contrato em
[ENTREGA_BACKEND_CHAT.md](ENTREGA_BACKEND_CHAT.md). Não apresentar histórico real,
aceite único, visão ou handle de largura como funções visuais já entregues.

Codex: backend/gateway/contratos/runtime e integração. Claude de interface:
frontend/ e desktop/ui/. Claude analista: somente ANALISE_CLI_CLAUDE.md.
[Divisão vigente](DIVISAO_RESPONSABILIDADES.md).

## Evidências e validação pendente

Testes desta rodada Linux: 96 backend aprovados; gateway108 executados (107 aprovados e 1 real ignorado);
6 testes de política/captura desktop aprovados. Smoke Chromium integrado aprovado,
incluindo página visual maior que a janela, identidade de documento, recusa de
menu antigo, maximize, navegação, isolamento, capturas, rascunhos, conversa pelo
IPC e persistência após reiniciar. Build/ícones, verify_ui.py e 16 testes frontend
aprovados na rodada anterior; frontend sem alterações nesta rodada. Xvfb, com sandbox do
sistema desativada só no teste Linux. Nenhuma geração real nesta rodada.

Windows: usuário forneceu tarefa3ca05830-926f-47ca-96d8-0ccfe7399a4d com resposta
cortada na versão anterior. Cota esgotada também foi confirmada em teste anterior.
Leitura comparativa dos bancos pronta, mas ainda não recebida/executada pelo Codex.
Não concluir retroativamente a causa da resposta nem marcar o teste real aprovado.
[Roteiro Windows e leitura sem geração](VALIDACAO_WINDOWS_ATUAL.md).

[Resposta à análise e revisão da PR](RESPOSTA_ANALISE_CLI.md).
Cancelamento de chamada em curso e entrega progressiva não estão no contrato atual.
Renovação de cota não é exposta; não inventar horário. Históricos de implantação,
limpeza de cópias e testes anteriores em [HISTORICO_STATUS.md](HISTORICO_STATUS.md).

Pedido do navegador lido até `claude/friendly-curie-pxw81w@1224556`, sem incorporar
as mudanças visuais recentes. [Resposta por item](RESPOSTA_VISAO_E_NAVEGADOR.md):
captura integral limitada, N7 e maximize entregues; anexos diretos no turno,
multimagem/1.3, PDF, streaming, cancelamento, ajustes persistidos, downloads e
extensões continuam pendentes. Preservar o painel aprovado, não recriar a visão
geral de abas sobre a nova aba que foi reprovada. Não liberar visão por padrão.

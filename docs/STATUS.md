# Estado atual — Yuki, Chromium e Claude

Atualizado em 16/11/2026. Branch codex/browser-capture-clis, PR #7, fora da main.
PR #11 integrada até b2735ca; análise da CLI integrada até eb6c671.

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
- Backend de conversas pronto: histórico, aceite revogável, contexto por turno,
  projeto implícito, envio idempotente/atômico pela fila existente.
- Captura textual de página inteira disponível no IPC, limitada a38.000 caracteres,
  com identidade de documento. Foco/atalho/largura disponíveis no runtime.
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

Testes locais Linux: 92 backend aprovados; gateway103 executados,102 aprovados e
1 real ignorado; frontend16 e políticas desktop3 aprovados. Build, ícones, verify_ui.py e smoke
Chromium integrado aprovados; smoke inclui navegação, isolamento, capturas,
rascunhos, conversa pelo IPC e persistência após reiniciar. Xvfb, com sandbox do
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

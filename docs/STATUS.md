# Estado atual — Yuki, Chromium e Claude

Validação Windows da base aprovada pelo usuário em 18/11. A rodada posterior de captura rica e vídeo aguarda repetição no Windows.

Atualizado em 17/11/2026. Branch codex/browser-capture-clis, PR #7, fora da main.
Interface integrada até 75db802 (inclui F-4 e imagens diretas). Base anterior integrada até 629254c por fast-forward sobre 93b44f6; análise CLI até 2f6fda8.

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
- Captura textual estruturada no IPC, com vídeo, legendas acessíveis e extratos parciais identificados, limitada a 38.000 caracteres,
  com identidade de documento, tab_id e documentVersion. Foco/atalho/largura
  disponíveis no runtime; menu antigo não captura seleção após navegar.
- Captura visual inteira via capture.page.visual: CDP privado, HTTP(S), máximo
  8.000 px por lado/16 MP de página original, saída para visão até 2.000 px por lado e 480 KB. Preserva print
  da área visível, recorte de imagem e importação. Comando maximize disponível.
- Visão experimental: modelo explicitamente configurado, uma PNG/JPEG até480KB,
  aceite separado, hash/eco da CLI. Testada com dublês; sem validação real da conta.
- Ícones .ico/.icns gerados do PNG aprovado e configurados para empacotamento.
  Instalador assinado/publicado não foi produzido.

## Interface integrada

Chat lateral usa conversations.*, corpo/turn_id persistidos antes do envio,
aceite revogável, perfis e snapshots de página/seleção. Imagem e revisão pedem
confirmação; print integral passa pela revisão da biblioteca. Histórico de
conversas e consulta de envio pendente sobrevivem ao reinício sem nova geração.
HTTP 5xx mantém o pedido pendente; 404 em consulta não prova que o envio parou.
Somente consulta ou replay do mesmo corpo ficam disponíveis nessa incerteza.

O processo principal persiste histórico, favoritos, ajustes e downloads por perfil.
O painel e a barra importam os dados legados uma vez. A nova aba aplica as preferências.
Downloads exigem confirmação de destino. Extensões adiadas. Janela Windows sem moldura. Imagens diretas ficam na conversa. O contrato opcional
1.3 aceita até quatro imagens com aceite visual, incluindo o histórico.
Captura limpa no IPC ainda exige fechar explicitamente sua revisão no painel;
não fechar rascunhos automaticamente. Contrato em [ENTREGA_BACKEND_CHAT.md](ENTREGA_BACKEND_CHAT.md).

Codex: backend/gateway/contratos/runtime e integração. Claude de interface:
frontend/ e desktop/ui/. Claude analista: somente ANALISE_CLI_CLAUDE.md.
[Divisão vigente](DIVISAO_RESPONSABILIDADES.md).

## Evidências e validação pendente

Testes desta rodada Linux: 100 backend aprovados; gateway111 executados (110 aprovados e 1 real ignorado);
9 testes de persistência/política/captura desktop aprovados. Smoke Chromium integrado aprovado,
incluindo página visual maior que a janela, identidade de documento, recusa de
menu antigo, maximize, navegação, isolamento, capturas, rascunhos, conversa pelo
IPC e persistência após reiniciar, perda de resposta, replay idempotente e
restauração de envio pendente sem despacho automático. Build/ícones
e 24 testes frontend aprovados nesta integração. Xvfb, com sandbox do
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

Pedido e interface incorporados até `claude/friendly-curie-pxw81w@629254c`. [Resposta por item](RESPOSTA_VISAO_E_NAVEGADOR.md):
captura integral limitada, N7 e maximize entregues; anexos diretos no turno,
multimagem/1.3, PDF, streaming, cancelamento, ajustes persistidos, downloads e
extensões continuam pendentes. Preservar o painel aprovado, não recriar a visão
geral de abas sobre a nova aba que foi reprovada. Não liberar visão por padrão.

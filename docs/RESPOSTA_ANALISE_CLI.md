# Resposta Codex à análise CLI — 16/11/2026

Análise integrada até eb6c671, incluindo A1/A2 de 16/11. PR de interface #11
integrada até b2735ca. Não houve chamada real nesta implementação.

| Itens | Implementação / decisão |
| --- | --- |
| P-1/P-2 | categoria única em failures.py para erro, assinatura SQLite e log JSON; texto nunca registrado |
| P-3 | JSON profundo vira provider_invalid_output, com diagnóstico e replay final |
| P-4 | formato atual de corte coberto; erro não inventa parcial; formato antigo length preservado como compatibilidade |
| P-5 | versão sanitizada no log e na assinatura, explicitamente last_verified |
| P-6/A2 | api_error conhecido tem precedência; api_error_status numérico; fallback textual cobre hit/reached your e uso pausado |
| P-7/A1 | stream-json interno, init.tools/model conferidos, agrupamento do último message.id, concatenação ordenada, comparação com último bloco/result; divergência/fallback recusados |
| C-1 | served_model no contrato1.2; 1/1.1 inalterados |
| C-2/C-7 | códigos de créditos, modelo indisponível e teto; classificados como finais, sem retry |
| C-3/C-4 | Fable explícito; regra de nível do revisor com override explícito |
| C-5 | duração medida por etapa durável; crash não inventa duração |
| C-6/C-10 | login separado de acesso por modelo; fingerprint e modelo servido disponíveis |
| C-8/C-9 | padrão2048 para novos chats/inicializador; histórico persistido no contexto; aceite e envio idempotente |
| R-1/R-3 | proveniência do fixture de cota; taxa de pedidos separada de cota |
| R-2/C-11 | campos de renovação levantados pelo analista, mas não expostos nesta versão; não prometer horário |

O contrato1.2 também incorpora visão tipada com habilitação por modelo, aceite,
hash e eco da CLI. HTTP continua não incremental. Detalhes e limitações em
ENTREGA_BACKEND_CHAT.md. Não há comprovação de visão real na conta do usuário.

## Investigação da resposta cortada

Dados recebidos do usuário: tarefa 3ca05830-926f-47ca-96d8-0ccfe7399a4d, etapa0,
Windows W:\Projeto\Ia-bbaru-chat, perfil %LOCALAPPDATA%\Ia-bbaru-teste-chat.
Saída vista: `-48dc-b51a-4c4ebcb0da4e).`. Contrato1.1, limite128, conclusão reportada.

O mecanismo de perda de blocos foi identificado pela leitura do pacote oficial
pelo analista e agora tem regressão sintética. **Ainda não está provado que causou
aquela resposta.** O Codex não tem acesso ao disco Windows; scripts/inspect_saved_response.py
faz leitura mode=ro dos dois bancos, sem CLI, comparação por hash/tamanho e usage.
Se outputs diferem, investigar backend; se iguais, o corte já estava no gateway
ou antes dele. Tokens de saída maiores não provam perda, pois raciocínio também
pode ser contado. O UUID parcial não pode ser reconstruído por adivinhação.

Prompt agora pede título da fonte, não id. Isso melhora a referência mas não
substitui a correção do parser. A falha provider_error original de “Revise”
continua sem causa retroativamente comprovada; H1/H2/H4/H5 são hipóteses.

## Revisão PR #11

Removidos extensão/instalador/guia Firefox; ponte stdio e serviço Python preservados
porque Electron os usa. Testes adaptados mantêm autorização antes de geração,
isolamento, persistência e proteção de rascunhos. Conflito em smoke.cjs resolvido
com fluxo novo da interface e contrato1.2; adicionados chat real via IPC e captura
obsoleta após reload. Skills importadas são documentação auxiliar, não execução
nem mudança de permissões. Nenhuma sessão de outros navegadores foi apagada.

Ícones .ico/.icns gerados do PNG aprovado, script reproduzível e caminhos de
empacotamento configurados. Isso não equivale a um instalador assinado/publicado.

O Claude analista pode revisar a implementação e atualizar somente sua análise;
qualquer nova implementação continua com Codex. O Claude de interface recebe
PROMPT_CLAUDE_FRONTEND_CHAT.md. Não há tarefa ativa atribuída ao antigo colaborador.

## Fechamento da seção 8 — 17/11/2026

Análise integrada até `856cfa5`. Implementação e testes sem conta real:

- P-8: metadados `system`, `rate_limit_event` e `keep_alive` podem vir depois do
  único `result`; conteúdo `assistant`/`user`/`prompt_suggestion` após ele é recusado.
- P-9: mensagens `<synthetic>` não entram na montagem/modelo; somente sintéticas
  não provam resposta e são recusadas.
- P-10: todos os eventos `model_*fallback`, inclusive variantes de recusa,
  consentimento e `no_fallback`, são recusados mesmo com alias da mesma família;
  após `result` também viram `provider_model_mismatch` sanitizado.
- P-11: fixture exige `--verbose`, inclui eventos de início/limite de uso e cota
  com assistente sintético + API error tipado. HTTP/replay testados sem duplicar.
- P-12: serialização e orçamento compartilhados em `backend/prompting.py`;
  `integrations/prompt.py` mantém exports compatíveis. Planejamento e execução
  (incluindo revisão) contam JSON real e reserva de saída como o gateway.
- P-13: fontes imutáveis únicas fora do JSON de histórico. Reanexar 38.000
  caracteres não duplica o texto; mesmo ID com conteúdo diferente é conflito.
- Windows: teste fixa prompt ASCII, sem metacaracteres de cmd e abaixo de 4.000
  caracteres. Isso não substitui a repetição da integração no Windows.

Não foi reproduzida a tarefa pessoal antiga nem atribuída retroativamente sua
causa sem a comparação dos bancos. Testes de parser são fixtures, não geração real.

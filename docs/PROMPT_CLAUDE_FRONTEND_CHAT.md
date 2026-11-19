# Atualização para o Claude de interface

Repositório Bbarusu/Ia-bbaru. Sua PR #11 (b2735ca) foi integrada em
codex/browser-capture-clis. Atualize sua branch a partir dessa base, preservando
alterações locais. Não reaplique a PR nem patches antigos e não altere main.

Leia docs/ENTREGA_BACKEND_CHAT.md, docs/STATUS.md e
DIVISAO_RESPONSABILIDADES.md. Mantenha o design aprovado pelo usuário.
Você continua responsável por frontend/ e desktop/ui/. Codex concluiu contratos,
backend, ponte, parser e runtime; o outro Claude continua analista da CLI.

Ligue os controles aos contratos entregues:
1. conversations.create/list/get e turns.send/get/list, com UUID/corpo persistidos
   antes do envio, histórico pelo backend e recuperação após reiniciar. O seletor
   “Nova conversa” deve criar conversa real, sem esconder tarefas por data.
2. Aceite explícito inicial revogável por conversa, nos limites do contrato.
   Remover a exigência repetida somente quando há consent_id válido. Sem
   confirmed=true automático. Garantir caminho de renovar/revogar e de consultar
   envio perdido sem duplicar geração.
3. capture.page/selection → snapshots por turno; chips identificam documento e
   contexto antigo. Não criar material textual automaticamente para cada captura.
4. Escutar focusComposer; implementar handle de largura usando panel.resize.
5. Mostrar perfis quick/normal/deep e escolha explícita do modelo. General é o
   padrão neutro; não voltar a fixar study para todo pedido. Revisão opcional em
   controle avançado, explicando a segunda chamada e política de revisor.
6. Visão: só mostrar como disponível quando input.image.supported e protocolo1.2.
   Prévia, source_ids e allow_visual_input explícito; não colocar base64 no texto.
   Deixar claro limite de uma imagem e estado experimental até teste real.
7. Modelo servido, duração e fingerprint nos detalhes; erros tipados e política
   sem repetição. Não anunciar parcial quando provider_output_limit_reached não
   trouxe texto. Não prometer horário de renovação nem “Parar” sem operação.

Pequenos ajustes de compatibilidade feitos pelo Codex na integração: ferramentas
bloqueadas também no catálogo1.2, escolha explícita de Fable encaminhada,
kind=general, mensagens de créditos/teto/taxa/cota. Preserve-os.

Critérios: conversa persiste ao fechar/reabrir; “explique o segundo ponto” recebe
histórico; contexto não troca ao navegar; envio duplo usa mesmo turno; revogação
bloqueia novos despachos; sem geração ao abrir; testes existentes adaptados com
essas verificações, sem mocks substituindo backend em produção. Não simular APIs.
Dependências não existentes vão para sua passagem; não criar fila ou contratos
paralelos. Entregue commits na sua branch, evidências e pendências para integração.

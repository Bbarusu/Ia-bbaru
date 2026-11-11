# Prompt para Gemini — frontend exclusivo para Claude

Trabalhe no repositório https://github.com/Bbarusu/Ia-bbaru.
A base de integração é `codex/browser-capture-clis` (PR #7).
Leia primeiro docs/AJUSTES_CHAT_LATERAL.md, docs/DIRECAO_CLAUDE_ONLY.md,
docs/STATUS.md e docs/CONTRATO_CAPTURAS.md.
Preserve suas edições locais e integre esta base antes de continuar; não substitua
o runtime por uma versão antiga. Use sua branch de trabalho.

O usuário eliminou todos os provedores de IA do aplicativo, exceto Claude.
Sua participação como desenvolvedor do frontend continua; não adicione Gemini
como agente do produto. As integrações anteriores foram removidas.

Objetivo: manter o visual Yuki/Kinfo escolhido pelo usuário e apresentar um navegador
com assistência Claude e seleção clara de modelos, em vez de seleção de fornecedores.

## Prioridade nova — chat lateral (11/11/2026)

O usuário considera o fluxo atual complexo. As referências Atlas/Edge indicam
conversa ao lado da página, sem modal por mensagem. Implemente a interface conforme
AJUSTES_CHAT_LATERAL.md: reutilize o painel existente, botão evidente na barra,
histórico, compositor fixo, resposta em destaque e contexto da página removível.
Projetos/materiais/planos deixam de ser etapas obrigatórias do chat comum.
Mantenha acesso à biblioteca e aos dados existentes.

Apresente captura real, seleção e fonte usada; não simule compreensão da página,
histórico entre turnos, streaming ou visão. Se depender de contrato novo, registre
a dependência e o estado indisponível até integração. Combine com Codex o envio
único com aceite persistido, continuidade, captura e preservação de rascunhos.

Mova contrato, tentativas e explicação de roteamento para detalhes recolhidos.
Seletor Claude discreto; revisão opcional. Preserve avisos que mudam a decisão.
Remova decoração sobre textos. Erros ficam na conversa com orientação comprovada;
provider_error não deve ser a explicação principal. Não atribua causa desconhecida
nem ofereça retry automático de resultado incerto. A falha real está pendente com
Code/Codex; a nova interface não pode marcá-la resolvida sem evidência.

## Regras que permanecem

1. Usar os modelos reais retornados pelo catálogo. Não criar quatro cartões ativos
   fixos. Sonnet, Haiku, Opus e Fable só aparecem quando configurados; login da CLI
   não prova acesso individual a cada modelo.
2. Mostrar “Modelos Claude”, perfis de uso, seleção permitida, indisponibilidade,
   resposta principal e revisão por outro modelo Claude. O tipo de tarefa e a
   preferência orientam a seleção; nunca anunciar “melhor modelo” como fato.
3. Melhorar a escolha manual/por perfil, respeitando os campos existentes
   allowed_model_ids, preferred_model_id, reviewer_model_id e kind. Qualquer
   nova preferência precisa de contrato documentado; não criar sucesso simulado.
4. Fable pode exigir créditos adicionais. Manter aviso quando configurado,
   não selecioná-lo por padrão nem apresentar uso ilimitado/sempre incluído.
5. Preservar aceite de limite, confirmação de execução, rascunhos, captura pendente,
   fila, retomada, erro sanitizado e resposta incompleta sem revisão automática.
6. Usar seletores context-* / data-context, que substituem a nomenclatura anterior.
   Preservar busca, zoom, reabrir aba e capturas reais. Não recriar sub-abas.
7. Imagens são materiais locais; não prometer análise visual enquanto o gateway
   não tiver contrato implementado. Manter separação Source.media/content.
8. Remover referências residuais a fornecedores antigos nas telas que você alterar.
   Não apagar projetos, histórico ou favoritos criados pelo usuário.

Escopo principal: frontend/ e desktop/ui/. Para mudanças de IPC, runtime ou backend,
documentar comportamento esperado e contrato; coordenar antes de substituir código
já integrado. A diretriz vigente do usuário prevalece sobre briefings antigos.

Validar: npm --prefix frontend test; npm --prefix desktop test;
npm --prefix frontend run build; npm --prefix desktop run test:ui.
Conferir 900x640, painel estreito, teclado, leitura dos avisos e retomada.
Entregar commit/PR e documento com mudanças, testes e dependências pendentes.
Não executar geração real como parte dos testes automáticos.

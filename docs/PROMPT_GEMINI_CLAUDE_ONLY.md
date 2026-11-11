# Prompt para Gemini — frontend exclusivo para Claude

Trabalhe no repositório https://github.com/Bbarusu/Ia-bbaru.
A base de integração é `codex/browser-capture-clis` (PR #7).
Leia primeiro docs/DIRECAO_CLAUDE_ONLY.md, docs/STATUS.md e docs/CONTRATO_CAPTURAS.md.
Preserve suas edições locais e integre esta base antes de continuar; não substitua
o runtime por uma versão antiga. Use sua branch de trabalho.

O usuário eliminou todos os provedores de IA do aplicativo, exceto Claude.
Sua participação como desenvolvedor do frontend continua; não adicione Gemini
como agente do produto. As integrações anteriores foram removidas.

Objetivo: manter o visual Yuki/Kinfo escolhido pelo usuário e apresentar um navegador
com assistência Claude e seleção clara de modelos, em vez de seleção de fornecedores.

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

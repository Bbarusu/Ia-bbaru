# Revisão da entrega do Gemini — PR #3

**Atualização de 9/11/2026:** os dois achados desta revisão histórica foram
corrigidos em `9814424`. A [revisão atual](REVISAO_INTEGRADA_2026_11_09.md) registra
as verificações e as pendências de capacidades e preservação de capturas/edições.
Veja o [prompt preparado para o Gemini](PROMPT_GEMINI_PENDENCIAS.md).

PR: https://github.com/Bbarusu/Ia-bbaru/pull/3

Commit revisado: `a0f852453dde65e34136227e79e2098c9abaa1c1`.
Base comparada: `f9216515c7a6ac22a3c033a7958f10787ac18b43` (`codex/frontend-firefox`).
Foram inspecionados os dois commits, os 23 arquivos alterados/adicionados e as três
capturas entregues. Revisão em worktree separada, sem modificar a branch do Gemini.

**Parecer: a entrega melhora a interface e respeita o escopo, mas deve corrigir os
dois achados abaixo antes do merge.** Os testes existentes passam, porém não cobrem
a regressão de captura reproduzida nesta revisão.

## P1 — segunda captura mistura texto antigo com origem nova

Local: [SourceModal.tsx, inicialização do estado](https://github.com/Bbarusu/Ia-bbaru/blob/a0f852453dde65e34136227e79e2098c9abaa1c1/frontend/src/components/SourceModal.tsx#L34)
e [App.tsx, montagem da fonte](https://github.com/Bbarusu/Ia-bbaru/blob/a0f852453dde65e34136227e79e2098c9abaa1c1/frontend/src/App.tsx#L269).

`title` e `content` recebem `capture` somente na inicialização de `useState`.
Se outra seleção chega com o modal aberto, React mantém o componente e esses estados,
mas a URL é lida da nova prop. Ao salvar, o pai também usa a URL da nova captura.
O resultado é uma fonte persistida com conteúdo e origem que não correspondem.

Reprodução:

1. Abra um projeto e capture **Fonte A**, texto **Texto exclusivo A**, URL
   `https://example.org/a`.
2. Sem fechar/salvar o formulário, faça uma segunda captura: **Fonte B**, texto
   **Texto exclusivo B**, URL `https://example.org/b`.
3. O formulário passa a exibir a URL B, mantendo título/texto A. Clique em salvar.
4. O backend grava:

```text
Fonte A
Origem: https://example.org/b

Texto exclusivo A
```

Essa sequência foi reproduzida em Firefox com eventos de captura simulados,
backend e ponte Python reais. O registro foi consultado no SQLite pela API.
Na base anterior, a mesma sequência guarda título, texto e origem B corretamente:
é uma regressão da extração do formulário para componente.

Correção esperada: manter identidade, origem, título e conteúdo como um conjunto
coerente ao trocar de captura. Uma estratégia é reinicializar o formulário pela
identidade da captura, tratando explicitamente edições não salvas; outra é manter
a nova captura pendente até concluir/substituir a atual. Não atualizar só a URL.
Ao salvar e limpar o trecho pendente, usar a identidade da captura efetivamente
revisada. Cobrir também chegada de captura durante edição manual.

Teste de aceite: enviar duas capturas enquanto o modal permanece aberto, salvar e
consultar a fonte pelo backend; título/texto/URL devem pertencer à mesma captura.

## P2 — semântica incompleta na lista de projetos

Local: [NavigationRail.tsx](https://github.com/Bbarusu/Ia-bbaru/blob/a0f852453dde65e34136227e79e2098c9abaa1c1/frontend/src/components/NavigationRail.tsx#L85).

O contêiner ganhou `role="list"`, mas seus filhos são botões, sem `listitem`.
Isso cria uma estrutura ARIA inválida e prejudica a representação da lista nas
tecnologias assistivas. O axe-core detectou `aria-required-children` no elemento
`.project-list`; esse problema não aparece na versão base.

Correção esperada: usar uma lista semântica `ul`/`li` com os botões dentro dos itens,
ou remover o papel de lista se o componente continuar sendo apenas um agrupamento
de botões. Tratar também o estado vazio e a ação de carregar mais projetos.

Teste de aceite: verificar a árvore acessível/lista renderizada, incluindo projeto
selecionado e paginação. Conferir apenas a presença de `:focus-visible` no CSS não
valida essa estrutura.

## Validação executada

| Verificação | Resultado |
| --- | --- |
| Instalação com `npm ci` | Passou, sem mudança de dependências |
| `npm test` | 8 testes passaram |
| `npm run build` | TypeScript e Vite passaram; extensão empacotada |
| `python -m unittest discover -s tests -v` | 25 testes passaram |
| `python scripts/verify_ui.py` | Passou no Firefox/Gecko headless |
| Quatro páginas em 320, 360, 480, 768, 1024 e 1440 px | 24 combinações sem rolagem horizontal |
| Fechar modais de projeto/material com Esc e botão Fechar | Foco retornou ao acionador nos quatro casos |
| Segunda captura com modal aberto | Falhou; mistura persistida confirmada |
| axe-core, área de trabalho ampla, regras WCAG A/AA | Falha `aria-required-children`; sem falha de contraste nessa tela testada |
| Comparação com a base, mesmas reproduções | Confirma regressão de captura e de semântica ARIA; confirma melhoria de foco e contraste |

Os dois novos testes em `frontend/tests/components.test.mjs` verificam strings
no CSS. São verificações estáticas: não renderizam componentes nem comprovam fluxo,
acessibilidade ou contraste. A revisão utilizou verificações adicionais de navegador
para avaliar esses pontos.

Os testes de UI usam Firefox real, mas simulam APIs WebExtensions e eventos de
captura. Não representam um teste completo de instalação nativa no Windows.
Nenhuma conta de IA foi acessada nem houve geração real nesta revisão. Não foi
realizada uma auditoria manual completa com leitor de tela; o resultado do axe não
certifica acessibilidade de todos os estados do aplicativo.

Medições e reproduções: [evidências estruturadas](reviews/gemini-a0f8524.json).

## Aspectos conformes

- Base e destino corretos: `gemini/frontend-v2` sobre `codex/frontend-firefox`.
- Mudanças limitadas ao frontend e capturas; backend, host, protocolo, manifesto,
  background da extensão e integração do Claude foram preservados.
- Componentes separados para navegação, compositor, biblioteca, conexões e modais.
- Visual compatível com a referência KInfo: preto, cartões escuros, azul, bordas
  discretas e cantos arredondados. Os tokens são a referência definida no projeto,
  não uma extração certificada de tokens oficiais do aplicativo KInfo.
- Melhorias de contraste confirmadas na área de trabalho: a base acusava vários
  textos abaixo de 4,5:1; essas falhas não apareceram na tela do Gemini testada.
- O foco ao fechar pelo botão, que falhava na base, retorna ao acionador nesta versão.
- Bibliotecas, rascunhos, planos, indisponibilidade do gateway e demo identificada
  continuam funcionando nos fluxos existentes.
- Materiais e respostas continuam como texto escapado; o teste com `<script>` não
  executou conteúdo da fonte.
- Execução pelo painel permanece desativada, conforme a capacidade atual da ponte.

## Próxima entrega solicitada ao Gemini

Corrigir os dois achados na própria branch e acrescentar testes de comportamento
que falhem na versão atual e passem com a correção. Preservar as melhorias visuais
e de foco já entregues. Reexecutar build, testes e fluxo de captura, indicando o
novo commit para revisão. Não é necessário refazer a interface.

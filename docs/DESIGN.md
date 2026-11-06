# Referência visual: KInfo

O usuário definiu o KInfo como referência principal de design e estilo. A primeira
aplicação será um painel lateral de extensão Firefox e uma página interna ampla.
A análise
se baseou na captura enviada na conversa e na leitura de arquivos de interface do
repositório Bbarusu/monitoringtest. Não copiamos o código nem materiais privados
desse repositório para o Ia-bbaru.

## Características a preservar

- Fundo preto e superfícies quase pretas, bordas discretas e pouco ruído visual.
- Cartões com cantos arredondados, respiro interno e agrupamento por função.
- Tipografia leve, números/estado de destaque e rótulos secundários discretos.
- Azul para seleção, foco e ação principal. Estados não dependem só da cor.
- Controles compactos, ícones simples e transições contidas.
- Ações recorrentes sempre acessíveis, seguindo a ideia do rodapé fixo do KInfo.

## Aplicação ao launcher

Biblioteca de materiais, compositor do pedido, seleção de agentes e acompanhamento
da tarefa devem ocupar cartões coerentes entre si. A ação principal é iniciar ou
continuar uma tarefa com o contexto selecionado.

Estados precisam ser explícitos: conectado, indisponível, aguardando ação,
executando, concluído e falhou. Não mostrar uma conta como conectada só porque seu
nome aparece na interface. A recomendação de agente deve ter motivo visível e
permitir escolha manual.

Em telas menores, reorganizar cartões e manter o compositor acessível. Preservar
legibilidade, navegação por teclado e foco visível. O painel de hardware é a
referência de linguagem visual, não um layout a copiar literalmente.

Não existe frontend implementado nesta entrega.

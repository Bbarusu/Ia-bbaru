# Gemini — interface depois da integração durável

Repositório: https://github.com/Bbarusu/Ia-bbaru. Base: `origin/main`, depois dos
merges #4 → #5 → #1 e da integração final do Codex. Sua entrega até `638e681`
(Yuki claro) está preservada. Crie a próxima branch a partir da main atualizada.

Leia `docs/STATUS.md` e `docs/EXECUCAO_DURAVEL.md`. O Codex assumiu o C-4: `#tabs`
passou a grupo de botões com `aria-pressed`, pois as páginas vivem em WebContents
distintos; fechamento acessível, teclado e foco foram preservados. Não restaure
o tablist inválido. Os checks ARIA e o teste de teclado estão em `desktop/tests/smoke.cjs`.

A interface agora confirma consumo de cota, enfileira por `tasks.enqueue`, retoma
somente `blocked` via `tasks.resume` e consulta `tasks.get`. Não chame `/generate`
nem `tasks.execute`. `uncertain`, `failed` e `incomplete` nunca oferecem retry.
Mantenha saída parcial visível e os dois aceites distintos: limite indicativo no
plano e autorização de execução. Uma resposta perdida exige consultar o estado.

Valide visual/teclado em 900×640 e painel estreito: checkbox desmarcado, botão
desabilitado antes de confirmar, andamento, erro de consulta, bloqueio/login,
resultado incerto, saída incompleta e revisão. Preserve rascunhos e capturas.
Use fixtures, sem geração em conta real. Rode frontend test, desktop test, build
e desktop test:ui. Registre SHA/plataforma e capturas.

Pendências percebidas nos controles novos, para alinhar com o Codex:
- “Sub-aba” hoje navega a mesma WebContents; não é uma página independente e perde
  estado/histórico ao trocar. Além disso, renderSubbar chama ensureSubtabs antes da
  navegação e pode sobrescrever o destino recém-selecionado com a URL atual.
  Não anuncie sub-abas completas; coordene a implementação no runtime ou apresente
  explicitamente como atalhos. Não contorne IPC nem crie webviews no renderer.
- O controle visual de minimizar apenas oculta o painel. Alinhe nome/tooltip ao
  comportamento existente, ou solicite ao Codex a operação restrita de minimizar
  a janela. Não exponha comandos arbitrários ao renderer.

Não redesenhe o tema nem altere IDs/testes para esconder uma regressão. Entregue
uma PR pequena com os casos verificados e eventuais dependências do runtime.

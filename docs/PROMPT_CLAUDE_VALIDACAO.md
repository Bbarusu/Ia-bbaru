# Prompt para o Claude — validar a integração atual no Windows

Copie o texto abaixo para a sessão local do Claude.

---

Continue a integração do Ia-bbaru em https://github.com/Bbarusu/Ia-bbaru,
branch `claude/vibrant-meitner-ksbzgf`, PR #1. O Codex revisou seu commit `452d2fd`
com o backend `d593e76` da branch `codex/frontend-firefox`.

As correções de deduplicação e término foram confirmadas; 50 testes do gateway
passaram com o backend atual, e o teste real permaneceu desativado. Componentes e
rotas OpenAPI 1.1 das duas frentes são iguais. O teste backend → HTTP → gateway →
CLI de teste passou para aceite, `unknown` sem revisão, término confirmado com
revisão e bloqueio de repetição. Não há correção nova de gateway exigida por esta
revisão. A pendência é verificar a combinação atual no Windows.

Leia na branch `codex/frontend-firefox`:

- `docs/REVISAO_INTEGRADA_2026_11_09.md`;
- `docs/TESTAR_GATEWAY_1_1.md`;
- `docs/DECISAO_CAPACIDADES.md`.

O backend já implementa schemas 1.1, `GATEWAY_PROTOCOL_VERSION`, aceite persistido
e encaminhado e `unknown` → `incomplete/completion_unconfirmed`, sem revisão.
As três escolhas foram confirmadas: aceite padrão false, motivo de indisponibilidade
como texto de até 80 caracteres e requisição com 1..4096 tokens. Não estão mais
pendentes de implementação pelo Codex.

Prepare checkouts separados ou uma worktree local de integração com as duas
versões atuais, preservando o trabalho em andamento. Registre os SHAs usados.
Não sobrescreva branches de outras frentes e não faça merge das PRs na main.

Nesta rodada de preparação, execute no Windows os testes sem conta real:

1. Backend atual: `.venv\Scripts\python.exe -m unittest discover -s tests -v`
   (48 testes na versão `d593e76`; conferir especialmente fechamento de SQLite).
2. Gateway: suíte `tests/integrations` usando o backend atual, com
   `IA_BBARU_REAL_TEST` desativado. São 50 testes aprováveis e um teste real pulado.
3. Na pasta do backend:
   `.venv\Scripts\python.exe scripts/verify_gateway_v11.py --gateway-checkout <pasta-do-gateway>`.
   Esse script usa somente o CLI de teste e bancos temporários.
4. Diagnóstico `python -m integrations diagnose`, sem gerar resposta.

Se houver falha, registre erro e reprodução. Corrija apenas o que pertencer a
`integrations/`/`tests/integrations/`; encaminhe problemas de backend ao Codex.

Prepare os comandos locais para a etapa seguinte: gateway na porta 8010, backend
na 8000 com `GATEWAY_PROTOCOL_VERSION=1.1`, uma tarefa `single`, fonte sintética
com acentos, modelo realmente disponível e aceite booleano true. Configure o
perfil do gateway para solicitar uma saída curta (por exemplo 64 ou 128 tokens);
o limite continua indicativo. Não existe `max_output_tokens` na entrada da tarefa.
Planeje verificar persistência do aceite/capacidades, resultado e repetição de
`execute` retornando 409. `unknown` é incompleto, nunca sucesso ou motivo para
repetir automaticamente. A geração real fica para a etapa de testes práticos
com o usuário, após esta preparação; não execute uma geração apenas para atualizar
a documentação desta revisão.

Atualize `integrations/docs/RESPOSTA_REVISAO.md` e o registro de validação com o
estado atual. Separe testes com fixture, diagnóstico e resultados reais anteriores.
Não publique tokens, bancos pessoais ou material da faculdade. Os schemas 1.1
duplicados já são equivalentes; consolidar os imports depois de integrar a base é
uma melhoria de manutenção, sem mudar o formato do contrato, e não bloqueia o teste.

Entregue comandos, resultados e SHA da sua branch. O frontend ainda será ajustado
pelo Gemini; não use a ausência do aceite na UI como motivo para remover a proteção
no gateway ou habilitar execução pela ponte.

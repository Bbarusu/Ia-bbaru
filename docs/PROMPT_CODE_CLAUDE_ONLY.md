# Prompt para Code (Claude Code) — integração exclusiva com Claude

Repositório https://github.com/Bbarusu/Ia-bbaru.
Base: `codex/browser-capture-clis` (PR #7). Preserve suas mudanças locais antes
de incorporar a base. Leia docs/AJUSTES_CHAT_LATERAL.md,
docs/DIRECAO_CLAUDE_ONLY.md e docs/STATUS.md.
Esta decisão substitui o trabalho anterior de integração de outras CLIs.

O usuário quer somente Claude no aplicativo, selecionando o modelo mais adequado
entre os que sua conta autoriza. Seus adaptadores antigos foram removidos da base;
não reintroduzi-los. Claude Code continua sendo a única conexão de execução.

## Prioridade nova — falha real e chat lateral (11/11/2026)

O usuário trouxe captura de pedido “Revise” que falhou com provider_error usando
sonnet, um material e uma tentativa. O limite exibido é 128; não há evidência
de que ele seja a causa. Os testes Windows passaram, mas a geração desta captura
falhou. Investigue classificação de erros e parsing da CLI antes de ampliar escopo.
Se faltar evidência, registre exatamente os metadados sanitizados necessários;
não peça/publice credenciais, materiais pessoais ou stderr bruto.

Entregue reprodução por fixture do formato observado, correção e teste de
regressão quando a causa for conhecida. Preserve request ID, ausência de repetição
após despacho incerto e códigos sanitizados até o backend. Não mascarar saída
inválida como sucesso. Validação de conta real é conduzida pelo usuário.

O novo frontend será um chat lateral com contexto e continuidade. Coordene com
Codex o conteúdo histórico recebido pelo gateway, limites de entrada e fontes;
não crie uma sessão CLI paralela que duplique a persistência do backend. Contrato
1.1 continua textual e sem streaming; alterações exigem proposta conjunta.
Gemini cuida da apresentação dos erros e Codex da conversa/ponte/fila. Sua entrega
deve identificar dependências, sem implementar endpoints presumidos ou automação
de páginas com ferramentas habilitadas.

## Base existente e próximos ajustes

Já implementado:
- Gateway/diagnóstico/inicializador apenas Claude Code; -Models aceita lista
  separada por vírgula, com -Model como alias e padrão sonnet.
- Perfis por modelo em IA_BBARU_CLAUDE_CODE_MODEL_TASK_KINDS.
- Roteamento determinístico por categoria, contexto e preferência, com revisão
  possível por outro modelo Claude. Não se trata de ranking universal.
- Contratos 1/1.1 e tools=disabled preservados. Nenhum aceite para ferramentas
  restritas permanece na implementação.

Trabalho solicitado em integrations/ e tests/integrations/:
1. Validar resolução dos aliases sonnet, haiku, opus e fable na versão oficial
   instalada e os meios de verificar acesso sem geração e sem ler credenciais.
   Se não houver prova por modelo, continuar distinguindo configuração de acesso
   confirmado; não inventar um endpoint ou interpretar login global como direito.
2. Conferir Fable e créditos. O seletor Windows 2.1.307 mostra Fable 5.2;
   a referência anterior ao requisito 2.1.321+ não invalida essa observação.
   Distinguir modelo listado de execução confirmada e possível cobrança adicional.
   Não exigir atualização apenas pelo número, atualizar CLI, habilitar modelos
   extras ou comprar créditos silenciosamente. Documentar condição para teste real.
3. Validar os perfis de tarefa e sugerir melhorias usando critérios explícitos:
   complexidade, contexto, latência e preferência/cota do usuário. Medições ainda
   não existem; não apresentar heurísticas como benchmarks.
4. Verificar troca automática de modelo pela CLI, inclusive Fable. Se a CLI der
   evidência do modelo efetivo, propor como compará-la com o modelo autorizado
   e expô-la no resultado, sem aceitar fallback não autorizado silenciosamente.
   Distinguir alias solicitado de versão resolvida. Não inventar evidência ausente.
5. Preservar login por assinatura, remoção de chaves de API/cloud, ausência de
   ferramentas/MCP, erros sanitizados, deduplicação e unknown sem revisão.
6. Atualizar a proposta de entrada visual 1.2 para somente Claude Code. Confirmar
   stream-json + blocos de imagem + tools desativadas com pacote oficial e fixtures.
   Não implementar visão enviando base64 dentro do texto e não alterar contratos
   unilateralmente.
7. Registrar a validação Windows do inicializador e dos perfis, sem repetir a
   geração em caso de timeout/resultado incerto. Conta real só em teste explícito
   conduzido pelo usuário.

Comandos: python -m unittest discover -s tests -v;
python -m unittest discover -s tests/integrations -v;
python scripts/verify_gateway_v11.py --gateway-checkout .
O teste novo test_claude_profiles.py cobre catálogo, perfis, escolha e revisão.
Entregue PR com SHAs e evidências, distinguindo fixtures, CLI sem geração e conta
real. Grave pendências para backend/frontend em documento de passagem.

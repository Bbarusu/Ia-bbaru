# Estado do Ia-bbaru

Atualizado em 6 de novembro de 2026.

## Implementado

- Backend local Python/FastAPI com SQLite.
- Autenticação por token único para uso pessoal local.
- Projetos, fontes de texto, tarefas e histórico.
- Plano com modelo principal e revisão opcional por segundo modelo.
- Seleção por categorias configuradas e preferência, com explicação.
- Cópia do contexto selecionado por tarefa e validação de vínculo com o projeto.
- Proteção contra execução concorrente/repetida da mesma tarefa.
- Registro de respostas parciais, truncamentos e interrupção após reinício.
- Contrato HTTP de gateway para API e schemas OpenAPI exportados.
- 14 testes automatizados locais; sem inferência real ou credenciais de provedores.

## Não implementado

Frontend, autenticação das contas de IA, adaptadores reais, OAuth, importação de
notebooks/projetos, execução por CLI, fila durável, multiusuário e deploy público.
Não há conta conectada nem uso de assinatura validado.

## Decisão atual

Priorizar contas e assinaturas existentes. Ver docs/ASSINATURAS.md. O gateway v1
é base para APIs com chave; precisa evoluir por capacidades antes de conectar
transportes com outras garantias, especialmente de limite de saída.

## Colaboração

- Codex: backend principal e coordenação das tarefas.
- Claude: investigar e implementar integrações dos agentes, seguindo o contrato
  acordado e comunicando mudanças de capacidades.
- Design: seguir docs/DESIGN.md, com o KInfo como referência.
- Repositório pretendido pelo usuário: Bbarusu/Ia-bbaru. A criação pelo conector
  foi recusada por falta de permissão; validar existência e acesso antes do push.

Não incluir no GitHub bancos locais, segredos, sessões de contas ou documentos
pessoais. Guardar código, contratos, testes e decisões de projeto.

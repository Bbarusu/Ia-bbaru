// Only reached with explicit ?demo=1. Never a fallback for connection failure.
const id = () => crypto.randomUUID();
const projectId = "11111111-1111-4111-8111-111111111111";
let projects = [
  { id: projectId, title: "Faculdade", created_at: new Date().toISOString() },
];
let sources = [
  {
    id: id(),
    project_id: projectId,
    title: "Fundamentos de inteligência artificial",
    content:
      "Material de exemplo: agentes observam um ambiente e escolhem ações para alcançar um objetivo.",
  },
  {
    id: id(),
    project_id: projectId,
    title: "Anotações para a próxima aula",
    content:
      "Exemplo de contexto: comparar busca em largura e busca em profundidade, com aplicações práticas.",
  },
];
let tasks: any[] = [];
export function demoRequest(op: string, params: any): unknown {
  if (op === "bridge.info")
    return { task_execution: false, version: "demonstração" };
  if (op === "health.get") return { status: "ok" };
  if (op === "projects.list") return { items: projects, next_offset: null };
  if (op === "projects.create") {
    const p = {
      id: id(),
      title: params.title,
      created_at: new Date().toISOString(),
    };
    projects.push(p);
    return p;
  }
  if (op === "sources.list")
    return {
      items: sources
        .filter((s) => s.project_id === params.project_id)
        .map((s) => ({
          ...s,
          preview: s.content.slice(0, 160),
          char_count: s.content.length,
        })),
      next_offset: null,
    };
  if (op === "sources.get")
    return sources.find((s) => s.id === params.source_id);
  if (op === "sources.create") {
    const s = { id: id(), ...params };
    sources.push(s);
    return s;
  }
  if (op === "models.list")
    return {
      models: [
        {
          id: "demo:example",
          provider: "demo",
          label: "Agente de exemplo",
          available: true,
          task_kinds: ["study"],
        },
      ],
    };
  if (op === "tasks.list")
    return {
      items: tasks.filter((t) => t.project_id === params.project_id),
      next_offset: null,
    };
  if (op === "tasks.get") return tasks.find((t) => t.id === params.task_id);
  if (op === "tasks.plan") {
    const t = {
      id: id(),
      project_id: params.project_id,
      ...params.task,
      status: "planned",
      created_at: new Date().toISOString(),
      plan: [{ role: "answer", model_id: "demo:example" }],
      routing: { reason: "Plano ilustrativo. Nenhuma IA foi chamada." },
      results: [],
    };
    tasks.unshift(t);
    return t;
  }
  throw new Error("Operação não disponível na demonstração.");
}

export type Project = { id: string; title: string; created_at: string };

export type Source = {
  id: string;
  title: string;
  preview?: string;
  content?: string;
  char_count?: number;
};

export type ModelCapabilities = {
  output_limit: "enforced" | "best_effort" | "none";
  cancellation: "provider" | "local_process_only" | "none";
  finish_reason: "reported" | "inferred";
  billing: "api_key" | "subscription_quota" | "unknown";
  tools: "disabled" | "restricted";
  streaming: boolean;
};

export type Model = {
  id: string;
  provider: string;
  label: string;
  available: boolean;
  task_kinds: string[];
  context_char_limit?: number;
  max_output_tokens?: number;
  unavailable_reason?: string | null;
  capabilities?: ModelCapabilities;
};

export type PlanStep = {
  role: string;
  model_id: string;
  provider?: string;
  context_char_limit?: number;
  max_output_tokens?: number;
  capabilities?: ModelCapabilities;
};

export type TaskResult = {
  model_id: string;
  output: string;
  role: string;
  finish_reason?: "stop" | "length" | "unknown";
};

export type Task = {
  id: string;
  instruction: string;
  status: string;
  created_at: string;
  kind?: string;
  gateway_protocol_version?: string;
  allow_unenforced_output_limit?: boolean;
  output?: string | null;
  error?: string | null;
  routing?: { method?: string; reason: string };
  context?: { id: string; title: string; content: string }[];
  plan: PlanStep[];
  results?: TaskResult[];
  execution?: { mode: "durable"; steps: {
    request_id: string; state: string; attempts: number;
    error_code?: string | null; finish_reason?: string;
  }[] };
};

export type Capture = { id: string; title: string; url: string; text: string };
export type Page<T> = { items: T[]; next_offset: number | null };
export type Tab = "workspace" | "library" | "history" | "connections";

declare global {
  interface Window {
    browser?: any;
    iaDesktop?: any;
  }
}

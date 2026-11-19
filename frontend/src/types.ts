export type Project = { id: string; title: string; created_at: string };

export type Source = {
  id: string;
  title: string;
  preview?: string;
  content?: string;
  char_count?: number;
  media?: Media;
};

export type Media = { kind: "image" | "screenshot"; data_url?: string; width?: number; height?: number; byte_count?: number };
export type Connection = { provider: string; version: string | null; installed: boolean; ready: boolean; configured: boolean; reason: string | null };

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
  input?: { image?: { supported: boolean; max_images?: number; max_bytes_per_image?: number } };
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
  served_model?: string | null;
};

export type DirectImage = { attachment_id: string; title: string; media: { kind: "image"; data_url: string } };

export type Task = {
  attachment_refs?: {id: string; sha256: string}[];
  id: string;
  instruction: string;
  status: string;
  created_at: string;
  kind?: string;
  mode?: "single" | "review";
  response_profile?: "quick" | "normal" | "deep" | null;
  conversation_id?: string;
  turn_id?: string;
  gateway_protocol_version?: string;
  allow_unenforced_output_limit?: boolean;
  output?: string | null;
  error?: string | null;
  routing?: { method?: string; reason: string };
  context?: { id: string; title: string; content?: string; preview?: string; char_count?: number }[];
  plan: PlanStep[];
  results?: TaskResult[];
  execution?: { mode: "durable"; steps: {
    request_id: string; state: string; attempts: number;
    error_code?: string | null; finish_reason?: string;
    duration_ms?: number; request_fingerprint?: string;
  }[] };
};

export type Capture = {
  id: string; title: string; url: string; text: string; media?: Media;
  kind?: string; document_id?: string | null; captured_at?: string;
  tab_id?: string | null; documentVersion?: number | null;
};
export type PageStatus = { has_video?: boolean; has_captions?: boolean; document_id: string | null; url: string | null; title: string; capture_is_current: boolean };

export type Conversation = { id: string; project_id: string; title: string; created_at: string; updated_at: string; revision: number };
export type Consent = {
  id: string; granted_at: string; allowed_model_ids: string[]; max_output_tokens: number;
  allow_unenforced_output_limit: boolean; allow_visual_input: boolean; gateway_protocol_version?: string;
};
export type Snapshot = { capture_id: string; kind: string; title: string; url?: string | null; document_id?: string | null; captured_at?: string | null };
export type Turn = { id: string; conversation_id: string; sequence: number; task_id: string; created_at: string; task: Task; snapshots?: Snapshot[] };
/** Corpo de conversations.turns.send, persistido inteiro antes do envio. */
export type TurnBody = Record<string, unknown> & { turn_id: string; instruction: string };
export type PendingSend = {
  conversation: { conversation_id: string; project_id: string; title: string };
  turn: TurnBody;
  captureId?: string;
  titles: string[];
};
export type Page<T> = { items: T[]; next_offset: number | null };
export type Tab =
  | "workspace"
  | "library"
  | "history"
  | "connections"
  | "web-history"
  | "downloads"
  | "settings";

declare global {
  interface Window {
    iaDesktop?: any;
  }
}

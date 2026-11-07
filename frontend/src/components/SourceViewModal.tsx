import { Dialog } from "./Dialog";
import type { Source } from "../types";

interface SourceViewModalProps {
  source: Source;
  close: () => void;
}

export function SourceViewModal({ source, close }: SourceViewModalProps) {
  return (
    <Dialog title={source.title} close={close}>
      <div className="source-view-content">
        <pre className="result-text">{source.content}</pre>
      </div>
    </Dialog>
  );
}

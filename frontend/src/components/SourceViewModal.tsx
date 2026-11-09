import { Dialog } from "./Dialog";
import type { Source } from "../types";

interface SourceViewModalProps {
  source: Source;
  close: () => void;
}

function extractVisualAttachment(content?: string): string | null {
  if (!content) return null;
  const match = content.match(
    /AnexoVisual:\s*(data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/\S+)/,
  );
  return match ? match[1] : null;
}

export function SourceViewModal({ source, close }: SourceViewModalProps) {
  const visualSrc = extractVisualAttachment(source.content);

  return (
    <Dialog title={source.title} close={close}>
      <div className="source-view-content">
        {visualSrc && (
          <div className="media-preview-frame">
            <img src={visualSrc} alt={source.title} />
          </div>
        )}
        <pre className="result-text">{source.content}</pre>
      </div>
    </Dialog>
  );
}

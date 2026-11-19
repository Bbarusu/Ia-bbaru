import { Dialog } from "./Dialog";
import type { Source } from "../types";

interface SourceViewModalProps {
  source: Source;
  close: () => void;
}

export function SourceViewModal({ source, close }: SourceViewModalProps) {
  const visualSrc = source.media?.data_url;

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

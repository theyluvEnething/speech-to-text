import React from "react";
import { X } from "lucide-react";

function TitleBar(): React.ReactElement {
  const isMac = window.wavely.platform === "darwin";

  return (
    <div
      className="drag-region flex items-center h-8 shrink-0 select-none"
      style={{ paddingLeft: isMac ? 80 : 0 }}
    >
      {!isMac && (
        <div className="no-drag ml-auto flex items-center h-full">
          <button
            onClick={() => window.wavely.closeWindow()}
            className="flex items-center justify-center w-10 h-full
              text-muted-foreground hover:text-red-400 hover:bg-red-500/10
              transition-colors"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default TitleBar;

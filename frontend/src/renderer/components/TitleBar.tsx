import React from "react";
import { useTranslation } from "react-i18next";
import { Minus, X } from "lucide-react";

function TitleBar(): React.ReactElement {
  const { t } = useTranslation();
  const isMac = window.wavely.platform === "darwin";

  return (
    <div
      className="drag-region flex items-center h-8 shrink-0 select-none"
      style={{ paddingLeft: isMac ? 80 : 0 }}
    >
      {!isMac && (
        <div className="no-drag ml-auto flex items-center h-full">
          <button
            onClick={() => window.wavely.minimizeWindow()}
            className="flex items-center justify-center w-10 h-full
              text-ink-4 hover:text-ink hover:bg-hover
              transition-colors duration-150"
            aria-label={t("titlebar.minimize")}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => window.wavely.hideWindow()}
            className="flex items-center justify-center w-10 h-full
              text-ink-4 hover:text-ink hover:bg-hover
              transition-colors duration-150"
            aria-label={t("titlebar.close")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default TitleBar;

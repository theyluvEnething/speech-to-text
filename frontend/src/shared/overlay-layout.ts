export type OverlayStatus = "idle" | "recording" | "transcribing" | "inserting";

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const OVERLAY_WINDOW_WIDTH = 460;
export const OVERLAY_WINDOW_HEIGHT = 260;
export const PILL_BOTTOM_MARGIN = 8;

const EXPANDED_PROXIMITY = { width: 400, height: 52 } as const;
const COLLAPSED_PROXIMITY = { width: 80, height: 20 } as const;

export function shouldDisableOverlayProximity({
  hidePill,
  status,
  isOverNotification,
  menuOverrideActive,
}: {
  hidePill: boolean;
  status: OverlayStatus;
  isOverNotification: boolean;
  menuOverrideActive: boolean;
}): boolean {
  return (
    hidePill &&
    status === "idle" &&
    !isOverNotification &&
    !menuOverrideActive
  );
}

export function getOverlayProximityDimensions(
  expanded: boolean,
): { width: number; height: number } {
  return expanded ? { ...EXPANDED_PROXIMITY } : { ...COLLAPSED_PROXIMITY };
}

export function calculateOverlayBounds(workArea: Rectangle): Rectangle {
  return {
    x: Math.round(workArea.x + (workArea.width - OVERLAY_WINDOW_WIDTH) / 2),
    y: Math.round(workArea.y + workArea.height - OVERLAY_WINDOW_HEIGHT),
    width: OVERLAY_WINDOW_WIDTH,
    height: OVERLAY_WINDOW_HEIGHT,
  };
}

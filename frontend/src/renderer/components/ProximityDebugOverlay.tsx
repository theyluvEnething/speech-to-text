import { useState, useEffect, useCallback } from "react";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  barRef: React.RefObject<HTMLDivElement | null>;
  profileButtonRef: React.RefObject<HTMLButtonElement | null>;
  popoverContentRef: React.RefObject<HTMLDivElement | null>;
  isProfileMenuOpen: boolean;
}

export function ProximityDebugOverlay({
  barRef,
  profileButtonRef,
  popoverContentRef,
  isProfileMenuOpen,
}: Props) {
  const [rects, setRects] = useState<{
    pill: Rect | null;
    button: Rect | null;
    popover: Rect | null;
    safeZone: Rect | null;
  }>({
    pill: null,
    button: null,
    popover: null,
    safeZone: null,
  });

  const updateRects = useCallback(() => {
    const pillEl = barRef.current;
    let pillRect: Rect | null = null;
    if (pillEl) {
      const br = pillEl.getBoundingClientRect();
      const centerX = br.left + br.width / 2;
      const centerY = br.top + br.height / 2;
      pillRect = {
        x: centerX - 140,
        y: centerY - 40,
        width: 280,
        height: 80,
      };
    }

    const btnEl = profileButtonRef.current;
    const popEl = popoverContentRef.current;

    const btnRect = btnEl?.getBoundingClientRect() ?? null;
    const popRect = popEl?.getBoundingClientRect() ?? null;

    let safeZone: Rect | null = null;
    if (isProfileMenuOpen && btnEl && popEl) {
      const b = btnEl.getBoundingClientRect();
      const p = popEl.getBoundingClientRect();
      if (p.bottom <= b.top) {
        safeZone = {
          x: Math.min(b.left, p.left),
          y: p.top,
          width: Math.max(b.right, p.right) - Math.min(b.left, p.left),
          height: b.bottom - p.top,
        };
      }
    }

    setRects({
      pill: pillRect,
      button: btnRect ? { x: btnRect.x, y: btnRect.y, width: btnRect.width, height: btnRect.height } : null,
      popover: popRect ? { x: popRect.x, y: popRect.y, width: popRect.width, height: popRect.height } : null,
      safeZone,
    });
  }, [barRef, profileButtonRef, popoverContentRef, isProfileMenuOpen]);

  useEffect(() => {
    updateRects();
    window.addEventListener("resize", updateRects);
    window.addEventListener("scroll", updateRects, true);
    window.addEventListener("mousemove", updateRects);
    const interval = setInterval(updateRects, 100);

    return () => {
      window.removeEventListener("resize", updateRects);
      window.removeEventListener("scroll", updateRects, true);
      window.removeEventListener("mousemove", updateRects);
      clearInterval(interval);
    };
  }, [updateRects]);

  const rectStyle = (rect: Rect, borderColor: string, bgColor: string): React.CSSProperties => ({
    position: "fixed",
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    border: `2px solid ${borderColor}`,
    backgroundColor: bgColor,
    pointerEvents: "none",
    zIndex: 99999,
  });

  const labelStyle: React.CSSProperties = {
    position: "absolute",
    top: -18,
    left: 0,
    fontSize: 10,
    background: "#000",
    padding: "0 4px",
    whiteSpace: "nowrap",
  };

  return (
    <>
      {rects.pill && (
        <div style={rectStyle(rects.pill, "#3b82f6", "rgba(59, 130, 246, 0.15)")}>
          <span style={{ ...labelStyle, color: "#3b82f6" }}>Pill (280x80)</span>
        </div>
      )}
      {rects.button && (
        <div style={{ ...rectStyle(rects.button, "#10b981", "rgba(16, 185, 129, 0.1)") }}>
          <span style={{ ...labelStyle, color: "#10b981" }}>Profile button</span>
        </div>
      )}
      {rects.popover && (
        <div style={{ ...rectStyle(rects.popover, "#f59e0b", "rgba(245, 158, 11, 0.1)") }}>
          <span style={{ ...labelStyle, color: "#f59e0b" }}>Popover content</span>
        </div>
      )}
      {rects.safeZone && (
        <div style={{ ...rectStyle(rects.safeZone, "#ec4899", "rgba(236, 72, 153, 0.15)") }}>
          <span style={{ ...labelStyle, color: "#ec4899" }}>Safe zone (btn→popover)</span>
        </div>
      )}
    </>
  );
}

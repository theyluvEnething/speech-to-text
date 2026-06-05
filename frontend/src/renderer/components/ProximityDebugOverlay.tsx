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
  notificationRef: React.RefObject<HTMLDivElement | null>;
  rightButtonsRef: React.RefObject<HTMLDivElement | null>;
  isProfileMenuOpen: boolean;
  menuOverrideActive?: boolean;
  expanded?: boolean;
  cachedMenuZones?: React.MutableRefObject<{
    btn: Rect | null;
    pop: Rect | null;
    safe: Rect | null;
  }>;
}

export function ProximityDebugOverlay({
  barRef,
  profileButtonRef,
  popoverContentRef,
  notificationRef,
  rightButtonsRef,
  isProfileMenuOpen,
  menuOverrideActive,
  expanded = false,
  cachedMenuZones,
}: Props) {
  const [rects, setRects] = useState<{
    pill: Rect | null;
    button: Rect | null;
    popover: Rect | null;
    safeZone: Rect | null;
    notification: Rect | null;
    rightButtons: Rect | null;
  }>({
    pill: null,
    button: null,
    popover: null,
    safeZone: null,
    notification: null,
    rightButtons: null,
  });

  const pillW = expanded ? 260 : 90;
  const pillH = expanded ? 52 : 30;

  const updateRects = useCallback(() => {
    // 1. Always calculate the dynamic Pill Rect
    const pillEl = barRef.current;
    let pillRect: Rect | null = null;
    if (pillEl) {
      const br = pillEl.getBoundingClientRect();
      const centerX = br.left + br.width / 2;
      const centerY = br.top + br.height / 2;
      pillRect = {
        x: centerX - pillW / 2,
        y: centerY - pillH / 2,
        width: pillW,
        height: pillH,
      };
    }

    let btnRect: Rect | null = null;
    let popRect: Rect | null = null;
    let safeZone: Rect | null = null;

    // 2. Use Cached Zones if the menu is visually closed but override is active
    if (menuOverrideActive && !isProfileMenuOpen && cachedMenuZones?.current) {
      btnRect = cachedMenuZones.current.btn;
      popRect = cachedMenuZones.current.pop;
      safeZone = cachedMenuZones.current.safe;
    }
    // 3. Otherwise, use Live DOM elements
    else {
      const btnEl = profileButtonRef.current;
      const popEl = popoverContentRef.current;

      btnRect = btnEl ? { x: btnEl.getBoundingClientRect().x, y: btnEl.getBoundingClientRect().y, width: btnEl.getBoundingClientRect().width, height: btnEl.getBoundingClientRect().height } : null;
      popRect = popEl ? { x: popEl.getBoundingClientRect().x, y: popEl.getBoundingClientRect().y, width: popEl.getBoundingClientRect().width, height: popEl.getBoundingClientRect().height } : null;

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
    }

    // 4. Right buttons bounds (live DOM)
    const rightEl = rightButtonsRef.current;
    const rightRect: Rect | null = rightEl
      ? {
          x: rightEl.getBoundingClientRect().x,
          y: rightEl.getBoundingClientRect().y,
          width: rightEl.getBoundingClientRect().width,
          height: rightEl.getBoundingClientRect().height,
        }
      : null;

    // 5. Notification card bounds (live DOM)
    const notifEl = notificationRef.current;
    const notifRect: Rect | null = notifEl
      ? {
          x: notifEl.getBoundingClientRect().x,
          y: notifEl.getBoundingClientRect().y,
          width: notifEl.getBoundingClientRect().width,
          height: notifEl.getBoundingClientRect().height,
        }
      : null;

    setRects({
      pill: pillRect,
      button: btnRect,
      popover: popRect,
      safeZone,
      notification: notifRect,
      rightButtons: rightRect,
    });
  }, [barRef, profileButtonRef, popoverContentRef, notificationRef, rightButtonsRef, isProfileMenuOpen, menuOverrideActive, expanded, pillW, pillH, cachedMenuZones]);

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
          <span style={{ ...labelStyle, color: "#3b82f6" }}>Pill ({pillW}x{pillH})</span>
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
      {rects.notification && (
        <div style={{ ...rectStyle(rects.notification, "#8b5cf6", "rgba(139, 92, 246, 0.12)") }}>
          <span style={{ ...labelStyle, color: "#8b5cf6" }}>Notification</span>
        </div>
      )}
      {rects.rightButtons && (
        <div style={{ ...rectStyle(rects.rightButtons, "#06b6d4", "rgba(6, 182, 212, 0.12)") }}>
          <span style={{ ...labelStyle, color: "#06b6d4" }}>Right buttons</span>
        </div>
      )}
    </>
  );
}

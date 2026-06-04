import { useState, useEffect, useRef, type RefObject } from "react";

export function useProximity(
  ref: RefObject<HTMLElement>,
  width: number,
  height: number,
  override: boolean = false,
  disabled: boolean = false,
): boolean {
  const [isNear, setIsNear] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const rafIdRef = useRef<number | null>(null);

  // When disabled, force cleanup: reset state and ensure click-through is on
  useEffect(() => {
    if (disabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setIsNear(false);
      window.overlay.setClickThrough(true);
    }
  }, [disabled]);

  // Immediately apply override if the menu opens (unless disabled)
  useEffect(() => {
    if (override && !disabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      setIsNear(true);
      window.overlay.setClickThrough(false);
    }
  }, [override, disabled]);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    const halfW = width / 2;
    const halfH = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const near =
          Math.abs(e.clientX - centerX) <= halfW &&
          Math.abs(e.clientY - centerY) <= halfH;

        // If override is true, force it to stay active
        const active = near || override;

        if (active && timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = undefined;
        }

        if (active !== isNear) {
          if (!active) {
            timeoutRef.current = setTimeout(() => {
              setIsNear(false);
              window.overlay.setClickThrough(true);
              timeoutRef.current = undefined;
            }, 80);
          } else {
            setIsNear(true);
            window.overlay.setClickThrough(false);
          }
        }
      });
    };

    const handleMouseLeaveDocument = () => {
      if (override) return; // Don't collapse if the menu is open
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      setIsNear(false);
      window.overlay.setClickThrough(true);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeaveDocument);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeaveDocument);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [ref, width, height, isNear, override, disabled]);

  // When disabled, always report false so the pill stays collapsed
  return disabled ? false : isNear || override;
}

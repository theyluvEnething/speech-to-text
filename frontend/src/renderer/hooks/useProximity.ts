import { useState, useEffect, useRef, type RefObject } from "react";

export function useProximity(
  ref: RefObject<HTMLElement>,
  width: number,
  height: number,
): boolean {
  const [isNear, setIsNear] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

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

        // Always clear the leave timeout when cursor is inside the bounding box,
        // even if isNear hasn't transitioned to false in the closure yet.
        if (near && timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = undefined;
        }

        if (near !== isNear) {
          if (!near) {
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
  }, [ref, width, height, isNear]);

  return isNear;
}

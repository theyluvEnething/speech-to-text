import { useState, useEffect, useRef, RefObject } from "react";

export function useProximity(ref: RefObject<HTMLElement>, radius: number): boolean {
  const [isNear, setIsNear] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let rafId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
        const near = distance <= radius;

        setIsNear(near);
        window.overlay.setClickThrough(!near);
      });
    };

    const handleMouseLeaveDocument = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setIsNear(false);
        window.overlay.setClickThrough(true);
      }, 100);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeaveDocument);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeaveDocument);
      if (rafId) cancelAnimationFrame(rafId);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [ref, radius]);

  return isNear;
}

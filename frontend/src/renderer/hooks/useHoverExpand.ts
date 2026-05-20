import { useEffect, useState } from "react";
import type { RefObject } from "react";

export function useHoverExpand(
  ref: RefObject<HTMLElement>,
  radius: number = 90,
): boolean {
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const checkProximity = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const distance = Math.hypot(dx, dy);
      const near = distance <= radius;
      setIsNear(near);
      window.overlay.setClickThrough(!near);
    };

    window.addEventListener("mousemove", checkProximity);
    return () => window.removeEventListener("mousemove", checkProximity);
  }, [ref, radius]);

  return isNear;
}

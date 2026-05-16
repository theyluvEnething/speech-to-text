import React, { useEffect } from "react";
import type { ReactNode } from "react";

const ENTER_ALT = "\x1b[?1049h";
const LEAVE_ALT = "\x1b[?1049l";

export default function FullScreen({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    process.stdout.write(ENTER_ALT);
    return () => {
      process.stdout.write(LEAVE_ALT);
    };
  }, []);
  return <>{children}</>;
}

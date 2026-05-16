import React, { useState, useEffect } from "react";
import { Text } from "ink";
import type { ReactNode } from "react";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface SpinnerProps {
  type?: string;
}

export default function Spinner(_props: SpinnerProps): ReactNode {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return <Text color="yellow">{FRAMES[frame]}</Text>;
}

import React from "react";
import { Box, Text } from "ink";
import type { ReactNode } from "react";

export interface LogEntry {
  id: number;
  timestamp: string;
  tag: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  message: string;
}

const TAG_COLORS: Record<LogEntry["tag"], string> = {
  INFO: "blue",
  SUCCESS: "green",
  WARN: "yellow",
  ERROR: "red",
};

interface LogPanelProps {
  height: number;
  width: number;
  logs: LogEntry[];
}

export default function LogPanel({ height, width, logs }: LogPanelProps): ReactNode {
  const visible = logs.slice(-height);

  return (
    <Box flexDirection="column" height={height} width={width} paddingLeft={2}>
      {visible.map((entry) => (
        <Box key={entry.id} flexDirection="row">
          <Text dimColor>{entry.timestamp}</Text>
          <Text>  </Text>
          <Text color={TAG_COLORS[entry.tag]} bold>
            {entry.tag.padEnd(8)}
          </Text>
          <Text>{entry.message}</Text>
        </Box>
      ))}
    </Box>
  );
}

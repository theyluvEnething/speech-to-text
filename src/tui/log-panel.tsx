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
  const visibleLines = Math.max(height - 2, 1);
  const visible = logs.slice(-visibleLines);
  const padTop = visibleLines - visible.length;

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      height={height}
      width={width}
      paddingX={1}
    >
      <Box flexDirection="column">
        {padTop > 0 &&
          Array.from({ length: padTop }, (_, i) => (
            <Box key={`pad-${i}`}>
              <Text> </Text>
            </Box>
          ))}
        {visible.map((entry) => (
          <Box key={entry.id} flexDirection="row">
            <Text dimColor>{entry.timestamp}</Text>
            <Text> </Text>
            <Text color={TAG_COLORS[entry.tag]} bold>
              {entry.tag.padEnd(7)}
            </Text>
            <Text> </Text>
            <Text>{entry.message}</Text>
          </Box>
        ))}
        {visible.length === 0 && (
          <Text dimColor>  -- no log entries --</Text>
        )}
      </Box>
    </Box>
  );
}

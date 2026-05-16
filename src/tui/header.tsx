import React from "react";
import { Box, Text } from "ink";
import type { ReactNode } from "react";

interface BadgeProps {
  label: string;
  value: string;
  color: string;
}

function Badge({ label, value, color }: BadgeProps): ReactNode {
  return (
    <Text>
      <Text dimColor>{label}:</Text>
      <Text color={color}> {value}</Text>
    </Text>
  );
}

interface HeaderProps {
  width: number;
  model: string;
  language: string;
  hotkey: string;
  isRecording: boolean;
}

export default function Header({
  width,
  model,
  language,
  hotkey,
  isRecording,
}: HeaderProps): ReactNode {
  const innerWidth = Math.max(width - 4, 40);

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      width={width}
      paddingX={1}
    >
      <Box width={innerWidth} justifyContent="space-between">
        <Text>
          <Text bold color="white">
            {"🎙  Whispr Flow"}
          </Text>
        </Text>

        <Box gap={2}>
          <Badge label="Model" value={model} color="cyan" />
          <Text dimColor>|</Text>
          <Badge label="Lang" value={language} color="yellow" />
          <Text dimColor>|</Text>
          <Badge
            label="Hotkey"
            value={hotkey}
            color={isRecording ? "green" : "magenta"}
          />
        </Box>
      </Box>
    </Box>
  );
}

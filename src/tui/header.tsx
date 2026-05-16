import React from "react";
import { Box, Text } from "ink";
import type { ReactNode } from "react";

interface HeaderProps {
  width: number;
  model: string;
  language: string;
  hotkey: string;
  isRecording: boolean;
  elapsed: number;
}

export default function Header({
  width,
  model,
  language,
  hotkey,
  isRecording,
  elapsed,
}: HeaderProps): ReactNode {
  const cwd = process.cwd();

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text bold color="#c084fc">{"▐"}<Text color="#e9d5ff">{"▛"}</Text><Text color="white">{"██"}</Text><Text color="#e9d5ff">{"█"}</Text><Text color="#c084fc">{"▜"}</Text><Text color="#a78bfa">{"▌"}</Text></Text>
        <Text>   </Text>
        <Text bold color="white">Whispr Flow</Text>
        <Text> </Text>
        <Text dimColor>v2.0.0</Text>
      </Box>

      <Box>
        <Text bold color="#c084fc">{"▝"}<Text color="#e9d5ff">{"▜"}</Text><Text color="white">{"███"}</Text><Text color="#e9d5ff">{"██"}</Text><Text color="#c084fc">{"▛"}</Text><Text color="#a78bfa">{"▘"}</Text></Text>
        <Text>  </Text>
        <Text color="cyan">{model}</Text>
        <Text dimColor> · </Text>
        <Text color="yellow">{language}</Text>
        <Text dimColor> · </Text>
        <Text color="#c084fc">{hotkey}</Text>
        {isRecording && (
          <>
            <Text dimColor> · </Text>
            <Text color="red" bold>{"●"}</Text>
            <Text color="white"> {elapsed.toFixed(1)}s</Text>
          </>
        )}
      </Box>

      <Box>
        <Text dimColor>  </Text>
        <Text color="#7c3aed">▘</Text>
        <Text color="#a78bfa">▘</Text>
        <Text dimColor> </Text>
        <Text color="#7c3aed">▝</Text>
        <Text color="#a78bfa">▝</Text>
        <Text>    </Text>
        <Text dimColor>{cwd}</Text>
      </Box>
    </Box>
  );
}

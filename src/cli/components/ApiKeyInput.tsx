/**
 * API Key Input Panel - Interactive provider selection and key input.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { colors, emoji } from "../theme.js";

type Provider = "anthropic" | "openai";

interface ApiKeyInputPanelProps {
  /** Callback when API key is saved */
  onKeySaved?: (provider: Provider, key: string) => void;
  /** Callback to close the panel */
  onClose?: () => void;
}

type Step = "select-provider" | "enter-key" | "success";

export function ApiKeyInputPanel({
  onKeySaved,
  onClose,
}: ApiKeyInputPanelProps): React.ReactElement {
  const [step, setStep] = useState<Step>("select-provider");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Handle keyboard input
  useInput((input, key) => {
    if (step === "select-provider") {
      if (input === "1" || input.toLowerCase() === "a") {
        setSelectedProvider("anthropic");
        setStep("enter-key");
        setError(null);
      } else if (input === "2" || input.toLowerCase() === "o") {
        setSelectedProvider("openai");
        setStep("enter-key");
        setError(null);
      } else if (key.escape) {
        onClose?.();
      }
    } else if (step === "enter-key") {
      if (key.escape) {
        // Go back to provider selection
        setStep("select-provider");
        setApiKey("");
        setError(null);
      } else if (key.return) {
        // Validate and save
        if (!apiKey.trim()) {
          setError("API key cannot be empty");
          return;
        }

        // Basic validation
        if (selectedProvider === "anthropic" && !apiKey.startsWith("sk-ant-")) {
          setError("Anthropic API keys typically start with 'sk-ant-'");
          return;
        }
        if (selectedProvider === "openai" && !apiKey.startsWith("sk-")) {
          setError("OpenAI API keys typically start with 'sk-'");
          return;
        }

        // Save to environment
        if (selectedProvider === "anthropic") {
          process.env.ANTHROPIC_API_KEY = apiKey.trim();
        } else if (selectedProvider === "openai") {
          process.env.OPENAI_API_KEY = apiKey.trim();
        }

        setStep("success");
        onKeySaved?.(selectedProvider!, apiKey.trim());

        // Auto-close after success
        setTimeout(() => {
          onClose?.();
        }, 1500);
      } else if (key.backspace || key.delete) {
        setApiKey((prev) => prev.slice(0, -1));
        setError(null);
      } else if (input && !key.ctrl && !key.meta) {
        setApiKey((prev) => prev + input);
        setError(null);
      }
    } else if (step === "success") {
      if (key.return || key.escape) {
        onClose?.();
      }
    }
  });

  const maskKey = (key: string): string => {
    if (key.length <= 8) return "•".repeat(key.length);
    return key.substring(0, 7) + "•".repeat(Math.min(key.length - 11, 20)) + key.substring(key.length - 4);
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.primary}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text bold color={colors.info}>
        {emoji.key} API Key Setup
      </Text>
      <Box height={1} />

      {step === "select-provider" && (
        <>
          <Text>Select a provider:</Text>
          <Box height={1} />
          <Box marginLeft={2}>
            <Text color={colors.primary}>[1]</Text>
            <Text> Anthropic (Claude)</Text>
          </Box>
          <Box marginLeft={2}>
            <Text color={colors.primary}>[2]</Text>
            <Text> OpenAI (GPT)</Text>
          </Box>
          <Box height={1} />
          <Text dimColor>Press 1 or 2 to select, Esc to cancel</Text>
        </>
      )}

      {step === "enter-key" && selectedProvider && (
        <>
          <Text>
            Enter your{" "}
            <Text color={colors.primary}>
              {selectedProvider === "anthropic" ? "Anthropic" : "OpenAI"}
            </Text>{" "}
            API key:
          </Text>
          <Box height={1} />
          <Box>
            <Text dimColor>{">"} </Text>
            <Text>{apiKey ? maskKey(apiKey) : <Text dimColor>Paste your API key here...</Text>}</Text>
            <Text color={colors.primary}>█</Text>
          </Box>
          {error && (
            <>
              <Box height={1} />
              <Text color={colors.error}>{emoji.warning} {error}</Text>
            </>
          )}
          <Box height={1} />
          <Text dimColor>Press Enter to save, Esc to go back</Text>
        </>
      )}

      {step === "success" && selectedProvider && (
        <>
          <Text color={colors.success}>
            {emoji.completed} API key saved for{" "}
            {selectedProvider === "anthropic" ? "Anthropic" : "OpenAI"}!
          </Text>
          <Box height={1} />
          <Text dimColor>Press Enter or Esc to continue</Text>
        </>
      )}
    </Box>
  );
}

/**
 * Simple API Key Status display (read-only).
 */
export function ApiKeyStatus(): React.ReactElement {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const maskKey = (key: string | undefined) => {
    if (!key) return null;
    return key.substring(0, 10) + "..." + key.substring(key.length - 4);
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.muted}
      paddingX={2}
      paddingY={1}
      marginY={1}
    >
      <Text bold color={colors.info}>
        {emoji.key} API Keys
      </Text>
      <Box height={1} />
      <Box>
        {anthropicKey ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>Anthropic: </Text>
            <Text dimColor>{maskKey(anthropicKey)}</Text>
          </>
        ) : (
          <>
            <Text color={colors.warning}>✗ </Text>
            <Text>Anthropic: </Text>
            <Text dimColor>not set</Text>
          </>
        )}
      </Box>
      <Box>
        {openaiKey ? (
          <>
            <Text color={colors.success}>✓ </Text>
            <Text>OpenAI: </Text>
            <Text dimColor>{maskKey(openaiKey)}</Text>
          </>
        ) : (
          <>
            <Text color={colors.warning}>✗ </Text>
            <Text>OpenAI: </Text>
            <Text dimColor>not set</Text>
          </>
        )}
      </Box>
      <Box height={1} />
      <Text dimColor>Use /apikey to add or update keys</Text>
    </Box>
  );
}


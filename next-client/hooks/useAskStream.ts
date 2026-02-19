"use client";

import { useState, useCallback, useRef } from "react";
import { askAIStream } from "@/lib/api";

export function useAskStream() {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const ask = useCallback(async (prompt: string, options?: { system?: string }) => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setResponse("");

    try {
      for await (const chunk of askAIStream(prompt, { ...options, signal: controller.signal })) {
        setResponse((prev) => prev + chunk);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setResponse("");
    setError(null);
  }, [cancel]);

  return { ask, response, loading, error, reset, cancel };
}

"use client";

import { useState, useCallback } from "react";
import { askAI } from "@/lib/api";

export function useAsk() {
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const ask = useCallback(async (prompt: string, options?: { system?: string }) => {
    setLoading(true);
    setError(null);
    setResponse("");

    try {
      const text = await askAI(prompt, options);
      setResponse(text);
      return text;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResponse("");
    setError(null);
  }, []);

  return { ask, response, loading, error, reset };
}

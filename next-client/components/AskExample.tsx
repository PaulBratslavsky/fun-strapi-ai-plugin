"use client";

import { useState } from "react";
import { useAsk } from "@/hooks";

export function AskExample() {
  const [prompt, setPrompt] = useState("What is the capital of France?");
  const { ask, response, loading, error } = useAsk();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await ask(prompt);
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow">
      <h2 className="text-xl font-semibold mb-4 text-black dark:text-white">
        1. /ask - Non-streaming
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-3 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
          placeholder="Enter your prompt..."
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Ask"}
        </button>
      </form>
      {error && (
        <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 rounded-lg">
          <p className="text-red-700 dark:text-red-200">{error.message}</p>
        </div>
      )}
      {response && (
        <div className="mt-4 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <p className="text-black dark:text-white whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </section>
  );
}

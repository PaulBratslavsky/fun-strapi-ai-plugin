"use client";

import { useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { API_BASE } from "@/lib/api";

export function ChatExample() {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `${API_BASE}/chat` }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => {
      console.error("useChat error:", err);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input;
    setInput("");
    await sendMessage({ text: message });
  };

  // Get text content from message parts
  const getMessageContent = (message: typeof messages[0]) => {
    return message.parts
      ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("") || "";
  };

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow">
      <h2 className="text-xl font-semibold mb-4 text-black dark:text-white">
        3. /chat - useChat Hook
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 rounded-lg text-red-700 dark:text-red-200">
          Error: {error.message}
        </div>
      )}

      <div className="space-y-4 mb-4 max-h-80 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded-lg ${
              message.role === "user"
                ? "bg-blue-100 dark:bg-blue-900 ml-8"
                : "bg-zinc-100 dark:bg-zinc-800 mr-8"
            }`}
          >
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              {message.role === "user" ? "You" : "Assistant"}
            </p>
            <p className="text-black dark:text-white whitespace-pre-wrap">
              {getMessageContent(message)}
            </p>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 mr-8">
            <p className="text-zinc-500 dark:text-zinc-400">Thinking...</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-3 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
          placeholder="Type a message..."
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {isLoading ? "..." : "Send"}
        </button>
      </form>
    </section>
  );
}

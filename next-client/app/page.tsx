import { AskExample, AskStreamExample, ChatExample } from "@/components";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <main className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-center text-black dark:text-white">
          AI SDK Endpoint Examples
        </h1>

        <div className="grid gap-8">
          <AskExample />
          <AskStreamExample />
          <ChatExample />
        </div>
      </main>
    </div>
  );
}

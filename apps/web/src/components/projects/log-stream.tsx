import { useEffect, useState, useRef } from "react";
import { Trash2, Download, ArrowDown } from "lucide-react";
import { Button } from "@Emitkit/ui/components/button";

export function LogStream({
  runId,
  status,
  initialLogs,
}: {
  runId: string;
  status: string;
  initialLogs?: string | null;
}) {
  const [logs, setLogs] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize logs when initialLogs changes
  useEffect(() => {
    setLogs(initialLogs || "");
  }, [initialLogs]);

  // EventSource stream for active logs
  useEffect(() => {
    if (status === "queued" || status === "running") {
      const eventSource = new EventSource(`/api/runs/${runId}/logs/stream`);

      eventSource.onmessage = (e) => {
        setLogs((prev) => prev + e.data + "\n");
        if (e.data.includes("[DONE]")) {
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    }
  }, [runId, status]);

  // Handle auto-scroll on logs updates
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Clear logs locally
  const handleClear = () => {
    setLogs("");
  };

  // Download logs as a .txt file
  const handleDownload = () => {
    const blob = new Blob([logs], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `run-${runId}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden font-mono shadow-xl">
      {/* Terminal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          {/* Simulated macOS style buttons */}
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors" />
          </div>
          <span className="text-xs text-zinc-500 font-mono ml-2">emitkit-terminal v0.1.0</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Clear Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleClear}
            className="text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-mono cursor-pointer transition-colors"
            title="Clear Logs"
          >
            <Trash2 className="size-3.5" />
            <span>Clear</span>
          </Button>

          {/* Download Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleDownload}
            className="text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-mono cursor-pointer transition-colors"
            title="Download Logs"
          >
            <Download className="size-3.5" />
            <span>Download</span>
          </Button>

          {/* Auto-Scroll Toggle Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 font-mono cursor-pointer transition-colors border ${
              autoScroll
                ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/30"
                : "text-zinc-500 bg-zinc-950/40 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700"
            }`}
            title="Toggle Auto-Scroll"
          >
            <ArrowDown className={`size-3.5 transition-transform ${autoScroll ? "animate-pulse" : ""}`} />
            <span>Scroll: {autoScroll ? "ON" : "OFF"}</span>
          </Button>
        </div>
      </div>

      {/* Terminal Logs Window */}
      <div
        ref={scrollContainerRef}
        className="max-h-[500px] overflow-y-auto p-6 text-xs text-zinc-300 space-y-1.5 leading-relaxed bg-zinc-950 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent select-text"
      >
        {logs ? (
          logs.split("\n").map((line, idx) => {
            // Skip trailing empty line from split
            if (idx === logs.split("\n").length - 1 && line === "") return null;

            let lineClass = "text-zinc-300";
            if (
              line.includes("[ERROR]") ||
              line.includes("error") ||
              line.includes("Error:") ||
              line.includes("FAILED")
            ) {
              lineClass = "text-rose-400 font-semibold";
            } else if (
              line.includes("[SUCCESS]") ||
              line.includes("SUCCESS") ||
              line.includes("Successfully")
            ) {
              lineClass = "text-emerald-400 font-semibold";
            } else if (line.includes("[WARNING]") || line.includes("warn") || line.includes("WARN")) {
              lineClass = "text-amber-400";
            } else if (line.includes("[INFO]") || line.includes("info")) {
              lineClass = "text-indigo-300";
            } else if (line.includes("[DONE]")) {
              lineClass = "text-indigo-400 font-bold border-t border-zinc-800 pt-1.5 mt-1.5";
            }

            return (
              <div key={idx} className={`${lineClass} whitespace-pre-wrap break-all leading-normal`}>
                {line}
              </div>
            );
          })
        ) : (
          <div className="text-zinc-500 italic flex items-center justify-center h-32 select-none">
            No logs recorded yet...
          </div>
        )}
      </div>
    </div>
  );
}

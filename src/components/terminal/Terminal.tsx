/**
 * Terminal Component
 *
 * Simple terminal component that connects to Tauri PTY backend.
 * For production, integrate xterm.js for full terminal emulation.
 */

import {
  createSignal,
  onMount,
  onCleanup,
  Show,
  For,
} from "solid-js";
import { listen } from "@tauri-apps/api/event";
import * as ipc from "../../ipc/commands";

interface TerminalProps {
  id?: string | undefined;
  cwd?: string | undefined;
  onTitleChange?: (title: string) => void;
  onExit?: (code: number) => void;
}

export function Terminal(props: TerminalProps) {
  let containerRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  const initialId = () => props.id ?? null;
  const [terminalId, setTerminalId] = createSignal<string | null>(initialId());
  const [lines, setLines] = createSignal<string[]>([]);
  const [currentLine, setCurrentLine] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  // Initialize terminal
  onMount(async () => {
    if (!props.id) {
      await createTerminal();
    } else {
      await connectToTerminal(props.id);
    }
  });

  // Create new terminal
  async function createTerminal() {
    try {
      const info = await ipc.terminalCreate(props.cwd, undefined, 24, 80);
      setTerminalId(info.id);
      await connectToTerminal(info.id);
    } catch (e) {
      setError(`Failed to create terminal: ${e}`);
    }
  }

  // Connect to existing terminal
  async function connectToTerminal(id: string) {
    try {
      // Listen for output
      const unlistenOutput = await listen<number[]>(`terminal-output-${id}`, (event) => {
        const text = new TextDecoder().decode(new Uint8Array(event.payload));
        appendOutput(text);
      });

      // Listen for exit
      const unlistenExit = await listen<number>(`terminal-exit-${id}`, (event) => {
        appendOutput(`\n[Process exited with code ${event.payload}]\n`);
        props.onExit?.(event.payload);
      });

      // Listen for errors
      const unlistenError = await listen<string>(`terminal-error-${id}`, (event) => {
        setError(event.payload);
      });

      onCleanup(() => {
        unlistenOutput();
        unlistenExit();
        unlistenError();

        // Kill terminal on cleanup
        const tid = terminalId();
        if (tid) {
          ipc.terminalKill(tid).catch(console.error);
        }
      });
    } catch (e) {
      setError(`Failed to connect to terminal: ${e}`);
    }
  }

  function appendOutput(text: string) {
    // Simple line buffering
    const current = currentLine() + text;
    const parts = current.split("\n");

    if (parts.length > 1) {
      // Add complete lines
      setLines([...lines(), ...parts.slice(0, -1)]);
      setCurrentLine(parts[parts.length - 1] ?? "");
    } else {
      setCurrentLine(current);
    }

    // Auto scroll
    if (containerRef) {
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  }

  // Handle keyboard input
  function handleKeyDown(e: KeyboardEvent) {
    const id = terminalId();
    if (!id) return;

    let data = "";

    if (e.key === "Enter") {
      data = "\r";
    } else if (e.key === "Backspace") {
      data = "\x7f";
    } else if (e.key === "Tab") {
      data = "\t";
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      data = "\x1b[A";
    } else if (e.key === "ArrowDown") {
      data = "\x1b[B";
    } else if (e.key === "ArrowRight") {
      data = "\x1b[C";
    } else if (e.key === "ArrowLeft") {
      data = "\x1b[D";
    } else if (e.ctrlKey && e.key === "c") {
      data = "\x03";
    } else if (e.ctrlKey && e.key === "d") {
      data = "\x04";
    } else if (e.ctrlKey && e.key === "z") {
      data = "\x1a";
    } else if (e.key.length === 1) {
      data = e.key;
    }

    if (data) {
      const bytes = Array.from(new TextEncoder().encode(data));
      ipc.terminalWrite(id, bytes).catch(console.error);
    }
  }

  return (
    <div
      class="h-full w-full flex flex-col bg-[#1e1e2e] font-mono text-sm"
      onClick={() => inputRef?.focus()}
    >
      <Show when={error()}>
        <div class="px-3 py-2 bg-red-900/50 text-red-300 text-sm">
          {error()}
        </div>
      </Show>

      <div
        ref={containerRef}
        class="flex-1 overflow-auto p-2 text-[#cdd6f4]"
      >
        <For each={lines()}>
          {(line) => (
            <div class="whitespace-pre-wrap break-all leading-5">
              {line || " "}
            </div>
          )}
        </For>
        <div class="whitespace-pre-wrap break-all leading-5">
          {currentLine()}
          <span class="bg-[#f5e0dc] text-[#1e1e2e] animate-pulse">▋</span>
        </div>
      </div>

      {/* Hidden input for keyboard capture */}
      <input
        ref={inputRef}
        type="text"
        class="absolute opacity-0 w-0 h-0"
        onKeyDown={handleKeyDown}
        autofocus
      />
    </div>
  );
}

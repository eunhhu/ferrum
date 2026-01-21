import { Show, createSignal } from "solid-js";
import { editorStore, uiStore } from "../../stores";

export function StatusBar() {
  const { getActiveTab, cursorPosition } = editorStore;
  const [gitBranch] = createSignal("main");
  const [notifications] = createSignal(0);

  // Get language display name
  const getLanguageDisplay = (lang: string | undefined) => {
    const langMap: Record<string, string> = {
      typescript: "TypeScript",
      typescriptreact: "TypeScript React",
      javascript: "JavaScript",
      javascriptreact: "JavaScript React",
      rust: "Rust",
      python: "Python",
      go: "Go",
      json: "JSON",
      html: "HTML",
      css: "CSS",
      markdown: "Markdown",
      plaintext: "Plain Text",
    };
    return langMap[lang || ""] || lang || "Plain Text";
  };

  // Get file encoding
  const getEncoding = () => "UTF-8";

  // Get line ending
  const getLineEnding = () => "LF";

  return (
    <div class="h-6 bg-accent flex items-center justify-between text-xs text-white select-none">
      {/* Left Section */}
      <div class="flex items-center h-full">
        {/* Git Branch */}
        <button class="h-full px-2 flex items-center gap-1 hover:bg-white/10 transition-colors">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
          </svg>
          <span>{gitBranch()}</span>
        </button>

        {/* Sync Status */}
        <button class="h-full px-2 flex items-center gap-1 hover:bg-white/10 transition-colors">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
          </svg>
        </button>

        {/* Errors & Warnings */}
        <button class="h-full px-2 flex items-center gap-2 hover:bg-white/10 transition-colors">
          <span class="flex items-center gap-0.5">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <span>0</span>
          </span>
          <span class="flex items-center gap-0.5">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
            </svg>
            <span>0</span>
          </span>
        </button>
      </div>

      {/* Right Section */}
      <div class="flex items-center h-full">
        {/* Editor Info */}
        <Show when={getActiveTab()}>
          {(tab) => (
            <>
              {/* Cursor Position */}
              <button class="h-full px-2 hover:bg-white/10 transition-colors">
                Ln {cursorPosition().line}, Col {cursorPosition().column}
              </button>

              {/* Spaces/Tabs */}
              <button class="h-full px-2 hover:bg-white/10 transition-colors">
                Spaces: 2
              </button>

              {/* Encoding */}
              <button class="h-full px-2 hover:bg-white/10 transition-colors">
                {getEncoding()}
              </button>

              {/* Line Ending */}
              <button class="h-full px-2 hover:bg-white/10 transition-colors">
                {getLineEnding()}
              </button>

              {/* Language */}
              <button class="h-full px-2 hover:bg-white/10 transition-colors">
                {getLanguageDisplay(tab().language)}
              </button>
            </>
          )}
        </Show>

        {/* Notifications */}
        <button class="h-full px-2 flex items-center gap-1 hover:bg-white/10 transition-colors">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
          <Show when={notifications() > 0}>
            <span class="px-1 bg-white/20 rounded text-[10px]">
              {notifications()}
            </span>
          </Show>
        </button>

        {/* Layout Toggle */}
        <button
          class="h-full px-2 flex items-center hover:bg-white/10 transition-colors"
          onClick={uiStore.togglePanel}
          title="Toggle Panel"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 5v14h18V5H3zm16 12H5v-7h14v7z" />
          </svg>
        </button>

        {/* Ferrum Branding */}
        <div class="h-full px-3 flex items-center gap-1 bg-white/10">
          <span class="font-semibold">Fe</span>
          <span class="opacity-75">Ferrum</span>
        </div>
      </div>
    </div>
  );
}

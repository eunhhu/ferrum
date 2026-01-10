import { onMount, onCleanup } from "solid-js";
import {
  ActivityBar,
  Sidebar,
  EditorArea,
  Panel,
  StatusBar,
} from "./components/layout";
import { CommandPalette } from "./components/ui/CommandPalette";
import { commandsStore } from "./stores";

function App() {
  let cleanup: (() => void) | undefined;

  onMount(() => {
    cleanup = commandsStore.setupKeyboardShortcuts();
  });

  onCleanup(() => {
    cleanup?.();
  });

  return (
    <div class="h-screen w-screen flex flex-col overflow-hidden">
      <div class="flex-1 flex min-h-0">
        <ActivityBar />
        <Sidebar />
        <div class="flex-1 flex flex-col min-w-0">
          <EditorArea />
          <Panel />
        </div>
      </div>
      <StatusBar />

      {/* Command Palette */}
      <CommandPalette
        commands={commandsStore.commands}
        isOpen={commandsStore.isCommandPaletteOpen()}
        onClose={commandsStore.closeCommandPalette}
      />
    </div>
  );
}

export default App;

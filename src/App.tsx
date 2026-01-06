import { ActivityBar, Sidebar, EditorArea, Panel, StatusBar } from "./components/layout";

function App() {
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
    </div>
  );
}

export default App;

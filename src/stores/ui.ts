import { createSignal } from "solid-js";
import type { SidebarView } from "../types";

const [sidebarVisible, setSidebarVisible] = createSignal(true);
const [sidebarView, setSidebarView] = createSignal<SidebarView>("explorer");
const [sidebarWidth, setSidebarWidth] = createSignal(260);

const [panelVisible, setPanelVisible] = createSignal(true);
const [panelHeight, setPanelHeight] = createSignal(200);

const [activityBarVisible, setActivityBarVisible] = createSignal(true);

export const uiStore = {
  sidebarVisible,
  setSidebarVisible,
  sidebarView,
  setSidebarView,
  sidebarWidth,
  setSidebarWidth,
  panelVisible,
  setPanelVisible,
  panelHeight,
  setPanelHeight,
  activityBarVisible,
  setActivityBarVisible,

  toggleSidebar: () => setSidebarVisible((v) => !v),
  togglePanel: () => setPanelVisible((v) => !v),
};

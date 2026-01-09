/**
 * Event listener hook with proper cleanup
 */

import { onCleanup, onMount, Accessor } from "solid-js";

type EventMap = WindowEventMap & DocumentEventMap & HTMLElementEventMap;

/**
 * Attach an event listener to window/document/element with automatic cleanup
 */
export function useEventListener<K extends keyof EventMap>(
  target: Window | Document | HTMLElement | Accessor<HTMLElement | null>,
  event: K,
  handler: (event: EventMap[K]) => void,
  options?: AddEventListenerOptions
) {
  const getTarget = () => {
    if (typeof target === "function") {
      return target();
    }
    return target;
  };

  onMount(() => {
    const el = getTarget();
    if (el) {
      el.addEventListener(event, handler as EventListener, options);
    }
  });

  onCleanup(() => {
    const el = getTarget();
    if (el) {
      el.removeEventListener(event, handler as EventListener, options);
    }
  });
}

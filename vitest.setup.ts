import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"

afterEach(() => {
  cleanup()
})

// jsdom does not implement DragEvent (constructing one throws, and
// @testing-library/dom's fireEvent.dragStart/drop silently fall back to a
// bare Event without clientX/clientY/dataTransfer support). Polyfill it as a
// MouseEvent subclass carrying a dataTransfer so drag-and-drop tests that
// assert on drop coordinates work the same way they would in a real browser.
if (typeof window !== "undefined" && typeof window.DragEvent === "undefined") {
  class DragEventPolyfill extends MouseEvent {
    dataTransfer: DataTransfer | null
    constructor(type: string, init: MouseEventInit & { dataTransfer?: DataTransfer | null } = {}) {
      super(type, init)
      this.dataTransfer = init.dataTransfer ?? null
    }
  }
  window.DragEvent = DragEventPolyfill as unknown as typeof DragEvent
}

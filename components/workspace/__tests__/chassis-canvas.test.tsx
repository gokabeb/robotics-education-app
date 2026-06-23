import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ChassisCanvas } from "../chassis-canvas"
import { RobotProjectStore } from "@/lib/workspace/robot-project-store"

describe("ChassisCanvas", () => {
  it("renders a pin badge showing the auto-assigned pin after a component is added", () => {
    const store = new RobotProjectStore()
    store.addComponent("led", 40, 40)
    render(<ChassisCanvas store={store} />)
    expect(screen.getByText(/D2/)).toBeInTheDocument()
  })

  it("re-renders when the store notifies after an external mutation", () => {
    const store = new RobotProjectStore()
    render(<ChassisCanvas store={store} />)
    expect(screen.queryByTestId(/^component-/)).not.toBeInTheDocument()
    store.addComponent("motor", 10, 10)
    expect(screen.getByTestId(/^component-/)).toBeInTheDocument()
  })

  it("rotates the selected component by 90 degrees on pressing R, without touching its position", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 40, 40)
    render(<ChassisCanvas store={store} />)
    const el = screen.getByTestId(`component-${led.id}`)
    fireEvent.click(el)
    fireEvent.keyDown(window, { key: "r" })
    const updated = store.getComponents()[0]
    expect(updated.rotation).toBe(90)
    expect(updated.x).toBe(40)
    expect(updated.y).toBe(40)
  })

  it("moves a placed component to the drop coordinates when dragged on the canvas", () => {
    const store = new RobotProjectStore()
    const led = store.addComponent("led", 40, 40)
    render(<ChassisCanvas store={store} />)
    const el = screen.getByTestId(`component-${led.id}`)
    const canvas = el.parentElement as HTMLElement

    // Mock getBoundingClientRect for both the dragged element (drag-start
    // offset calculation) and the canvas (drop coordinate calculation).
    el.getBoundingClientRect = () => ({ left: 40, top: 40, right: 70, bottom: 70, width: 30, height: 30, x: 40, y: 40, toJSON() {} })
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON() {} })

    const transferData = new Map<string, string>()
    const dataTransfer = {
      setData: (k: string, v: string) => transferData.set(k, v),
      getData: (k: string) => transferData.get(k) ?? "",
    }
    fireEvent.dragStart(el, { clientX: 45, clientY: 45, dataTransfer })
    fireEvent.drop(canvas, { clientX: 120, clientY: 130, dataTransfer })

    const updated = store.getComponents()[0]
    // offset within element was (5, 5); drop at (120, 130) => (115, 125)
    expect(updated.x).toBe(115)
    expect(updated.y).toBe(125)
  })

  it("opens a pin picker listing only free, valid pins for the component's kind", () => {
    const store = new RobotProjectStore()
    const motor = store.addComponent("motor", 0, 0) // pin 3 (PWM)
    render(<ChassisCanvas store={store} />)
    const badge = screen.getByTestId(`pin-badge-${motor.id}`)
    fireEvent.click(badge)
    const select = screen.getByTestId(`pin-select-${motor.id}`) as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).toContain("3")
    expect(options).not.toContain("4") // D4 is not PWM-capable
  })
})

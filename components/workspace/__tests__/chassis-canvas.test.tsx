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

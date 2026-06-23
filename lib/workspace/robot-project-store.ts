import { getComponentDef, type WorkspaceComponentType } from "./component-types"
import { getFreePinsFor, isPinFreeAndValidFor, type PinInfo } from "./pin-constraints"

export interface RobotProjectComponent {
  id: string
  type: WorkspaceComponentType
  name: string
  x: number
  y: number
  rotation: number
  pin: number | null
}

export interface WorkspaceCode {
  source: "blocks" | "text"
  blocklyXml: string | null
  generatedCode: string
}

export interface WorkspaceSnapshot {
  components: RobotProjectComponent[]
  code: WorkspaceCode
  hash: string
  flashedAt: number
}

function hashContent(components: RobotProjectComponent[], code: WorkspaceCode): string {
  // Hash content only, not the auto-generated `id` field: ids come from a
  // module-global counter, so two stores with identical components can have
  // different ids while representing the same content. Sort by a stable,
  // content-derived key so add-order never affects the hash either.
  const sorted = [...components]
    .map(({ id, ...rest }) => rest)
    .sort((a, b) => `${a.type}-${a.x}-${a.y}-${a.pin}`.localeCompare(`${b.type}-${b.x}-${b.y}-${b.pin}`))
  const payload = JSON.stringify({ sorted, code })
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0
  }
  return hash.toString(16)
}

let nextId = 0
function generateId(prefix: string): string {
  nextId += 1
  return `${prefix}-${nextId}`
}

export class RobotProjectStore {
  private components: RobotProjectComponent[] = []
  private code: WorkspaceCode = { source: "blocks", blocklyXml: null, generatedCode: "" }
  private listeners = new Set<() => void>()

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  getComponents(): RobotProjectComponent[] {
    return this.components
  }

  private usedPins(): number[] {
    return this.components.map((c) => c.pin).filter((p): p is number => p !== null)
  }

  addComponent(type: WorkspaceComponentType, x: number, y: number): RobotProjectComponent {
    const def = getComponentDef(type)
    const free = getFreePinsFor(def.pinKind, this.usedPins())
    const component: RobotProjectComponent = {
      id: generateId(type),
      type,
      name: def.label,
      x,
      y,
      rotation: 0,
      pin: free[0]?.digitalPin ?? null,
    }
    this.components.push(component)
    this.notify()
    return component
  }

  removeComponent(id: string): void {
    this.components = this.components.filter((c) => c.id !== id)
    this.notify()
  }

  moveComponent(id: string, x: number, y: number): void {
    const component = this.components.find((c) => c.id === id)
    if (!component) return
    component.x = x
    component.y = y
    this.notify()
  }

  rotateComponent(id: string, rotation: number): void {
    const component = this.components.find((c) => c.id === id)
    if (!component) return
    component.rotation = rotation
    this.notify()
  }

  getFreePinsForComponent(id: string): PinInfo[] {
    const component = this.components.find((c) => c.id === id)
    if (!component) return []
    const def = getComponentDef(component.type)
    const used = this.usedPins().filter((p) => p !== component.pin)
    return getFreePinsFor(def.pinKind, used)
  }

  reassignPin(id: string, pin: number): boolean {
    const component = this.components.find((c) => c.id === id)
    if (!component) return false
    const def = getComponentDef(component.type)
    const used = this.usedPins().filter((p) => p !== component.pin)
    if (!isPinFreeAndValidFor(def.pinKind, pin, used)) return false
    component.pin = pin
    this.notify()
    return true
  }

  getCode(): WorkspaceCode {
    return this.code
  }

  setBlocklyXml(xml: string, generatedCode: string): void {
    this.code = { source: "blocks", blocklyXml: xml, generatedCode }
    this.notify()
  }

  setManualCode(code: string): void {
    this.code = { ...this.code, source: "text", generatedCode: code }
    this.notify()
  }

  private flashed: WorkspaceSnapshot | null = null

  flash(): WorkspaceSnapshot {
    const snapshot: WorkspaceSnapshot = {
      components: this.components.map((c) => ({ ...c })),
      code: { ...this.code },
      hash: hashContent(this.components, this.code),
      flashedAt: Date.now(),
    }
    this.flashed = snapshot
    this.notify()
    return snapshot
  }

  getFlashed(): WorkspaceSnapshot | null {
    return this.flashed
  }

  isOutOfSync(): boolean {
    if (!this.flashed) return false
    return hashContent(this.components, this.code) !== this.flashed.hash
  }
}

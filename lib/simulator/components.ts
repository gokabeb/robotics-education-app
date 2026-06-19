// Robot component definitions for the builder

export type ComponentType = "chassis" | "motor" | "sensor" | "wheel" | "arm"

export interface RobotComponent {
  id: string
  type: ComponentType
  name: string
  description: string
  icon: string
  color: string
  width: number
  height: number
  slots?: ComponentSlot[]
  properties?: ComponentProperty[]
}

export interface ComponentSlot {
  id: string
  name: string
  accepts: ComponentType[]
  x: number
  y: number
  angle?: number
}

export interface ComponentProperty {
  id: string
  name: string
  type: "number" | "boolean" | "select"
  default: number | boolean | string
  min?: number
  max?: number
  options?: string[]
}

export interface PlacedComponent {
  id: string
  componentId: string
  x: number
  y: number
  rotation: number
  slotId?: string
  parentId?: string
  properties: Record<string, number | boolean | string>
}

export interface RobotDesign {
  id: string
  name: string
  components: PlacedComponent[]
  createdAt: string
  updatedAt: string
}

// Available components in the library
export const COMPONENT_LIBRARY: RobotComponent[] = [
  // Chassis options
  {
    id: "chassis-basic",
    type: "chassis",
    name: "Basic Chassis",
    description: "A simple rectangular chassis for beginners",
    icon: "🔲",
    color: "#3b82f6",
    width: 80,
    height: 60,
    slots: [
      { id: "motor-left", name: "Left Motor", accepts: ["motor"], x: -40, y: 0, angle: 0 },
      { id: "motor-right", name: "Right Motor", accepts: ["motor"], x: 40, y: 0, angle: 0 },
      { id: "sensor-front", name: "Front Sensor", accepts: ["sensor"], x: 0, y: -30, angle: 0 },
      { id: "sensor-left", name: "Left Sensor", accepts: ["sensor"], x: -40, y: -20, angle: -45 },
      { id: "sensor-right", name: "Right Sensor", accepts: ["sensor"], x: 40, y: -20, angle: 45 },
    ],
  },
  {
    id: "chassis-compact",
    type: "chassis",
    name: "Compact Chassis",
    description: "A smaller, more agile chassis",
    icon: "🔳",
    color: "#8b5cf6",
    width: 60,
    height: 50,
    slots: [
      { id: "motor-left", name: "Left Motor", accepts: ["motor"], x: -30, y: 0, angle: 0 },
      { id: "motor-right", name: "Right Motor", accepts: ["motor"], x: 30, y: 0, angle: 0 },
      { id: "sensor-front", name: "Front Sensor", accepts: ["sensor"], x: 0, y: -25, angle: 0 },
    ],
  },
  {
    id: "chassis-tank",
    type: "chassis",
    name: "Tank Chassis",
    description: "Heavy-duty chassis with track mounts",
    icon: "🛡️",
    color: "#059669",
    width: 100,
    height: 70,
    slots: [
      { id: "motor-left", name: "Left Track", accepts: ["motor"], x: -50, y: 0, angle: 0 },
      { id: "motor-right", name: "Right Track", accepts: ["motor"], x: 50, y: 0, angle: 0 },
      { id: "sensor-front-l", name: "Front Left Sensor", accepts: ["sensor"], x: -30, y: -35, angle: -15 },
      { id: "sensor-front-r", name: "Front Right Sensor", accepts: ["sensor"], x: 30, y: -35, angle: 15 },
      { id: "sensor-back", name: "Rear Sensor", accepts: ["sensor"], x: 0, y: 35, angle: 180 },
      { id: "arm-mount", name: "Arm Mount", accepts: ["arm"], x: 0, y: -20, angle: 0 },
    ],
  },

  // Motor options
  {
    id: "motor-dc",
    type: "motor",
    name: "DC Motor",
    description: "Standard DC motor for differential drive",
    icon: "⚙️",
    color: "#f59e0b",
    width: 20,
    height: 30,
    properties: [
      { id: "maxSpeed", name: "Max Speed", type: "number", default: 100, min: 0, max: 255 },
    ],
  },
  {
    id: "motor-servo",
    type: "motor",
    name: "Servo Motor",
    description: "Precise position control motor",
    icon: "🎯",
    color: "#ec4899",
    width: 15,
    height: 25,
    properties: [
      { id: "minAngle", name: "Min Angle", type: "number", default: 0, min: 0, max: 180 },
      { id: "maxAngle", name: "Max Angle", type: "number", default: 180, min: 0, max: 180 },
    ],
  },
  {
    id: "motor-stepper",
    type: "motor",
    name: "Stepper Motor",
    description: "High-precision stepper motor",
    icon: "📐",
    color: "#14b8a6",
    width: 25,
    height: 25,
    properties: [
      { id: "stepsPerRev", name: "Steps/Rev", type: "number", default: 200, min: 100, max: 400 },
    ],
  },

  // Sensor options
  {
    id: "sensor-ultrasonic",
    type: "sensor",
    name: "Ultrasonic Sensor",
    description: "Measures distance using sound waves",
    icon: "📡",
    color: "#06b6d4",
    width: 20,
    height: 15,
    properties: [
      { id: "maxRange", name: "Max Range (cm)", type: "number", default: 200, min: 10, max: 400 },
    ],
  },
  {
    id: "sensor-ir",
    type: "sensor",
    name: "IR Sensor",
    description: "Infrared proximity sensor",
    icon: "🔴",
    color: "#ef4444",
    width: 15,
    height: 10,
    properties: [
      { id: "threshold", name: "Threshold", type: "number", default: 500, min: 0, max: 1023 },
    ],
  },
  {
    id: "sensor-line",
    type: "sensor",
    name: "Line Sensor",
    description: "Detects dark lines on light surfaces",
    icon: "➖",
    color: "#1f2937",
    width: 12,
    height: 8,
    properties: [
      { id: "threshold", name: "Threshold", type: "number", default: 500, min: 0, max: 1023 },
    ],
  },
  {
    id: "sensor-color",
    type: "sensor",
    name: "Color Sensor",
    description: "Detects and identifies colors",
    icon: "🌈",
    color: "#a855f7",
    width: 15,
    height: 15,
  },
  {
    id: "sensor-touch",
    type: "sensor",
    name: "Touch Sensor",
    description: "Physical bump sensor",
    icon: "👆",
    color: "#84cc16",
    width: 20,
    height: 10,
  },

  // Arm/Gripper
  {
    id: "arm-gripper",
    type: "arm",
    name: "Gripper Arm",
    description: "Two-finger gripper for picking objects",
    icon: "🦾",
    color: "#6366f1",
    width: 40,
    height: 60,
    properties: [
      { id: "maxOpen", name: "Max Open (mm)", type: "number", default: 50, min: 20, max: 100 },
    ],
  },
]

export function getComponentById(id: string): RobotComponent | undefined {
  return COMPONENT_LIBRARY.find((c) => c.id === id)
}

export function getComponentsByType(type: ComponentType): RobotComponent[] {
  return COMPONENT_LIBRARY.filter((c) => c.type === type)
}

export function createPlacedComponent(
  componentId: string,
  x: number,
  y: number,
  rotation: number = 0
): PlacedComponent {
  const component = getComponentById(componentId)
  const properties: Record<string, number | boolean | string> = {}
  
  if (component?.properties) {
    for (const prop of component.properties) {
      properties[prop.id] = prop.default
    }
  }

  return {
    id: crypto.randomUUID(),
    componentId,
    x,
    y,
    rotation,
    properties,
  }
}

export function generateRobotConfig(design: RobotDesign) {
  const chassis = design.components.find((c) => {
    const comp = getComponentById(c.componentId)
    return comp?.type === "chassis"
  })

  const motors = design.components.filter((c) => {
    const comp = getComponentById(c.componentId)
    return comp?.type === "motor"
  })

  const sensors = design.components.filter((c) => {
    const comp = getComponentById(c.componentId)
    return comp?.type === "sensor"
  })

  return {
    chassis: chassis ? getComponentById(chassis.componentId) : null,
    motors: motors.map((m) => ({
      placed: m,
      component: getComponentById(m.componentId),
    })),
    sensors: sensors.map((s) => ({
      placed: s,
      component: getComponentById(s.componentId),
    })),
  }
}



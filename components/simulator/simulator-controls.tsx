"use client"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Play,
  Pause,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Gauge,
  Target,
} from "lucide-react"
import { motion } from "framer-motion"
import { RobotState } from "@/lib/simulator/robot"
import { ARENAS } from "@/lib/simulator/arena"

interface SimulatorControlsProps {
  isRunning: boolean
  onToggleRun: () => void
  onReset: () => void
  onMoveForward: () => void
  onMoveBackward: () => void
  onTurnLeft: () => void
  onTurnRight: () => void
  onStop: () => void
  robotState: RobotState | null
  selectedArena: string
  onArenaChange: (arenaId: string) => void
  speed: number
  onSpeedChange: (speed: number) => void
}

export function SimulatorControls({
  isRunning,
  onToggleRun,
  onReset,
  onMoveForward,
  onMoveBackward,
  onTurnLeft,
  onTurnRight,
  onStop,
  robotState,
  selectedArena,
  onArenaChange,
  speed,
  onSpeedChange,
}: SimulatorControlsProps) {
  return (
    <div className="space-y-6">
      {/* Arena Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Arena</label>
        <Select value={selectedArena} onValueChange={onArenaChange}>
          <SelectTrigger className="w-full bg-background border-border">
            <SelectValue placeholder="Select arena" />
          </SelectTrigger>
          <SelectContent>
            {ARENAS.map((arena) => (
              <SelectItem key={arena.id} value={arena.id}>
                <div className="flex flex-col">
                  <span>{arena.name}</span>
                  <span className="text-xs text-muted-foreground">{arena.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Simulation Controls */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Simulation</label>
        <div className="flex gap-2">
          <Button
            variant={isRunning ? "default" : "outline"}
            size="sm"
            onClick={onToggleRun}
            className={isRunning ? "bg-primary" : "border-border"}
          >
            {isRunning ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} className="border-border">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Speed Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-muted-foreground">Speed</label>
          <span className="text-sm text-muted-foreground">{speed}%</span>
        </div>
        <Slider
          value={[speed]}
          onValueChange={([value]) => onSpeedChange(value)}
          min={10}
          max={100}
          step={10}
          className="w-full"
        />
      </div>

      {/* Manual Controls */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Manual Controls</label>
        <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto">
          <div />
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="icon"
              className="w-full aspect-square border-border"
              onMouseDown={onMoveForward}
              onMouseUp={onStop}
              onMouseLeave={onStop}
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          </motion.div>
          <div />

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="icon"
              className="w-full aspect-square border-border"
              onMouseDown={onTurnLeft}
              onMouseUp={onStop}
              onMouseLeave={onStop}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="icon"
              className="w-full aspect-square border-border"
              onClick={onStop}
            >
              <Square className="h-4 w-4" />
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="icon"
              className="w-full aspect-square border-border"
              onMouseDown={onTurnRight}
              onMouseUp={onStop}
              onMouseLeave={onStop}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </motion.div>

          <div />
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="icon"
              className="w-full aspect-square border-border"
              onMouseDown={onMoveBackward}
              onMouseUp={onStop}
              onMouseLeave={onStop}
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          </motion.div>
          <div />
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Use arrow keys or WASD
        </p>
      </div>

      {/* Sensor Readings */}
      {robotState && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Sensors</label>
          
          {/* Distance Sensors */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="text-xs text-muted-foreground mb-1">Left</div>
              <div className="text-sm font-mono">{robotState.sensors.left.toFixed(0)}cm</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="text-xs text-muted-foreground mb-1">Front</div>
              <div className="text-sm font-mono">{robotState.sensors.front.toFixed(0)}cm</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="text-xs text-muted-foreground mb-1">Right</div>
              <div className="text-sm font-mono">{robotState.sensors.right.toFixed(0)}cm</div>
            </div>
          </div>

          {/* Line Sensors */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className={`rounded-lg p-2 ${robotState.sensors.lineLeft ? "bg-primary/20" : "bg-secondary/50"}`}>
              <div className="text-xs text-muted-foreground mb-1">Line L</div>
              <div className={`text-sm font-mono ${robotState.sensors.lineLeft ? "text-primary" : ""}`}>
                {robotState.sensors.lineLeft ? "ON" : "OFF"}
              </div>
            </div>
            <div className={`rounded-lg p-2 ${robotState.sensors.lineCenter ? "bg-primary/20" : "bg-secondary/50"}`}>
              <div className="text-xs text-muted-foreground mb-1">Line C</div>
              <div className={`text-sm font-mono ${robotState.sensors.lineCenter ? "text-primary" : ""}`}>
                {robotState.sensors.lineCenter ? "ON" : "OFF"}
              </div>
            </div>
            <div className={`rounded-lg p-2 ${robotState.sensors.lineRight ? "bg-primary/20" : "bg-secondary/50"}`}>
              <div className="text-xs text-muted-foreground mb-1">Line R</div>
              <div className={`text-sm font-mono ${robotState.sensors.lineRight ? "text-primary" : ""}`}>
                {robotState.sensors.lineRight ? "ON" : "OFF"}
              </div>
            </div>
          </div>

          {/* Motor Status */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Gauge className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Left Motor</span>
              </div>
              <div className="text-sm font-mono">{robotState.leftMotor}%</div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Gauge className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Right Motor</span>
              </div>
              <div className="text-sm font-mono">{robotState.rightMotor}%</div>
            </div>
          </div>

          {/* Position */}
          <div className="rounded-lg bg-secondary/50 p-2">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Position</span>
            </div>
            <div className="text-sm font-mono">
              X: {robotState.x.toFixed(0)} Y: {robotState.y.toFixed(0)} θ: {(robotState.angle * 180 / Math.PI).toFixed(0)}°
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



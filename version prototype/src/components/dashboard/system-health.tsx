'use client'

import { Card } from '@/components/ui/card'
import { Cpu, Thermometer, MemoryStick, HardDrive, Activity, Zap } from 'lucide-react'
import type { Telemetry } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SystemHealthProps {
  telemetry: Telemetry | null
}

function Meter({ label, value, suffix, color, icon: Icon }: {
  label: string
  value: number
  suffix: string
  color: string
  icon: React.ElementType
}) {
  const pct = Math.min(100, Math.max(0, value))
  const danger = pct > 85
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className={cn('text-xs font-mono tabular-nums font-semibold', danger ? 'text-rose-400' : color)}>
          {value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-700', danger ? 'bg-rose-500' : color.replace('text-', 'bg-'))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function SystemHealth({ telemetry }: SystemHealthProps) {
  const t = telemetry
  return (
    <Card className="p-4 bg-card/60 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">Raspberry Pi Health</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
          rpi-4b · 8gb
        </span>
      </div>

      <div className="space-y-3">
        <Meter
          label="CPU Temperature"
          value={t?.cpuTemp ?? 0}
          suffix="°C"
          color="text-emerald-400"
          icon={Thermometer}
        />
        <Meter
          label="CPU Load"
          value={t?.cpuLoad ?? 0}
          suffix="%"
          color="text-cyan-400"
          icon={Activity}
        />
        <Meter
          label="Memory Usage"
          value={t?.memoryUsage ?? 0}
          suffix="%"
          color="text-emerald-400"
          icon={MemoryStick}
        />
        <Meter
          label="Disk Usage"
          value={t?.diskUsage ?? 0}
          suffix="%"
          color="text-cyan-400"
          icon={HardDrive}
        />
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" /> Station Power
          </p>
          <p className="font-mono font-semibold tabular-nums mt-0.5">
            {(t?.stationPower ?? 0).toFixed(1)} <span className="text-muted-foreground text-[10px]">W</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Thermometer className="h-3 w-3" /> Battery Voltage
          </p>
          <p className="font-mono font-semibold tabular-nums mt-0.5">
            {(t?.batteryVoltage ?? 0).toFixed(2)} <span className="text-muted-foreground text-[10px]">V</span>
          </p>
        </div>
      </div>
    </Card>
  )
}

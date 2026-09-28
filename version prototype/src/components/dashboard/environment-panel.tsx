'use client'

import { Card } from '@/components/ui/card'
import { Thermometer, Droplets, Wind, Sun } from 'lucide-react'
import type { Telemetry } from '@/lib/types'
import { cn } from '@/lib/utils'

interface EnvironmentPanelProps {
  telemetry: Telemetry | null
}

function Gauge({ label, value, suffix, icon: Icon, color, hint }: {
  label: string
  value: number
  suffix: string
  icon: React.ElementType
  color: string
  hint?: string
}) {
  return (
    <Card className="p-3 bg-card/60 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Icon className={cn('h-3 w-3', color)} /> {label}
        </span>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', color)}>
        {value.toFixed(1)}
        <span className="text-xs text-muted-foreground font-normal ml-1">{suffix}</span>
      </p>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </Card>
  )
}

export function EnvironmentPanel({ telemetry }: EnvironmentPanelProps) {
  const t = telemetry
  return (
    <div className="grid grid-cols-2 gap-3">
      <Gauge
        label="Temperature"
        value={t?.temperature ?? 0}
        suffix="°C"
        icon={Thermometer}
        color="text-emerald-400"
        hint={t && t.temperature > 30 ? 'Hot - keep shaded' : t && t.temperature < 5 ? 'Cold - check battery' : 'Normal range'}
      />
      <Gauge
        label="Humidity"
        value={t?.humidity ?? 0}
        suffix="%"
        icon={Droplets}
        color="text-cyan-400"
        hint={t && t.humidity > 80 ? 'High humidity' : 'Comfortable'}
      />
      <Gauge
        label="Air Quality"
        value={t?.airQuality ?? 0}
        suffix="AQI"
        icon={Wind}
        color="text-emerald-400"
        hint={t && t.airQuality > 100 ? 'Poor - sensitive caution' : t && t.airQuality > 50 ? 'Moderate' : 'Good'}
      />
      <Gauge
        label="Solar Output"
        value={t?.solarPower ?? 0}
        suffix="W"
        icon={Sun}
        color="text-amber-400"
        hint={t && t.solarPower > 200 ? 'Peak production' : t && t.solarPower > 0 ? 'Active' : 'Inactive'}
      />
    </div>
  )
}

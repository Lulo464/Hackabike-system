'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bike as BikeIcon, BatteryCharging, Wrench, Zap, User, Gauge } from 'lucide-react'
import type { Bike } from '@/lib/types'
import { statusConfig } from '@/lib/types'
import { cn } from '@/lib/utils'

interface BikeGridProps {
  bikes: Bike[]
  onToggle: (bikeId: string) => void
  onToggleMaintenance: (bikeId: string) => void
}

function BatteryBar({ level }: { level: number }) {
  const color = level > 60 ? 'bg-emerald-500' : level > 25 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-500', color)}
          style={{ width: `${level}%` }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums w-8 text-right">{level}%</span>
    </div>
  )
}

export function BikeGrid({ bikes, onToggle, onToggleMaintenance }: BikeGridProps) {
  if (bikes.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">Loading bikes…</Card>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {bikes.map((bike) => {
        const cfg = statusConfig[bike.status]
        const isInUse = bike.status === 'in_use'
        const isMaintenance = bike.status === 'maintenance'
        return (
          <Card
            key={bike.bikeId}
            className={cn(
              'relative p-4 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:bg-card/80',
              cfg.border,
              cfg.glow,
              isInUse && 'animate-pulse-subtle'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn('p-2 rounded-lg', cfg.bg)}>
                  <BikeIcon className={cn('h-4 w-4', cfg.text)} />
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold">{bike.bikeId}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{cfg.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full pulse-dot', cfg.dot)} />
              </div>
            </div>

            {/* Battery */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <BatteryCharging className="h-3 w-3" /> Battery
                </span>
              </div>
              <BatteryBar level={bike.batteryLevel} />
            </div>

            {/* Live speed if in use */}
            {isInUse && bike.speed !== undefined && (
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Gauge className="h-3 w-3" /> Speed
                </span>
                <span className="font-mono tabular-nums text-amber-400 font-semibold">
                  {bike.speed.toFixed(1)} km/h
                </span>
              </div>
            )}

            {/* Last rider */}
            {bike.lastRider && (
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Rider
                </span>
                <span className="font-mono text-amber-300">{bike.lastRider}</span>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="rounded-md bg-muted/40 px-2 py-1.5">
                <p className="text-[9px] text-muted-foreground uppercase">Rides</p>
                <p className="font-mono font-semibold tabular-nums">{bike.totalRides}</p>
              </div>
              <div className="rounded-md bg-muted/40 px-2 py-1.5">
                <p className="text-[9px] text-muted-foreground uppercase">Distance</p>
                <p className="font-mono font-semibold tabular-nums">{bike.totalKm.toFixed(1)} km</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs flex-1"
                onClick={() => onToggle(bike.bikeId)}
                disabled={isMaintenance}
              >
                {isInUse ? 'Return' : 'Rent'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={cn('h-7 text-xs px-2', isMaintenance && 'text-orange-400')}
                onClick={() => onToggleMaintenance(bike.bikeId)}
                title="Toggle maintenance"
              >
                <Wrench className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

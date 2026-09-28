'use client'

import { Card } from '@/components/ui/card'
import { Trophy, Bike as BikeIcon, TrendingUp } from 'lucide-react'
import type { Stats } from '@/lib/types'
import { statusConfig } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TopBikesProps {
  stats: Stats | null
}

export function TopBikes({ stats }: TopBikesProps) {
  const top = stats?.topBikes ?? []
  const maxRides = top.length > 0 ? top[0].totalRides : 1

  return (
    <Card className="p-4 bg-card/60 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold">Top Bikes by Rides</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">All-time</span>
      </div>
      <ul className="space-y-2">
        {top.map((bike, i) => {
          const cfg = statusConfig[bike.status as keyof typeof statusConfig] ?? statusConfig.available
          return (
            <li key={bike.bikeId} className="flex items-center gap-3">
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold',
                i === 0 ? 'bg-amber-500/20 text-amber-300' : i === 1 ? 'bg-zinc-500/20 text-zinc-300' : i === 2 ? 'bg-orange-500/20 text-orange-300' : 'bg-muted text-muted-foreground'
              )}>
                {i + 1}
              </div>
              <BikeIcon className={cn('h-3.5 w-3.5', cfg.text)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono">{bike.bikeId}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {bike.totalRides} rides · {bike.totalKm.toFixed(0)} km
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400 transition-all duration-500"
                    style={{ width: `${(bike.totalRides / maxRides) * 100}%` }}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

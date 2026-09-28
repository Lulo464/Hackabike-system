'use client'

import { Bike, Battery, Zap, Wrench, TrendingUp, Activity as ActivityIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { Bike as BikeType } from '@/lib/types'
import { statusConfig } from '@/lib/types'
import { cn } from '@/lib/utils'

interface KpiCardsProps {
  bikes: BikeType[]
  totalRidesToday: number
  totalKm: number
}

export function KpiCards({ bikes, totalRidesToday, totalKm }: KpiCardsProps) {
  const available = bikes.filter((b) => b.status === 'available').length
  const inUse = bikes.filter((b) => b.status === 'in_use').length
  const charging = bikes.filter((b) => b.status === 'charging').length
  const maintenance = bikes.filter((b) => b.status === 'maintenance').length

  const cards = [
    {
      label: 'Available',
      value: available,
      suffix: `/ ${bikes.length || 8}`,
      icon: Bike,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      ring: 'border-emerald-500/30',
    },
    {
      label: 'In Use',
      value: inUse,
      suffix: 'bikes',
      icon: ActivityIcon,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      ring: 'border-amber-500/30',
    },
    {
      label: 'Charging',
      value: charging,
      suffix: 'bikes',
      icon: Battery,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      ring: 'border-cyan-500/30',
    },
    {
      label: 'Rides Today',
      value: totalRidesToday,
      suffix: 'rentals',
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      ring: 'border-emerald-500/30',
    },
    {
      label: 'Maintenance',
      value: maintenance,
      suffix: 'bikes',
      icon: Wrench,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      ring: 'border-orange-500/30',
    },
    {
      label: 'Total Distance',
      value: totalKm,
      suffix: 'km',
      icon: Zap,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      ring: 'border-cyan-500/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <Card
          key={c.label}
          className={cn('relative overflow-hidden p-4 bg-card/60 backdrop-blur-sm border', c.ring)}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {c.label}
              </p>
              <p className="text-2xl font-bold mt-1 tabular-nums">
                {c.value}
                <span className="text-xs text-muted-foreground ml-1 font-normal">{c.suffix}</span>
              </p>
            </div>
            <div className={cn('p-2 rounded-lg', c.bg)}>
              <c.icon className={cn('h-4 w-4', c.color)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

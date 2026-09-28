'use client'

import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bike, Wrench, BatteryCharging, AlertTriangle, Sun, CheckCircle2, Radio } from 'lucide-react'
import type { Activity } from '@/lib/types'
import { severityConfig } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface ActivityFeedProps {
  activities: Activity[]
  connected: boolean
}

const iconForType: Record<string, React.ElementType> = {
  rent: Bike,
  return: CheckCircle2,
  charge_start: BatteryCharging,
  charge_done: CheckCircle2,
  maintenance: Wrench,
  alert: AlertTriangle,
  system: Sun,
}

export function ActivityFeed({ activities, connected }: ActivityFeedProps) {
  return (
    <Card className="flex flex-col h-full p-0 bg-card/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">Live Activity</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full pulse-dot', connected ? 'bg-emerald-400' : 'bg-zinc-500')} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {connected ? 'Live' : 'Connecting'}
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1 max-h-[520px] min-h-[200px]">
        <div className="p-2">
          {activities.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-12">
              Waiting for events…
            </div>
          ) : (
            <ul className="space-y-1">
              {activities.map((a) => {
                const sev = severityConfig[a.severity] ?? severityConfig.info
                const Icon = iconForType[a.type] ?? Radio
                return (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <div className={cn('mt-0.5 rounded p-1 bg-muted/50', sev.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-tight">{a.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
                        {a.bikeId && <span className="ml-1 font-mono">· {a.bikeId}</span>}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}

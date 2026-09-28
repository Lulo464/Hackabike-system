'use client'

import { Card } from '@/components/ui/card'
import { Radio, MapPin, Clock, Cpu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  stationName: string
  location: string
  status: string
  connected: boolean
  uptime?: string
}

export function DashboardHeader({ stationName, location, status, connected, uptime }: DashboardHeaderProps) {
  const [now, setNow] = useState<string>('')
  useEffect(() => {
    const tick = () =>
      setNow(new Date().toLocaleTimeString('en-US', { hour12: false }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/30 blur-xl rounded-full" />
          <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17.5" r="3.5" />
              <circle cx="18.5" cy="17.5" r="3.5" />
              <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
            </svg>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">{stationName}</h1>
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium border',
              status === 'online'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full pulse-dot', status === 'online' ? 'bg-emerald-400' : 'bg-amber-400')} />
              {status === 'online' ? 'ONLINE' : 'MAINTENANCE'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" /> {location}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Card className="px-3 py-2 bg-card/60 backdrop-blur-sm flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-cyan-400" />
          <div className="text-xs">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Pi Status</p>
            <p className="font-mono font-semibold leading-tight">
              {connected ? 'Connected' : 'Offline'}
            </p>
          </div>
        </Card>
        <Card className="px-3 py-2 bg-card/60 backdrop-blur-sm flex items-center gap-2">
          <Radio className={cn('h-3.5 w-3.5', connected ? 'text-emerald-400' : 'text-zinc-500')} />
          <div className="text-xs">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Stream</p>
            <p className="font-mono font-semibold leading-tight">
              {connected ? 'Live' : 'Idle'}
            </p>
          </div>
        </Card>
        <Card className="px-3 py-2 bg-card/60 backdrop-blur-sm flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-emerald-400" />
          <div className="text-xs">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Local Time</p>
            <p className="font-mono font-semibold leading-tight tabular-nums">{now}</p>
          </div>
        </Card>
        {uptime && (
          <Card className="px-3 py-2 bg-card/60 backdrop-blur-sm flex items-center gap-2 hidden md:flex">
            <div className="text-xs">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">Uptime</p>
              <p className="font-mono font-semibold leading-tight">{uptime}</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

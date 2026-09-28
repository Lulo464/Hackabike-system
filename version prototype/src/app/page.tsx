'use client'

import { useEffect, useState } from 'react'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { BikeGrid } from '@/components/dashboard/bike-grid'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { SystemHealth } from '@/components/dashboard/system-health'
import { EnvironmentPanel } from '@/components/dashboard/environment-panel'
import { UsageCharts } from '@/components/dashboard/usage-charts'
import { TopBikes } from '@/components/dashboard/top-bikes'
import { useStationSocket } from '@/hooks/use-station-socket'
import type { Bike, Activity, Station, Stats } from '@/lib/types'

export default function Page() {
  const [station, setStation] = useState<Station | null>(null)
  const [initialBikes, setInitialBikes] = useState<Bike[]>([])
  const [initialActivities, setInitialActivities] = useState<Activity[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  // Initial data fetch
  useEffect(() => {
    Promise.all([
      fetch('/api/station').then((r) => r.json()),
      fetch('/api/bikes').then((r) => r.json()),
      fetch('/api/activities').then((r) => r.json()),
      fetch('/api/stats').then((r) => r.json()),
    ]).then(([s, b, a, st]) => {
      if (s && !s.error) setStation(s)
      if (Array.isArray(b)) setInitialBikes(b)
      if (Array.isArray(a)) setInitialActivities(a)
      if (st && !st.error) setStats(st)
    })
  }, [])

  const { connected, bikes, telemetry, activities, toggleBike, toggleMaintenance } = useStationSocket(initialBikes, initialActivities)

  // Compute rides-today as a derived value (no setState in effect)
  const ridesToday = (() => {
    const today = new Date().toDateString()
    return activities.filter((a) => a.type === 'rent' && new Date(a.timestamp).toDateString() === today).length
  })()

  const totalKm = bikes.reduce((s, b) => s + b.totalKm, 0)

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <DashboardHeader
            stationName={station?.name ?? 'EcoHub Central'}
            location={station?.location ?? 'Pi Square, Building A'}
            status={station?.status ?? 'online'}
            connected={connected}
            uptime={stats?.totals?.uptime}
          />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 py-4 space-y-4">
        {/* KPI Row */}
        <KpiCards bikes={bikes} totalRidesToday={ridesToday} totalKm={Math.round(totalKm)} />

        {/* Main grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Left + Center (bikes + charts) */}
          <div className="xl:col-span-2 space-y-4">
            {/* Bike grid */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
                  Bike Fleet
                  <span className="text-muted-foreground font-normal">· {bikes.length} units</span>
                </h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">3D-printed smart bikes</p>
              </div>
              <BikeGrid bikes={bikes} onToggle={toggleBike} onToggleMaintenance={toggleMaintenance} />
            </section>

            {/* Charts */}
            <UsageCharts stats={stats} />

            {/* Environment */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 pulse-dot" />
                  Environmental Sensors
                </h2>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">BMP280 · MQ-135 · INA219</p>
              </div>
              <EnvironmentPanel telemetry={telemetry} />
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <SystemHealth telemetry={telemetry} />
            <TopBikes stats={stats} />
            <div className="h-[480px] xl:h-auto xl:min-h-[480px] xl:flex-1">
              <ActivityFeed activities={activities} connected={connected} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border/50 pt-4 pb-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span>EcoHub Smart Bike Station · Powered by Raspberry Pi</span>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span>API: <span className={connected ? 'text-emerald-400' : 'text-zinc-500'}>{connected ? '200 OK' : '503'}</span></span>
            <span>WS: <span className={connected ? 'text-emerald-400' : 'text-zinc-500'}>{connected ? 'Connected' : 'Disconnected'}</span></span>
            <span>v1.0.0-hackathon</span>
          </div>
        </footer>
      </div>
    </main>
  )
}

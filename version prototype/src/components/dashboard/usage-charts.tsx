'use client'

import { Card } from '@/components/ui/card'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts'
import type { Stats } from '@/lib/types'

interface UsageChartsProps {
  stats: Stats | null
}

const hourLabels = Array.from({ length: 24 }, (_, h) => `${h.toString().padStart(2, '0')}:00`)

export function UsageCharts({ stats }: UsageChartsProps) {
  const hourlyData = (stats?.hourlyUsage ?? []).map((d) => ({
    hour: hourLabels[d.hour],
    rides: d.rides,
    label: `${d.hour}:00`,
  }))

  const energyData = (stats?.energy ?? []).slice(-24).map((e) => ({
    time: new Date(e.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    solar: Number(e.solar.toFixed(1)),
    consumption: Number(e.consumption.toFixed(1)),
    net: Number(e.net.toFixed(1)),
  }))

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      <Card className="p-4 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Hourly Bike Rentals</h3>
            <p className="text-[10px] text-muted-foreground">Distribution of rentals across the day</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
            <defs>
              <linearGradient id="ridesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.7 0.16 152)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="oklch(0.7 0.16 152)" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.015 165)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 9, fill: 'oklch(0.65 0.02 152)' }}
              tickLine={false}
              axisLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'oklch(0.65 0.02 152)' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'oklch(0.7 0.16 152 / 0.1)' }}
              contentStyle={{
                backgroundColor: 'oklch(0.17 0.018 165)',
                border: '1px solid oklch(0.28 0.015 165)',
                borderRadius: '0.5rem',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="rides" fill="url(#ridesGradient)" radius={[3, 3, 0, 0]} />
            <ReferenceLine x={hourLabels[8]} stroke="oklch(0.75 0.18 75 / 0.4)" strokeDasharray="4 4" label={{ value: 'AM peak', fill: 'oklch(0.75 0.18 75)', fontSize: 9, position: 'top' }} />
            <ReferenceLine x={hourLabels[18]} stroke="oklch(0.75 0.18 75 / 0.4)" strokeDasharray="4 4" label={{ value: 'PM peak', fill: 'oklch(0.75 0.18 75)', fontSize: 9, position: 'top' }} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Energy: Production vs Consumption</h3>
            <p className="text-[10px] text-muted-foreground">Solar generation vs station power draw (W)</p>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-400" /> Solar</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" /> Used</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={energyData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
            <defs>
              <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.75 0.18 75)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="oklch(0.75 0.18 75)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="consumptionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.7 0.16 152)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="oklch(0.7 0.16 152)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.015 165)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: 'oklch(0.65 0.02 152)' }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'oklch(0.65 0.02 152)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(0.17 0.018 165)',
                border: '1px solid oklch(0.28 0.015 165)',
                borderRadius: '0.5rem',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="solar"
              stroke="oklch(0.75 0.18 75)"
              strokeWidth={2}
              fill="url(#solarGrad)"
              name="Solar (W)"
            />
            <Area
              type="monotone"
              dataKey="consumption"
              stroke="oklch(0.7 0.16 152)"
              strokeWidth={2}
              fill="url(#consumptionGrad)"
              name="Used (W)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

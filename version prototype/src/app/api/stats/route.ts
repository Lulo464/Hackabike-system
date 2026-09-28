import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Aggregate stats: usage by hour, total rides, popular bikes, etc.
export async function GET() {
  const station = await db.station.findFirst()
  if (!station) return NextResponse.json({ error: 'no station' }, { status: 404 })

  const bikes = await db.bike.findMany({ orderBy: { totalRides: 'desc' } })
  const activities = await db.activity.findMany({
    where: { stationId: station.id },
    orderBy: { timestamp: 'asc' },
  })
  const telemetry = await db.telemetry.findMany({
    where: { stationId: station.id },
    orderBy: { timestamp: 'asc' },
  })

  // Rides per hour of day (across all history)
  const hourlyUsage = Array.from({ length: 24 }, (_, h) => ({ hour: h, rides: 0 }))
  for (const a of activities) {
    if (a.type === 'rent') {
      hourlyUsage[a.timestamp.getHours()].rides++
    }
  }

  // Top bikes by total rides
  const topBikes = bikes
    .map((b) => ({ bikeId: b.bikeId, totalRides: b.totalRides, totalKm: b.totalKm, status: b.status }))
    .slice(0, 5)

  // Energy produced vs consumed (last 24h from telemetry)
  const energy = telemetry.map((t) => ({
    timestamp: t.timestamp,
    solar: t.solarPower,
    consumption: t.stationPower,
    net: t.solarPower - t.stationPower,
  }))

  // Cumulative totals
  const totalRides = bikes.reduce((sum, b) => sum + b.totalRides, 0)
  const totalKm = bikes.reduce((sum, b) => sum + b.totalKm, 0)
  const totalEnergyProduced = telemetry.reduce((sum, t) => sum + t.solarPower, 0)
  const avgCpuTemp = telemetry.length > 0
    ? telemetry.reduce((s, t) => s + t.cpuTemp, 0) / telemetry.length
    : 0

  return NextResponse.json({
    hourlyUsage,
    topBikes,
    energy,
    totals: {
      totalRides,
      totalKm: Math.round(totalKm * 10) / 10,
      totalEnergyProduced: Math.round(totalEnergyProduced),
      avgCpuTemp: Math.round(avgCpuTemp * 10) / 10,
      uptime: '4d 12h 36m',
    },
  })
}

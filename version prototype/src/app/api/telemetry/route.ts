import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const station = await db.station.findFirst()
  if (!station) return NextResponse.json([])
  const telemetry = await db.telemetry.findMany({
    where: { stationId: station.id },
    orderBy: { timestamp: 'asc' },
    take: 48,
  })
  return NextResponse.json(telemetry)
}

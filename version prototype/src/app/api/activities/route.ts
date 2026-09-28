import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const station = await db.station.findFirst()
  if (!station) return NextResponse.json([])
  const activities = await db.activity.findMany({
    where: { stationId: station.id },
    orderBy: { timestamp: 'desc' },
    take: 30,
  })
  return NextResponse.json(activities)
}

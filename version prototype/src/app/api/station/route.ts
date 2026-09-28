import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const station = await db.station.findFirst({
    include: { _count: { select: { bikes: true, activities: true } } },
  })
  if (!station) return NextResponse.json({ error: 'No station' }, { status: 404 })
  return NextResponse.json(station)
}

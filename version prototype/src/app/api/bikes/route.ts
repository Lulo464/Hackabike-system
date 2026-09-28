import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const bikes = await db.bike.findMany({
    orderBy: { bikeId: 'asc' },
  })
  return NextResponse.json(bikes)
}

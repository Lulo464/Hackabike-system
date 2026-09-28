// Seed the smart bike station with realistic initial data
import { db } from '../src/lib/db'

const BIKE_COUNT = 8

async function main() {
  console.log('🌱 Seeding smart bike station...')

  // Clean up existing data
  await db.activity.deleteMany()
  await db.telemetry.deleteMany()
  await db.bike.deleteMany()
  await db.station.deleteMany()

  // Create station
  const station = await db.station.create({
    data: {
      name: 'EcoHub Central',
      location: 'Pi Square, Building A',
      status: 'online',
      capacity: BIKE_COUNT,
    },
  })
  console.log(`✓ Created station: ${station.name}`)

  // Create bikes with varied statuses
  const statuses: string[] = ['available', 'available', 'in_use', 'available', 'charging', 'in_use', 'available', 'maintenance']
  const bikes = []
  for (let i = 0; i < BIKE_COUNT; i++) {
    const bike = await db.bike.create({
      data: {
        bikeId: `BK-${String(i + 1).padStart(3, '0')}`,
        stationId: station.id,
        status: statuses[i],
        batteryLevel: statuses[i] === 'charging'
          ? 30 + Math.floor(Math.random() * 30)
          : 60 + Math.floor(Math.random() * 40),
        totalRides: Math.floor(Math.random() * 320) + 20,
        totalKm: Math.round((Math.random() * 480 + 30) * 10) / 10,
        lastRider: statuses[i] === 'in_use' ? `User_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}` : null,
        lastRideEnd: statuses[i] === 'in_use' ? null : new Date(Date.now() - Math.random() * 86400000 * 3),
      },
    })
    bikes.push(bike)
  }
  console.log(`✓ Created ${bikes.length} bikes`)

  // Generate 24h of historical telemetry (one record per 30 min)
  const now = Date.now()
  for (let i = 0; i < 48; i++) {
    const ts = new Date(now - (47 - i) * 30 * 60 * 1000)
    const hour = ts.getHours()
    const isDaytime = hour >= 6 && hour <= 19
    const temp = isDaytime ? 18 + Math.sin((hour - 6) / 13 * Math.PI) * 8 + Math.random() * 2 : 12 + Math.random() * 3
    const solar = isDaytime ? Math.max(0, Math.sin((hour - 6) / 13 * Math.PI) * 320 + Math.random() * 30 - 10) : 0
    const peakHours = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)
    const inUse = peakHours ? Math.floor(Math.random() * 3) + 3 : Math.floor(Math.random() * 2)
    await db.telemetry.create({
      data: {
        stationId: station.id,
        timestamp: ts,
        temperature: Math.round(temp * 10) / 10,
        humidity: Math.round(45 + Math.random() * 25),
        airQuality: Math.round(40 + Math.random() * 40),
        solarPower: Math.round(solar * 10) / 10,
        batteryVoltage: Math.round((11.8 + Math.random() * 1.2) * 100) / 100,
        stationPower: Math.round((20 + Math.random() * 40 + (solar > 0 ? 0 : 15)) * 10) / 10,
        cpuTemp: Math.round((42 + Math.random() * 18) * 10) / 10,
        cpuLoad: Math.round((15 + Math.random() * 35) * 10) / 10,
        memoryUsage: Math.round((28 + Math.random() * 18) * 10) / 10,
        diskUsage: Math.round((34 + Math.random() * 6) * 10) / 10,
        availableBikes: BIKE_COUNT - inUse,
        inUseBikes: inUse,
      },
    })
  }
  console.log(`✓ Created 48 telemetry records (24h history)`)

  // Generate activity log
  const activityTypes = [
    { type: 'rent', severity: 'info', msg: (id: string) => `Bike ${id} rented by User_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}` },
    { type: 'return', severity: 'success', msg: (id: string) => `Bike ${id} returned, battery at ${60 + Math.floor(Math.random() * 35)}%` },
    { type: 'charge_start', severity: 'info', msg: (id: string) => `Bike ${id} docked, charging started` },
    { type: 'charge_done', severity: 'success', msg: (id: string) => `Bike ${id} fully charged (100%)` },
    { type: 'alert', severity: 'warning', msg: (id: string) => `Bike ${id} low battery (15%), return for charging` },
    { type: 'system', severity: 'info', msg: () => `Solar panel output peaked at ${Math.floor(Math.random() * 60 + 280)}W` },
  ]
  for (let i = 0; i < 24; i++) {
    const a = activityTypes[Math.floor(Math.random() * activityTypes.length)]
    const bikeId = `BK-${String(Math.floor(Math.random() * BIKE_COUNT) + 1).padStart(3, '0')}`
    await db.activity.create({
      data: {
        stationId: station.id,
        timestamp: new Date(now - i * 15 * 60 * 1000),
        type: a.type,
        bikeId,
        message: a.msg(bikeId),
        severity: a.severity,
      },
    })
  }
  console.log(`✓ Created 24 activity records`)

  console.log('\n🎉 Seed complete!')
  console.log(`   Station: ${station.id}`)
  console.log(`   Bikes: ${bikes.length}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

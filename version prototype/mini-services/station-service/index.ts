// Smart Bike Station - Real-time WebSocket service
// Streams live telemetry + activity events to the dashboard
import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------------------------------------------------------------------------
// Simulated station state (in a real deployment this would come from your
// Raspberry Pi sensors: BMP280 temp/humidity, INA219 power, ADC battery levels,
// reed switches on bike docks, etc.)
// ---------------------------------------------------------------------------
const STATION_NAME = 'EcoHub Central'
const STATION_LOCATION = 'Pi Square, Building A'
const BIKE_COUNT = 8

type BikeStatus = 'available' | 'in_use' | 'charging' | 'maintenance' | 'offline'

interface Bike {
  bikeId: string
  status: BikeStatus
  batteryLevel: number
  totalRides: number
  totalKm: number
  lastRider: string | null
  speed: number // km/h (if in_use)
  docked: boolean
}

const initialStatuses: BikeStatus[] = ['available', 'available', 'in_use', 'available', 'charging', 'in_use', 'available', 'maintenance']

const bikes: Bike[] = Array.from({ length: BIKE_COUNT }, (_, i) => ({
  bikeId: `BK-${String(i + 1).padStart(3, '0')}`,
  status: initialStatuses[i],
  batteryLevel: initialStatuses[i] === 'charging' ? 30 + Math.floor(Math.random() * 30) : 60 + Math.floor(Math.random() * 40),
  totalRides: Math.floor(Math.random() * 320) + 20,
  totalKm: Math.round((Math.random() * 480 + 30) * 10) / 10,
  lastRider: initialStatuses[i] === 'in_use' ? `User_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}` : null,
  speed: initialStatuses[i] === 'in_use' ? Math.round(Math.random() * 20 + 8) : 0,
  docked: initialStatuses[i] !== 'in_use',
}))

interface Telemetry {
  temperature: number
  humidity: number
  airQuality: number
  solarPower: number
  batteryVoltage: number
  stationPower: number
  cpuTemp: number
  cpuLoad: number
  memoryUsage: number
  diskUsage: number
  availableBikes: number
  inUseBikes: number
}

function generateTelemetry(): Telemetry {
  const hour = new Date().getHours()
  const isDaytime = hour >= 6 && hour <= 19
  const peakHours = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)
  const inUse = bikes.filter((b) => b.status === 'in_use').length

  const temp = isDaytime
    ? 18 + Math.sin((hour - 6) / 13 * Math.PI) * 8 + (Math.random() - 0.5) * 2
    : 11 + Math.random() * 3

  const solar = isDaytime
    ? Math.max(0, Math.sin((hour - 6) / 13 * Math.PI) * 320 + (Math.random() - 0.5) * 40)
    : 0

  return {
    temperature: Math.round(temp * 10) / 10,
    humidity: Math.round((45 + Math.random() * 25) * 10) / 10,
    airQuality: Math.round(40 + Math.random() * 40),
    solarPower: Math.round(solar * 10) / 10,
    batteryVoltage: Math.round((11.8 + Math.random() * 1.2) * 100) / 100,
    stationPower: Math.round((20 + Math.random() * 40 + (solar > 0 ? -10 : 15) + inUse * 4) * 10) / 10,
    cpuTemp: Math.round((42 + Math.random() * 18 + inUse * 2) * 10) / 10,
    cpuLoad: Math.round((15 + Math.random() * 35 + inUse * 5) * 10) / 10,
    memoryUsage: Math.round((28 + Math.random() * 18) * 10) / 10,
    diskUsage: Math.round((34 + Math.random() * 6) * 10) / 10,
    availableBikes: bikes.filter((b) => b.status === 'available').length,
    inUseBikes: inUse,
  }
}

// ---------------------------------------------------------------------------
// Simulation loop: battery drain while in use, charging when docked, random
// rents / returns / alerts. This keeps the dashboard feeling alive.
// ---------------------------------------------------------------------------
const activityMessages: Array<{ type: string; severity: string; build: () => { msg: string; bikeId: string } }> = [
  { type: 'rent', severity: 'info', build: () => {
    const candidates = bikes.filter((b) => b.status === 'available')
    if (candidates.length === 0) return { msg: '', bikeId: '' }
    const b = candidates[Math.floor(Math.random() * candidates.length)]
    b.status = 'in_use'
    b.docked = false
    b.lastRider = `User_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
    b.speed = Math.round(Math.random() * 20 + 8)
    return { msg: `Bike ${b.bikeId} rented by ${b.lastRider}`, bikeId: b.bikeId }
  } },
  { type: 'return', severity: 'success', build: () => {
    const candidates = bikes.filter((b) => b.status === 'in_use')
    if (candidates.length === 0) return { msg: '', bikeId: '' }
    const b = candidates[Math.floor(Math.random() * candidates.length)]
    b.status = b.batteryLevel < 30 ? 'charging' : 'available'
    b.docked = true
    b.speed = 0
    const rider = b.lastRider
    b.lastRider = null
    b.totalRides += 1
    b.totalKm = Math.round((b.totalKm + Math.random() * 8) * 10) / 10
    return { msg: `Bike ${b.bikeId} returned by ${rider}, battery at ${b.batteryLevel}%`, bikeId: b.bikeId }
  } },
  { type: 'charge_done', severity: 'success', build: () => {
    const candidates = bikes.filter((b) => b.status === 'charging' && b.batteryLevel >= 99)
    if (candidates.length === 0) return { msg: '', bikeId: '' }
    const b = candidates[Math.floor(Math.random() * candidates.length)]
    b.status = 'available'
    b.batteryLevel = 100
    return { msg: `Bike ${b.bikeId} fully charged (100%)`, bikeId: b.bikeId }
  } },
  { type: 'alert', severity: 'warning', build: () => {
    const candidates = bikes.filter((b) => b.status === 'in_use' && b.batteryLevel < 25)
    if (candidates.length === 0) return { msg: '', bikeId: '' }
    const b = candidates[Math.floor(Math.random() * candidates.length)]
    return { msg: `Bike ${b.bikeId} low battery (${b.batteryLevel}%), return for charging`, bikeId: b.bikeId }
  } },
  { type: 'system', severity: 'info', build: () => ({
    msg: `Solar panel output at ${Math.floor(Math.random() * 60 + 280)}W`, bikeId: '',
  }) },
]

function tickBikes() {
  for (const b of bikes) {
    if (b.status === 'in_use') {
      b.batteryLevel = Math.max(5, b.batteryLevel - Math.random() * 0.4)
      b.speed = Math.max(0, b.speed + (Math.random() - 0.5) * 6)
      b.totalKm = Math.round((b.totalKm + 0.02) * 100) / 100
    } else if (b.status === 'charging') {
      b.batteryLevel = Math.min(100, b.batteryLevel + Math.random() * 1.2)
    }
    b.batteryLevel = Math.round(b.batteryLevel)
  }
}

function emitActivity() {
  // 60% chance of an activity event each cycle
  if (Math.random() > 0.6) return
  const picker = activityMessages[Math.floor(Math.random() * activityMessages.length)]
  const result = picker.build()
  if (!result.msg) return
  const event = {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    type: picker.type,
    severity: picker.severity,
    bikeId: result.bikeId || null,
    message: result.msg,
  }
  io.emit('activity', event)
  // console.log(`[activity] ${event.message}`)
}

// ---------------------------------------------------------------------------
// Socket.io connection handling
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id}`)
  socket.emit('station:hello', {
    station: { name: STATION_NAME, location: STATION_LOCATION },
    timestamp: new Date().toISOString(),
  })
  // Send current state immediately so dashboard renders without waiting for next tick
  socket.emit('bikes:sync', bikes)
  socket.emit('telemetry:update', generateTelemetry())

  socket.on('bike:toggle', ({ bikeId }: { bikeId: string }) => {
    const b = bikes.find((x) => x.bikeId === bikeId)
    if (!b) return
    if (b.status === 'available') {
      b.status = 'in_use'
      b.docked = false
      b.lastRider = `User_${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`
      b.speed = Math.round(Math.random() * 20 + 8)
      io.emit('activity', {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        type: 'rent',
        severity: 'info',
        bikeId,
        message: `Bike ${bikeId} manually rented via dashboard`,
      })
    } else if (b.status === 'in_use') {
      b.status = b.batteryLevel < 30 ? 'charging' : 'available'
      b.docked = true
      b.speed = 0
      b.totalRides += 1
      b.lastRider = null
      io.emit('activity', {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        type: 'return',
        severity: 'success',
        bikeId,
        message: `Bike ${bikeId} manually returned via dashboard`,
      })
    }
    io.emit('bikes:sync', bikes)
  })

  socket.on('bike:maintenance', ({ bikeId }: { bikeId: string }) => {
    const b = bikes.find((x) => x.bikeId === bikeId)
    if (!b) return
    b.status = b.status === 'maintenance' ? 'available' : 'maintenance'
    b.docked = true
    b.speed = 0
    io.emit('bikes:sync', bikes)
    io.emit('activity', {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      type: 'maintenance',
      severity: b.status === 'maintenance' ? 'warning' : 'info',
      bikeId,
      message: b.status === 'maintenance'
        ? `Bike ${bikeId} flagged for maintenance`
        : `Bike ${bikeId} maintenance cleared`,
    })
  })

  socket.on('disconnect', () => {
    console.log(`[socket] client disconnected: ${socket.id}`)
  })
})

// ---------------------------------------------------------------------------
// Broadcast loops
// ---------------------------------------------------------------------------
setInterval(() => {
  tickBikes()
  io.emit('bikes:update', bikes)
}, 2000)

setInterval(() => {
  io.emit('telemetry:update', generateTelemetry())
}, 2500)

setInterval(() => {
  emitActivity()
}, 8000)

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`🚲 Smart Bike Station service running on port ${PORT}`)
  console.log(`   ${STATION_NAME} · ${STATION_LOCATION}`)
})

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...')
  httpServer.close(() => process.exit(0))
})

// Shared types for the smart bike station dashboard
export type BikeStatus = 'available' | 'in_use' | 'charging' | 'maintenance' | 'offline'

export interface Bike {
  id?: string
  bikeId: string
  status: BikeStatus
  batteryLevel: number
  totalRides: number
  totalKm: number
  lastRider: string | null
  lastRideEnd?: string | null
  speed?: number
  docked?: boolean
}

export interface Telemetry {
  id?: string
  timestamp?: string
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

export interface Activity {
  id: string
  timestamp: string
  type: string
  severity: 'info' | 'success' | 'warning' | 'critical'
  bikeId?: string | null
  message: string
}

export interface Station {
  id: string
  name: string
  location: string
  status: string
  capacity: number
}

export interface Stats {
  hourlyUsage: Array<{ hour: number; rides: number }>
  topBikes: Array<{ bikeId: string; totalRides: number; totalKm: number; status: string }>
  energy: Array<{ timestamp: string; solar: number; consumption: number; net: number }>
  totals: {
    totalRides: number
    totalKm: number
    totalEnergyProduced: number
    avgCpuTemp: number
    uptime: string
  }
}

export const statusConfig: Record<BikeStatus, { label: string; color: string; bg: string; border: string; text: string; dot: string; glow?: string }> = {
  available: { label: 'Available', color: 'emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400', glow: 'glow-emerald' },
  in_use: { label: 'In Use', color: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400', glow: 'glow-amber' },
  charging: { label: 'Charging', color: 'cyan', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-400', glow: 'glow-cyan' },
  maintenance: { label: 'Maintenance', color: 'orange', bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
  offline: { label: 'Offline', color: 'zinc', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', text: 'text-zinc-400', dot: 'bg-zinc-400' },
}

export const severityConfig: Record<string, { label: string; color: string; dot: string }> = {
  info: { label: 'Info', color: 'text-sky-400', dot: 'bg-sky-400' },
  success: { label: 'Success', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  warning: { label: 'Warning', color: 'text-amber-400', dot: 'bg-amber-400' },
  critical: { label: 'Critical', color: 'text-rose-400', dot: 'bg-rose-400' },
}

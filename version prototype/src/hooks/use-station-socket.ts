'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { Bike, Telemetry, Activity } from '@/lib/types'

interface UseStationSocket {
  connected: boolean
  bikes: Bike[]
  telemetry: Telemetry | null
  activities: Activity[]
  toggleBike: (bikeId: string) => void
  toggleMaintenance: (bikeId: string) => void
}

const MAX_ACTIVITIES = 50

export function useStationSocket(initialBikes: Bike[] = [], initialActivities: Activity[] = []): UseStationSocket {
  const [connected, setConnected] = useState(false)
  // WebSocket-driven state. When null, fall back to the SSR/API-loaded initial values.
  const [wsBikes, setWsBikes] = useState<Bike[] | null>(null)
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [wsActivities, setWsActivities] = useState<Activity[] | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io('/?XTransformPort=3003', {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      forceNew: true,
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => {
      // Silently retry - reconnection is handled by socket.io
    })
    socket.on('reconnect', () => setConnected(true))

    socket.on('bikes:update', (data: Bike[]) => setWsBikes(data))
    socket.on('bikes:sync', (data: Bike[]) => setWsBikes(data))
    socket.on('telemetry:update', (data: Telemetry) => setTelemetry(data))
    socket.on('activity', (data: Activity) => {
      setWsActivities((prev) => {
        const next = [data, ...(prev ?? initialActivities)].slice(0, MAX_ACTIVITIES)
        return next
      })
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  // Derive the user-facing values: prefer WS data, fall back to initial data from API.
  const bikes = wsBikes ?? initialBikes
  const activities = wsActivities ?? initialActivities

  const toggleBike = useCallback((bikeId: string) => {
    socketRef.current?.emit('bike:toggle', { bikeId })
  }, [])

  const toggleMaintenance = useCallback((bikeId: string) => {
    socketRef.current?.emit('bike:maintenance', { bikeId })
  }, [])

  return { connected, bikes, telemetry, activities, toggleBike, toggleMaintenance }
}

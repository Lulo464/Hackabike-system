#!/bin/bash
# Start the smart bike station WebSocket service as a properly detached daemon
# This script does double-fork to fully detach from the parent shell

cd /home/z/my-project/mini-services/station-service

LOG_FILE=/home/z/my-project/station-service.log
PID_FILE=/home/z/my-project/station-service.pid

# Kill any existing instance
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing service (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null
    sleep 1
    kill -9 "$OLD_PID" 2>/dev/null
  fi
  rm -f "$PID_FILE"
fi

# Double-fork to fully detach
(
  # First child
  (
    # Second child - actual daemon
    exec bun index.ts >> "$LOG_FILE" 2>&1
  ) &
  echo $! > "$PID_FILE"
  exit 0
) &

# Wait a moment for the daemon to start
sleep 2

# Verify it's running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "✓ Station service started (PID $PID)"
  else
    echo "✗ Station service failed to start"
    tail -10 "$LOG_FILE"
    exit 1
  fi
else
  echo "✗ PID file not created"
  exit 1
fi

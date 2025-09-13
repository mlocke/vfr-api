import { NextRequest } from 'next/server'
import { mcpClient } from '../../../services/mcp/MCPClient'

interface WebSocketMessage {
  type: 'stocks_update' | 'sector_change' | 'error' | 'heartbeat'
  sector?: string
  symbols?: any[]
  error?: string
  timestamp: number
}

interface ClientConnection {
  id: string
  sector?: string
  lastUpdate: number
  send: (data: WebSocketMessage) => void
}

// Store active WebSocket connections
const clients = new Map<string, ClientConnection>()

// Update intervals and cache
const UPDATE_INTERVAL = 30000 // 30 seconds
const HEARTBEAT_INTERVAL = 10000 // 10 seconds
let updateTimer: NodeJS.Timeout | null = null
let heartbeatTimer: NodeJS.Timeout | null = null

// Cache for stock data
const stockCache = new Map<string, { data: any[], timestamp: number }>()
const CACHE_DURATION = 25000 // 25 seconds (refresh before 30s update)

/**
 * WebSocket upgrade handler for real-time stock data
 */
export async function GET(request: NextRequest) {
  // Check if this is a WebSocket upgrade request
  const upgrade = request.headers.get('upgrade')
  if (upgrade !== 'websocket') {
    return new Response('WebSocket upgrade required', { status: 426 })
  }

  try {
    // In a real implementation, we'd handle WebSocket upgrade here
    // For Next.js, we'll return instructions for client-side connection
    return new Response(JSON.stringify({
      message: 'WebSocket endpoint available',
      endpoint: '/api/ws/stocks',
      protocol: 'ws',
      usage: {
        connect: 'ws://localhost:3000/api/ws/stocks',
        messages: {
          subscribe: { type: 'subscribe', sector: 'technology' },
          unsubscribe: { type: 'unsubscribe' },
          heartbeat: { type: 'ping' }
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ WebSocket initialization error:', error)
    return new Response('WebSocket initialization failed', { status: 500 })
  }
}

/**
 * POST endpoint for WebSocket control messages
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, clientId, message } = body
    
    switch (action) {
      case 'connect':
        console.log(`📡 Client ${clientId} connected`)
        return new Response(JSON.stringify({ success: true, message: 'Connected' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'disconnect':
        handleClientDisconnect(clientId)
        return new Response(JSON.stringify({ success: true, message: 'Disconnected' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      case 'message':
        // Handle WebSocket-style messages via POST
        await handleWebSocketMessage(clientId, message)
        return new Response(JSON.stringify({ success: true, message: 'Message processed' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      default:
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
    
  } catch (error) {
    console.error('❌ WebSocket POST handler error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle WebSocket messages (internal function)
 */
async function handleWebSocketMessage(clientId: string, message: any) {
  try {
    const client: ClientConnection = {
      id: clientId,
      sector: message.sector,
      lastUpdate: 0,
      send: (data: WebSocketMessage) => {
        // In a real WebSocket implementation, this would send to the client
        console.log(`📡 Sending to client ${clientId}:`, data.type)
      }
    }

    clients.set(clientId, client)

    switch (message.type) {
      case 'subscribe':
        if (message.sector) {
          client.sector = message.sector
          console.log(`📡 Client ${clientId} subscribed to ${message.sector}`)
          
          // Send immediate data
          await sendStockUpdate(client)
          
          // Start update timers if not already running
          startUpdateTimers()
        }
        break

      case 'unsubscribe':
        client.sector = undefined
        console.log(`📡 Client ${clientId} unsubscribed`)
        break

      case 'ping':
        client.send({
          type: 'heartbeat',
          timestamp: Date.now()
        })
        break

      default:
        client.send({
          type: 'error',
          error: 'Unknown message type',
          timestamp: Date.now()
        })
    }

  } catch (error) {
    console.error(`❌ WebSocket message handling error for client ${clientId}:`, error)
  }
}

/**
 * Handle client disconnection (internal function)
 */
function handleClientDisconnect(clientId: string) {
  clients.delete(clientId)
  console.log(`📡 Client ${clientId} disconnected`)
  
  // Stop timers if no clients connected
  if (clients.size === 0) {
    stopUpdateTimers()
  }
}

/**
 * Send stock data update to a specific client
 */
async function sendStockUpdate(client: ClientConnection) {
  if (!client.sector) return

  try {
    // Check cache first
    const cacheKey = `ws-${client.sector}`
    const cached = stockCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      client.send({
        type: 'stocks_update',
        sector: client.sector,
        symbols: cached.data,
        timestamp: cached.timestamp
      })
      return
    }

    // Fetch fresh data using MCP
    const response = await fetch(`http://localhost:3000/api/stocks/by-sector?sector=${client.sector}`)
    const data = await response.json()

    if (data.success && data.symbols) {
      // Cache the result
      stockCache.set(cacheKey, {
        data: data.symbols,
        timestamp: Date.now()
      })

      client.send({
        type: 'stocks_update',
        sector: client.sector,
        symbols: data.symbols,
        timestamp: Date.now()
      })
      
      client.lastUpdate = Date.now()
      console.log(`📊 Sent stock update to client ${client.id} for ${client.sector}`)
    }

  } catch (error) {
    console.error(`❌ Failed to send stock update to client ${client.id}:`, error)
    client.send({
      type: 'error',
      error: 'Failed to fetch stock data',
      timestamp: Date.now()
    })
  }
}

/**
 * Broadcast updates to all connected clients
 */
async function broadcastUpdates() {
  console.log(`📡 Broadcasting updates to ${clients.size} connected clients`)
  
  const updatePromises = Array.from(clients.values()).map(client => 
    sendStockUpdate(client).catch(error => 
      console.error(`❌ Failed to update client ${client.id}:`, error)
    )
  )
  
  await Promise.all(updatePromises)
}

/**
 * Send heartbeat to all clients
 */
function sendHeartbeat() {
  const heartbeatMessage: WebSocketMessage = {
    type: 'heartbeat',
    timestamp: Date.now()
  }
  
  clients.forEach(client => {
    try {
      client.send(heartbeatMessage)
    } catch (error) {
      console.error(`❌ Failed to send heartbeat to client ${client.id}:`, error)
    }
  })
}

/**
 * Start update and heartbeat timers
 */
function startUpdateTimers() {
  if (updateTimer) return // Already running

  console.log('🕐 Starting WebSocket update timers (30s updates, 10s heartbeat)')
  
  // Stock data updates every 30 seconds
  updateTimer = setInterval(broadcastUpdates, UPDATE_INTERVAL)
  
  // Heartbeat every 10 seconds
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)
}

/**
 * Stop update and heartbeat timers
 */
function stopUpdateTimers() {
  console.log('🛑 Stopping WebSocket update timers')
  
  if (updateTimer) {
    clearInterval(updateTimer)
    updateTimer = null
  }
  
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

/**
 * Get WebSocket server statistics
 */
function getWebSocketStats() {
  const sectors = new Map<string, number>()
  
  clients.forEach(client => {
    if (client.sector) {
      sectors.set(client.sector, (sectors.get(client.sector) || 0) + 1)
    }
  })
  
  return {
    totalClients: clients.size,
    sectorSubscriptions: Object.fromEntries(sectors),
    updateInterval: UPDATE_INTERVAL,
    heartbeatInterval: HEARTBEAT_INTERVAL,
    cacheSize: stockCache.size,
    uptime: process.uptime()
  }
}
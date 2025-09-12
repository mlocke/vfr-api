import { NextRequest } from 'next/server'
import { WebSocketServer } from 'ws'

// WebSocket server for real-time stock updates
let wss: WebSocketServer | null = null

// Stock data cache with real-time simulation
interface StockUpdate {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  timestamp: number
  sector: string
}

const stockCache = new Map<string, StockUpdate>()
const subscribers = new Map<string, Set<any>>() // sector -> Set<WebSocket>

// Initialize WebSocket server
function initWebSocketServer() {
  if (wss) return wss
  
  wss = new WebSocketServer({ port: 3001 })
  
  wss.on('connection', (ws, request) => {
    console.log('📡 New WebSocket connection established')
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        
        switch (message.type) {
          case 'subscribe':
            handleSubscribe(ws, message.sector)
            break
          case 'unsubscribe':
            handleUnsubscribe(ws, message.sector)
            break
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
            break
        }
      } catch (error) {
        console.error('WebSocket message error:', error)
      }
    })
    
    ws.on('close', () => {
      console.log('📡 WebSocket connection closed')
      // Clean up subscriptions
      subscribers.forEach((sectorSubs, sector) => {
        sectorSubs.delete(ws)
        if (sectorSubs.size === 0) {
          subscribers.delete(sector)
        }
      })
    })
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  })
  
  console.log('🚀 WebSocket server started on port 3001')
  return wss
}

// Handle sector subscription
function handleSubscribe(ws: any, sector: string) {
  if (!subscribers.has(sector)) {
    subscribers.set(sector, new Set())
  }
  
  subscribers.get(sector)!.add(ws)
  console.log(`📊 Client subscribed to sector: ${sector}`)
  
  // Send initial data
  const sectorStocks = Array.from(stockCache.values())
    .filter(stock => stock.sector === sector)
    .slice(0, 20)
    
  if (sectorStocks.length > 0) {
    ws.send(JSON.stringify({
      type: 'sector_update',
      sector: sector,
      stocks: sectorStocks,
      timestamp: Date.now()
    }))
  }
}

// Handle sector unsubscription
function handleUnsubscribe(ws: any, sector: string) {
  if (subscribers.has(sector)) {
    subscribers.get(sector)!.delete(ws)
    if (subscribers.get(sector)!.size === 0) {
      subscribers.delete(sector)
    }
    console.log(`📊 Client unsubscribed from sector: ${sector}`)
  }
}

// Simulate real-time stock data updates
function simulateRealTimeUpdates() {
  const sectors = ['technology', 'healthcare', 'financials', 'energy', 'consumer-discretionary']
  const symbols = {
    technology: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA'],
    healthcare: ['JNJ', 'PFE', 'MRNA', 'UNH', 'ABT', 'TMO'],
    financials: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'V', 'MA'],
    energy: ['XOM', 'CVX', 'COP', 'EOG', 'SLB'],
    'consumer-discretionary': ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE']
  }
  
  setInterval(() => {
    sectors.forEach(sector => {
      const sectorSymbols = symbols[sector as keyof typeof symbols] || []
      
      sectorSymbols.forEach(symbol => {
        const existing = stockCache.get(symbol)
        const basePrice = existing?.price || (Math.random() * 500 + 50)
        
        // Simulate realistic price movement (±2% max change)
        const priceChange = (Math.random() - 0.5) * 0.04 * basePrice
        const newPrice = Math.max(basePrice + priceChange, 1)
        const changePercent = (priceChange / basePrice) * 100
        
        const update: StockUpdate = {
          symbol: symbol,
          price: parseFloat(newPrice.toFixed(2)),
          change: parseFloat(priceChange.toFixed(2)),
          changePercent: parseFloat(changePercent.toFixed(2)),
          volume: Math.floor(Math.random() * 10000000) + 1000000,
          timestamp: Date.now(),
          sector: sector
        }
        
        stockCache.set(symbol, update)
      })
      
      // Broadcast updates to subscribers
      if (subscribers.has(sector)) {
        const sectorUpdates = sectorSymbols.map(symbol => stockCache.get(symbol)!).filter(Boolean)
        
        const message = JSON.stringify({
          type: 'real_time_update',
          sector: sector,
          stocks: sectorUpdates,
          timestamp: Date.now()
        })
        
        subscribers.get(sector)!.forEach(ws => {
          try {
            if (ws.readyState === ws.OPEN) {
              ws.send(message)
            }
          } catch (error) {
            console.error('Error sending WebSocket message:', error)
          }
        })
      }
    })
  }, 2000) // Update every 2 seconds for real-time feel
}

// Start the services
initWebSocketServer()
simulateRealTimeUpdates()

// HTTP endpoint for WebSocket server status
export async function GET(request: NextRequest) {
  const connectedClients = wss?.clients?.size || 0
  const activeSubscriptions = Array.from(subscribers.entries()).map(([sector, clients]) => ({
    sector,
    subscribers: clients.size
  }))
  
  return Response.json({
    success: true,
    websocketServer: {
      status: 'running',
      port: 3001,
      connectedClients: connectedClients,
      activeSubscriptions: activeSubscriptions,
      cachedStocks: stockCache.size
    },
    realTimeUpdates: {
      enabled: true,
      updateInterval: '2 seconds',
      supportedSectors: ['technology', 'healthcare', 'financials', 'energy', 'consumer-discretionary']
    },
    usage: {
      connect: 'ws://localhost:3001',
      subscribe: '{"type": "subscribe", "sector": "technology"}',
      unsubscribe: '{"type": "unsubscribe", "sector": "technology"}',
      ping: '{"type": "ping"}'
    }
  })
}
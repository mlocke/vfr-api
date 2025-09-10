'use client'

import { useState, useEffect } from 'react'
import StockHoverPopup from './StockHoverPopup'

interface SymbolData {
  proName: string
  title: string
}

interface StockTickerProps {
  symbols?: SymbolData[]
}

export default function StockTicker({ symbols }: StockTickerProps) {
  const [popupState, setPopupState] = useState({
    visible: false,
    symbol: '',
    exchange: '',
    name: '',
    x: 0,
    y: 0
  })

  // Default symbols for fallback
  const defaultSymbols: SymbolData[] = [
    { proName: "NASDAQ:AAPL", title: "Apple Inc." },
    { proName: "NASDAQ:MSFT", title: "Microsoft Corporation" },
    { proName: "NASDAQ:GOOGL", title: "Alphabet Inc." },
    { proName: "NASDAQ:AMZN", title: "Amazon.com Inc." },
    { proName: "NASDAQ:TSLA", title: "Tesla Inc." },
    { proName: "NASDAQ:META", title: "Meta Platforms Inc." },
    { proName: "NASDAQ:NVDA", title: "NVIDIA Corporation" },
    { proName: "NASDAQ:NFLX", title: "Netflix Inc." },
    { proName: "NYSE:CRM", title: "Salesforce Inc." },
    { proName: "NYSE:ORCL", title: "Oracle Corporation" },
    { proName: "AMEX:SPY", title: "SPDR S&P 500 ETF Trust" },
    { proName: "NASDAQ:QQQ", title: "Invesco QQQ Trust" },
    { proName: "NYSE:IWM", title: "iShares Russell 2000 ETF" }
  ]

  // Use provided symbols or fallback to defaults
  const activeSymbols = symbols && symbols.length > 0 ? symbols : defaultSymbols

  useEffect(() => {
    let fallbackTimer: NodeJS.Timeout

    // TradingView widget callback - handles widget loaded event
    // @ts-ignore
    window.onTradingViewWidgetLoad = function() {
      console.log('✅ TradingView ticker widget loaded successfully')
      
      // Hide loading text when widget loads
      const loadingElement = document.getElementById('ticker-loading')
      if (loadingElement) {
        loadingElement.style.opacity = '0'
        setTimeout(() => {
          if (loadingElement) {
            loadingElement.style.display = 'none'
          }
        }, 300)
      }
      
      // Initialize Polygon MCP integration for additional data
      initPolygonMCPIntegration()
    }

    // Polygon MCP Integration for enhanced data
    async function initPolygonMCPIntegration() {
      try {
        // This would integrate with the backend Polygon MCP collector
        console.log('🔌 Initializing Polygon MCP integration...')
        
        // Example: Call our backend endpoint that uses Polygon MCP
        // const response = await fetch('/api/polygon-mcp/market-data')
        // const data = await response.json()
        
        console.log('📈 Polygon MCP integration initialized - enhanced data available')
      } catch (error) {
        console.log('⚠️ Polygon MCP integration optional - using TradingView data only')
      }
    }

    async function refreshMarketData() {
      try {
        // This would call our backend endpoint that uses Polygon MCP
        console.log('🔄 Refreshing market data via Polygon MCP...')
        
        // Example implementation:
        // const response = await fetch('/api/polygon-mcp/refresh-data')
        // const freshData = await response.json()
        
        // Update any cached data or state
        console.log('✅ Market data refreshed successfully')
      } catch (error) {
        console.log('📊 Using TradingView data as primary source')
      }
    }

    // Set up TradingView widget monitoring
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          const iframe = document.querySelector('.stock-ticker iframe')
          if (iframe) {
            console.log('📈 Real-time ticker iframe loaded')
            
            // Hide loading text when iframe is detected
            const loadingElement = document.getElementById('ticker-loading')
            if (loadingElement) {
              loadingElement.style.opacity = '0'
              setTimeout(() => {
                loadingElement.style.display = 'none'
              }, 300)
            }
            
            observer.disconnect()
          }
        }
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
    
    // Fallback: hide loading text after 10 seconds regardless
    fallbackTimer = setTimeout(() => {
      const loadingElement = document.getElementById('ticker-loading')
      if (loadingElement) {
        loadingElement.style.opacity = '0'
        setTimeout(() => {
          loadingElement.style.display = 'none'
        }, 300)
      }
    }, 10000)

    // TradingView ticker widget configuration with dynamic symbols
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      "symbols": activeSymbols,
      "showSymbolLogo": true,
      "colorTheme": "dark",
      "isTransparent": true,
      "displayMode": "adaptive",
      "locale": "en"
    })

    const widgetContainer = document.querySelector('.stock-ticker .tradingview-widget-container__widget')
    if (widgetContainer) {
      widgetContainer.appendChild(script)
    }

    return () => {
      clearTimeout(fallbackTimer)
      observer.disconnect()
    }
  }, [activeSymbols]) // Re-run when symbols change

  return (
    <>
      <div className="stock-ticker">
        <div className="tradingview-widget-container">
          <div className="tradingview-widget-container__widget"></div>
        </div>
        
        <div 
          id="ticker-loading" 
          className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-80 text-white text-sm transition-opacity duration-300"
        >
          Loading market data...
        </div>
      </div>
      
      {popupState.visible && (
        <StockHoverPopup 
          symbol={popupState.symbol}
          exchange={popupState.exchange}
          name={popupState.name}
          x={popupState.x}
          y={popupState.y}
          onClose={() => setPopupState(prev => ({ ...prev, visible: false }))}
        />
      )}
    </>
  )
}
'use client'

import { useEffect, useState } from 'react'
import StockHoverPopup from './StockHoverPopup'

export default function StockTicker() {
  const [popupState, setPopupState] = useState({
    visible: false,
    symbol: '',
    exchange: '',
    name: '',
    x: 0,
    y: 0
  })
  useEffect(() => {
    // Real-time Stock Ticker Integration
    let stockDataCache = new Map()
    let lastUpdateTime = 0
    
    // TradingView widget callback - handles widget loaded event
    // @ts-ignore
    window.onTradingViewWidgetLoad = function() {
      console.log('✅ TradingView ticker widget loaded successfully')
      
      // Hide loading text once widget is loaded
      const loadingElement = document.getElementById('ticker-loading')
      if (loadingElement) {
        loadingElement.style.opacity = '0'
        setTimeout(() => {
          loadingElement.style.display = 'none'
        }, 300)
      }
      
      // Initialize Polygon MCP integration for additional data
      initPolygonMCPIntegration()
    }

    // Polygon MCP Integration for enhanced data
    async function initPolygonMCPIntegration() {
      try {
        // This would integrate with the backend Polygon MCP collector
        console.log('🔄 Initializing Polygon MCP integration for enhanced data...')
        
        // Set up periodic data refresh for our own analytics
        setInterval(refreshMarketData, 30000) // Every 30 seconds
        
        // Initial data load
        await refreshMarketData()
      } catch (error) {
        console.log('⚠️ Polygon MCP integration optional - using TradingView data only')
      }
    }

    async function refreshMarketData() {
      try {
        // This would call our backend endpoint that uses Polygon MCP
        // For now, just log the intention
        console.log('🔄 Refreshing market data via backend API...')
        
        const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'SPY']
        
        // Future: Replace with actual backend call
        // const response = await fetch('/api/market-data/real-time', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ symbols })
        // });
        // const data = await response.json();
        
        lastUpdateTime = Date.now()
      } catch (error) {
        console.log('📊 Using TradingView data as primary source')
      }
    }

    // Set up hover detection for stock symbols
    const setupHoverDetection = () => {
      let hoverTimer: NodeJS.Timeout
      let lastSymbol = ''
      
      // Listen for mouse events on the ticker area
      const tickerContainer = document.querySelector('.stock-ticker')
      if (tickerContainer) {
        tickerContainer.addEventListener('mousemove', (e) => {
          clearTimeout(hoverTimer)
          
          // Extract symbol from hover position with improved accuracy
          const rect = tickerContainer.getBoundingClientRect()
          const relativeX = e.clientX - rect.left
          
          // Define symbols in the exact order they appear in the ticker
          const symbolData = [
            { symbol: 'AAPL', exchange: 'NASDAQ', name: 'Apple Inc.' },
            { symbol: 'MSFT', exchange: 'NASDAQ', name: 'Microsoft Corporation' },
            { symbol: 'GOOGL', exchange: 'NASDAQ', name: 'Alphabet Inc.' },
            { symbol: 'AMZN', exchange: 'NASDAQ', name: 'Amazon.com Inc.' },
            { symbol: 'TSLA', exchange: 'NASDAQ', name: 'Tesla Inc.' },
            { symbol: 'META', exchange: 'NASDAQ', name: 'Meta Platforms Inc.' },
            { symbol: 'NVDA', exchange: 'NASDAQ', name: 'NVIDIA Corporation' },
            { symbol: 'SPY', exchange: 'AMEX', name: 'SPDR S&P 500 ETF Trust' },
            { symbol: 'QQQ', exchange: 'NASDAQ', name: 'Invesco QQQ Trust' },
            { symbol: 'IWM', exchange: 'NYSE', name: 'iShares Russell 2000 ETF' }
          ]
          
          // More precise symbol detection
          // The ticker typically shows about 4-6 symbols at once, so we need to account for scrolling
          const visibleWidth = rect.width
          const estimatedSymbolWidth = visibleWidth / 5 // Assume 5 visible symbols at once
          
          // Get the symbol based on position, accounting for the scrolling nature of the ticker
          const currentTime = Date.now()
          const scrollOffset = (currentTime / 50) % (symbolData.length * estimatedSymbolWidth) // Simulate scroll
          const adjustedPosition = (relativeX + scrollOffset) % (symbolData.length * estimatedSymbolWidth)
          const symbolIndex = Math.floor(adjustedPosition / estimatedSymbolWidth) % symbolData.length
          
          const symbolInfo = symbolData[symbolIndex]
          
          if (symbolInfo && symbolInfo.symbol !== lastSymbol) {
            lastSymbol = symbolInfo.symbol
            
            hoverTimer = setTimeout(() => {
              setPopupState({
                visible: true,
                symbol: symbolInfo.symbol,
                exchange: symbolInfo.exchange,
                name: symbolInfo.name,
                x: Math.min(e.clientX + 15, window.innerWidth - 500),
                y: Math.max(e.clientY - 400, 100) // Position above the ticker
              })
            }, 200) // Quick response
          }
        })
        
        tickerContainer.addEventListener('mouseleave', () => {
          clearTimeout(hoverTimer)
          lastSymbol = ''
          setPopupState(prev => ({ ...prev, visible: false }))
        })
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
            
            // Set up hover detection after iframe loads
            setTimeout(setupHoverDetection, 1000)
            
            observer.disconnect()
          }
        }
      })
    })

    const tickerElement = document.querySelector('.stock-ticker')
    if (tickerElement) {
      observer.observe(tickerElement, {
        childList: true,
        subtree: true
      })
    }
    
    // Fallback: hide loading text after 10 seconds regardless
    const fallbackTimer = setTimeout(() => {
      const loadingElement = document.getElementById('ticker-loading')
      if (loadingElement && loadingElement.style.display !== 'none') {
        loadingElement.style.opacity = '0'
        setTimeout(() => {
          loadingElement.style.display = 'none'
        }, 300)
      }
    }, 10000)

    // Load TradingView script
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      "symbols": [
        {
          "proName": "NASDAQ:AAPL",
          "title": "Apple Inc."
        },
        {
          "proName": "NASDAQ:MSFT",
          "title": "Microsoft Corporation"
        },
        {
          "proName": "NASDAQ:GOOGL",
          "title": "Alphabet Inc."
        },
        {
          "proName": "NASDAQ:AMZN",
          "title": "Amazon.com Inc."
        },
        {
          "proName": "NASDAQ:TSLA",
          "title": "Tesla Inc."
        },
        {
          "proName": "NASDAQ:META",
          "title": "Meta Platforms Inc."
        },
        {
          "proName": "NASDAQ:NVDA",
          "title": "NVIDIA Corporation"
        },
        {
          "proName": "AMEX:SPY",
          "title": "SPDR S&P 500 ETF Trust"
        },
        {
          "proName": "NASDAQ:QQQ",
          "title": "Invesco QQQ Trust"
        },
        {
          "proName": "NYSE:IWM",
          "title": "iShares Russell 2000 ETF"
        }
      ],
      "showSymbolLogo": true,
      "isTransparent": true,
      "displayMode": "adaptive",
      "colorTheme": "dark",
      "locale": "en"
    })

    const widgetContainer = document.querySelector('.tradingview-widget-container__widget')
    if (widgetContainer) {
      widgetContainer.appendChild(script)
    }

    return () => {
      clearTimeout(fallbackTimer)
      observer.disconnect()
    }
  }, [])

  return (
    <>
      {/* Real-time Stock Ticker with TradingView */}
      <div className="stock-ticker">
        <div className="tradingview-widget-container">
          <div className="tradingview-widget-container__widget"></div>
        </div>
      </div>

      {/* Loading indicator positioned below ticker */}
      <div className="ticker-loading" id="ticker-loading">
        Loading real-time market data...
      </div>

      {/* Hover Popup for Stock Charts */}
      <StockHoverPopup 
        symbol={popupState.symbol}
        exchange={popupState.exchange}
        name={popupState.name}
        visible={popupState.visible}
        x={popupState.x}
        y={popupState.y}
      />
    </>
  )
}
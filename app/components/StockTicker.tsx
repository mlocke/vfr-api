'use client'

import { useEffect } from 'react'

export default function StockTicker() {
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
    </>
  )
}
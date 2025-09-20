// Frontend Form Handler
// components/AnalysisForm.tsx

interface AnalysisFormProps {
  onAnalysisStart: (symbol: string) => void;
}

export function AnalysisForm({ onAnalysisStart }: AnalysisFormProps) {
  const [symbol, setSymbol] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!symbol.trim()) {
      setError('Please enter a stock symbol');
      return;
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    
    setIsLoading(true);
    setError('');
    
    try {
      // This is THE FIRST CALL - from form to your backend
      await initiateDeepAnalysis(cleanSymbol);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="analysis-form">
      <div className="form-group">
        <label htmlFor="symbol">Stock Symbol</label>
        <input
          id="symbol"
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g., AAPL"
          disabled={isLoading}
          maxLength={10}
        />
      </div>
      
      <button 
        type="submit" 
        disabled={isLoading || !symbol.trim()}
        className="deep-analysis-btn"
      >
        {isLoading ? 'Analyzing...' : 'Deep Analysis'}
      </button>
      
      {error && <div className="error">{error}</div>}
    </form>
  );
}

// Frontend API Call
// services/analysisService.ts

async function initiateDeepAnalysis(symbol: string): Promise<AnalysisResult> {
  // THE FIRST CALL from frontend to backend
  const response = await fetch(`/api/analysis/${symbol}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      symbol,
      analysisType: 'deep',
      timestamp: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Analysis failed');
  }

  return response.json();
}

// Backend Route Handler
// routes/analysis.ts

import express from 'express';
import { collectPolygonData } from '../services/dataCollection';

const router = express.Router();

// THE ENDPOINT that receives the first call
router.post('/analysis/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const startTime = Date.now();

  console.log(`🎯 Deep Analysis requested for: ${symbol}`);

  try {
    // 1. Basic validation
    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ 
        error: 'Invalid symbol format',
        symbol 
      });
    }

    // 2. Start with your working Polygon call (the one from your admin page)
    console.log('📊 Collecting Polygon data...');
    const polygonData = await collectPolygonData(symbol);

    // 3. Basic response for now (expand this later)
    const analysisResult = {
      symbol,
      timestamp: new Date().toISOString(),
      executionTime: Date.now() - startTime,
      data: {
        currentPrice: polygonData.price,
        volume: polygonData.volume,
        change: polygonData.change,
        changePercent: polygonData.changePercent
      },
      status: 'success',
      dataSource: 'polygon'
    };

    console.log(`✅ Analysis complete for ${symbol} in ${analysisResult.executionTime}ms`);
    
    res.json(analysisResult);

  } catch (error) {
    console.error(`❌ Analysis failed for ${symbol}:`, error.message);
    
    res.status(500).json({
      error: 'Analysis failed',
      symbol,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Data Collection Service (start simple)
// services/dataCollection.ts

interface PolygonResponse {
  price: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export async function collectPolygonData(symbol: string): Promise<PolygonResponse> {
  console.log(`🔄 Fetching Polygon data for ${symbol}...`);
  
  try {
    // Use your existing Polygon.io API call from admin page
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apikey=${process.env.POLYGON_API_KEY}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.POLYGON_API_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Polygon API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform Polygon response to your format
    const result = data.results[0];
    
    return {
      price: result.c,  // close price
      volume: result.v, // volume
      change: result.c - result.o, // close - open
      changePercent: ((result.c - result.o) / result.o) * 100,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Polygon data collection failed:', error);
    throw new Error(`Failed to collect data for ${symbol}: ${error.message}`);
  }
}

// Utility Functions
// utils/validation.ts

function isValidSymbol(symbol: string): boolean {
  // Basic symbol validation
  if (!symbol || typeof symbol !== 'string') return false;
  
  const cleanSymbol = symbol.trim().toUpperCase();
  
  // Check format: 1-5 letters, possibly with dots (for some symbols)
  const symbolRegex = /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/;
  
  return symbolRegex.test(cleanSymbol) && cleanSymbol.length <= 10;
}

// Types
// types/analysis.ts

interface AnalysisResult {
  symbol: string;
  timestamp: string;
  executionTime: number;
  data: {
    currentPrice: number;
    volume: number;
    change: number;
    changePercent: number;
  };
  status: 'success' | 'error';
  dataSource: string;
}

// Example Usage in your main app
// App.tsx or main component

function App() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalysis = async (symbol: string) => {
    setIsAnalyzing(true);
    try {
      const result = await initiateDeepAnalysis(symbol);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      // Handle error state
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="vfr-app">
      <h1>VFR Financial Research</h1>
      
      <AnalysisForm onAnalysisStart={handleAnalysis} />
      
      {isAnalyzing && (
        <div className="analyzing">
          🔄 Analyzing... collecting real-time data
        </div>
      )}
      
      {analysisResult && (
        <div className="results">
          <h2>Analysis Results for {analysisResult.symbol}</h2>
          <p>Price: ${analysisResult.data.currentPrice}</p>
          <p>Volume: {analysisResult.data.volume.toLocaleString()}</p>
          <p>Change: {analysisResult.data.changePercent.toFixed(2)}%</p>
          <p>Execution Time: {analysisResult.executionTime}ms</p>
        </div>
      )}
    </div>
  );
}
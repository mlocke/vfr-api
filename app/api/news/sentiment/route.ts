import { NextRequest, NextResponse } from 'next/server'

interface NewsArticle {
  title: string
  content: string
  url: string
  publishedAt: string
  source: string
  sentiment: {
    score: number // -1 to 1 (-1 most negative, 1 most positive)
    label: 'positive' | 'negative' | 'neutral'
    confidence: number
  }
  relevance: number // 0 to 1
  keywords: string[]
}

interface SectorNews {
  sector: string
  articles: NewsArticle[]
  overallSentiment: {
    score: number
    label: 'positive' | 'negative' | 'neutral'
    trending: 'up' | 'down' | 'stable'
  }
  marketImpact: 'high' | 'medium' | 'low'
  timestamp: number
}

// Cache for news data
const newsCache = new Map<string, { data: SectorNews, timestamp: number }>()
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

// Sector-specific financial news sources
const NEWS_SOURCES = {
  technology: [
    'https://techcrunch.com',
    'https://www.theverge.com',
    'https://arstechnica.com',
    'https://9to5mac.com'
  ],
  healthcare: [
    'https://www.fiercepharma.com',
    'https://www.biospace.com',
    'https://www.statnews.com'
  ],
  financials: [
    'https://www.bloomberg.com/markets',
    'https://www.wsj.com/markets',
    'https://finance.yahoo.com'
  ],
  energy: [
    'https://oilprice.com',
    'https://www.energyvoice.com'
  ],
  'consumer-discretionary': [
    'https://www.retaildive.com',
    'https://www.cnbc.com/retail'
  ]
}

// Simple sentiment analysis (would use AI service in production)
function analyzeSentiment(text: string): { score: number; label: 'positive' | 'negative' | 'neutral'; confidence: number } {
  const positiveWords = ['growth', 'profit', 'increase', 'surge', 'boom', 'bullish', 'gain', 'rise', 'up', 'strong', 'success', 'breakthrough', 'expansion', 'revenue', 'earnings']
  const negativeWords = ['loss', 'decline', 'fall', 'drop', 'crash', 'bearish', 'recession', 'bankruptcy', 'lawsuit', 'investigation', 'scandal', 'layoffs', 'down', 'weak', 'struggle']
  
  const lowerText = text.toLowerCase()
  let positiveCount = 0
  let negativeCount = 0
  
  positiveWords.forEach(word => {
    const matches = (lowerText.match(new RegExp(word, 'g')) || []).length
    positiveCount += matches
  })
  
  negativeWords.forEach(word => {
    const matches = (lowerText.match(new RegExp(word, 'g')) || []).length
    negativeCount += matches
  })
  
  const total = positiveCount + negativeCount
  if (total === 0) {
    return { score: 0, label: 'neutral', confidence: 0.5 }
  }
  
  const score = (positiveCount - negativeCount) / Math.max(total * 2, 1)
  const confidence = Math.min(total / 10, 1) // Higher word count = higher confidence
  
  let label: 'positive' | 'negative' | 'neutral' = 'neutral'
  if (score > 0.1) label = 'positive'
  else if (score < -0.1) label = 'negative'
  
  return { score: Math.max(-1, Math.min(1, score)), label, confidence }
}

// Extract keywords from content
function extractKeywords(text: string): string[] {
  const financialKeywords = [
    // Market terms
    'earnings', 'revenue', 'profit', 'growth', 'market cap', 'valuation', 'IPO', 'merger', 'acquisition',
    // Technology terms
    'AI', 'artificial intelligence', 'cloud', 'software', 'hardware', 'semiconductor', 'blockchain',
    // Healthcare terms
    'drug', 'pharmaceutical', 'biotech', 'clinical trial', 'FDA approval', 'vaccine', 'treatment',
    // Financial terms
    'bank', 'loan', 'mortgage', 'interest rate', 'credit', 'investment', 'trading',
    // Energy terms
    'oil', 'gas', 'renewable', 'solar', 'wind', 'battery', 'EV', 'electric vehicle'
  ]
  
  const lowerText = text.toLowerCase()
  const foundKeywords: string[] = []
  
  financialKeywords.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword)
    }
  })
  
  return foundKeywords.slice(0, 5) // Return top 5 keywords
}

// Note: News fetching now uses fallback data only
// In a production system, this would integrate with news APIs directly
// such as NewsAPI, Alpha Vantage News, or financial news services

// Fallback news data generation
function generateFallbackNews(sector: string): NewsArticle[] {
  const sectorNews = {
    technology: [
      { title: 'Tech Stocks Rally on AI Breakthrough', content: 'Major technology companies see significant gains following breakthrough in artificial intelligence capabilities...' },
      { title: 'Cloud Computing Revenue Surges 25%', content: 'Cloud service providers report strong quarterly growth driven by enterprise digital transformation...' },
      { title: 'Semiconductor Industry Shows Resilience', content: 'Chip manufacturers maintain steady production despite global supply chain challenges...' }
    ],
    healthcare: [
      { title: 'Biotech Sector Gains on FDA Approvals', content: 'Healthcare stocks rise as multiple drug candidates receive regulatory approval...' },
      { title: 'Medical Device Innovation Drives Growth', content: 'New medical technologies show promise for improving patient outcomes...' },
      { title: 'Pharmaceutical Revenue Beats Estimates', content: 'Major pharma companies report stronger than expected quarterly earnings...' }
    ],
    financials: [
      { title: 'Banking Sector Profits Rise 15%', content: 'Financial institutions benefit from higher interest rates and strong loan demand...' },
      { title: 'Fintech Innovation Accelerates', content: 'Digital payment platforms and financial services continue rapid adoption...' },
      { title: 'Insurance Companies Report Strong Results', content: 'Insurance sector shows resilience with improved underwriting performance...' }
    ],
    energy: [
      { title: 'Oil Prices Stabilize on Supply Balance', content: 'Energy markets find equilibrium as production meets global demand...' },
      { title: 'Renewable Energy Investment Surges', content: 'Clean energy projects attract record levels of capital investment...' },
      { title: 'Natural Gas Demand Remains Strong', content: 'Utility companies report steady natural gas consumption patterns...' }
    ],
    'consumer-discretionary': [
      { title: 'Retail Sales Show Seasonal Strength', content: 'Consumer spending patterns indicate healthy discretionary income levels...' },
      { title: 'E-commerce Growth Continues', content: 'Online retail platforms maintain double-digit growth rates...' },
      { title: 'Auto Industry Rebounds Strongly', content: 'Automotive manufacturers report improved production and sales figures...' }
    ]
  }
  
  const fallbackArticles = sectorNews[sector as keyof typeof sectorNews] || sectorNews.technology
  
  return fallbackArticles.map((article, index) => {
    const sentiment = analyzeSentiment(article.title + ' ' + article.content)
    const keywords = extractKeywords(article.title + ' ' + article.content)
    
    return {
      title: article.title,
      content: article.content,
      url: `https://example.com/news/${sector}/${index + 1}`,
      publishedAt: new Date(Date.now() - index * 3600000).toISOString(),
      source: 'Financial News Wire',
      sentiment,
      relevance: 0.8,
      keywords
    }
  })
}

// Calculate overall sentiment for sector
function calculateOverallSentiment(articles: NewsArticle[]): SectorNews['overallSentiment'] {
  if (articles.length === 0) {
    return { score: 0, label: 'neutral', trending: 'stable' }
  }
  
  const weightedScore = articles.reduce((sum, article) => {
    return sum + (article.sentiment.score * article.relevance)
  }, 0) / articles.length
  
  let label: 'positive' | 'negative' | 'neutral' = 'neutral'
  if (weightedScore > 0.15) label = 'positive'
  else if (weightedScore < -0.15) label = 'negative'
  
  // Simple trending calculation (would use historical data in production)
  const recentArticles = articles.slice(0, Math.floor(articles.length / 2))
  const olderArticles = articles.slice(Math.floor(articles.length / 2))
  
  const recentScore = recentArticles.reduce((sum, a) => sum + a.sentiment.score, 0) / recentArticles.length
  const olderScore = olderArticles.length > 0 
    ? olderArticles.reduce((sum, a) => sum + a.sentiment.score, 0) / olderArticles.length 
    : recentScore
  
  let trending: 'up' | 'down' | 'stable' = 'stable'
  if (recentScore > olderScore + 0.1) trending = 'up'
  else if (recentScore < olderScore - 0.1) trending = 'down'
  
  return {
    score: Math.max(-1, Math.min(1, weightedScore)),
    label,
    trending
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sector = searchParams.get('sector')
    
    if (!sector) {
      return NextResponse.json({
        success: false,
        error: 'Sector parameter is required'
      }, { status: 400 })
    }
    
    // Check cache first
    const cacheKey = `news-${sector}`
    const cached = newsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        ...cached.data,
        cached: true,
        cacheAge: Math.round((Date.now() - cached.timestamp) / 1000)
      })
    }
    
    // Use fallback news data (in production, this would use direct news APIs)
    const articles = generateFallbackNews(sector)
    const source = 'fallback'
    
    // Calculate overall sentiment and market impact
    const overallSentiment = calculateOverallSentiment(articles)
    
    // Determine market impact based on sentiment strength and relevance
    const avgRelevance = articles.reduce((sum, a) => sum + a.relevance, 0) / articles.length
    let marketImpact: 'high' | 'medium' | 'low' = 'low'
    
    if (Math.abs(overallSentiment.score) > 0.3 && avgRelevance > 0.7) {
      marketImpact = 'high'
    } else if (Math.abs(overallSentiment.score) > 0.15 || avgRelevance > 0.5) {
      marketImpact = 'medium'
    }
    
    const result: SectorNews = {
      sector,
      articles: articles.slice(0, 10), // Limit to 10 articles
      overallSentiment,
      marketImpact,
      timestamp: Date.now()
    }
    
    // Cache the result
    newsCache.set(cacheKey, { data: result, timestamp: Date.now() })
    
    console.log(`✅ News sentiment analysis completed for ${sector}: ${overallSentiment.label} (${overallSentiment.score.toFixed(2)})`)
    
    return NextResponse.json({
      success: true,
      ...result,
      source,
      cached: false
    })
    
  } catch (error) {
    console.error('❌ News sentiment API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch news sentiment',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
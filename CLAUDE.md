# Financial Analysis & Stock Prediction Platform - Claude Context

## Project Overview
This is a comprehensive financial analysis tool that aggregates data from public APIs and government sources to analyze market trends, predict stock movements, and provide investment insights.

## Architecture & Stack

### Backend
- **Languages**: Python
- **Data Processing**: Pandas, NumPy
- **Machine Learning**: scikit-learn, TensorFlow, PyTorch
- **APIs**: FastAPI or Flask for REST endpoints
- **Database**: PostgreSQL (structured data), InfluxDB (time-series)

### Frontend
- **Framework**: React/Next.js or Vue/Nuxt
- **Visualization**: D3.js, Chart.js, or Plotly
- **Styling**: Tailwind CSS, Headless UI
- **State**: Redux or Pinia

### Infrastructure
- **Cloud**: AWS, Azure, or GCP
- **Containers**: Docker, Kubernetes
- **CI/CD**: GitHub Actions or GitLab CI
- **Monitoring**: Prometheus, Grafana

## Key Data Sources
- **Government**: SEC EDGAR API, FRED API, Treasury Direct API
- **Market Data**: Alpha Vantage, IEX Cloud, Quandl, Yahoo Finance, Polygon.io
- **News/Sentiment**: News API, Twitter API, Reddit API

## Development Commands
```bash
# Backend setup
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend setup  
cd frontend
npm install
npm run dev

# Daily operations
python scripts/collect_daily_data.py
python scripts/generate_recommendations.py --sector technology --risk low
python scripts/analyze_portfolio.py --portfolio my_portfolio.json
```

## Project Status
- Early stage project with documentation in place
- Main implementation files not yet created
- Focus on financial analysis and stock prediction
- Emphasizes data-driven investment insights

## Important Notes
- **Legal Compliance**: Tool is for informational purposes only, not financial advice
- **Risk Disclaimer**: All investments carry risk of loss
- **Data Ethics**: Uses only public APIs and government data sources
- **Security**: Requires API key management via .env files

## File Structure (Planned)
```
├── backend/           # Python API services
├── frontend/          # React/Vue web interface  
├── scripts/           # Data collection and analysis scripts
├── requirements.txt   # Python dependencies
├── package.json       # Frontend dependencies
└── .env              # API keys and configuration
```
### **VFR Site Data Flow: User Input to Analysis**

The core principle of the VFR site's data flow is **data collection orchestration** triggered by user action. When a user clicks "Deep Analysis," a streamlined process begins to deliver insights quickly and efficiently.

***

### **The Data Flow Process**

1.  **User Input**: The process starts with a user entering a stock symbol and clicking "Deep Analysis."
2.  **Symbol Validation**: The system first validates the entered symbol to ensure it is a legitimate stock.
3.  **Trigger Analysis**: Once the symbol is validated, the system triggers the analysis workflow.
4.  **Data Collection**: The analysis engine initiates **parallel API calls** to multiple data sources including Polygon, FMP, TwelveData, and the MarketIndicesService (for VIX, major indices, and sector rotation). Additionally, analyst data is collected from FMP (consensus ratings, price targets, rating changes). This concurrent fetching is critical for speed, as it allows all necessary data to be retrieved at the same time.
5.  **Data Normalization**: As data streams in from different APIs, it is immediately converted into a **consistent JSON format**. This ensures the data is uniform and ready for the analysis engine, regardless of its original source.
6.  **Analysis Engine**: A complete dataset, now in a standardized format, is fed into the analysis engine. The engine processes this data to generate actionable insights.
7.  **Results Display**: The final insights are then presented to the user on the VFR site.

***

### **Key Architectural Decisions for MVP**

For the initial version of the VFR site, several critical design choices were made to prioritize **speed, simplicity, and cost-effectiveness**:

* **Real-time Collection**: Data is fetched live upon user request, ensuring the analysis is always based on the freshest information.
* **JSON Caching**: To prevent redundant API calls, a **Redis cache** is used. Data is cached for a short period (1-15 minutes) to serve subsequent requests quickly without re-fetching from the source APIs.
* **No Initial Database**: The system avoids a complex database schema by processing the data and returning the results directly to the user. This keeps the architecture lean and allows for rapid iteration.
* **Parallel API Calls**: The simultaneous fetching of data from various Tier 1 sources (including MarketIndicesService for VIX and sector data, plus analyst data from FMP) minimizes latency, aiming for a total collection time of approximately 500ms.

This approach ensures users receive a fresh analysis within **2-3 seconds**, maintaining a simple, flexible, and efficient system that can easily be scaled or modified in the future by adding a database for backtesting or historical analysis.
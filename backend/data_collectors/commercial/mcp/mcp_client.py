"""
Generic MCP Client Framework

Provides a comprehensive JSON-RPC 2.0 client for MCP server communication.
This client handles protocol-level details, allowing collectors to focus on 
business logic rather than MCP implementation specifics.

Features:
- JSON-RPC 2.0 protocol compliance
- Connection management and pooling
- Automatic retry logic with exponential backoff
- Tool discovery and metadata caching
- Session management and authentication
- Error handling and recovery
- Performance monitoring and optimization
"""

import json
import time
import asyncio
import aiohttp
import logging
from typing import Dict, List, Any, Optional, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import threading
import uuid
from urllib.parse import urljoin
import ssl

logger = logging.getLogger(__name__)


class MCPConnectionState(Enum):
    """MCP connection states."""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"
    ERROR = "error"


class MCPProtocolVersion(Enum):
    """Supported MCP protocol versions."""
    V1_0 = "1.0"
    V2_0 = "2.0"


@dataclass
class MCPServerInfo:
    """MCP server information."""
    name: str
    version: str
    protocol_version: str
    capabilities: List[str]
    description: Optional[str] = None
    vendor: Optional[str] = None
    last_updated: Optional[datetime] = None


@dataclass
class MCPTool:
    """MCP tool metadata."""
    name: str
    description: str
    parameters: Dict[str, Any]
    category: Optional[str] = None
    cost_estimate: Optional[float] = None
    rate_limit: Optional[Dict[str, Any]] = None
    examples: Optional[List[Dict[str, Any]]] = None


@dataclass
class MCPRequest:
    """MCP request structure."""
    id: str
    method: str
    params: Dict[str, Any]
    timestamp: datetime
    timeout: Optional[float] = None


@dataclass
class MCPResponse:
    """MCP response structure."""
    id: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None


class MCPClientError(Exception):
    """Base exception for MCP client errors."""
    pass


class MCPConnectionError(MCPClientError):
    """MCP connection-related errors."""
    pass


class MCPProtocolError(MCPClientError):
    """MCP protocol-related errors."""
    pass


class MCPTimeoutError(MCPClientError):
    """MCP request timeout errors."""
    pass


class MCPRateLimitError(MCPClientError):
    """MCP rate limiting errors."""
    pass


class MCPClient:
    """
    Generic MCP client with comprehensive protocol support.
    
    Handles all aspects of MCP communication including connection management,
    tool discovery, request routing, and error handling.
    """
    
    def __init__(
        self,
        server_url: str,
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        backoff_factor: float = 1.5,
        pool_size: int = 10,
        enable_compression: bool = True
    ):
        """
        Initialize MCP client.
        
        Args:
            server_url: MCP server URL
            api_key: API key for authentication
            timeout: Request timeout in seconds
            max_retries: Maximum retry attempts
            backoff_factor: Exponential backoff multiplier
            pool_size: Connection pool size
            enable_compression: Enable HTTP compression
        """
        self.server_url = server_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.pool_size = pool_size
        self.enable_compression = enable_compression
        
        # Connection management
        self.connection_state = MCPConnectionState.DISCONNECTED
        self.session: Optional[aiohttp.ClientSession] = None
        self._connector: Optional[aiohttp.TCPConnector] = None
        self._connection_lock = asyncio.Lock()
        
        # Server information and capabilities
        self.server_info: Optional[MCPServerInfo] = None
        self.available_tools: Dict[str, MCPTool] = {}
        self.tool_categories: Dict[str, List[str]] = {}
        
        # Request tracking
        self.pending_requests: Dict[str, MCPRequest] = {}
        self.request_counter = 0
        self._request_lock = threading.Lock()
        
        # Performance metrics
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_response_time': 0.0,
            'connection_attempts': 0,
            'reconnection_count': 0
        }
        
        # Rate limiting
        self.rate_limits: Dict[str, Dict[str, Any]] = {}
        self.last_request_times: Dict[str, datetime] = {}
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.disconnect()
    
    async def connect(self) -> bool:
        """
        Establish connection to MCP server.
        
        Returns:
            True if connection successful
        """
        async with self._connection_lock:
            if self.connection_state == MCPConnectionState.CONNECTED:
                return True
            
            self.connection_state = MCPConnectionState.CONNECTING
            self.stats['connection_attempts'] += 1
            
            try:
                # Create HTTP connector with optimizations
                self._connector = aiohttp.TCPConnector(
                    limit=self.pool_size,
                    limit_per_host=self.pool_size,
                    ttl_dns_cache=300,
                    use_dns_cache=True,
                    keepalive_timeout=60,
                    enable_cleanup_closed=True,
                    ssl=ssl.create_default_context()
                )
                
                # Create session with headers
                headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'StockPicker-MCP-Client/1.0',
                    'Accept': 'application/json'
                }
                
                if self.api_key:
                    headers['Authorization'] = f'Bearer {self.api_key}'
                
                if self.enable_compression:
                    headers['Accept-Encoding'] = 'gzip, deflate'
                
                timeout_config = aiohttp.ClientTimeout(total=self.timeout)
                
                self.session = aiohttp.ClientSession(
                    connector=self._connector,
                    headers=headers,
                    timeout=timeout_config,
                    json_serialize=json.dumps,
                    raise_for_status=False
                )
                
                # Discover server capabilities
                await self._discover_server_info()
                await self._discover_tools()
                
                self.connection_state = MCPConnectionState.CONNECTED
                logger.info(f"Connected to MCP server: {self.server_info.name if self.server_info else self.server_url}")
                
                return True
                
            except Exception as e:
                self.connection_state = MCPConnectionState.ERROR
                logger.error(f"Failed to connect to MCP server: {e}")
                await self._cleanup_connection()
                raise MCPConnectionError(f"Connection failed: {e}")
    
    async def disconnect(self) -> None:
        """Disconnect from MCP server."""
        async with self._connection_lock:
            await self._cleanup_connection()
            self.connection_state = MCPConnectionState.DISCONNECTED
            logger.info("Disconnected from MCP server")
    
    async def _cleanup_connection(self) -> None:
        """Clean up connection resources."""
        if self.session:
            await self.session.close()
            self.session = None
        
        if self._connector:
            await self._connector.close()
            self._connector = None
    
    async def _discover_server_info(self) -> None:
        """Discover MCP server information and capabilities."""
        try:
            response = await self._make_request('server/info', {})
            
            if response.error:
                raise MCPProtocolError(f"Server info error: {response.error}")
            
            result = response.result or {}
            self.server_info = MCPServerInfo(
                name=result.get('name', 'Unknown'),
                version=result.get('version', '1.0'),
                protocol_version=result.get('protocol_version', '1.0'),
                capabilities=result.get('capabilities', []),
                description=result.get('description'),
                vendor=result.get('vendor'),
                last_updated=datetime.now()
            )
            
            logger.info(f"Server info: {self.server_info.name} v{self.server_info.version}")
            
        except Exception as e:
            raise MCPConnectionError(f"Failed to get server info: {e}")
    
    async def _discover_tools(self) -> None:
        """Discover available MCP tools."""
        try:
            response = await self._make_request('tools/list', {})
            
            if response.error:
                raise MCPProtocolError(f"Tool discovery error: {response.error}")
            
            result = response.result or {}
            tools_data = result.get('tools', [])
            
            self.available_tools = {}
            self.tool_categories = {}
            
            for tool_data in tools_data:
                tool = MCPTool(
                    name=tool_data.get('name', ''),
                    description=tool_data.get('description', ''),
                    parameters=tool_data.get('parameters', {}),
                    category=tool_data.get('category'),
                    cost_estimate=tool_data.get('cost_estimate'),
                    rate_limit=tool_data.get('rate_limit'),
                    examples=tool_data.get('examples')
                )
                
                self.available_tools[tool.name] = tool
                
                # Categorize tools
                category = tool.category or self._infer_tool_category(tool.name, tool.description)
                if category not in self.tool_categories:
                    self.tool_categories[category] = []
                self.tool_categories[category].append(tool.name)
            
            logger.info(f"Discovered {len(self.available_tools)} tools in {len(self.tool_categories)} categories")
            
        except Exception as e:
            raise MCPConnectionError(f"Failed to discover tools: {e}")
    
    def _infer_tool_category(self, tool_name: str, description: str) -> str:
        """Infer tool category from name and description."""
        name_lower = tool_name.lower()
        desc_lower = description.lower()
        
        # Market data patterns
        if any(term in name_lower or term in desc_lower for term in [
            'price', 'quote', 'ohlcv', 'market', 'stock', 'equity', 'trading'
        ]):
            return 'market_data'
        
        # Technical analysis patterns
        elif any(term in name_lower or term in desc_lower for term in [
            'rsi', 'sma', 'ema', 'macd', 'bollinger', 'stochastic', 'indicator', 'technical'
        ]):
            return 'technical_analysis'
        
        # Fundamental data patterns
        elif any(term in name_lower or term in desc_lower for term in [
            'earnings', 'revenue', 'balance', 'income', 'cash', 'financial', 'statement'
        ]):
            return 'fundamentals'
        
        # News and sentiment patterns
        elif any(term in name_lower or term in desc_lower for term in [
            'news', 'sentiment', 'social', 'article', 'headline', 'buzz'
        ]):
            return 'sentiment'
        
        # Forex patterns
        elif any(term in name_lower or term in desc_lower for term in [
            'forex', 'currency', 'exchange', 'fx'
        ]):
            return 'forex'
        
        # Cryptocurrency patterns
        elif any(term in name_lower or term in desc_lower for term in [
            'crypto', 'bitcoin', 'ethereum', 'blockchain', 'digital'
        ]):
            return 'cryptocurrency'
        
        # Options patterns
        elif any(term in name_lower or term in desc_lower for term in [
            'option', 'call', 'put', 'strike', 'expiry', 'volatility'
        ]):
            return 'options'
        
        else:
            return 'general'
    
    async def call_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Call a specific MCP tool.
        
        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments
            timeout: Request timeout override
            
        Returns:
            Tool execution result
        """
        if self.connection_state != MCPConnectionState.CONNECTED:
            await self.connect()
        
        if tool_name not in self.available_tools:
            raise MCPProtocolError(f"Tool '{tool_name}' not available")
        
        # Check rate limiting
        await self._check_rate_limit(tool_name)
        
        try:
            start_time = time.time()
            
            response = await self._make_request(
                'tools/call',
                {'name': tool_name, 'arguments': arguments},
                timeout=timeout
            )
            
            response_time = time.time() - start_time
            
            if response.error:
                self.stats['failed_requests'] += 1
                
                # Handle specific error types
                error_code = response.error.get('code', 0)
                error_message = response.error.get('message', 'Unknown error')
                
                if error_code == 429:  # Rate limit
                    raise MCPRateLimitError(f"Rate limit exceeded for {tool_name}: {error_message}")
                elif error_code == 401:  # Unauthorized
                    raise MCPConnectionError(f"Authentication failed: {error_message}")
                elif error_code == 404:  # Not found
                    raise MCPProtocolError(f"Tool not found: {tool_name}")
                else:
                    raise MCPProtocolError(f"Tool execution error: {error_message}")
            
            # Update statistics
            self.stats['successful_requests'] += 1
            self.stats['total_response_time'] += response_time
            self.last_request_times[tool_name] = datetime.now()
            
            logger.debug(f"Tool '{tool_name}' executed successfully in {response_time:.2f}s")
            
            return response.result or {}
            
        except MCPClientError:
            raise
        except Exception as e:
            self.stats['failed_requests'] += 1
            logger.error(f"Tool '{tool_name}' execution failed: {e}")
            raise MCPProtocolError(f"Tool execution failed: {e}")
    
    async def batch_call_tools(
        self,
        tool_calls: List[Dict[str, Any]],
        optimize_order: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Execute multiple tool calls efficiently.
        
        Args:
            tool_calls: List of tool calls with 'tool_name' and 'arguments'
            optimize_order: Whether to optimize call order for performance
            
        Returns:
            List of execution results
        """
        if optimize_order:
            tool_calls = self._optimize_tool_call_order(tool_calls)
        
        results = []
        
        # Execute tools sequentially (could be made parallel in future)
        for tool_call in tool_calls:
            try:
                result = await self.call_tool(
                    tool_call['tool_name'],
                    tool_call.get('arguments', {}),
                    tool_call.get('timeout')
                )
                
                results.append({
                    'tool_name': tool_call['tool_name'],
                    'success': True,
                    'result': result,
                    'timestamp': datetime.now().isoformat()
                })
                
            except Exception as e:
                results.append({
                    'tool_name': tool_call['tool_name'],
                    'success': False,
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'timestamp': datetime.now().isoformat()
                })
        
        return results
    
    def _optimize_tool_call_order(self, tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Optimize tool call order for better performance."""
        # Group by category to minimize context switching
        categorized_calls = {}
        
        for call in tool_calls:
            tool_name = call['tool_name']
            category = self._get_tool_category(tool_name)
            
            if category not in categorized_calls:
                categorized_calls[category] = []
            categorized_calls[category].append(call)
        
        # Order categories by priority (market data first, then others)
        category_priority = [
            'market_data', 'technical_analysis', 'fundamentals',
            'sentiment', 'forex', 'cryptocurrency', 'options', 'general'
        ]
        
        optimized_calls = []
        for category in category_priority:
            if category in categorized_calls:
                optimized_calls.extend(categorized_calls[category])
        
        return optimized_calls
    
    def _get_tool_category(self, tool_name: str) -> str:
        """Get category for a tool."""
        for category, tools in self.tool_categories.items():
            if tool_name in tools:
                return category
        return 'general'
    
    async def _make_request(
        self,
        method: str,
        params: Dict[str, Any],
        timeout: Optional[float] = None
    ) -> MCPResponse:
        """
        Make a JSON-RPC 2.0 request to the MCP server.
        
        Args:
            method: RPC method name
            params: Method parameters
            timeout: Request timeout override
            
        Returns:
            Parsed response
        """
        request_id = str(uuid.uuid4())
        request_timeout = timeout or self.timeout
        
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params
        }
        
        # Track request
        request_obj = MCPRequest(
            id=request_id,
            method=method,
            params=params,
            timestamp=datetime.now(),
            timeout=request_timeout
        )
        
        self.pending_requests[request_id] = request_obj
        self.stats['total_requests'] += 1
        
        # Retry logic with exponential backoff
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                if attempt > 0:
                    delay = self.backoff_factor ** (attempt - 1)
                    logger.debug(f"Retrying request {request_id} in {delay:.1f}s (attempt {attempt + 1})")
                    await asyncio.sleep(delay)
                
                async with self.session.post(
                    self.server_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=request_timeout)
                ) as response:
                    response_text = await response.text()
                    
                    # Handle HTTP errors
                    if response.status >= 400:
                        if response.status == 429:  # Rate limit
                            retry_after = response.headers.get('Retry-After', '1')
                            await asyncio.sleep(float(retry_after))
                            continue
                        elif response.status in [500, 502, 503, 504]:  # Server errors - retry
                            last_exception = MCPConnectionError(f"HTTP {response.status}: {response_text}")
                            continue
                        else:  # Client errors - don't retry
                            raise MCPConnectionError(f"HTTP {response.status}: {response_text}")
                    
                    # Parse JSON response
                    try:
                        result_data = json.loads(response_text)
                    except json.JSONDecodeError as e:
                        raise MCPProtocolError(f"Invalid JSON response: {e}")
                    
                    # Validate JSON-RPC response
                    if result_data.get('jsonrpc') != '2.0':
                        raise MCPProtocolError("Invalid JSON-RPC version")
                    
                    if result_data.get('id') != request_id:
                        raise MCPProtocolError("Request ID mismatch")
                    
                    # Clean up request tracking
                    self.pending_requests.pop(request_id, None)
                    
                    return MCPResponse(
                        id=request_id,
                        result=result_data.get('result'),
                        error=result_data.get('error'),
                        timestamp=datetime.now()
                    )
                    
            except asyncio.TimeoutError:
                last_exception = MCPTimeoutError(f"Request timeout after {request_timeout}s")
            except aiohttp.ClientError as e:
                last_exception = MCPConnectionError(f"Connection error: {e}")
            except Exception as e:
                last_exception = MCPClientError(f"Unexpected error: {e}")
        
        # All retries exhausted
        self.pending_requests.pop(request_id, None)
        
        if last_exception:
            raise last_exception
        else:
            raise MCPClientError("All retry attempts failed")
    
    async def _check_rate_limit(self, tool_name: str) -> None:
        """Check and enforce rate limiting for a tool."""
        tool = self.available_tools.get(tool_name)
        if not tool or not tool.rate_limit:
            return
        
        rate_limit = tool.rate_limit
        requests_per_period = rate_limit.get('requests', 1)
        period_seconds = rate_limit.get('period_seconds', 1)
        
        # Simple rate limiting implementation
        now = datetime.now()
        last_request = self.last_request_times.get(tool_name)
        
        if last_request:
            time_since_last = (now - last_request).total_seconds()
            min_interval = period_seconds / requests_per_period
            
            if time_since_last < min_interval:
                wait_time = min_interval - time_since_last
                logger.debug(f"Rate limiting: waiting {wait_time:.1f}s for {tool_name}")
                await asyncio.sleep(wait_time)
    
    # Public API methods
    
    def get_server_info(self) -> Optional[MCPServerInfo]:
        """Get MCP server information."""
        return self.server_info
    
    def get_available_tools(self, category: Optional[str] = None) -> List[str]:
        """Get list of available tools, optionally filtered by category."""
        if category and category in self.tool_categories:
            return self.tool_categories[category].copy()
        return list(self.available_tools.keys())
    
    def get_tool_categories(self) -> List[str]:
        """Get list of available tool categories."""
        return list(self.tool_categories.keys())
    
    def get_tool_info(self, tool_name: str) -> Optional[MCPTool]:
        """Get detailed information about a specific tool."""
        return self.available_tools.get(tool_name)
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection and performance statistics."""
        avg_response_time = 0.0
        if self.stats['successful_requests'] > 0:
            avg_response_time = self.stats['total_response_time'] / self.stats['successful_requests']
        
        success_rate = 0.0
        total_requests = self.stats['total_requests']
        if total_requests > 0:
            success_rate = (self.stats['successful_requests'] / total_requests) * 100
        
        return {
            'connection_state': self.connection_state.value,
            'server_info': self.server_info.__dict__ if self.server_info else None,
            'total_requests': total_requests,
            'successful_requests': self.stats['successful_requests'],
            'failed_requests': self.stats['failed_requests'],
            'success_rate': success_rate,
            'average_response_time': avg_response_time,
            'connection_attempts': self.stats['connection_attempts'],
            'reconnection_count': self.stats['reconnection_count'],
            'available_tools_count': len(self.available_tools),
            'tool_categories_count': len(self.tool_categories),
            'pending_requests': len(self.pending_requests)
        }
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check on MCP connection."""
        start_time = time.time()
        
        try:
            response = await self._make_request('server/ping', {})
            response_time = time.time() - start_time
            
            return {
                'healthy': response.error is None,
                'response_time': response_time,
                'server_responsive': True,
                'connection_state': self.connection_state.value,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            response_time = time.time() - start_time
            
            return {
                'healthy': False,
                'response_time': response_time,
                'server_responsive': False,
                'connection_state': self.connection_state.value,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
    
    def __str__(self) -> str:
        """String representation of MCP client."""
        server_name = self.server_info.name if self.server_info else "Unknown"
        tool_count = len(self.available_tools)
        return f"MCPClient(server={server_name}, tools={tool_count}, state={self.connection_state.value})"


# Utility functions for synchronous usage

def create_sync_client(server_url: str, **kwargs) -> MCPClient:
    """Create an MCP client for synchronous usage patterns."""
    return MCPClient(server_url, **kwargs)


async def quick_tool_call(
    server_url: str,
    tool_name: str,
    arguments: Dict[str, Any],
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Quick one-off tool call without persistent connection."""
    async with MCPClient(server_url, api_key=api_key) as client:
        return await client.call_tool(tool_name, arguments)
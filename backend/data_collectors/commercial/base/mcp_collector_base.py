"""
MCP Collector Base Class

Base class for all MCP (Model Context Protocol) collectors.
Provides common MCP protocol handling, tool discovery, and session management.

Features:
- JSON-RPC 2.0 protocol communication
- Automatic tool discovery and categorization
- Session management and connection pooling
- MCP-specific error handling and retry logic
- Cost tracking integration
- Context optimization for AI consumption
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Union
import json
import requests
from datetime import datetime, timedelta
import time
import logging
import sys
from pathlib import Path

# Add path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from .commercial_collector_interface import CommercialCollectorInterface, SubscriptionTier
from .cost_tracker import usage_tracker
from base.collector_interface import CollectorConfig

logger = logging.getLogger(__name__)


class MCPError(Exception):
    """Base exception for MCP-related errors."""
    pass


class MCPConnectionError(MCPError):
    """MCP server connection error."""
    pass


class MCPToolError(MCPError):
    """MCP tool execution error."""
    pass


class MCPQuotaError(MCPError):
    """MCP server quota exceeded error."""
    pass


class MCPCollectorBase(CommercialCollectorInterface):
    """
    Base class for MCP-based commercial collectors.
    
    Handles MCP protocol communication, tool discovery, and session management.
    Subclasses implement specific MCP server integrations (e.g., Alpha Vantage).
    """
    
    def __init__(self, config: CollectorConfig, mcp_server_url: str, api_key: str):
        """
        Initialize MCP collector.
        
        Args:
            config: Base collector configuration
            mcp_server_url: URL of the MCP server
            api_key: API key for authentication
        """
        super().__init__(config)
        
        self.mcp_server_url = mcp_server_url
        self.api_key = api_key
        self.session = requests.Session()
        
        # MCP-specific attributes
        self.available_tools: Dict[str, Any] = {}
        self.tool_categories: Dict[str, List[str]] = {}
        self.server_info: Dict[str, Any] = {}
        self.connection_established = False
        
        # Configure session
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'StockPicker-MCP-Client/1.0'
        })
        
        # Connection pooling
        adapter = requests.adapters.HTTPAdapter(
            pool_connections=5,
            pool_maxsize=10,
            max_retries=3
        )
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
    
    @property
    def supports_mcp_protocol(self) -> bool:
        """MCP collectors always support MCP protocol."""
        return True
    
    @abstractmethod
    def get_tool_cost_map(self) -> Dict[str, float]:
        """
        Get mapping of MCP tool names to their costs.
        
        Returns:
            Dictionary mapping tool names to cost per call
        """
        pass
    
    # MCP Protocol Methods
    
    def establish_connection(self) -> bool:
        """
        Establish connection with MCP server and discover capabilities.
        
        Returns:
            True if connection successful
        """
        try:
            # Discover server capabilities
            self._discover_server_info()
            
            # Discover available tools
            self._discover_tools()
            
            # Categorize tools for optimization
            self._categorize_tools()
            
            self.connection_established = True
            logger.info(f"MCP connection established with {self.source_name}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to establish MCP connection: {e}")
            self.connection_established = False
            return False
    
    def _discover_server_info(self) -> None:
        """Discover MCP server information and capabilities."""
        try:
            response = self._make_mcp_request('server/info', {})
            self.server_info = response.get('result', {})
            
            logger.info(f"Connected to MCP server: {self.server_info.get('name', 'Unknown')}")
            
        except Exception as e:
            raise MCPConnectionError(f"Failed to get server info: {e}")
    
    def _discover_tools(self) -> None:
        """Discover available MCP tools."""
        try:
            response = self._make_mcp_request('tools/list', {})
            tools = response.get('result', {}).get('tools', [])
            
            self.available_tools = {}
            for tool in tools:
                tool_name = tool.get('name')
                if tool_name:
                    self.available_tools[tool_name] = tool
            
            logger.info(f"Discovered {len(self.available_tools)} MCP tools")
            
        except Exception as e:
            raise MCPConnectionError(f"Failed to discover tools: {e}")
    
    def _categorize_tools(self) -> None:
        """Categorize tools for optimization and easy access."""
        self.tool_categories = {}
        
        for tool_name, tool_info in self.available_tools.items():
            # Extract category from tool description or name
            category = self._extract_tool_category(tool_name, tool_info)
            
            if category not in self.tool_categories:
                self.tool_categories[category] = []
            
            self.tool_categories[category].append(tool_name)
        
        logger.debug(f"Tool categories: {list(self.tool_categories.keys())}")
    
    def _extract_tool_category(self, tool_name: str, tool_info: Dict[str, Any]) -> str:
        """Extract category from tool name or description."""
        # Default categorization logic - can be overridden by subclasses
        name_lower = tool_name.lower()
        
        if any(term in name_lower for term in ['price', 'quote', 'ohlcv', 'market']):
            return 'market_data'
        elif any(term in name_lower for term in ['rsi', 'sma', 'ema', 'macd', 'bbands']):
            return 'technical_indicators'
        elif any(term in name_lower for term in ['news', 'sentiment', 'social']):
            return 'sentiment'
        elif any(term in name_lower for term in ['balance', 'income', 'cash', 'earnings']):
            return 'fundamentals'
        elif any(term in name_lower for term in ['forex', 'currency', 'exchange']):
            return 'forex'
        elif any(term in name_lower for term in ['crypto', 'bitcoin', 'ethereum']):
            return 'cryptocurrency'
        else:
            return 'other'
    
    def _make_mcp_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make a JSON-RPC 2.0 request to the MCP server.
        
        Args:
            method: MCP method name
            params: Method parameters
            
        Returns:
            Response dictionary
        """
        request_id = int(time.time() * 1000)  # Use timestamp as request ID
        
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params
        }
        
        try:
            start_time = time.time()
            
            response = self.session.post(
                self.mcp_server_url,
                json=payload,
                timeout=self.config.timeout
            )
            
            response_time = time.time() - start_time
            
            # Check for HTTP errors
            response.raise_for_status()
            
            # Parse JSON-RPC response
            result = response.json()
            
            # Check for JSON-RPC errors
            if 'error' in result:
                error_info = result['error']
                error_message = f"MCP Error {error_info.get('code', 'Unknown')}: {error_info.get('message', 'Unknown error')}"
                
                # Handle specific error types
                if error_info.get('code') == 429:  # Rate limit
                    raise MCPQuotaError(error_message)
                else:
                    raise MCPError(error_message)
            
            # Record usage for cost tracking
            tool_cost = self._estimate_request_cost(method, params)
            usage_tracker.record_usage(
                collector_name=self.source_name,
                endpoint=method,
                request_type="mcp_tool",
                cost=tool_cost,
                success=True,
                response_time=response_time,
                request_size=len(json.dumps(payload)),
                response_size=len(response.text)
            )
            
            return result
            
        except requests.RequestException as e:
            # Record failed request
            usage_tracker.record_usage(
                collector_name=self.source_name,
                endpoint=method,
                request_type="mcp_tool",
                cost=0.0,
                success=False,
                response_time=0.0,
                error_message=str(e)
            )
            
            raise MCPConnectionError(f"HTTP request failed: {e}")
        
        except json.JSONDecodeError as e:
            raise MCPError(f"Invalid JSON response: {e}")
    
    def call_mcp_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a specific MCP tool.
        
        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments
            
        Returns:
            Tool result
        """
        if not self.connection_established:
            if not self.establish_connection():
                raise MCPConnectionError("Cannot establish MCP connection")
        
        if tool_name not in self.available_tools:
            raise MCPToolError(f"Tool '{tool_name}' not available")
        
        # Check budget before making request
        estimated_cost = self._estimate_tool_cost(tool_name, arguments)
        if not usage_tracker.can_make_request(self.source_name, estimated_cost):
            raise MCPQuotaError("Request would exceed budget limits")
        
        try:
            response = self._make_mcp_request('tools/call', {
                'name': tool_name,
                'arguments': arguments
            })
            
            result = response.get('result', {})
            logger.debug(f"MCP tool '{tool_name}' executed successfully")
            
            return result
            
        except Exception as e:
            logger.error(f"MCP tool '{tool_name}' failed: {e}")
            raise
    
    def batch_call_tools(self, tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Call multiple MCP tools in sequence (with optimization).
        
        Args:
            tool_calls: List of tool calls, each with 'tool_name' and 'arguments'
            
        Returns:
            List of tool results
        """
        results = []
        
        # Optimize tool calls by category to reduce context switching
        categorized_calls = self._optimize_tool_call_order(tool_calls)
        
        for tool_call in categorized_calls:
            try:
                result = self.call_mcp_tool(
                    tool_call['tool_name'],
                    tool_call['arguments']
                )
                results.append({
                    'tool_name': tool_call['tool_name'],
                    'success': True,
                    'result': result
                })
                
            except Exception as e:
                results.append({
                    'tool_name': tool_call['tool_name'],
                    'success': False,
                    'error': str(e)
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
        
        # Return calls ordered by category (can be further optimized)
        optimized_calls = []
        for category in ['market_data', 'technical_indicators', 'fundamentals', 'sentiment', 'other']:
            if category in categorized_calls:
                optimized_calls.extend(categorized_calls[category])
        
        return optimized_calls
    
    def _get_tool_category(self, tool_name: str) -> str:
        """Get category for a tool."""
        for category, tools in self.tool_categories.items():
            if tool_name in tools:
                return category
        return 'other'
    
    def _estimate_request_cost(self, method: str, params: Dict[str, Any]) -> float:
        """Estimate cost of an MCP request."""
        # Base implementation - subclasses should provide more accurate estimates
        if method == 'tools/call':
            tool_name = params.get('name', '')
            return self._estimate_tool_cost(tool_name, params.get('arguments', {}))
        else:
            return 0.0  # Server info and tool discovery are typically free
    
    def _estimate_tool_cost(self, tool_name: str, arguments: Dict[str, Any]) -> float:
        """Estimate cost of a specific tool call."""
        cost_map = self.get_tool_cost_map()
        return cost_map.get(tool_name, 0.0)
    
    # Implementation of abstract methods from CommercialCollectorInterface
    
    def get_api_cost_estimate(self, request_params: Dict[str, Any]) -> float:
        """Estimate cost of request parameters."""
        total_cost = 0.0
        
        # If request specifies tools to call
        if 'tools' in request_params:
            for tool_call in request_params['tools']:
                tool_name = tool_call.get('tool_name', '')
                arguments = tool_call.get('arguments', {})
                total_cost += self._estimate_tool_cost(tool_name, arguments)
        else:
            # Default estimation based on request type
            total_cost = self.cost_per_request
        
        return total_cost
    
    def check_quota_status(self) -> Dict[str, Any]:
        """Check quota status - implemented by subclasses with specific limits."""
        return {
            'remaining_requests': None,
            'used_requests': None,
            'quota_limit': self.monthly_quota_limit,
            'reset_date': None,
            'usage_percentage': 0.0
        }
    
    def get_cost_breakdown(self, time_period: str = "current_month") -> Dict[str, Any]:
        """Get cost breakdown using the usage tracker."""
        if time_period == "current_month":
            return usage_tracker.get_monthly_usage(self.source_name)
        else:
            # For other time periods, return basic info
            return {
                'collector_name': self.source_name,
                'time_period': time_period,
                'total_cost': 0.0,
                'total_requests': 0
            }
    
    # Utility methods
    
    def get_mcp_server_info(self) -> Dict[str, Any]:
        """Get MCP server information."""
        return self.server_info
    
    def get_available_tools(self, category: Optional[str] = None) -> List[str]:
        """
        Get list of available tools, optionally filtered by category.
        
        Args:
            category: Optional category filter
            
        Returns:
            List of tool names
        """
        if category and category in self.tool_categories:
            return self.tool_categories[category]
        else:
            return list(self.available_tools.keys())
    
    def get_tool_categories(self) -> List[str]:
        """Get list of available tool categories."""
        return list(self.tool_categories.keys())
    
    def get_tool_info(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific tool."""
        return self.available_tools.get(tool_name)
    
    def __str__(self) -> str:
        """String representation including MCP info."""
        tool_count = len(self.available_tools)
        return f"{self.name}(source={self.source_name}, tools={tool_count}, mcp=True, authenticated={self._authenticated})"
"""
Data.gov MCP Server

Local MCP server implementation for government financial data access.
Provides JSON-RPC 2.0 compliant MCP server with tools for SEC filings,
institutional holdings, Treasury data, and Federal Reserve indicators.

Features:
- JSON-RPC 2.0 protocol compliance
- Tool discovery and metadata
- Rate limiting and error handling
- Government data access optimization
- AI-native tool design

Usage:
    python server.py --port 3001 --host localhost
"""

import asyncio
import json
import logging
import argparse
import signal
import sys
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
import traceback
from pathlib import Path

# HTTP server imports
from aiohttp import web, WSMsgType
import aiohttp_cors
from aiohttp.web_runner import GracefulExit

# Tool imports
from tools import ALL_DATA_GOV_MCP_TOOLS, TOOL_CATEGORIES

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DataGovMCPServer:
    """
    Data.gov MCP server implementation.
    
    Provides JSON-RPC 2.0 compliant server for government financial data tools.
    """
    
    def __init__(self, host: str = 'localhost', port: int = 3001):
        """
        Initialize MCP server.
        
        Args:
            host: Server host
            port: Server port
        """
        self.host = host
        self.port = port
        self.app = web.Application()
        self.runner = None
        self.site = None
        
        # Server information
        self.server_info = {
            'name': 'Data.gov Financial MCP Server',
            'version': '1.0.0',
            'protocol_version': '2.0',
            'description': 'Government financial data MCP server with SEC, Treasury, and Fed tools',
            'vendor': 'Stock Picker Platform',
            'capabilities': [
                'tools/list',
                'tools/call', 
                'server/info',
                'server/ping'
            ],
            'supported_tools': len(ALL_DATA_GOV_MCP_TOOLS),
            'tool_categories': list(TOOL_CATEGORIES.keys())
        }
        
        # Request tracking
        self.request_count = 0
        self.error_count = 0
        self.tool_usage = {}
        self.start_time = datetime.now()
        
        # Setup routes
        self._setup_routes()
        
        # Setup CORS for development
        self._setup_cors()
    
    def _setup_routes(self):
        """Setup HTTP routes for MCP endpoints."""
        self.app.router.add_post('/mcp', self.handle_mcp_request)
        self.app.router.add_get('/health', self.handle_health_check)
        self.app.router.add_get('/info', self.handle_server_info)
        self.app.router.add_get('/tools', self.handle_tools_list)
    
    def _setup_cors(self):
        """Setup CORS for development."""
        cors = aiohttp_cors.setup(self.app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # Add CORS to all routes
        for route in list(self.app.router.routes()):
            cors.add(route)
    
    async def handle_mcp_request(self, request: web.Request) -> web.Response:
        """Handle MCP JSON-RPC 2.0 requests."""
        try:
            # Parse JSON-RPC request
            body = await request.json()
            
            # Validate JSON-RPC format
            if not self._validate_jsonrpc_request(body):
                return self._create_error_response(
                    None, -32600, "Invalid Request", "Invalid JSON-RPC 2.0 request"
                )
            
            request_id = body.get('id')
            method = body.get('method')
            params = body.get('params', {})
            
            self.request_count += 1
            logger.debug(f"MCP request: {method} (ID: {request_id})")
            
            # Route to appropriate handler
            if method == 'server/info':
                result = await self._handle_server_info(params)
            elif method == 'server/ping':
                result = await self._handle_server_ping(params)
            elif method == 'tools/list':
                result = await self._handle_tools_list(params)
            elif method == 'tools/call':
                result = await self._handle_tool_call(params)
            else:
                return self._create_error_response(
                    request_id, -32601, "Method not found", f"Unknown method: {method}"
                )
            
            # Return successful response
            return self._create_success_response(request_id, result)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            return self._create_error_response(
                None, -32700, "Parse error", f"Invalid JSON: {e}"
            )
        except Exception as e:
            logger.error(f"MCP request error: {e}")
            logger.error(traceback.format_exc())
            self.error_count += 1
            
            return self._create_error_response(
                body.get('id') if 'body' in locals() else None,
                -32603, "Internal error", str(e)
            )
    
    def _validate_jsonrpc_request(self, body: Dict[str, Any]) -> bool:
        """Validate JSON-RPC 2.0 request format."""
        return (
            isinstance(body, dict) and
            body.get('jsonrpc') == '2.0' and
            'method' in body and
            isinstance(body.get('method'), str)
        )
    
    async def _handle_server_info(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle server/info method."""
        return {
            **self.server_info,
            'uptime_seconds': (datetime.now() - self.start_time).total_seconds(),
            'request_count': self.request_count,
            'error_count': self.error_count
        }
    
    async def _handle_server_ping(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle server/ping method."""
        return {
            'status': 'ok',
            'timestamp': datetime.now().isoformat(),
            'server': self.server_info['name']
        }
    
    async def _handle_tools_list(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tools/list method."""
        tools = []
        
        for tool_name, tool_func in ALL_DATA_GOV_MCP_TOOLS.items():
            # Extract tool metadata from docstring and function signature
            tool_info = {
                'name': tool_name,
                'description': self._extract_tool_description(tool_func),
                'parameters': self._extract_tool_parameters(tool_func),
                'category': self._get_tool_category(tool_name),
                'cost_estimate': 0.0,  # Government data is free
                'rate_limit': {
                    'requests': 60,
                    'period_seconds': 60
                }
            }
            
            tools.append(tool_info)
        
        return {
            'tools': tools,
            'total_count': len(tools),
            'categories': TOOL_CATEGORIES
        }
    
    async def _handle_tool_call(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Handle tools/call method."""
        tool_name = params.get('name')
        arguments = params.get('arguments', {})
        
        if not tool_name:
            raise ValueError("Tool name is required")
        
        if tool_name not in ALL_DATA_GOV_MCP_TOOLS:
            raise ValueError(f"Unknown tool: {tool_name}")
        
        # Get tool function
        tool_func = ALL_DATA_GOV_MCP_TOOLS[tool_name]
        
        # Track tool usage
        self.tool_usage[tool_name] = self.tool_usage.get(tool_name, 0) + 1
        
        # Execute tool
        try:
            start_time = datetime.now()
            result = await tool_func(**arguments)
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Add metadata
            if isinstance(result, dict):
                result['execution_metadata'] = {
                    'tool_name': tool_name,
                    'execution_time_seconds': execution_time,
                    'server': self.server_info['name'],
                    'timestamp': datetime.now().isoformat()
                }
            
            logger.info(f"Tool {tool_name} executed successfully in {execution_time:.2f}s")
            return result
            
        except Exception as e:
            logger.error(f"Tool {tool_name} execution failed: {e}")
            logger.error(traceback.format_exc())
            
            return {
                'success': False,
                'error': str(e),
                'tool_name': tool_name,
                'arguments': arguments,
                'execution_metadata': {
                    'error_type': type(e).__name__,
                    'timestamp': datetime.now().isoformat()
                }
            }
    
    def _extract_tool_description(self, tool_func: Callable) -> str:
        """Extract tool description from function docstring."""
        if tool_func.__doc__:
            lines = tool_func.__doc__.strip().split('\n')
            for line in lines:
                line = line.strip()
                if line and not line.startswith('MCP Tool:'):
                    if line.startswith('MCP Tool:'):
                        return line.replace('MCP Tool:', '').strip()
                    elif not line.startswith(('Args:', 'Returns:')):
                        return line
        return f"Government financial data tool: {tool_func.__name__}"
    
    def _extract_tool_parameters(self, tool_func: Callable) -> Dict[str, Any]:
        """Extract tool parameters from function signature."""
        import inspect
        
        try:
            signature = inspect.signature(tool_func)
            parameters = {}
            
            for param_name, param in signature.parameters.items():
                param_info = {
                    'name': param_name,
                    'required': param.default == inspect.Parameter.empty,
                    'type': 'string'  # Default type
                }
                
                # Try to infer type from annotation
                if param.annotation != inspect.Parameter.empty:
                    param_info['type'] = self._python_type_to_json_type(param.annotation)
                
                # Add default value if available
                if param.default != inspect.Parameter.empty:
                    param_info['default'] = param.default
                
                parameters[param_name] = param_info
            
            return parameters
            
        except Exception as e:
            logger.warning(f"Failed to extract parameters for {tool_func.__name__}: {e}")
            return {}
    
    def _python_type_to_json_type(self, python_type) -> str:
        """Convert Python type to JSON schema type."""
        if python_type == str:
            return 'string'
        elif python_type == int:
            return 'integer'  
        elif python_type == float:
            return 'number'
        elif python_type == bool:
            return 'boolean'
        elif python_type == list or str(python_type).startswith('typing.List'):
            return 'array'
        elif python_type == dict or str(python_type).startswith('typing.Dict'):
            return 'object'
        else:
            return 'string'  # Default fallback
    
    def _get_tool_category(self, tool_name: str) -> str:
        """Get category for a tool."""
        for category, tools in TOOL_CATEGORIES.items():
            if tool_name in tools:
                return category
        return 'general'
    
    def _create_success_response(self, request_id: Any, result: Any) -> web.Response:
        """Create JSON-RPC success response."""
        response_body = {
            'jsonrpc': '2.0',
            'id': request_id,
            'result': result
        }
        
        return web.Response(
            text=json.dumps(response_body, default=str),
            content_type='application/json',
            headers={'Access-Control-Allow-Origin': '*'}
        )
    
    def _create_error_response(
        self, 
        request_id: Any, 
        code: int, 
        message: str, 
        data: Any = None
    ) -> web.Response:
        """Create JSON-RPC error response."""
        error_body = {
            'code': code,
            'message': message
        }
        
        if data is not None:
            error_body['data'] = data
        
        response_body = {
            'jsonrpc': '2.0',
            'id': request_id,
            'error': error_body
        }
        
        return web.Response(
            text=json.dumps(response_body, default=str),
            content_type='application/json',
            status=200,  # JSON-RPC errors use HTTP 200
            headers={'Access-Control-Allow-Origin': '*'}
        )
    
    async def handle_health_check(self, request: web.Request) -> web.Response:
        """Handle health check endpoint."""
        health_data = {
            'status': 'healthy',
            'server': self.server_info['name'],
            'version': self.server_info['version'],
            'uptime_seconds': (datetime.now() - self.start_time).total_seconds(),
            'requests_processed': self.request_count,
            'errors': self.error_count,
            'tools_available': len(ALL_DATA_GOV_MCP_TOOLS),
            'timestamp': datetime.now().isoformat()
        }
        
        return web.Response(
            text=json.dumps(health_data, indent=2),
            content_type='application/json'
        )
    
    async def handle_server_info(self, request: web.Request) -> web.Response:
        """Handle server info endpoint."""
        return web.Response(
            text=json.dumps(self.server_info, indent=2),
            content_type='application/json'
        )
    
    async def handle_tools_list(self, request: web.Request) -> web.Response:
        """Handle tools list endpoint."""
        tools_result = await self._handle_tools_list({})
        
        return web.Response(
            text=json.dumps(tools_result, indent=2),
            content_type='application/json'
        )
    
    async def start(self):
        """Start the MCP server."""
        try:
            logger.info(f"Starting Data.gov MCP server on {self.host}:{self.port}")
            
            # Create runner and site
            self.runner = web.AppRunner(self.app)
            await self.runner.setup()
            
            self.site = web.TCPSite(
                self.runner,
                host=self.host,
                port=self.port,
                reuse_address=True,
                reuse_port=True
            )
            
            await self.site.start()
            
            logger.info(f"Data.gov MCP server started successfully!")
            logger.info(f"  - MCP endpoint: http://{self.host}:{self.port}/mcp")
            logger.info(f"  - Health check: http://{self.host}:{self.port}/health")
            logger.info(f"  - Server info: http://{self.host}:{self.port}/info")
            logger.info(f"  - Tools list: http://{self.host}:{self.port}/tools")
            logger.info(f"  - Available tools: {len(ALL_DATA_GOV_MCP_TOOLS)}")
            
        except Exception as e:
            logger.error(f"Failed to start MCP server: {e}")
            raise
    
    async def stop(self):
        """Stop the MCP server."""
        logger.info("Stopping Data.gov MCP server...")
        
        if self.site:
            await self.site.stop()
        
        if self.runner:
            await self.runner.cleanup()
        
        logger.info("Data.gov MCP server stopped")
    
    async def run_forever(self):
        """Run server until interrupted."""
        await self.start()
        
        try:
            # Wait indefinitely
            while True:
                await asyncio.sleep(1)
                
        except (KeyboardInterrupt, GracefulExit):
            logger.info("Received shutdown signal")
        finally:
            await self.stop()


def setup_signal_handlers(server: DataGovMCPServer):
    """Setup signal handlers for graceful shutdown."""
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}")
        raise KeyboardInterrupt()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Data.gov MCP Server')
    parser.add_argument('--host', default='localhost', help='Server host (default: localhost)')
    parser.add_argument('--port', type=int, default=3001, help='Server port (default: 3001)')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')
    
    args = parser.parse_args()
    
    # Setup logging level
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")
    
    # Create and run server
    server = DataGovMCPServer(host=args.host, port=args.port)
    setup_signal_handlers(server)
    
    try:
        await server.run_forever()
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        logger.error(traceback.format_exc())
        sys.exit(1)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)
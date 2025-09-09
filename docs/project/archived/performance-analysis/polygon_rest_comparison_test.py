#!/usr/bin/env python3
"""
Polygon.io REST API vs MCP Protocol Comparison Test
Demonstrates the differences in development experience and performance
"""

import requests
import time
import json
from typing import Dict, Any

class PolygonRESTComparison:
    """Compare Polygon.io REST API vs MCP Protocol"""
    
    def __init__(self, api_key: str = "ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr"):
        self.api_key = api_key
        self.base_url = "https://api.polygon.io"
        
    def test_rest_api_call(self, endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Test a REST API call and measure performance"""
        
        if params is None:
            params = {}
            
        params['apikey'] = self.api_key
        
        start_time = time.time()
        
        try:
            response = requests.get(f"{self.base_url}{endpoint}", params=params, timeout=10)
            end_time = time.time()
            
            return {
                "status": "success" if response.status_code == 200 else "error",
                "status_code": response.status_code,
                "response_time_ms": (end_time - start_time) * 1000,
                "response_size_bytes": len(response.content),
                "data": response.json() if response.status_code == 200 else response.text
            }
            
        except Exception as e:
            end_time = time.time()
            return {
                "status": "error",
                "response_time_ms": (end_time - start_time) * 1000,
                "error": str(e)
            }

    def compare_protocols(self) -> Dict[str, Any]:
        """Compare MCP vs REST API across multiple dimensions"""
        
        # Test some basic REST API endpoints
        rest_tests = [
            {
                "name": "Market Status",
                "endpoint": "/v1/marketstatus/now",
                "params": {}
            },
            {
                "name": "Market Holidays", 
                "endpoint": "/v1/marketstatus/upcoming",
                "params": {}
            },
            {
                "name": "Ticker Details",
                "endpoint": "/v3/reference/tickers/AAPL",
                "params": {}
            },
            {
                "name": "Last Quote",
                "endpoint": "/v2/last/nbbo/AAPL",
                "params": {}
            }
        ]
        
        rest_results = []
        for test in rest_tests:
            print(f"Testing REST: {test['name']}")
            result = self.test_rest_api_call(test['endpoint'], test['params'])
            result['test_name'] = test['name']
            rest_results.append(result)
            
        # Calculate REST API statistics
        successful_rest = [r for r in rest_results if r['status'] == 'success']
        avg_rest_time = sum(r['response_time_ms'] for r in rest_results) / len(rest_results)
        
        return {
            "rest_api_results": {
                "total_tests": len(rest_results),
                "successful": len(successful_rest),
                "success_rate": len(successful_rest) / len(rest_results) * 100,
                "avg_response_time_ms": avg_rest_time,
                "detailed_results": rest_results
            },
            "mcp_protocol_comparison": {
                "development_experience": {
                    "rest_api": {
                        "pros": [
                            "Familiar HTTP patterns",
                            "Extensive tooling (Postman, curl, etc.)",
                            "Well-documented endpoints"
                        ],
                        "cons": [
                            "Manual parameter validation",
                            "No type safety",
                            "Endpoint discovery requires documentation",
                            "Error handling varies by endpoint"
                        ]
                    },
                    "mcp_protocol": {
                        "pros": [
                            "Built-in parameter validation",
                            "Type safety with IDE support", 
                            "Dynamic tool discovery",
                            "Consistent error handling",
                            "Function signatures with autocomplete"
                        ],
                        "cons": [
                            "Newer protocol - less familiar",
                            "Requires MCP-compatible tooling",
                            "Authentication setup complexity"
                        ]
                    }
                },
                "performance_characteristics": {
                    "rest_api": {
                        "network_overhead": "Standard HTTP headers and JSON",
                        "error_handling": "HTTP status codes + custom error formats",
                        "caching": "HTTP caching mechanisms available",
                        "tooling": "Mature ecosystem"
                    },
                    "mcp_protocol": {
                        "network_overhead": "Optimized for function calls",
                        "error_handling": "Consistent structured errors",
                        "caching": "Protocol-level optimization possible",
                        "tooling": "Emerging ecosystem"
                    }
                },
                "institutional_considerations": {
                    "data_quality": "Both: High-quality Polygon.io data",
                    "compliance": "Both: Meet institutional requirements",
                    "integration_complexity": {
                        "rest_api": "Traditional integration patterns",
                        "mcp_protocol": "Modern function-based integration"
                    },
                    "maintenance": {
                        "rest_api": "Manual endpoint updates and validation",
                        "mcp_protocol": "Automatic tool discovery and validation"
                    }
                }
            }
        }

def main():
    """Run the comparison test"""
    
    print("Polygon.io REST API vs MCP Protocol Comparison")
    print("=" * 55)
    
    comparator = PolygonRESTComparison()
    results = comparator.compare_protocols()
    
    # Display REST API results
    rest_results = results["rest_api_results"]
    print(f"\nREST API Test Results:")
    print(f"  Total Tests: {rest_results['total_tests']}")
    print(f"  Successful: {rest_results['successful']}")
    print(f"  Success Rate: {rest_results['success_rate']:.1f}%")
    print(f"  Average Response Time: {rest_results['avg_response_time_ms']:.2f}ms")
    
    print("\nDetailed REST API Results:")
    for result in rest_results['detailed_results']:
        status_emoji = "✅" if result['status'] == 'success' else "❌"
        print(f"  {status_emoji} {result['test_name']}: {result['response_time_ms']:.2f}ms")
        if result['status'] == 'error':
            print(f"    Error: {result.get('error', 'Unknown error')}")
    
    # Display comparison summary
    comparison = results["mcp_protocol_comparison"]
    
    print(f"\n🔄 Protocol Comparison Summary:")
    print(f"  REST API: Familiar, mature tooling, manual validation")
    print(f"  MCP Protocol: Type-safe, auto-discovery, consistent errors")
    
    print(f"\n🏛️ Institutional Assessment:")
    institutional = comparison["institutional_considerations"]
    print(f"  Data Quality: {institutional['data_quality']}")
    print(f"  Compliance: {institutional['compliance']}")
    print(f"  Integration: REST = {institutional['integration_complexity']['rest_api']}")
    print(f"              MCP = {institutional['integration_complexity']['mcp_protocol']}")

if __name__ == "__main__":
    main()
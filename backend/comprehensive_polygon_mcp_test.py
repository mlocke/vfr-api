#!/usr/bin/env python3
"""
Comprehensive Polygon.io MCP Server Test Suite
Tests multiple MCP tools and saves detailed results to test_output/POLYGON/
"""

import json
import subprocess
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

def mcp_call(process, method: str, params: Dict[str, Any], request_id: int) -> Optional[Dict[str, Any]]:
    """Make a single MCP call and return the response"""
    message = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": params
    }
    
    json_message = json.dumps(message) + '\n'
    process.stdin.write(json_message)
    process.stdin.flush()
    
    time.sleep(1.5)  # Give server time to process
    
    try:
        response_line = process.stdout.readline()
        if response_line:
            return json.loads(response_line.strip())
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse response for {method}: {e}")
        return None
    
    return None

def comprehensive_polygon_test():
    """Run comprehensive tests on Polygon.io MCP server"""
    
    # Set up environment
    env = os.environ.copy()
    env['POLYGON_API_KEY'] = 'ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr'
    env['PATH'] = f"{os.path.expanduser('~')}/.local/bin:{env.get('PATH', '')}"
    
    # Test results structure
    test_results = {
        'test_metadata': {
            'timestamp': datetime.now().isoformat(),
            'test_duration': None,
            'api_key': 'ZptDc62SeqTh7FJxpLhYEPo4IPjSxQdr',
            'server_version': None,
            'protocol_version': None,
            'total_tests': 0,
            'passed_tests': 0,
            'failed_tests': 0
        },
        'server_initialization': {},
        'tool_discovery': {},
        'tool_tests': [],
        'test_summary': {}
    }
    
    start_time = time.time()
    
    print("🚀 Starting Comprehensive Polygon.io MCP Server Test")
    print("=" * 60)
    
    # Start MCP server
    cmd = ['uvx', '--from', 'git+https://github.com/polygon-io/mcp_polygon@v0.4.0', 'mcp_polygon']
    
    try:
        process = subprocess.Popen(
            cmd,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=0
        )
        
        time.sleep(3)
        print("✅ MCP server started")
        
        # Step 1: Initialize MCP connection
        print("\n🔗 Step 1: MCP Server Initialization")
        init_response = mcp_call(process, "initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {"roots": {"listChanged": True}},
            "clientInfo": {"name": "polygon-comprehensive-test", "version": "1.0"}
        }, 1)
        
        if init_response and 'result' in init_response:
            server_info = init_response['result']['serverInfo']
            test_results['server_initialization'] = init_response['result']
            test_results['test_metadata']['server_version'] = server_info['version']
            test_results['test_metadata']['protocol_version'] = init_response['result']['protocolVersion']
            print(f"✅ Server: {server_info['name']} v{server_info['version']}")
        else:
            print("❌ Server initialization failed")
            return test_results
        
        # Step 2: Send initialized notification
        print("\n📤 Step 2: Sending initialized notification")
        initialized_message = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }
        json_message = json.dumps(initialized_message) + '\n'
        process.stdin.write(json_message)
        process.stdin.flush()
        time.sleep(1)
        
        # Step 3: Discover available tools
        print("\n🔧 Step 3: Tool Discovery")
        tools_response = mcp_call(process, "tools/list", {}, 2)
        
        if tools_response and 'result' in tools_response:
            tools = tools_response['result'].get('tools', [])
            test_results['tool_discovery'] = {
                'total_tools': len(tools),
                'tools': tools,
                'categories': {}
            }
            
            # Categorize tools
            categories = {}
            for tool in tools:
                name = tool['name']
                if any(x in name for x in ['agg', 'trade', 'quote', 'snapshot']):
                    category = 'Market Data'
                elif 'market' in name or 'holiday' in name:
                    category = 'Market Status'
                elif any(x in name for x in ['news', 'financial', 'earnings', 'ipo']):
                    category = 'News & Fundamentals'  
                elif any(x in name for x in ['ticker', 'exchange', 'condition']):
                    category = 'Reference Data'
                elif any(x in name for x in ['crypto', 'forex', 'currency']):
                    category = 'Forex/Crypto'
                elif any(x in name for x in ['split', 'dividend']):
                    category = 'Corporate Actions'
                else:
                    category = 'Other'
                
                if category not in categories:
                    categories[category] = []
                categories[category].append(name)
            
            test_results['tool_discovery']['categories'] = categories
            
            print(f"✅ Discovered {len(tools)} tools in {len(categories)} categories:")
            for category, tool_list in categories.items():
                print(f"   📊 {category}: {len(tool_list)} tools")
        else:
            print("❌ Tool discovery failed")
            return test_results
        
        # Step 4: Test key MCP tools
        print(f"\n🧪 Step 4: Testing Key MCP Tools")
        
        test_cases = [
            {
                'name': 'get_market_status',
                'description': 'Market trading status',
                'params': {},
                'category': 'Market Status'
            },
            {
                'name': 'get_last_quote',
                'description': 'Latest stock quote - AAPL',
                'params': {'ticker': 'AAPL'},
                'category': 'Market Data'
            },
            {
                'name': 'get_ticker_details',
                'description': 'Company details - MSFT',
                'params': {'ticker': 'MSFT'},
                'category': 'Reference Data'
            },
            {
                'name': 'get_previous_close_agg',
                'description': 'Previous close - TSLA',
                'params': {'ticker': 'TSLA'},
                'category': 'Market Data'
            },
            {
                'name': 'list_ticker_news',
                'description': 'Recent news - GOOGL',
                'params': {'ticker': 'GOOGL', 'limit': 3},
                'category': 'News & Fundamentals'
            },
            {
                'name': 'get_last_forex_quote',
                'description': 'Forex quote - EUR/USD',
                'params': {'from_': 'EUR', 'to': 'USD'},
                'category': 'Forex/Crypto'
            },
            {
                'name': 'get_snapshot_direction',
                'description': 'Market gainers',
                'params': {'market_type': 'stocks', 'direction': 'gainers'},
                'category': 'Market Data'
            }
        ]
        
        test_id = 10  # Start after initialization calls
        for i, test_case in enumerate(test_cases, 1):
            print(f"\n   🧪 Test {i}/{len(test_cases)}: {test_case['description']}")
            
            test_result = {
                'test_name': test_case['name'],
                'description': test_case['description'],
                'category': test_case['category'],
                'params': test_case['params'],
                'success': False,
                'response_time': None,
                'data_received': None,
                'error': None,
                'raw_response': None
            }
            
            start_test_time = time.time()
            
            response = mcp_call(process, "tools/call", {
                "name": test_case['name'],
                "arguments": test_case['params']
            }, test_id)
            
            test_result['response_time'] = round(time.time() - start_test_time, 3)
            test_id += 1
            
            if response:
                test_result['raw_response'] = response
                if 'result' in response:
                    test_result['success'] = True
                    # Parse the response content
                    try:
                        content = response['result'][0]['content'][0]['text']
                        data = json.loads(content)
                        test_result['data_received'] = data
                        
                        # Extract key info based on test type
                        if test_case['name'] == 'get_market_status':
                            market_info = data.get('market', 'unknown')
                            print(f"      ✅ Market Status: {market_info}")
                        elif test_case['name'] == 'get_last_quote':
                            quote_data = data.get('results', {})
                            if quote_data:
                                price = quote_data.get('P', 'N/A')
                                volume = quote_data.get('S', 'N/A')
                                print(f"      ✅ AAPL Quote: ${price}, Volume: {volume}")
                        elif test_case['name'] == 'get_ticker_details':
                            ticker_info = data.get('results', {})
                            name = ticker_info.get('name', 'N/A')
                            market_cap = ticker_info.get('market_cap', 'N/A')
                            print(f"      ✅ MSFT: {name}, Market Cap: {market_cap}")
                        elif test_case['name'] == 'get_previous_close_agg':
                            close_data = data.get('results', [{}])[0] if data.get('results') else {}
                            close_price = close_data.get('c', 'N/A')
                            volume = close_data.get('v', 'N/A')
                            print(f"      ✅ TSLA Previous Close: ${close_price}, Volume: {volume}")
                        elif test_case['name'] == 'list_ticker_news':
                            news_results = data.get('results', [])
                            print(f"      ✅ GOOGL News: {len(news_results)} articles found")
                        elif test_case['name'] == 'get_last_forex_quote':
                            forex_data = data.get('results', {})
                            rate = forex_data.get('c', 'N/A')
                            print(f"      ✅ EUR/USD Rate: {rate}")
                        elif test_case['name'] == 'get_snapshot_direction':
                            gainers = data.get('results', [])
                            print(f"      ✅ Market Gainers: {len(gainers)} stocks found")
                        
                    except (json.JSONDecodeError, KeyError, IndexError) as e:
                        print(f"      ⚠️ Data parsing issue: {e}")
                        test_result['data_received'] = "Raw response parsing failed"
                        
                elif 'error' in response:
                    test_result['error'] = response['error']
                    error_msg = response['error'].get('message', 'Unknown error')
                    print(f"      ❌ Error: {error_msg}")
                else:
                    print(f"      ⚠️ Unexpected response format")
            else:
                test_result['error'] = "No response received"
                print(f"      ❌ No response received")
            
            test_results['tool_tests'].append(test_result)
            test_results['test_metadata']['total_tests'] += 1
            if test_result['success']:
                test_results['test_metadata']['passed_tests'] += 1
            else:
                test_results['test_metadata']['failed_tests'] += 1
        
    except Exception as e:
        print(f"❌ Test suite failed with exception: {e}")
        test_results['test_metadata']['exception'] = str(e)
    
    finally:
        try:
            process.terminate()
            process.wait()
        except:
            pass
    
    # Calculate test duration and generate summary
    end_time = time.time()
    test_results['test_metadata']['test_duration'] = round(end_time - start_time, 2)
    
    # Generate summary
    total = test_results['test_metadata']['total_tests']
    passed = test_results['test_metadata']['passed_tests']
    failed = test_results['test_metadata']['failed_tests']
    success_rate = (passed / total * 100) if total > 0 else 0
    
    test_results['test_summary'] = {
        'success_rate_percent': round(success_rate, 1),
        'avg_response_time': round(sum(t.get('response_time', 0) for t in test_results['tool_tests']) / len(test_results['tool_tests']), 3) if test_results['tool_tests'] else 0,
        'categories_tested': len(set(t['category'] for t in test_results['tool_tests'])),
        'tools_available': test_results['tool_discovery'].get('total_tools', 0),
        'tools_tested': len(test_results['tool_tests'])
    }
    
    print(f"\n📊 Test Summary:")
    print(f"   ✅ Success Rate: {success_rate:.1f}% ({passed}/{total})")
    print(f"   ⏱️  Average Response Time: {test_results['test_summary']['avg_response_time']}s")
    print(f"   🔧 Tools Available: {test_results['test_summary']['tools_available']}")
    print(f"   🧪 Tools Tested: {test_results['test_summary']['tools_tested']}")
    print(f"   📊 Categories: {test_results['test_summary']['categories_tested']}")
    
    return test_results

def save_test_results(results: Dict[str, Any], output_dir: str):
    """Save test results to output directory"""
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    # Save comprehensive results
    results_file = os.path.join(output_dir, f'polygon_mcp_comprehensive_test_{timestamp}.json')
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    # Save summary report
    summary_file = os.path.join(output_dir, f'polygon_mcp_test_summary_{timestamp}.md')
    with open(summary_file, 'w') as f:
        f.write(f"# Polygon.io MCP Server Test Summary\n\n")
        f.write(f"**Test Date**: {results['test_metadata']['timestamp']}\n")
        f.write(f"**Test Duration**: {results['test_metadata']['test_duration']}s\n")
        f.write(f"**Server Version**: {results['test_metadata']['server_version']}\n")
        f.write(f"**Protocol Version**: {results['test_metadata']['protocol_version']}\n\n")
        
        f.write(f"## Test Results\n\n")
        f.write(f"- **Success Rate**: {results['test_summary']['success_rate_percent']}%\n")
        f.write(f"- **Tests Passed**: {results['test_metadata']['passed_tests']}/{results['test_metadata']['total_tests']}\n")
        f.write(f"- **Average Response Time**: {results['test_summary']['avg_response_time']}s\n")
        f.write(f"- **Tools Available**: {results['test_summary']['tools_available']}\n")
        f.write(f"- **Categories Tested**: {results['test_summary']['categories_tested']}\n\n")
        
        f.write(f"## Tool Categories\n\n")
        for category, tools in results['tool_discovery']['categories'].items():
            f.write(f"### {category} ({len(tools)} tools)\n")
            for tool in tools[:5]:  # First 5 tools
                f.write(f"- {tool}\n")
            if len(tools) > 5:
                f.write(f"- ... and {len(tools) - 5} more\n")
            f.write("\n")
        
        f.write(f"## Individual Test Results\n\n")
        for test in results['tool_tests']:
            status = "✅ PASSED" if test['success'] else "❌ FAILED"
            f.write(f"### {test['test_name']} - {status}\n")
            f.write(f"- **Description**: {test['description']}\n")
            f.write(f"- **Category**: {test['category']}\n")
            f.write(f"- **Response Time**: {test['response_time']}s\n")
            if test['error']:
                f.write(f"- **Error**: {test['error']}\n")
            f.write("\n")
    
    return results_file, summary_file

def main():
    """Main test execution"""
    print("🧪 Polygon.io MCP Server Comprehensive Test Suite")
    print("=" * 50)
    
    # Run tests
    results = comprehensive_polygon_test()
    
    # Save results
    output_dir = "/Users/michaellocke/WebstormProjects/Home/public/stock-picker/test_output/POLYGON"
    results_file, summary_file = save_test_results(results, output_dir)
    
    print(f"\n💾 Test Results Saved:")
    print(f"   📄 Detailed Results: {results_file}")
    print(f"   📋 Summary Report: {summary_file}")
    
    # Return success/failure
    success_rate = results['test_summary']['success_rate_percent']
    if success_rate >= 80:
        print(f"\n🎉 TEST SUITE PASSED: {success_rate}% success rate")
        return 0
    else:
        print(f"\n⚠️ TEST SUITE WARNING: {success_rate}% success rate (below 80% threshold)")
        return 1

if __name__ == "__main__":
    exit(main())
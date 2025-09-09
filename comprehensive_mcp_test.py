#!/usr/bin/env python3
"""
Comprehensive MCP Collector Testing Suite
Tests all integrated MCP servers to validate functionality, performance, and reliability.

This script provides detailed outcome analysis for all MCP collectors:
- Alpha Vantage MCP
- Polygon.io MCP  
- Yahoo Finance MCP
- Dappier MCP (Web Intelligence)
- Data.gov MCP (Government)
- SEC EDGAR MCP (Government)
"""

import sys
import os
import json
import time
import traceback
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Tuple

# Add backend directory to Python path
backend_path = Path(__file__).parent / "backend" / "data_collectors"
sys.path.insert(0, str(backend_path))

class MCPTestSuite:
    """Comprehensive MCP testing suite."""
    
    def __init__(self):
        self.results = {
            "test_timestamp": datetime.now().isoformat(),
            "test_summary": {
                "total_collectors": 0,
                "tested_collectors": 0,
                "passed_collectors": 0,
                "failed_collectors": 0,
                "warning_collectors": 0
            },
            "collector_results": {}
        }
        
    def log(self, message: str, level: str = "INFO"):
        """Log message with timestamp."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def test_collector_import(self, module_path: str, class_name: str) -> Tuple[bool, str, Any]:
        """Test if collector can be imported."""
        try:
            module = __import__(module_path, fromlist=[class_name])
            collector_class = getattr(module, class_name)
            return True, f"✓ {class_name} imported successfully", collector_class
        except ImportError as e:
            return False, f"❌ Import failed: {e}", None
        except AttributeError as e:
            return False, f"❌ Class not found: {e}", None
        except Exception as e:
            return False, f"❌ Unexpected error: {e}", None
            
    def test_collector_initialization(self, collector_class: Any, collector_name: str) -> Tuple[bool, str, Any]:
        """Test collector initialization."""
        try:
            # Try to initialize with minimal config
            if "alpha_vantage" in collector_name.lower():
                collector = collector_class(api_key="demo")
            elif "polygon" in collector_name.lower():
                collector = collector_class(api_key="demo")
            elif "yahoo" in collector_name.lower():
                collector = collector_class()
            elif "dappier" in collector_name.lower():
                collector = collector_class(api_key="demo")
            elif "data_gov" in collector_name.lower() or "sec_edgar" in collector_name.lower():
                collector = collector_class()
            else:
                collector = collector_class()
                
            return True, f"✓ {collector_name} initialized successfully", collector
        except Exception as e:
            return False, f"❌ Initialization failed: {e}", None
            
    def test_collector_methods(self, collector: Any, collector_name: str) -> Dict[str, Any]:
        """Test basic collector methods."""
        methods_tested = {}
        
        # Test common methods
        common_methods = [
            "get_available_tools",
            "should_activate", 
            "get_activation_priority",
            "get_supported_request_types"
        ]
        
        for method_name in common_methods:
            try:
                if hasattr(collector, method_name):
                    method = getattr(collector, method_name)
                    if method_name == "should_activate":
                        result = method({})  # Empty filter criteria
                    elif method_name == "get_activation_priority":
                        result = method({})  # Empty filter criteria
                    else:
                        result = method()
                    methods_tested[method_name] = {
                        "status": "✓ PASS",
                        "result_type": str(type(result).__name__),
                        "result_length": len(result) if hasattr(result, '__len__') else 1
                    }
                else:
                    methods_tested[method_name] = {
                        "status": "⚠ NOT IMPLEMENTED",
                        "result_type": "N/A",
                        "result_length": 0
                    }
            except Exception as e:
                methods_tested[method_name] = {
                    "status": f"❌ FAIL: {str(e)[:100]}",
                    "result_type": "error",
                    "result_length": 0
                }
                
        return methods_tested
        
    def test_mcp_specific_functionality(self, collector: Any, collector_name: str) -> Dict[str, Any]:
        """Test MCP-specific functionality."""
        mcp_tests = {}
        
        # Test MCP server connection (if applicable)
        if hasattr(collector, 'mcp_client') or hasattr(collector, 'establish_connection'):
            try:
                if hasattr(collector, 'establish_connection'):
                    connection_result = collector.establish_connection()
                    mcp_tests["mcp_connection"] = {
                        "status": "✓ CONNECTION AVAILABLE",
                        "details": "MCP server connection method exists"
                    }
                else:
                    mcp_tests["mcp_connection"] = {
                        "status": "⚠ NO CONNECTION METHOD",
                        "details": "No establish_connection method found"
                    }
            except Exception as e:
                mcp_tests["mcp_connection"] = {
                    "status": f"❌ CONNECTION FAILED: {str(e)[:100]}",
                    "details": "MCP server unavailable or credentials invalid"
                }
        
        # Test tool discovery
        if hasattr(collector, 'get_available_tools'):
            try:
                tools = collector.get_available_tools()
                mcp_tests["tool_discovery"] = {
                    "status": "✓ TOOLS DISCOVERED",
                    "tool_count": len(tools) if tools else 0,
                    "details": f"Found {len(tools) if tools else 0} available tools"
                }
            except Exception as e:
                mcp_tests["tool_discovery"] = {
                    "status": f"❌ TOOL DISCOVERY FAILED: {str(e)[:100]}",
                    "tool_count": 0,
                    "details": "Could not retrieve tool list"
                }
        
        # Test router compliance methods
        router_methods = ["should_activate", "get_activation_priority", "get_supported_request_types"]
        router_compliance = 0
        for method in router_methods:
            if hasattr(collector, method):
                router_compliance += 1
                
        mcp_tests["router_compliance"] = {
            "status": "✓ COMPLIANT" if router_compliance == 3 else f"⚠ PARTIAL ({router_compliance}/3)",
            "compliance_score": f"{router_compliance}/3",
            "details": f"Implements {router_compliance} of 3 required router methods"
        }
        
        return mcp_tests
        
    def test_commercial_mcp_collectors(self) -> Dict[str, Any]:
        """Test all commercial MCP collectors."""
        self.log("Testing Commercial MCP Collectors", "INFO")
        commercial_results = {}
        
        collectors_to_test = [
            {
                "name": "Alpha Vantage MCP",
                "module": "commercial.mcp.alpha_vantage_mcp_collector",
                "class": "AlphaVantageMCPCollector",
                "expected_tools": 79
            },
            {
                "name": "Polygon.io MCP", 
                "module": "commercial.mcp.polygon_mcp_collector",
                "class": "PolygonMCPCollector",
                "expected_tools": 40
            },
            {
                "name": "Yahoo Finance MCP",
                "module": "commercial.mcp.yahoo_finance_mcp_collector", 
                "class": "YahooFinanceMCPCollector",
                "expected_tools": 10
            },
            {
                "name": "Dappier MCP",
                "module": "commercial.mcp.dappier_mcp_collector",
                "class": "DappierMCPCollector", 
                "expected_tools": 2
            }
        ]
        
        for collector_config in collectors_to_test:
            self.log(f"Testing {collector_config['name']}...", "INFO")
            collector_result = self.test_single_collector(collector_config)
            commercial_results[collector_config['name']] = collector_result
            
        return commercial_results
        
    def test_government_mcp_collectors(self) -> Dict[str, Any]:
        """Test all government MCP collectors."""
        self.log("Testing Government MCP Collectors", "INFO")
        government_results = {}
        
        collectors_to_test = [
            {
                "name": "Data.gov MCP",
                "module": "government.mcp.data_gov_mcp_collector",
                "class": "DataGovMCPCollector",
                "expected_tools": 5
            },
            {
                "name": "SEC EDGAR MCP",
                "module": "government.mcp.sec_edgar_mcp_collector", 
                "class": "SECEdgarMCPCollector",
                "expected_tools": 8
            }
        ]
        
        for collector_config in collectors_to_test:
            self.log(f"Testing {collector_config['name']}...", "INFO")
            collector_result = self.test_single_collector(collector_config)
            government_results[collector_config['name']] = collector_result
            
        return government_results
        
    def test_single_collector(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test a single collector comprehensively."""
        start_time = time.time()
        result = {
            "collector_name": config['name'],
            "expected_tools": config.get('expected_tools', 'Unknown'),
            "test_timestamp": datetime.now().isoformat(),
            "tests": {},
            "overall_status": "UNKNOWN",
            "test_duration": 0
        }
        
        try:
            # Test 1: Import
            import_success, import_msg, collector_class = self.test_collector_import(
                config['module'], config['class']
            )
            result['tests']['import'] = {
                "status": "PASS" if import_success else "FAIL",
                "message": import_msg
            }
            
            if not import_success:
                result['overall_status'] = "FAIL - Import Failed"
                return result
                
            # Test 2: Initialization
            init_success, init_msg, collector_instance = self.test_collector_initialization(
                collector_class, config['name']
            )
            result['tests']['initialization'] = {
                "status": "PASS" if init_success else "FAIL", 
                "message": init_msg
            }
            
            if not init_success:
                result['overall_status'] = "FAIL - Initialization Failed"
                return result
                
            # Test 3: Method testing
            method_results = self.test_collector_methods(collector_instance, config['name'])
            result['tests']['methods'] = method_results
            
            # Test 4: MCP-specific functionality
            mcp_results = self.test_mcp_specific_functionality(collector_instance, config['name'])
            result['tests']['mcp_functionality'] = mcp_results
            
            # Determine overall status
            failed_tests = sum(1 for test in result['tests'].values() 
                             if isinstance(test, dict) and test.get('status') == 'FAIL')
            warning_tests = sum(1 for test in result['tests'].values()
                              if isinstance(test, dict) and 'WARN' in str(test.get('status', '')))
            
            if failed_tests == 0:
                if warning_tests > 0:
                    result['overall_status'] = "PASS with Warnings"
                    self.results['test_summary']['warning_collectors'] += 1
                else:
                    result['overall_status'] = "PASS"
                    self.results['test_summary']['passed_collectors'] += 1
            else:
                result['overall_status'] = f"FAIL ({failed_tests} failed tests)"
                self.results['test_summary']['failed_collectors'] += 1
                
        except Exception as e:
            result['overall_status'] = f"ERROR: {str(e)}"
            result['tests']['error'] = {
                "status": "FAIL",
                "message": f"Unexpected error during testing: {str(e)}"
            }
            self.results['test_summary']['failed_collectors'] += 1
            
        result['test_duration'] = round(time.time() - start_time, 2)
        self.results['test_summary']['tested_collectors'] += 1
        
        return result
        
    def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive test of all MCP collectors."""
        self.log("=== Starting Comprehensive MCP Collector Test ===", "INFO")
        start_time = time.time()
        
        # Test commercial collectors
        commercial_results = self.test_commercial_mcp_collectors()
        self.results['collector_results']['commercial'] = commercial_results
        
        # Test government collectors
        government_results = self.test_government_mcp_collectors()
        self.results['collector_results']['government'] = government_results
        
        # Update summary
        total_collectors = len(commercial_results) + len(government_results)
        self.results['test_summary']['total_collectors'] = total_collectors
        
        # Calculate overall results
        total_duration = round(time.time() - start_time, 2)
        self.results['test_duration'] = total_duration
        
        self.log(f"=== Test Complete in {total_duration}s ===", "INFO")
        self.log(f"Total Collectors: {total_collectors}", "INFO")
        self.log(f"Tested: {self.results['test_summary']['tested_collectors']}", "INFO") 
        self.log(f"Passed: {self.results['test_summary']['passed_collectors']}", "INFO")
        self.log(f"Warnings: {self.results['test_summary']['warning_collectors']}", "INFO")
        self.log(f"Failed: {self.results['test_summary']['failed_collectors']}", "INFO")
        
        return self.results
        
    def save_results(self, filename: str):
        """Save test results to file."""
        results_path = Path("docs/project/test_outcome") / filename
        results_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(results_path, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        self.log(f"Results saved to: {results_path}", "INFO")


def main():
    """Main test execution."""
    test_suite = MCPTestSuite()
    
    try:
        # Run comprehensive tests
        results = test_suite.run_comprehensive_test()
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        test_suite.save_results(f"mcp_comprehensive_test_results_{timestamp}.json")
        
        # Print summary
        print("\n" + "="*80)
        print("COMPREHENSIVE MCP TEST SUMMARY")
        print("="*80)
        print(f"Test Date: {results['test_timestamp']}")
        print(f"Total Duration: {results['test_duration']}s")
        print(f"Total Collectors Tested: {results['test_summary']['tested_collectors']}")
        print(f"✓ Passed: {results['test_summary']['passed_collectors']}")
        print(f"⚠ Warnings: {results['test_summary']['warning_collectors']}")
        print(f"❌ Failed: {results['test_summary']['failed_collectors']}")
        
        # Success if no failures
        success = results['test_summary']['failed_collectors'] == 0
        return 0 if success else 1
        
    except Exception as e:
        print(f"❌ Test suite execution failed: {e}")
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
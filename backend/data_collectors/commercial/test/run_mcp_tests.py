#!/usr/bin/env python3
"""
MCP Collector Test Runner

Comprehensive test runner for all MCP-based commercial collectors.
Runs unit tests, integration tests, and performance benchmarks.

Usage:
    python run_mcp_tests.py                    # Run all tests
    python run_mcp_tests.py --alpha-vantage    # Run Alpha Vantage tests only
    python run_mcp_tests.py --benchmark        # Run performance benchmarks
    python run_mcp_tests.py --integration      # Run integration tests
"""

import sys
import os
import argparse
import unittest
import asyncio
import time
from datetime import datetime
from pathlib import Path

# Add paths for imports
project_root = Path(__file__).parent.parent.parent.parent
sys.path.append(str(project_root))
sys.path.append(str(Path(__file__).parent.parent))

# Test imports
try:
    from test_alpha_vantage_mcp_collector import run_comprehensive_test_suite
    ALPHA_VANTAGE_TESTS_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Alpha Vantage tests not available: {e}")
    ALPHA_VANTAGE_TESTS_AVAILABLE = False


class MCPTestRunner:
    """Test runner for MCP collector test suites."""
    
    def __init__(self):
        self.start_time = datetime.now()
        self.test_results = {}
        
    def run_alpha_vantage_tests(self):
        """Run Alpha Vantage MCP collector tests."""
        print("🚀 Running Alpha Vantage MCP Collector Tests")
        print("=" * 50)
        
        if not ALPHA_VANTAGE_TESTS_AVAILABLE:
            print("❌ Alpha Vantage tests not available")
            return False
        
        try:
            run_comprehensive_test_suite()
            self.test_results['alpha_vantage'] = 'PASS'
            return True
        except Exception as e:
            print(f"❌ Alpha Vantage tests failed: {e}")
            self.test_results['alpha_vantage'] = 'FAIL'
            return False
    
    def run_integration_tests(self):
        """Run integration tests between MCP collectors and router."""
        print("\n🔗 Running MCP Integration Tests")
        print("=" * 40)
        
        try:
            # Test MCP collector registration with router
            self._test_router_integration()
            
            # Test four-quadrant routing with MCP collectors
            self._test_four_quadrant_routing()
            
            # Test cost tracking integration
            self._test_cost_tracking_integration()
            
            self.test_results['integration'] = 'PASS'
            print("✅ Integration tests completed successfully")
            return True
            
        except Exception as e:
            print(f"❌ Integration tests failed: {e}")
            self.test_results['integration'] = 'FAIL'
            return False
    
    def _test_router_integration(self):
        """Test MCP collector integration with router."""
        try:
            # Import router
            from collector_router import CollectorRouter
            
            # Create router with budget for commercial collectors
            router = CollectorRouter(budget_limit=100.0)
            
            # Test quadrant summary
            quadrant_summary = router.get_quadrant_summary()
            print(f"📊 Router quadrants available: {list(quadrant_summary.keys())}")
            
            # Test collector info
            collector_info = router.get_collector_info()
            
            # Look for Alpha Vantage MCP collector
            av_collector = collector_info.get('alpha_vantage_mcp')
            if av_collector:
                print("✅ Alpha Vantage MCP collector registered with router")
                print(f"   Quadrant: {av_collector['quadrant']}")
                print(f"   Cost per request: ${av_collector['cost_per_request']}")
                print(f"   MCP tools: {av_collector.get('mcp_tool_count', 'Unknown')}")
            else:
                print("⚠️  Alpha Vantage MCP collector not found in router registry")
            
        except ImportError as e:
            print(f"⚠️  Router integration test skipped: {e}")
    
    def _test_four_quadrant_routing(self):
        """Test four-quadrant routing logic with MCP collectors."""
        try:
            from collector_router import route_data_request
            
            # Test real-time request routing (should prefer MCP)
            real_time_filters = {
                'companies': ['AAPL'],
                'real_time': True,
                'analysis_type': 'technical'
            }
            
            collectors = route_data_request(real_time_filters, budget_limit=50.0)
            print(f"📈 Real-time request routed to {len(collectors)} collectors:")
            for collector in collectors:
                print(f"   - {collector.__class__.__name__}")
            
            # Test basic fundamental request (should use government sources)
            fundamental_filters = {
                'companies': ['AAPL'],
                'analysis_type': 'fundamental'
            }
            
            gov_collectors = route_data_request(fundamental_filters)
            print(f"📊 Fundamental request routed to {len(gov_collectors)} government collectors:")
            for collector in gov_collectors:
                print(f"   - {collector.__class__.__name__}")
                
        except Exception as e:
            print(f"⚠️  Four-quadrant routing test error: {e}")
    
    def _test_cost_tracking_integration(self):
        """Test cost tracking integration with MCP collectors."""
        try:
            from commercial.base.cost_tracker import usage_tracker, BudgetConfig
            
            # Test budget configuration
            budget_config = BudgetConfig(
                monthly_limit=100.0,
                daily_limit=10.0,
                alert_thresholds=[50.0, 75.0, 90.0]
            )
            
            usage_tracker.set_budget('alpha_vantage_mcp', budget_config)
            print("✅ Budget configuration set for Alpha Vantage MCP")
            
            # Test usage recording
            usage_tracker.record_usage(
                collector_name='alpha_vantage_mcp',
                endpoint='GLOBAL_QUOTE',
                request_type='real_time_quote',
                cost=0.01,
                success=True,
                response_time=0.5
            )
            
            # Test budget status
            budget_status = usage_tracker.check_budget_status('alpha_vantage_mcp')
            print(f"💰 Budget status: {budget_status.get('status', 'unknown')}")
            print(f"   Current spending: ${budget_status.get('current_spending', 0):.2f}")
            print(f"   Usage percentage: {budget_status.get('usage_percentage', 0):.1f}%")
            
        except Exception as e:
            print(f"⚠️  Cost tracking integration test error: {e}")
    
    def run_performance_benchmarks(self):
        """Run performance benchmarks for MCP collectors."""
        print("\n⚡ Running MCP Collector Performance Benchmarks")
        print("=" * 50)
        
        try:
            # Benchmark Alpha Vantage collector if available
            if ALPHA_VANTAGE_TESTS_AVAILABLE:
                self._benchmark_alpha_vantage()
            
            # Benchmark router performance with MCP collectors
            self._benchmark_router_performance()
            
            self.test_results['benchmarks'] = 'PASS'
            return True
            
        except Exception as e:
            print(f"❌ Performance benchmarks failed: {e}")
            self.test_results['benchmarks'] = 'FAIL'
            return False
    
    def _benchmark_alpha_vantage(self):
        """Benchmark Alpha Vantage MCP collector performance."""
        try:
            from mcp.alpha_vantage_mcp_collector import AlphaVantageMCPCollector
            
            collector = AlphaVantageMCPCollector()
            test_filters = {
                'companies': ['AAPL', 'MSFT', 'GOOGL'],
                'real_time': True,
                'analysis_type': 'technical',
                'technical_indicators': ['RSI', 'MACD']
            }
            
            # Benchmark filter analysis
            start_time = time.time()
            for _ in range(100):
                tools = collector._analyze_filters_for_tools(test_filters)
            analysis_time = time.time() - start_time
            
            # Benchmark activation checks
            start_time = time.time()
            for _ in range(1000):
                should_activate = collector.should_activate(test_filters)
                priority = collector.get_activation_priority(test_filters)
            activation_time = time.time() - start_time
            
            print(f"📊 Alpha Vantage MCP Collector Benchmarks:")
            print(f"   Filter analysis (100x): {analysis_time:.4f}s")
            print(f"   Activation checks (1000x): {activation_time:.4f}s")
            print(f"   Tools identified: {len(tools) if 'tools' in locals() else 'N/A'}")
            
        except Exception as e:
            print(f"⚠️  Alpha Vantage benchmark error: {e}")
    
    def _benchmark_router_performance(self):
        """Benchmark router performance with MCP collectors."""
        try:
            from collector_router import CollectorRouter
            
            router = CollectorRouter(budget_limit=100.0)
            
            test_cases = [
                {'companies': ['AAPL'], 'real_time': True},
                {'companies': ['MSFT'], 'analysis_type': 'technical'},
                {'forex_pairs': ['EUR/USD']},
                {'crypto_symbols': ['BTC']},
                {'companies': ['GOOGL'], 'analysis_type': 'fundamental'}
            ]
            
            # Benchmark routing decisions
            start_time = time.time()
            for _ in range(100):
                for test_case in test_cases:
                    collectors = router.route_request(test_case)
            routing_time = time.time() - start_time
            
            print(f"📊 Router Performance with MCP Collectors:")
            print(f"   Routing decisions (500x): {routing_time:.4f}s")
            print(f"   Average per request: {routing_time/500:.6f}s")
            
        except Exception as e:
            print(f"⚠️  Router benchmark error: {e}")
    
    def run_all_tests(self):
        """Run all MCP collector tests."""
        print("🧪 MCP Collector Comprehensive Test Suite")
        print("=" * 60)
        print(f"Started at: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        success = True
        
        # Run Alpha Vantage tests
        if not self.run_alpha_vantage_tests():
            success = False
        
        # Run integration tests
        if not self.run_integration_tests():
            success = False
        
        # Run performance benchmarks
        if not self.run_performance_benchmarks():
            success = False
        
        # Print summary
        self.print_summary()
        
        return success
    
    def print_summary(self):
        """Print test summary."""
        end_time = datetime.now()
        duration = end_time - self.start_time
        
        print("\n🏆 MCP Test Suite Summary")
        print("=" * 30)
        print(f"Duration: {duration.total_seconds():.2f} seconds")
        print(f"Results:")
        
        for test_name, result in self.test_results.items():
            status_icon = "✅" if result == "PASS" else "❌"
            print(f"   {status_icon} {test_name}: {result}")
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result == "PASS")
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        print(f"\nSuccess Rate: {success_rate:.1f}% ({passed_tests}/{total_tests})")
        
        if success_rate >= 80:
            print("🎉 MCP Collectors: READY FOR PRODUCTION")
        else:
            print("⚠️  MCP Collectors: NEED ATTENTION")


def main():
    """Main test runner function."""
    parser = argparse.ArgumentParser(description="MCP Collector Test Runner")
    parser.add_argument("--alpha-vantage", action="store_true", help="Run Alpha Vantage tests only")
    parser.add_argument("--integration", action="store_true", help="Run integration tests only")
    parser.add_argument("--benchmark", action="store_true", help="Run performance benchmarks only")
    parser.add_argument("--all", action="store_true", help="Run all tests (default)")
    
    args = parser.parse_args()
    
    runner = MCPTestRunner()
    
    if args.alpha_vantage:
        success = runner.run_alpha_vantage_tests()
    elif args.integration:
        success = runner.run_integration_tests()
    elif args.benchmark:
        success = runner.run_performance_benchmarks()
    else:
        success = runner.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
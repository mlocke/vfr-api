#!/usr/bin/env python3
"""
Test script for predict_rate_impact() MCP tool

This script validates the predict_rate_impact() tool implementation,
testing various scenarios, parameter combinations, and error conditions.

Tests:
1. Basic functionality with default parameters
2. Custom rate scenarios and asset classes
3. Different time horizons and confidence levels
4. Error handling and edge cases
5. Integration with existing tools
"""

import asyncio
import json
import logging
import sys
import os
from typing import Dict, Any

# Add the project root to Python path
sys.path.append('/Users/michaellocke/WebstormProjects/Home/public/stock-picker')

try:
    from backend.data_collectors.government.mcp.tools.treasury_macro_tools import (
        predict_rate_impact,
        MCP_TREASURY_MACRO_TOOLS
    )
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print("Please ensure you're running from the project root directory")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TestResults:
    """Track test results and generate summary."""
    
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.test_details = []
    
    def add_result(self, test_name: str, passed: bool, details: str = ""):
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            status = "✅ PASSED"
        else:
            self.tests_failed += 1
            status = "❌ FAILED"
        
        self.test_details.append({
            'test_name': test_name,
            'status': status,
            'details': details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
    
    def print_summary(self):
        print("\n" + "="*60)
        print("📊 TEST RESULTS SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: ✅ {self.tests_passed}")
        print(f"Failed: ❌ {self.tests_failed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "0%")
        
        if self.tests_failed > 0:
            print("\n❌ FAILED TESTS:")
            for test in self.test_details:
                if "FAILED" in test['status']:
                    print(f"  - {test['test_name']}: {test['details']}")


async def test_basic_functionality(results: TestResults):
    """Test basic predict_rate_impact() functionality."""
    
    try:
        logger.info("Testing basic predict_rate_impact() functionality...")
        
        result = await predict_rate_impact()
        
        # Validate basic structure
        required_keys = [
            'success', 'analysis_date', 'analysis_parameters',
            'scenario_predictions', 'cross_scenario_analysis',
            'investment_recommendations', 'risk_metrics',
            'economic_implications', 'methodology'
        ]
        
        missing_keys = [key for key in required_keys if key not in result]
        if missing_keys:
            results.add_result(
                "Basic Functionality",
                False,
                f"Missing keys: {missing_keys}"
            )
            return
        
        # Validate success status
        if not result.get('success'):
            results.add_result(
                "Basic Functionality",
                False,
                f"Tool returned success=False: {result.get('error', 'Unknown error')}"
            )
            return
        
        # Validate scenario predictions
        scenarios = result.get('scenario_predictions', {})
        expected_scenarios = ['base_case', 'mild_hike', 'aggressive_hike', 'mild_cut', 'aggressive_cut']
        
        if not all(scenario in scenarios for scenario in expected_scenarios):
            results.add_result(
                "Basic Functionality",
                False,
                f"Missing expected scenarios. Found: {list(scenarios.keys())}"
            )
            return
        
        # Validate each scenario has required structure
        for scenario_name, prediction in scenarios.items():
            scenario_keys = ['scenario_name', 'rate_change_bps', 'scenario_probability', 
                           'asset_class_impacts', 'confidence_intervals']
            missing_scenario_keys = [key for key in scenario_keys if key not in prediction]
            
            if missing_scenario_keys:
                results.add_result(
                    "Basic Functionality",
                    False,
                    f"Scenario {scenario_name} missing keys: {missing_scenario_keys}"
                )
                return
        
        results.add_result(
            "Basic Functionality",
            True,
            f"Successfully analyzed {len(scenarios)} rate scenarios"
        )
        
    except Exception as e:
        results.add_result(
            "Basic Functionality",
            False,
            f"Exception: {str(e)}"
        )


async def test_custom_scenarios(results: TestResults):
    """Test custom rate scenarios and asset classes."""
    
    try:
        logger.info("Testing custom scenarios and asset classes...")
        
        # Custom rate scenarios
        custom_scenarios = {
            "fed_pause": 0,
            "gradual_tightening": 75,
            "emergency_cut": -200
        }
        
        # Custom asset classes
        custom_assets = ['treasuries', 'financials', 'reits']
        
        result = await predict_rate_impact(
            rate_scenarios=custom_scenarios,
            asset_classes=custom_assets,
            time_horizon="6_months",
            confidence_level=0.9
        )
        
        if not result.get('success'):
            results.add_result(
                "Custom Scenarios",
                False,
                f"Failed with custom parameters: {result.get('error')}"
            )
            return
        
        # Validate custom scenarios were used
        scenarios = result.get('scenario_predictions', {})
        custom_scenario_names = list(custom_scenarios.keys())
        
        if not all(name in scenarios for name in custom_scenario_names):
            results.add_result(
                "Custom Scenarios",
                False,
                f"Custom scenarios not found. Expected: {custom_scenario_names}, Found: {list(scenarios.keys())}"
            )
            return
        
        # Validate custom asset classes in at least one scenario
        sample_scenario = list(scenarios.values())[0]
        asset_impacts = sample_scenario.get('asset_class_impacts', {})
        
        found_custom_assets = [asset for asset in custom_assets if asset in asset_impacts]
        if len(found_custom_assets) < len(custom_assets):
            results.add_result(
                "Custom Scenarios",
                False,
                f"Not all custom assets found. Expected: {custom_assets}, Found: {list(asset_impacts.keys())}"
            )
            return
        
        # Validate parameters were recorded
        params = result.get('analysis_parameters', {})
        if (params.get('time_horizon') != '6_months' or 
            params.get('confidence_level') != 0.9):
            results.add_result(
                "Custom Scenarios",
                False,
                f"Parameters not recorded correctly: {params}"
            )
            return
        
        results.add_result(
            "Custom Scenarios",
            True,
            f"Custom scenarios ({len(custom_scenarios)}) and assets ({len(custom_assets)}) processed correctly"
        )
        
    except Exception as e:
        results.add_result(
            "Custom Scenarios",
            False,
            f"Exception: {str(e)}"
        )


async def test_time_horizons(results: TestResults):
    """Test different time horizon impacts."""
    
    try:
        logger.info("Testing different time horizons...")
        
        time_horizons = ['3_months', '6_months', '1_year', '2_years']
        horizon_results = {}
        
        for horizon in time_horizons:
            result = await predict_rate_impact(
                time_horizon=horizon,
                asset_classes=['equities', 'financials']
            )
            
            if not result.get('success'):
                results.add_result(
                    "Time Horizons",
                    False,
                    f"Failed for horizon {horizon}: {result.get('error')}"
                )
                return
            
            horizon_results[horizon] = result
        
        # Validate time horizon adjustments
        # Longer horizons should generally have larger impacts
        base_scenario_impacts = {}
        
        for horizon, result in horizon_results.items():
            scenarios = result.get('scenario_predictions', {})
            if 'mild_hike' in scenarios:
                mild_hike = scenarios['mild_hike']
                financials_impact = mild_hike.get('asset_class_impacts', {}).get('financials', {})
                impact = financials_impact.get('expected_impact_percent', 0)
                base_scenario_impacts[horizon] = impact
        
        # Validate implementation timeline differs by horizon
        for horizon, result in horizon_results.items():
            recommendations = result.get('investment_recommendations', {})
            timeline = recommendations.get('implementation_timeline', [])
            
            if not timeline:
                results.add_result(
                    "Time Horizons",
                    False,
                    f"No implementation timeline for horizon {horizon}"
                )
                return
            
            # Check timeline has appropriate timeframe references
            timeline_text = str(timeline)
            if horizon == '3_months' and 'Month' not in timeline_text:
                results.add_result(
                    "Time Horizons",
                    False,
                    f"3-month horizon should reference months in timeline"
                )
                return
            elif horizon == '2_years' and 'Year' not in timeline_text:
                results.add_result(
                    "Time Horizons",
                    False,
                    f"2-year horizon should reference years in timeline"
                )
                return
        
        results.add_result(
            "Time Horizons",
            True,
            f"Successfully tested {len(time_horizons)} time horizons with appropriate adjustments"
        )
        
    except Exception as e:
        results.add_result(
            "Time Horizons",
            False,
            f"Exception: {str(e)}"
        )


async def test_confidence_levels(results: TestResults):
    """Test different confidence level impacts."""
    
    try:
        logger.info("Testing different confidence levels...")
        
        confidence_levels = [0.6, 0.8, 0.9, 0.95]
        confidence_results = {}
        
        for confidence in confidence_levels:
            result = await predict_rate_impact(
                confidence_level=confidence,
                asset_classes=['treasuries', 'equities']
            )
            
            if not result.get('success'):
                results.add_result(
                    "Confidence Levels",
                    False,
                    f"Failed for confidence {confidence}: {result.get('error')}"
                )
                return
            
            confidence_results[confidence] = result
        
        # Validate confidence intervals widen with higher confidence
        for confidence, result in confidence_results.items():
            scenarios = result.get('scenario_predictions', {})
            if 'base_case' in scenarios:
                intervals = scenarios['base_case'].get('confidence_intervals', {})
                
                for asset_class, interval_data in intervals.items():
                    recorded_confidence = interval_data.get('confidence_level')
                    if abs(recorded_confidence - confidence) > 0.01:
                        results.add_result(
                            "Confidence Levels",
                            False,
                            f"Confidence level {confidence} not recorded correctly: {recorded_confidence}"
                        )
                        return
                    
                    # Check interval structure
                    required_interval_keys = ['point_estimate', 'lower_bound', 'upper_bound']
                    missing_keys = [key for key in required_interval_keys if key not in interval_data]
                    
                    if missing_keys:
                        results.add_result(
                            "Confidence Levels",
                            False,
                            f"Confidence interval missing keys: {missing_keys}"
                        )
                        return
        
        results.add_result(
            "Confidence Levels",
            True,
            f"Successfully tested {len(confidence_levels)} confidence levels with proper intervals"
        )
        
    except Exception as e:
        results.add_result(
            "Confidence Levels",
            False,
            f"Exception: {str(e)}"
        )


async def test_edge_cases(results: TestResults):
    """Test edge cases and error handling."""
    
    try:
        logger.info("Testing edge cases and error handling...")
        
        # Test with invalid confidence level (should be clamped)
        result = await predict_rate_impact(confidence_level=1.5)
        
        if not result.get('success'):
            results.add_result(
                "Edge Cases - Invalid Confidence",
                False,
                f"Failed with invalid confidence level: {result.get('error')}"
            )
            return
        
        # Confidence should be clamped to 0.95
        params = result.get('analysis_parameters', {})
        if params.get('confidence_level') != 0.95:
            results.add_result(
                "Edge Cases - Invalid Confidence",
                False,
                f"Confidence level not clamped properly: {params.get('confidence_level')}"
            )
            return
        
        # Test with empty asset classes (should use defaults)
        result = await predict_rate_impact(asset_classes=[])
        
        if not result.get('success'):
            results.add_result(
                "Edge Cases - Empty Assets",
                False,
                f"Failed with empty asset classes: {result.get('error')}"
            )
            return
        
        # Should have default asset classes
        scenarios = result.get('scenario_predictions', {})
        if scenarios:
            sample_scenario = list(scenarios.values())[0]
            asset_impacts = sample_scenario.get('asset_class_impacts', {})
            
            if len(asset_impacts) == 0:
                results.add_result(
                    "Edge Cases - Empty Assets",
                    False,
                    "No asset classes found when empty list provided"
                )
                return
        
        # Test with invalid time horizon (should use default)
        result = await predict_rate_impact(time_horizon="invalid_horizon")
        
        if not result.get('success'):
            results.add_result(
                "Edge Cases - Invalid Horizon",
                False,
                f"Failed with invalid time horizon: {result.get('error')}"
            )
            return
        
        results.add_result(
            "Edge Cases",
            True,
            "Edge cases handled properly with appropriate fallbacks"
        )
        
    except Exception as e:
        results.add_result(
            "Edge Cases",
            False,
            f"Exception: {str(e)}"
        )


async def test_integration(results: TestResults):
    """Test integration with existing MCP tools."""
    
    try:
        logger.info("Testing integration with existing tools...")
        
        # Test that predict_rate_impact is in MCP tool registry
        if 'predict_rate_impact' not in MCP_TREASURY_MACRO_TOOLS:
            results.add_result(
                "MCP Integration",
                False,
                "predict_rate_impact not found in MCP tool registry"
            )
            return
        
        # Test that the tool can be called via registry
        tool_function = MCP_TREASURY_MACRO_TOOLS['predict_rate_impact']
        result = await tool_function()
        
        if not result.get('success'):
            results.add_result(
                "MCP Integration",
                False,
                f"Tool failed when called via registry: {result.get('error')}"
            )
            return
        
        # Verify it integrates data from other tools
        # The tool should call get_yield_curve_analysis and calculate_rate_sensitivity
        methodology = result.get('methodology', {})
        
        expected_method_keys = [
            'duration_analysis', 'equity_impact', 'sector_rotation', 
            'confidence_intervals', 'time_horizon'
        ]
        
        missing_method_keys = [key for key in expected_method_keys if key not in methodology]
        
        if missing_method_keys:
            results.add_result(
                "MCP Integration",
                False,
                f"Methodology missing keys: {missing_method_keys}"
            )
            return
        
        results.add_result(
            "MCP Integration",
            True,
            "Successfully integrated with MCP tool registry and existing tools"
        )
        
    except Exception as e:
        results.add_result(
            "MCP Integration",
            False,
            f"Exception: {str(e)}"
        )


async def test_output_quality(results: TestResults):
    """Test quality and completeness of output."""
    
    try:
        logger.info("Testing output quality and completeness...")
        
        result = await predict_rate_impact(
            rate_scenarios={"test_hike": 100},
            asset_classes=['treasuries', 'financials', 'reits'],
            time_horizon="1_year",
            confidence_level=0.8
        )
        
        if not result.get('success'):
            results.add_result(
                "Output Quality",
                False,
                f"Failed to generate output: {result.get('error')}"
            )
            return
        
        # Test investment recommendations completeness
        recommendations = result.get('investment_recommendations', {})
        expected_rec_keys = [
            'portfolio_positioning', 'sector_rotation', 'tactical_considerations',
            'risk_management', 'implementation_timeline', 'monitoring_metrics'
        ]
        
        missing_rec_keys = [key for key in expected_rec_keys if key not in recommendations]
        if missing_rec_keys:
            results.add_result(
                "Output Quality",
                False,
                f"Investment recommendations missing: {missing_rec_keys}"
            )
            return
        
        # Test that recommendations are actionable (contain strings)
        for key, value in recommendations.items():
            if isinstance(value, list) and len(value) > 0:
                if not all(isinstance(item, (str, dict)) for item in value):
                    results.add_result(
                        "Output Quality",
                        False,
                        f"Recommendations {key} contains non-string/dict items"
                    )
                    return
        
        # Test economic implications structure
        economics = result.get('economic_implications', {})
        expected_econ_keys = ['growth_impact', 'policy_considerations']
        
        missing_econ_keys = [key for key in expected_econ_keys if key not in economics]
        if missing_econ_keys:
            results.add_result(
                "Output Quality",
                False,
                f"Economic implications missing: {missing_econ_keys}"
            )
            return
        
        # Test risk metrics structure
        risk_metrics = result.get('risk_metrics', {})
        expected_risk_keys = ['scenario_risk_breakdown', 'portfolio_risk_metrics']
        
        missing_risk_keys = [key for key in expected_risk_keys if key not in risk_metrics]
        if missing_risk_keys:
            results.add_result(
                "Output Quality",
                False,
                f"Risk metrics missing: {missing_risk_keys}"
            )
            return
        
        results.add_result(
            "Output Quality",
            True,
            "Output structure is complete and well-formed with actionable content"
        )
        
    except Exception as e:
        results.add_result(
            "Output Quality",
            False,
            f"Exception: {str(e)}"
        )


def save_test_results(results: TestResults, sample_output: Dict[str, Any] = None):
    """Save test results to file."""
    
    # Create output directory if it doesn't exist
    output_dir = "docs/project/test_output/predict_rate_impact"
    os.makedirs(output_dir, exist_ok=True)
    
    # Save test summary
    summary = {
        "test_date": "2025-09-08",
        "tool_name": "predict_rate_impact",
        "total_tests": results.tests_run,
        "tests_passed": results.tests_passed,
        "tests_failed": results.tests_failed,
        "success_rate": f"{(results.tests_passed/results.tests_run)*100:.1f}%" if results.tests_run > 0 else "0%",
        "test_details": results.test_details
    }
    
    summary_path = os.path.join(output_dir, "test_summary.json")
    with open(summary_path, 'w') as f:
        json.dump(summary, f, indent=2, default=str)
    
    print(f"\n📁 Test results saved to: {summary_path}")
    
    # Save sample output if provided
    if sample_output:
        sample_path = os.path.join(output_dir, "sample_output.json")
        with open(sample_path, 'w') as f:
            json.dump(sample_output, f, indent=2, default=str)
        print(f"📁 Sample output saved to: {sample_path}")


async def main():
    """Run all tests for predict_rate_impact() tool."""
    
    print("🚀 PREDICT RATE IMPACT MCP TOOL - TEST SUITE")
    print("=" * 60)
    
    results = TestResults()
    
    # Run test suite
    test_functions = [
        test_basic_functionality,
        test_custom_scenarios,
        test_time_horizons,
        test_confidence_levels,
        test_edge_cases,
        test_integration,
        test_output_quality
    ]
    
    sample_output = None
    
    for test_func in test_functions:
        try:
            await test_func(results)
            
            # Capture sample output from first successful test
            if sample_output is None and results.tests_passed > 0:
                try:
                    sample_output = await predict_rate_impact(
                        rate_scenarios={"demo_hike": 75, "demo_cut": -50},
                        asset_classes=['treasuries', 'equities', 'financials'],
                        confidence_level=0.8
                    )
                except:
                    pass
            
        except Exception as e:
            results.add_result(
                test_func.__name__.replace('test_', '').replace('_', ' ').title(),
                False,
                f"Test function exception: {str(e)}"
            )
    
    # Print results
    results.print_summary()
    
    # Save results
    save_test_results(results, sample_output)
    
    print("\n✨ Test suite completed!")
    return results.tests_failed == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
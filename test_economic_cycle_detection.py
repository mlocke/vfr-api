#!/usr/bin/env python3
"""
Test script for Economic Cycle Detection MCP Tool

This script tests the newly implemented detect_economic_cycle MCP tool
to ensure it's working properly with realistic data and cross-tool integration.
"""

import asyncio
import json
import sys
import os
from pathlib import Path

# Add the backend path for imports
backend_path = Path(__file__).parent / 'backend'
sys.path.append(str(backend_path))

from data_collectors.government.mcp.tools.treasury_macro_tools import (
    detect_economic_cycle,
    get_yield_curve_analysis,
    calculate_economic_indicators
)

async def test_basic_cycle_detection():
    """Test basic economic cycle detection functionality."""
    print("🔄 Testing basic economic cycle detection...")
    
    try:
        result = await detect_economic_cycle()
        
        print(f"✅ Cycle detection successful!")
        print(f"   Current Phase: {result['current_phase']}")
        print(f"   Phase Strength: {result['phase_strength']}/100")
        print(f"   Confidence Score: {result['confidence_score']}")
        print(f"   Cycle Duration: {result['cycle_duration']} months")
        
        # Validate required fields
        required_fields = [
            'current_phase', 'phase_strength', 'confidence_score', 
            'leading_indicators', 'sector_rotation_guidance', 
            'historical_context', 'transition_probabilities'
        ]
        
        missing_fields = [field for field in required_fields if field not in result]
        if missing_fields:
            print(f"⚠️  Missing fields: {missing_fields}")
        else:
            print("✅ All required fields present")
        
        return result
        
    except Exception as e:
        print(f"❌ Basic cycle detection failed: {e}")
        return None

async def test_sector_rotation_guidance():
    """Test sector rotation guidance functionality."""
    print("\n📊 Testing sector rotation guidance...")
    
    try:
        result = await detect_economic_cycle()
        
        if result and 'sector_rotation_guidance' in result:
            guidance = result['sector_rotation_guidance']
            print(f"✅ Sector guidance for {result['current_phase']} phase:")
            print(f"   Overweight: {guidance.get('overweight', [])}")
            print(f"   Underweight: {guidance.get('underweight', [])}")
            print(f"   Rationale: {guidance.get('rationale', 'N/A')}")
            print(f"   Implementation: {guidance.get('implementation_timeline', 'N/A')}")
        else:
            print("❌ No sector rotation guidance found")
            
    except Exception as e:
        print(f"❌ Sector guidance test failed: {e}")

async def test_leading_indicators():
    """Test leading indicators functionality."""
    print("\n📈 Testing leading indicators...")
    
    try:
        result = await detect_economic_cycle()
        
        if result and 'leading_indicators' in result:
            signals = result['leading_indicators']
            print(f"✅ Leading indicators analysis:")
            print(f"   Yield Curve Signal: {signals.get('yield_curve_signal', 'N/A')}")
            print(f"   Employment Signal: {signals.get('employment_signal', 'N/A')}")
            print(f"   Credit Signal: {signals.get('credit_signal', 'N/A')}")
            print(f"   Composite Signal: {signals.get('composite_signal', 'N/A')}")
            print(f"   Signal Confidence: {signals.get('confidence', 0.0)}")
        else:
            print("❌ No leading indicators found")
            
    except Exception as e:
        print(f"❌ Leading indicators test failed: {e}")

async def test_cross_tool_integration():
    """Test integration with existing yield curve tools."""
    print("\n🔗 Testing cross-tool integration...")
    
    try:
        # Test yield curve analysis integration
        curve_result = await get_yield_curve_analysis()
        cycle_result = await detect_economic_cycle()
        
        if curve_result and cycle_result:
            curve_shape = curve_result.get('curve_shape', 'unknown')
            cycle_phase = cycle_result.get('current_phase', 'unknown')
            
            print(f"✅ Cross-tool integration successful:")
            print(f"   Yield Curve Shape: {curve_shape}")
            print(f"   Economic Cycle Phase: {cycle_phase}")
            
            # Check for logical consistency
            if curve_shape == 'inverted' and cycle_phase in ['Peak', 'Contraction']:
                print("✅ Logical consistency: Inverted curve aligns with late-cycle phase")
            elif curve_shape == 'steep_normal' and cycle_phase in ['Expansion', 'Trough']:
                print("✅ Logical consistency: Steep curve aligns with growth phase")
            else:
                print("ℹ️  Curve-cycle relationship noted for review")
                
        else:
            print("❌ Cross-tool integration failed - missing results")
            
    except Exception as e:
        print(f"❌ Cross-tool integration test failed: {e}")

async def test_economic_indicators_integration():
    """Test integration with economic indicators."""
    print("\n📊 Testing economic indicators integration...")
    
    try:
        economic_result = await calculate_economic_indicators()
        cycle_result = await detect_economic_cycle()
        
        if economic_result and cycle_result:
            recession_prob = economic_result.get('recession_probability', 0)
            cycle_phase = cycle_result.get('current_phase', 'unknown')
            
            print(f"✅ Economic indicators integration:")
            print(f"   Recession Probability: {recession_prob}%")
            print(f"   Cycle Phase: {cycle_phase}")
            
            # Check for logical consistency
            if recession_prob > 50 and cycle_phase in ['Peak', 'Contraction']:
                print("✅ Consistency: High recession risk aligns with late-cycle phase")
            elif recession_prob < 25 and cycle_phase in ['Expansion']:
                print("✅ Consistency: Low recession risk aligns with expansion")
            else:
                print("ℹ️  Recession-cycle relationship noted for review")
                
        else:
            print("❌ Economic indicators integration failed")
            
    except Exception as e:
        print(f"❌ Economic indicators integration test failed: {e}")

async def test_confidence_thresholds():
    """Test confidence threshold functionality."""
    print("\n🎯 Testing confidence thresholds...")
    
    try:
        # Test with high confidence threshold
        high_threshold_result = await detect_economic_cycle(confidence_threshold=0.9)
        normal_threshold_result = await detect_economic_cycle(confidence_threshold=0.7)
        
        high_confidence = high_threshold_result.get('confidence_score', 0)
        normal_confidence = normal_threshold_result.get('confidence_score', 0)
        
        print(f"✅ Confidence threshold testing:")
        print(f"   Normal threshold (0.7): {normal_confidence}")
        print(f"   High threshold (0.9): {high_confidence}")
        
        if 'warning' in high_threshold_result:
            print(f"✅ Warning system working: {high_threshold_result['warning']}")
        
        if high_confidence == normal_confidence:
            print("✅ Confidence scoring consistent across thresholds")
        else:
            print("ℹ️  Different confidence scores - check calculation logic")
            
    except Exception as e:
        print(f"❌ Confidence threshold test failed: {e}")

async def main():
    """Run all economic cycle detection tests."""
    print("🚀 Economic Cycle Detection MCP Tool Test Suite")
    print("=" * 50)
    
    # Run all tests
    basic_result = await test_basic_cycle_detection()
    await test_sector_rotation_guidance()
    await test_leading_indicators()
    await test_cross_tool_integration()
    await test_economic_indicators_integration()
    await test_confidence_thresholds()
    
    print("\n" + "=" * 50)
    print("🎯 Test Summary")
    
    if basic_result:
        print("✅ Economic Cycle Detection MCP Tool is operational")
        print(f"✅ Current Analysis: {basic_result['current_phase']} phase")
        print(f"✅ Strength: {basic_result['phase_strength']}/100")
        print(f"✅ Confidence: {basic_result['confidence_score']}")
        
        # Save detailed results for review
        with open('economic_cycle_test_results.json', 'w') as f:
            json.dump(basic_result, f, indent=2, default=str)
        print("✅ Detailed results saved to economic_cycle_test_results.json")
    else:
        print("❌ Economic Cycle Detection MCP Tool failed basic tests")
    
    print("\n🎉 Test suite completed!")

if __name__ == "__main__":
    asyncio.run(main())
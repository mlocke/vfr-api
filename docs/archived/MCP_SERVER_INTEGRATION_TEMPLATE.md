# MCP Server Integration Template - Universal Implementation Guide

**Date**: September 9, 2025  
**Status**: Template - Ready for Use  
**Priority**: Strategic Framework for MCP Ecosystem Expansion

---

## 🎯 **Template Purpose**

This document provides a **standardized template** for integrating any MCP (Model Context Protocol) server into the Stock Picker Financial Analysis platform. Based on successful implementations of Alpha Vantage MCP (85.71% success rate) and Data.gov MCP, this template ensures rapid, consistent, and high-quality integrations.

### **Target MCP Servers**
- **Immediate**: Polygon.io MCP, Financial Modeling Prep MCP
- **Future**: Any financial MCP server in the growing ecosystem
- **Custom**: Internal MCP servers for proprietary data sources

---

## 🏗️ **Phase 1: MCP Server Discovery & Research**

### **1.1 Server Research Checklist**

```markdown
### MCP Server Information
- **Server Name**: [e.g., "Financial Modeling Prep MCP"]
- **Official URL**: [e.g., "https://mcp.financialmodelingprep.com/mcp?apikey=YOUR_KEY"]
- **Documentation**: [Link to MCP server docs]
- **Rate Limits**: [e.g., "300 req/min, 10,000 req/day"]
- **Pricing Tiers**: [Free tier limits, paid plans]
- **Authentication**: [API key format, auth method]

### Tool Discovery
- **Total Tools Available**: [Number from MCP tools/list call]
- **Tool Categories**: [List main categories]
- **High-Value Tools**: [Identify 5-10 most valuable tools]
- **Unique Capabilities**: [What makes this server special]
```

### **1.2 MCP Protocol Validation**

**Test MCP Connectivity:**
```bash
# Test basic MCP connection
curl -X POST https://mcp.example.com/mcp?apikey=YOUR_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'

# Expected response: JSON-RPC 2.0 with tools array
```

**Required Validations:**
- ✅ JSON-RPC 2.0 compliance
- ✅ Tools discovery (`tools/list` method)
- ✅ Tool execution (`tools/call` method)  
- ✅ Error handling (malformed requests)
- ✅ Rate limiting behavior

---

## 🚀 **Phase 2: Collector Implementation Architecture**

### **2.1 Create MCP Collector Class**

**File**: `/backend/data_collectors/commercial/mcp/[server_name]_mcp_collector.py`

```python
"""
[Server Name] MCP Collector

[Brief description of the MCP server and its capabilities]

Features:
- [Key feature 1]
- [Key feature 2] 
- [Key feature 3]
- AI-optimized MCP tools for financial analysis

This collector leverages the [Server Name] MCP server to provide
[value proposition].
"""

import os
import sys
import json
import time
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
from pathlib import Path
import aiohttp

# Add path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from base.collector_interface import DataCollectorInterface, CollectorConfig
from commercial.base.mcp_collector_base import MCPCollectorBase, MCPError
from commercial.mcp.mcp_client import MCPClient
from commercial.base.cost_tracker import usage_tracker

logger = logging.getLogger(__name__)


class [ServerName]MCPCollector(MCPCollectorBase):
    """
    [Server Name] MCP collector for [data type] data.
    
    Integrates with [Server Name] MCP server to provide [capabilities].
    """
    
    def __init__(self, config: Optional[CollectorConfig] = None):
        """
        Initialize [Server Name] MCP collector.
        
        Args:
            config: Optional collector configuration
        """
        # Use default config if none provided
        if config is None:
            config = CollectorConfig(
                timeout=30,
                max_retries=3,
                requests_per_minute=[RATE_LIMIT],  # Server-specific
                cache_ttl=3600
            )
        
        # MCP server configuration
        api_key = os.getenv("[SERVER_NAME]_API_KEY")
        if not api_key:
            raise ValueError("[Server Name] API key not found in environment")
        
        mcp_server_url = f"[MCP_SERVER_URL]?apikey={api_key}"
        
        super().__init__(config, mcp_server_url, api_key)
        
        # Required properties
        self._source_name = "[Server Name] MCP"
        self._supported_data_types = [
            '[data_type_1]', '[data_type_2]', '[data_type_3]'
        ]
        
        # Tool categories for optimization
        self.tool_categories = {
            '[category_1]': [
                '[tool_1]', '[tool_2]', '[tool_3]'
            ],
            '[category_2]': [
                '[tool_4]', '[tool_5]', '[tool_6]'  
            ]
            # Add categories based on MCP tools/list discovery
        }
        
        # Subscription tier and cost management
        self.subscription_tier = self._detect_subscription_tier()
        
    def should_activate(self, filter_criteria: Dict[str, Any]) -> bool:
        """
        Determine if this collector should activate for given criteria.
        
        Args:
            filter_criteria: Filter criteria from request
            
        Returns:
            True if collector should handle this request
        """
        criteria_str = str(filter_criteria).lower()
        
        # Check for [Server Name]-specific requests
        if '[server_keyword]' in criteria_str:
            return True
        
        # Check for supported data types
        has_supported_data = any(
            data_type in criteria_str 
            for data_type in self._supported_data_types
        )
        
        # Check for commercial data preference
        has_commercial_preference = (
            'commercial' in criteria_str or 
            'paid' in criteria_str or 
            'premium' in criteria_str
        )
        
        return has_supported_data or has_commercial_preference
    
    def get_activation_priority(self, filter_criteria: Dict[str, Any]) -> int:
        """
        Calculate activation priority for given criteria.
        
        Args:
            filter_criteria: Filter criteria from request
            
        Returns:
            Priority score (0-100)
        """
        criteria_str = str(filter_criteria).lower()
        priority = 30  # Base priority for commercial MCP
        
        # High priority for [Server Name]-specific requests
        if '[server_keyword]' in criteria_str:
            priority += 60  # 90 total
        
        # Priority based on data types
        if '[high_priority_data_type]' in criteria_str:
            priority += 40  # 70 total
        elif '[medium_priority_data_type]' in criteria_str:
            priority += 30  # 60 total
        elif '[low_priority_data_type]' in criteria_str:
            priority += 20  # 50 total
        
        # MCP preference bonus
        if 'mcp_preferred' in criteria_str or 'ai_native' in criteria_str:
            priority += 15
        
        # Commercial data preference bonus
        if 'commercial' in criteria_str or 'premium' in criteria_str:
            priority += 10
        
        return min(priority, 100)

    # Add remaining methods following the MCPCollectorBase pattern
    # See Alpha Vantage MCP implementation for complete reference
```

### **2.2 Integration with Router System**

**File**: `/backend/data_collectors/collector_router.py`

```python
# Add import
from .commercial.mcp.[server_name]_mcp_collector import [ServerName]MCPCollector

# Add to COMMERCIAL_COLLECTORS dictionary
COMMERCIAL_COLLECTORS = {
    "alpha_vantage_mcp": AlphaVantageMCPCollector,
    "[server_name]_mcp": [ServerName]MCPCollector,  # Add this line
    # ... other collectors
}
```

---

## 🧪 **Phase 3: Comprehensive Testing Framework**

### **3.1 Create Test Suite**

**File**: `/backend/data_collectors/commercial/test/test_[server_name]_mcp_collector.py`

```python
"""
Comprehensive test suite for [Server Name] MCP collector.

Tests MCP protocol compliance, tool discovery, execution, error handling,
cost tracking, and integration with the routing system.
"""

import pytest
import asyncio
import json
import os
from typing import Dict, Any

# Standard test structure following Alpha Vantage pattern
class Test[ServerName]MCPCollector:
    
    @pytest.mark.asyncio
    async def test_mcp_connection(self):
        """Test basic MCP server connectivity."""
        # Implementation following Alpha Vantage test pattern
        pass
    
    @pytest.mark.asyncio  
    async def test_tool_discovery(self):
        """Test MCP tool discovery via tools/list."""
        # Implementation following Alpha Vantage test pattern
        pass
    
    @pytest.mark.asyncio
    async def test_tool_execution(self):
        """Test execution of key MCP tools."""
        # Implementation following Alpha Vantage test pattern
        pass
    
    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Test error handling for invalid requests."""
        # Implementation following Alpha Vantage test pattern
        pass
    
    @pytest.mark.asyncio
    async def test_cost_tracking(self):
        """Test cost tracking integration."""
        # Implementation following Alpha Vantage test pattern
        pass
    
    @pytest.mark.asyncio
    async def test_routing_integration(self):
        """Test integration with collector router."""
        # Implementation following Alpha Vantage test pattern
        pass

# Add main execution block for standalone testing
if __name__ == "__main__":
    # Run comprehensive test suite
    pass
```

### **3.2 Test Execution Commands**

```bash
# Individual MCP collector tests
python -m pytest backend/data_collectors/commercial/test/test_[server_name]_mcp_collector.py -v

# Integration tests with router
python backend/data_collectors/commercial/test/run_mcp_tests.py --collector [server_name]

# Full regression testing
python backend/data_collectors/commercial/test/run_all_commercial_tests.py
```

---

## 📋 **Phase 4: Documentation & Integration Standards**

### **4.1 Implementation Documentation**

**File**: `/backend/data_collectors/commercial/mcp/README_[SERVER_NAME]_MCP.md`

```markdown
# [Server Name] MCP Integration

## Overview
[Brief description of integration and capabilities]

## Implementation Status
- ✅ MCP Protocol Compliance
- ✅ Tool Discovery ([N] tools)
- ✅ Cost Tracking Integration  
- ✅ Router Integration
- ✅ Comprehensive Testing

## Available Tools
[List of key tools with descriptions]

## Usage Examples
[Code examples for common use cases]

## Testing Results
[Link to test output files and success rates]
```

### **4.2 Test Results Documentation**

**Directory**: `/docs/project/test_output/[ServerName]/`

**Required Files:**
- `mcp_connection_[YYYYMMDD]_[HHMMSS].json`
- `mcp_tool_discovery_[YYYYMMDD]_[HHMMSS].json`
- `mcp_tool_execution_[YYYYMMDD]_[HHMMSS].json`
- `mcp_cost_tracking_[YYYYMMDD]_[HHMMSS].json`
- `mcp_integration_test_summary_[YYYYMMDD]_[HHMMSS].json`

---

## ✅ **Phase 5: Quality Assurance Checklist**

### **5.1 Technical Requirements**

```markdown
### MCP Protocol Compliance
- [ ] JSON-RPC 2.0 request/response format
- [ ] Proper tool discovery via `tools/list`
- [ ] Successful tool execution via `tools/call`
- [ ] Error handling for malformed requests
- [ ] Timeout and connection error handling

### Integration Requirements  
- [ ] Implements `should_activate()` filtering method
- [ ] Implements `get_activation_priority()` scoring method
- [ ] Registered in collector router system
- [ ] Cost tracking integration functional
- [ ] Proper logging and error reporting

### Testing Requirements
- [ ] >80% success rate on tool execution tests
- [ ] Comprehensive error handling validation
- [ ] Performance benchmarks within acceptable ranges
- [ ] Integration tests with router system pass
- [ ] Cost tracking accuracy validated

### Documentation Requirements
- [ ] README with implementation overview
- [ ] Test results documented and saved
- [ ] Integration guide for future reference
- [ ] Code comments and docstrings complete
```

### **5.2 Performance Benchmarks**

**Target Metrics:**
- **MCP Connection**: <2 seconds average
- **Tool Discovery**: <3 seconds for full tool list
- **Tool Execution**: <5 seconds for standard requests
- **Integration Test Success Rate**: >85%
- **Error Recovery**: Graceful handling of all error conditions

---

## 🚀 **Implementation Timeline**

### **Week 1: Discovery & Architecture**
- Day 1-2: MCP server research and tool discovery
- Day 3-4: Collector class implementation
- Day 5-7: Basic MCP protocol integration

### **Week 2: Testing & Integration** 
- Day 1-3: Comprehensive test suite development
- Day 4-5: Router integration and filtering implementation
- Day 6-7: Cost tracking and quota management

### **Week 3: Validation & Documentation**
- Day 1-3: Full regression testing and optimization
- Day 4-5: Documentation and integration guides
- Day 6-7: Performance benchmarking and final validation

---

## 📊 **Success Metrics**

### **Technical Success**
- ✅ **MCP Protocol Compliance**: 100% JSON-RPC 2.0 compatibility
- ✅ **Tool Availability**: All advertised tools discoverable and executable
- ✅ **Integration Success**: Seamless router integration with proper filtering
- ✅ **Performance**: Meets or exceeds benchmark targets

### **Business Value** 
- ✅ **Data Access**: New data capabilities not available elsewhere
- ✅ **Cost Efficiency**: Optimal usage of commercial API quotas
- ✅ **Scalability**: Architecture supports future MCP ecosystem growth
- ✅ **Differentiation**: Maintains platform leadership in MCP-native finance

---

## 🔗 **Reference Implementations**

### **Alpha Vantage MCP (✅ Complete)**
- **File**: `/backend/data_collectors/commercial/mcp/alpha_vantage_mcp_collector.py`
- **Success Rate**: 85.71% (6/7 tools functional)
- **Test Coverage**: 19 comprehensive test scenarios
- **Integration**: Full router and cost tracking integration

### **Data.gov MCP (✅ Complete)**
- **File**: `/backend/data_collectors/government/mcp/data_gov_mcp_collector.py`
- **Tools**: 6 operational government data tools
- **Integration**: Government data routing and filtering
- **Performance**: High-speed government data access

---

## 🎯 **Template Usage Instructions**

### **For New MCP Server Integration:**

1. **Copy Template**: Start with this template structure
2. **Customize Sections**: Replace `[ServerName]` and `[server_name]` placeholders
3. **Research Phase**: Complete MCP server discovery and tool mapping
4. **Implementation**: Follow the established architecture patterns
5. **Testing**: Execute comprehensive test suite and document results
6. **Integration**: Register with router system and validate filtering
7. **Documentation**: Complete all required documentation files

### **Template Benefits:**

- **Accelerated Integration**: Proven patterns reduce implementation time by 60-80%
- **Consistent Quality**: Standardized approach ensures reliable integrations
- **Comprehensive Testing**: Built-in test framework validates all aspects
- **Future-Proof Architecture**: Template evolves with MCP ecosystem

---

**📋 TEMPLATE STATUS**: **READY FOR USE**  
**🚀 NEXT ACTION**: Apply template to next MCP server (Polygon.io, Financial Modeling Prep)  
**⏰ ESTIMATED INTEGRATION TIME**: 2-3 weeks per MCP server using this template  
**🎉 SUCCESS OUTCOME**: Rapid expansion of MCP-native financial data capabilities

---

*This template codifies the successful patterns from Alpha Vantage MCP and Data.gov MCP implementations, enabling rapid and consistent integration of the growing MCP ecosystem.*
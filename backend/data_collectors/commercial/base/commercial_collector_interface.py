"""
Commercial Collector Interface

Extends the base DataCollectorInterface with commercial-specific functionality:
- Cost tracking and quota management
- Subscription tier handling
- API usage analytics
- Budget controls and alerts

This interface maintains full backward compatibility with government collectors
while adding the enhanced capabilities needed for commercial API management.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent))

from base.collector_interface import DataCollectorInterface, CollectorConfig


class SubscriptionTier(Enum):
    """Commercial API subscription tiers."""
    FREE = "free"
    BASIC = "basic"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"


class UsageAlert(Enum):
    """Types of usage alerts."""
    QUOTA_WARNING = "quota_warning"
    QUOTA_EXCEEDED = "quota_exceeded"
    BUDGET_WARNING = "budget_warning"
    BUDGET_EXCEEDED = "budget_exceeded"
    RATE_LIMIT_APPROACHING = "rate_limit_approaching"


class CommercialCollectorInterface(DataCollectorInterface):
    """
    Extended interface for commercial API collectors.
    
    Adds commercial-specific capabilities while maintaining full compatibility
    with the base DataCollectorInterface used by government collectors.
    """
    
    def __init__(self, config: CollectorConfig):
        super().__init__(config)
        self._subscription_tier = SubscriptionTier.FREE
        self._monthly_budget = 0.0
        self._current_month_cost = 0.0
        
    @property
    @abstractmethod
    def cost_per_request(self) -> float:
        """Return the cost per API request in USD."""
        pass
    
    @property
    @abstractmethod
    def monthly_quota_limit(self) -> Optional[int]:
        """Return monthly request quota limit, or None if unlimited."""
        pass
        
    @property
    @abstractmethod
    def supports_mcp_protocol(self) -> bool:
        """Return True if this collector supports MCP protocol."""
        pass
    
    @abstractmethod
    def get_api_cost_estimate(self, request_params: Dict[str, Any]) -> float:
        """
        Estimate the cost of an API request before execution.
        
        Args:
            request_params: Parameters for the request to estimate
            
        Returns:
            Estimated cost in USD
        """
        pass
    
    @abstractmethod
    def get_subscription_tier_info(self) -> Dict[str, Any]:
        """
        Get current subscription tier details.
        
        Returns:
            Dictionary with tier information, limits, and capabilities
        """
        pass
    
    @abstractmethod
    def check_quota_status(self) -> Dict[str, Any]:
        """
        Check remaining quota and usage statistics.
        
        Returns:
            Dictionary with quota information:
            - remaining_requests: int
            - used_requests: int
            - quota_limit: int
            - reset_date: datetime
            - usage_percentage: float
        """
        pass
    
    @abstractmethod
    def get_cost_breakdown(self, time_period: str = "current_month") -> Dict[str, Any]:
        """
        Get detailed cost breakdown for specified time period.
        
        Args:
            time_period: 'current_month', 'last_month', 'last_7_days', etc.
            
        Returns:
            Dictionary with cost analysis:
            - total_cost: float
            - request_count: int
            - cost_per_request_avg: float
            - daily_breakdown: List[Dict]
        """
        pass
    
    # Quota and Budget Management
    
    def set_monthly_budget(self, budget: float) -> bool:
        """
        Set monthly budget limit in USD.
        
        Args:
            budget: Monthly budget limit
            
        Returns:
            True if budget set successfully
        """
        self._monthly_budget = budget
        return True
    
    def get_monthly_budget(self) -> float:
        """Get current monthly budget limit."""
        return self._monthly_budget
    
    def get_budget_status(self) -> Dict[str, Any]:
        """
        Get current budget status and spending.
        
        Returns:
            Dictionary with budget information
        """
        remaining_budget = max(0, self._monthly_budget - self._current_month_cost)
        usage_percentage = (self._current_month_cost / self._monthly_budget * 100) if self._monthly_budget > 0 else 0
        
        return {
            'monthly_budget': self._monthly_budget,
            'current_spend': self._current_month_cost,
            'remaining_budget': remaining_budget,
            'usage_percentage': usage_percentage,
            'budget_exceeded': self._current_month_cost > self._monthly_budget,
            'last_updated': datetime.now().isoformat()
        }
    
    def check_budget_before_request(self, estimated_cost: float) -> bool:
        """
        Check if request can be made without exceeding budget.
        
        Args:
            estimated_cost: Estimated cost of the request
            
        Returns:
            True if request is within budget
        """
        if self._monthly_budget <= 0:
            return True  # No budget limit set
            
        return (self._current_month_cost + estimated_cost) <= self._monthly_budget
    
    # Usage Tracking
    
    def record_api_usage(self, endpoint: str, cost: float, success: bool) -> None:
        """
        Record API usage for tracking and analytics.
        
        Args:
            endpoint: API endpoint or tool used
            cost: Cost of the request
            success: Whether request was successful
        """
        self._current_month_cost += cost
        # This would typically be implemented with a proper database/storage
        # For now, just update the running cost total
    
    def get_usage_analytics(self) -> Dict[str, Any]:
        """
        Get usage analytics and patterns.
        
        Returns:
            Dictionary with usage analytics
        """
        return {
            'total_requests_this_month': 0,  # Would be tracked properly
            'successful_requests': 0,
            'failed_requests': 0,
            'average_cost_per_request': 0.0,
            'most_used_endpoints': [],
            'usage_trends': {}
        }
    
    # Alert System
    
    def check_usage_alerts(self) -> List[Dict[str, Any]]:
        """
        Check for usage alerts (quota warnings, budget warnings, etc.).
        
        Returns:
            List of active alerts
        """
        alerts = []
        
        # Budget alerts
        if self._monthly_budget > 0:
            usage_percentage = (self._current_month_cost / self._monthly_budget * 100)
            
            if usage_percentage >= 100:
                alerts.append({
                    'type': UsageAlert.BUDGET_EXCEEDED.value,
                    'severity': 'critical',
                    'message': f'Monthly budget exceeded: ${self._current_month_cost:.2f} / ${self._monthly_budget:.2f}',
                    'timestamp': datetime.now().isoformat()
                })
            elif usage_percentage >= 80:
                alerts.append({
                    'type': UsageAlert.BUDGET_WARNING.value,
                    'severity': 'warning', 
                    'message': f'Monthly budget at {usage_percentage:.1f}%: ${self._current_month_cost:.2f} / ${self._monthly_budget:.2f}',
                    'timestamp': datetime.now().isoformat()
                })
        
        # Quota alerts (would be implemented by subclasses)
        quota_status = self.check_quota_status()
        if quota_status.get('usage_percentage', 0) >= 90:
            alerts.append({
                'type': UsageAlert.QUOTA_WARNING.value,
                'severity': 'warning',
                'message': f'API quota at {quota_status["usage_percentage"]:.1f}%',
                'timestamp': datetime.now().isoformat()
            })
        
        return alerts
    
    # Enhanced collector info for commercial APIs
    
    def get_commercial_collector_info(self) -> Dict[str, Any]:
        """
        Get comprehensive commercial collector information.
        
        Returns:
            Dictionary with commercial-specific collector metadata
        """
        base_info = self.get_collector_info()
        
        commercial_info = {
            'subscription_tier': self._subscription_tier.value,
            'cost_per_request': self.cost_per_request,
            'monthly_quota_limit': self.monthly_quota_limit,
            'supports_mcp': self.supports_mcp_protocol,
            'budget_status': self.get_budget_status(),
            'quota_status': self.check_quota_status(),
            'active_alerts': self.check_usage_alerts()
        }
        
        return {**base_info, **commercial_info}
    
    def __str__(self) -> str:
        """String representation including commercial info."""
        return f"{self.name}(source={self.source_name}, tier={self._subscription_tier.value}, authenticated={self._authenticated})"
"""
API Usage and Cost Tracking System

Provides comprehensive tracking and analytics for commercial API usage:
- Real-time cost monitoring
- Usage analytics and patterns
- Budget management and alerts
- Performance metrics
- Historical data analysis

This system helps optimize API usage costs and provides insights for
budget planning and usage optimization.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, date, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import json
from pathlib import Path
import threading


class AlertLevel(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning" 
    CRITICAL = "critical"


@dataclass
class APIUsageRecord:
    """Individual API usage record."""
    timestamp: datetime
    collector_name: str
    endpoint: str
    request_type: str
    cost: float
    success: bool
    response_time: float
    request_size: Optional[int] = None
    response_size: Optional[int] = None
    error_message: Optional[str] = None


@dataclass
class BudgetConfig:
    """Budget configuration for API usage."""
    monthly_limit: float
    daily_limit: Optional[float] = None
    alert_thresholds: List[float] = None  # Alert at these percentage levels
    auto_stop_at_limit: bool = False
    
    def __post_init__(self):
        if self.alert_thresholds is None:
            self.alert_thresholds = [50.0, 75.0, 90.0, 100.0]


class APIUsageTracker:
    """
    Comprehensive API usage and cost tracking system.
    
    Tracks usage across all commercial collectors with real-time
    cost monitoring, budget management, and analytics.
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize usage tracker.
        
        Args:
            storage_path: Path for persistent storage (optional)
        """
        self.storage_path = Path(storage_path) if storage_path else None
        self.usage_records: List[APIUsageRecord] = []
        self.budget_configs: Dict[str, BudgetConfig] = {}
        self.monthly_costs: Dict[str, Dict[str, float]] = {}  # collector -> {month: cost}
        self._lock = threading.Lock()
        
        # Load existing data if storage path provided
        if self.storage_path:
            self._load_data()
    
    def record_usage(
        self,
        collector_name: str,
        endpoint: str, 
        request_type: str,
        cost: float,
        success: bool,
        response_time: float,
        request_size: Optional[int] = None,
        response_size: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> None:
        """
        Record API usage.
        
        Args:
            collector_name: Name of the collector
            endpoint: API endpoint or MCP tool used
            request_type: Type of request (e.g., 'stock_price', 'sentiment')
            cost: Cost of the request in USD
            success: Whether request was successful
            response_time: Response time in seconds
            request_size: Request size in bytes (optional)
            response_size: Response size in bytes (optional)
            error_message: Error message if request failed (optional)
        """
        with self._lock:
            record = APIUsageRecord(
                timestamp=datetime.now(),
                collector_name=collector_name,
                endpoint=endpoint,
                request_type=request_type,
                cost=cost,
                success=success,
                response_time=response_time,
                request_size=request_size,
                response_size=response_size,
                error_message=error_message
            )
            
            self.usage_records.append(record)
            
            # Update monthly cost tracking
            month_key = record.timestamp.strftime("%Y-%m")
            if collector_name not in self.monthly_costs:
                self.monthly_costs[collector_name] = {}
            
            if month_key not in self.monthly_costs[collector_name]:
                self.monthly_costs[collector_name][month_key] = 0.0
                
            self.monthly_costs[collector_name][month_key] += cost
            
            # Persist data if storage configured
            if self.storage_path:
                self._save_data()
    
    def set_budget(self, collector_name: str, budget_config: BudgetConfig) -> None:
        """
        Set budget configuration for a collector.
        
        Args:
            collector_name: Name of the collector
            budget_config: Budget configuration
        """
        with self._lock:
            self.budget_configs[collector_name] = budget_config
            if self.storage_path:
                self._save_data()
    
    def get_monthly_usage(
        self, 
        collector_name: str,
        month: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get monthly usage statistics for a collector.
        
        Args:
            collector_name: Name of the collector
            month: Month in YYYY-MM format (defaults to current month)
            
        Returns:
            Dictionary with monthly usage statistics
        """
        if month is None:
            month = datetime.now().strftime("%Y-%m")
            
        # Filter records for the specified month and collector
        month_records = [
            record for record in self.usage_records
            if (record.collector_name == collector_name and
                record.timestamp.strftime("%Y-%m") == month)
        ]
        
        if not month_records:
            return {
                'collector_name': collector_name,
                'month': month,
                'total_cost': 0.0,
                'total_requests': 0,
                'successful_requests': 0,
                'failed_requests': 0,
                'average_response_time': 0.0,
                'average_cost_per_request': 0.0,
                'endpoints_used': {},
                'daily_breakdown': {}
            }
        
        # Calculate statistics
        total_cost = sum(record.cost for record in month_records)
        total_requests = len(month_records)
        successful_requests = sum(1 for record in month_records if record.success)
        failed_requests = total_requests - successful_requests
        average_response_time = sum(record.response_time for record in month_records) / total_requests
        average_cost_per_request = total_cost / total_requests if total_requests > 0 else 0.0
        
        # Endpoint usage breakdown
        endpoints_used = {}
        for record in month_records:
            if record.endpoint not in endpoints_used:
                endpoints_used[record.endpoint] = {'count': 0, 'cost': 0.0}
            endpoints_used[record.endpoint]['count'] += 1
            endpoints_used[record.endpoint]['cost'] += record.cost
        
        # Daily breakdown
        daily_breakdown = {}
        for record in month_records:
            day = record.timestamp.date().isoformat()
            if day not in daily_breakdown:
                daily_breakdown[day] = {'requests': 0, 'cost': 0.0, 'avg_response_time': 0.0}
            daily_breakdown[day]['requests'] += 1
            daily_breakdown[day]['cost'] += record.cost
        
        # Calculate average response times for each day
        for day in daily_breakdown:
            day_records = [r for r in month_records if r.timestamp.date().isoformat() == day]
            daily_breakdown[day]['avg_response_time'] = sum(r.response_time for r in day_records) / len(day_records)
        
        return {
            'collector_name': collector_name,
            'month': month,
            'total_cost': total_cost,
            'total_requests': total_requests,
            'successful_requests': successful_requests,
            'failed_requests': failed_requests,
            'success_rate': (successful_requests / total_requests * 100) if total_requests > 0 else 0.0,
            'average_response_time': average_response_time,
            'average_cost_per_request': average_cost_per_request,
            'endpoints_used': endpoints_used,
            'daily_breakdown': daily_breakdown
        }
    
    def check_budget_status(self, collector_name: str) -> Dict[str, Any]:
        """
        Check budget status for a collector.
        
        Args:
            collector_name: Name of the collector
            
        Returns:
            Dictionary with budget status information
        """
        if collector_name not in self.budget_configs:
            return {
                'collector_name': collector_name,
                'has_budget': False,
                'status': 'no_budget_configured'
            }
        
        budget_config = self.budget_configs[collector_name]
        current_month = datetime.now().strftime("%Y-%m")
        
        # Get current month spending
        current_spending = self.monthly_costs.get(collector_name, {}).get(current_month, 0.0)
        
        # Calculate budget status
        monthly_usage_percentage = (current_spending / budget_config.monthly_limit * 100) if budget_config.monthly_limit > 0 else 0
        remaining_budget = max(0, budget_config.monthly_limit - current_spending)
        
        # Determine status
        status = 'within_budget'
        if current_spending >= budget_config.monthly_limit:
            status = 'budget_exceeded'
        elif monthly_usage_percentage >= 90:
            status = 'approaching_limit'
        elif monthly_usage_percentage >= 75:
            status = 'high_usage'
        
        # Check for alerts
        alerts = []
        for threshold in budget_config.alert_thresholds:
            if monthly_usage_percentage >= threshold:
                alerts.append({
                    'threshold': threshold,
                    'current_percentage': monthly_usage_percentage,
                    'message': f'Budget usage at {monthly_usage_percentage:.1f}% (threshold: {threshold}%)'
                })
        
        return {
            'collector_name': collector_name,
            'has_budget': True,
            'status': status,
            'monthly_limit': budget_config.monthly_limit,
            'current_spending': current_spending,
            'remaining_budget': remaining_budget,
            'usage_percentage': monthly_usage_percentage,
            'alerts': alerts,
            'auto_stop_enabled': budget_config.auto_stop_at_limit,
            'last_updated': datetime.now().isoformat()
        }
    
    def can_make_request(self, collector_name: str, estimated_cost: float) -> bool:
        """
        Check if a request can be made without exceeding budget.
        
        Args:
            collector_name: Name of the collector
            estimated_cost: Estimated cost of the request
            
        Returns:
            True if request can be made within budget
        """
        if collector_name not in self.budget_configs:
            return True  # No budget configured, allow request
            
        budget_status = self.check_budget_status(collector_name)
        
        # If auto-stop is enabled and budget exceeded, deny request
        budget_config = self.budget_configs[collector_name]
        if budget_config.auto_stop_at_limit and budget_status['status'] == 'budget_exceeded':
            return False
        
        # Check if request would exceed budget
        projected_spending = budget_status['current_spending'] + estimated_cost
        return projected_spending <= budget_config.monthly_limit
    
    def get_cost_optimization_suggestions(self, collector_name: str) -> List[Dict[str, Any]]:
        """
        Get cost optimization suggestions for a collector.
        
        Args:
            collector_name: Name of the collector
            
        Returns:
            List of optimization suggestions
        """
        usage_stats = self.get_monthly_usage(collector_name)
        suggestions = []
        
        # High-cost endpoints
        if usage_stats['endpoints_used']:
            expensive_endpoints = sorted(
                usage_stats['endpoints_used'].items(),
                key=lambda x: x[1]['cost'],
                reverse=True
            )[:3]
            
            for endpoint, stats in expensive_endpoints:
                if stats['cost'] > usage_stats['total_cost'] * 0.3:  # >30% of total cost
                    suggestions.append({
                        'type': 'expensive_endpoint',
                        'priority': 'high',
                        'endpoint': endpoint,
                        'cost': stats['cost'],
                        'percentage_of_total': stats['cost'] / usage_stats['total_cost'] * 100,
                        'suggestion': f"Consider optimizing usage of {endpoint} - accounts for {stats['cost']/usage_stats['total_cost']*100:.1f}% of monthly cost"
                    })
        
        # Low success rate
        if usage_stats['success_rate'] < 95:
            suggestions.append({
                'type': 'low_success_rate',
                'priority': 'medium',
                'success_rate': usage_stats['success_rate'],
                'suggestion': f"Success rate is {usage_stats['success_rate']:.1f}% - investigate failed requests to avoid wasted costs"
            })
        
        # High average response time
        if usage_stats['average_response_time'] > 5.0:  # >5 seconds
            suggestions.append({
                'type': 'slow_responses',
                'priority': 'low',
                'avg_response_time': usage_stats['average_response_time'],
                'suggestion': f"Average response time is {usage_stats['average_response_time']:.1f}s - consider request optimization or caching"
            })
        
        return suggestions
    
    def get_usage_summary(self) -> Dict[str, Any]:
        """
        Get overall usage summary across all collectors.
        
        Returns:
            Dictionary with comprehensive usage summary
        """
        current_month = datetime.now().strftime("%Y-%m")
        
        # Aggregate data across all collectors
        total_cost_this_month = 0.0
        total_requests_this_month = 0
        collectors_summary = {}
        
        for collector_name in set(record.collector_name for record in self.usage_records):
            usage = self.get_monthly_usage(collector_name, current_month)
            total_cost_this_month += usage['total_cost']
            total_requests_this_month += usage['total_requests']
            
            collectors_summary[collector_name] = {
                'cost': usage['total_cost'],
                'requests': usage['total_requests'],
                'success_rate': usage['success_rate'],
                'avg_response_time': usage['average_response_time']
            }
        
        # Calculate projections
        days_in_month = (date.today().replace(month=date.today().month + 1, day=1) - timedelta(days=1)).day
        days_elapsed = date.today().day
        daily_average_cost = total_cost_this_month / days_elapsed if days_elapsed > 0 else 0
        projected_monthly_cost = daily_average_cost * days_in_month
        
        return {
            'current_month': current_month,
            'total_cost_this_month': total_cost_this_month,
            'total_requests_this_month': total_requests_this_month,
            'daily_average_cost': daily_average_cost,
            'projected_monthly_cost': projected_monthly_cost,
            'collectors_summary': collectors_summary,
            'last_updated': datetime.now().isoformat()
        }
    
    def _save_data(self) -> None:
        """Save data to persistent storage."""
        if not self.storage_path:
            return
            
        data = {
            'usage_records': [asdict(record) for record in self.usage_records],
            'budget_configs': {k: asdict(v) for k, v in self.budget_configs.items()},
            'monthly_costs': self.monthly_costs
        }
        
        # Convert datetime objects to ISO strings for JSON serialization
        for record_dict in data['usage_records']:
            if isinstance(record_dict['timestamp'], datetime):
                record_dict['timestamp'] = record_dict['timestamp'].isoformat()
        
        try:
            with open(self.storage_path, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Warning: Could not save usage data: {e}")
    
    def _load_data(self) -> None:
        """Load data from persistent storage."""
        if not self.storage_path or not self.storage_path.exists():
            return
            
        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)
            
            # Restore usage records
            self.usage_records = []
            for record_dict in data.get('usage_records', []):
                # Convert ISO string back to datetime
                record_dict['timestamp'] = datetime.fromisoformat(record_dict['timestamp'])
                self.usage_records.append(APIUsageRecord(**record_dict))
            
            # Restore budget configs
            self.budget_configs = {}
            for collector_name, budget_dict in data.get('budget_configs', {}).items():
                self.budget_configs[collector_name] = BudgetConfig(**budget_dict)
            
            # Restore monthly costs
            self.monthly_costs = data.get('monthly_costs', {})
            
        except Exception as e:
            print(f"Warning: Could not load usage data: {e}")


# Global usage tracker instance
usage_tracker = APIUsageTracker()
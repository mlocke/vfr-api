"""
Data validation utilities for financial data collectors.

This module provides comprehensive data validation and quality checks
to ensure data integrity and consistency across all collectors.
"""

import pandas as pd
import numpy as np
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Dict, List, Any, Optional, Union, Callable
from enum import Enum
import logging
import re

logger = logging.getLogger(__name__)


class ValidationLevel(Enum):
    """Validation severity levels."""
    ERROR = "error"      # Critical issues that should prevent data usage
    WARNING = "warning"  # Issues that may affect data quality  
    INFO = "info"       # Informational notices


@dataclass
class ValidationRule:
    """Definition of a data validation rule."""
    name: str
    description: str
    validator: Callable[[pd.DataFrame], List[Dict[str, Any]]]
    level: ValidationLevel = ValidationLevel.ERROR
    columns: Optional[List[str]] = None
    enabled: bool = True


@dataclass  
class ValidationIssue:
    """Individual validation issue found in data."""
    rule_name: str
    level: ValidationLevel
    message: str
    column: Optional[str] = None
    row_indices: Optional[List[int]] = None
    count: int = 1
    details: Optional[Dict[str, Any]] = None


@dataclass
class ValidationReport:
    """Complete validation report for a dataset."""
    total_rows: int = 0
    total_columns: int = 0
    issues: List[ValidationIssue] = field(default_factory=list)
    passed_rules: List[str] = field(default_factory=list)
    failed_rules: List[str] = field(default_factory=list)
    validation_time: Optional[datetime] = None
    
    @property
    def error_count(self) -> int:
        """Count of error-level issues."""
        return sum(1 for issue in self.issues if issue.level == ValidationLevel.ERROR)
    
    @property
    def warning_count(self) -> int:
        """Count of warning-level issues."""
        return sum(1 for issue in self.issues if issue.level == ValidationLevel.WARNING)
    
    @property
    def is_valid(self) -> bool:
        """True if no error-level issues found."""
        return self.error_count == 0
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of validation results."""
        return {
            "total_rows": self.total_rows,
            "total_columns": self.total_columns,
            "is_valid": self.is_valid,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "total_issues": len(self.issues),
            "rules_passed": len(self.passed_rules),
            "rules_failed": len(self.failed_rules),
            "validation_time": self.validation_time
        }


class DataValidator:
    """
    Comprehensive data validator for financial datasets.
    
    Provides built-in validation rules for:
    - Data types and formats
    - Missing values and completeness
    - Numerical ranges and outliers
    - Date/time consistency
    - Business logic validation
    - Data quality metrics
    """
    
    def __init__(self, custom_rules: Optional[List[ValidationRule]] = None):
        """
        Initialize data validator.
        
        Args:
            custom_rules: Additional custom validation rules
        """
        self.rules: Dict[str, ValidationRule] = {}
        
        # Add built-in rules
        self._add_builtin_rules()
        
        # Add custom rules
        if custom_rules:
            for rule in custom_rules:
                self.add_rule(rule)
    
    def add_rule(self, rule: ValidationRule) -> None:
        """Add a validation rule."""
        self.rules[rule.name] = rule
        logger.debug(f"Added validation rule: {rule.name}")
    
    def remove_rule(self, rule_name: str) -> None:
        """Remove a validation rule."""
        if rule_name in self.rules:
            del self.rules[rule_name]
            logger.debug(f"Removed validation rule: {rule_name}")
    
    def enable_rule(self, rule_name: str) -> None:
        """Enable a validation rule."""
        if rule_name in self.rules:
            self.rules[rule_name].enabled = True
    
    def disable_rule(self, rule_name: str) -> None:
        """Disable a validation rule."""
        if rule_name in self.rules:
            self.rules[rule_name].enabled = False
    
    def validate(self, data: pd.DataFrame, data_type: str = "general") -> ValidationReport:
        """
        Validate a dataset against all enabled rules.
        
        Args:
            data: DataFrame to validate
            data_type: Type of data for context-specific validation
            
        Returns:
            ValidationReport with all issues found
        """
        start_time = datetime.now()
        report = ValidationReport(
            total_rows=len(data),
            total_columns=len(data.columns),
            validation_time=start_time
        )
        
        logger.info(f"Starting validation of {data.shape} dataset (type: {data_type})")
        
        # Run all enabled rules
        for rule_name, rule in self.rules.items():
            if not rule.enabled:
                continue
                
            try:
                # Check if rule applies to specific columns
                if rule.columns and not any(col in data.columns for col in rule.columns):
                    continue
                
                # Run validation rule
                issues = rule.validator(data)
                
                if issues:
                    # Convert issues to ValidationIssue objects
                    for issue_data in issues:
                        issue = ValidationIssue(
                            rule_name=rule_name,
                            level=rule.level,
                            message=issue_data.get("message", "Validation failed"),
                            column=issue_data.get("column"),
                            row_indices=issue_data.get("row_indices"),
                            count=issue_data.get("count", 1),
                            details=issue_data.get("details")
                        )
                        report.issues.append(issue)
                    
                    report.failed_rules.append(rule_name)
                    logger.debug(f"Rule '{rule_name}' found {len(issues)} issues")
                else:
                    report.passed_rules.append(rule_name)
                    
            except Exception as e:
                # Rule execution failed
                error_issue = ValidationIssue(
                    rule_name=rule_name,
                    level=ValidationLevel.ERROR,
                    message=f"Rule execution failed: {str(e)}",
                    details={"exception_type": type(e).__name__}
                )
                report.issues.append(error_issue)
                report.failed_rules.append(rule_name)
                logger.error(f"Rule '{rule_name}' execution failed: {e}")
        
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"Validation completed in {duration:.2f}s. "
                   f"Found {len(report.issues)} issues ({report.error_count} errors, "
                   f"{report.warning_count} warnings)")
        
        return report
    
    def _add_builtin_rules(self) -> None:
        """Add built-in validation rules."""
        
        # Missing values rule
        def check_missing_values(df: pd.DataFrame) -> List[Dict[str, Any]]:
            issues = []
            for col in df.columns:
                missing_count = df[col].isna().sum()
                if missing_count > 0:
                    missing_pct = (missing_count / len(df)) * 100
                    level = ValidationLevel.ERROR if missing_pct > 50 else ValidationLevel.WARNING
                    issues.append({
                        "message": f"Column '{col}' has {missing_count} missing values ({missing_pct:.1f}%)",
                        "column": col,
                        "count": missing_count,
                        "details": {"missing_percentage": missing_pct}
                    })
            return issues
        
        self.add_rule(ValidationRule(
            name="missing_values",
            description="Check for missing values in dataset",
            validator=check_missing_values,
            level=ValidationLevel.WARNING
        ))
        
        # Duplicate rows rule
        def check_duplicate_rows(df: pd.DataFrame) -> List[Dict[str, Any]]:
            issues = []
            duplicates = df.duplicated()
            duplicate_count = duplicates.sum()
            if duplicate_count > 0:
                duplicate_indices = df[duplicates].index.tolist()
                issues.append({
                    "message": f"Found {duplicate_count} duplicate rows",
                    "row_indices": duplicate_indices,
                    "count": duplicate_count
                })
            return issues
        
        self.add_rule(ValidationRule(
            name="duplicate_rows",
            description="Check for duplicate rows",
            validator=check_duplicate_rows,
            level=ValidationLevel.WARNING
        ))
        
        # Numerical outliers rule
        def check_numerical_outliers(df: pd.DataFrame) -> List[Dict[str, Any]]:
            issues = []
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            
            for col in numeric_cols:
                if col in df.columns:
                    Q1 = df[col].quantile(0.25)
                    Q3 = df[col].quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    
                    outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
                    if len(outliers) > 0:
                        outlier_indices = outliers.index.tolist()
                        issues.append({
                            "message": f"Column '{col}' has {len(outliers)} potential outliers",
                            "column": col,
                            "row_indices": outlier_indices,
                            "count": len(outliers),
                            "details": {
                                "lower_bound": lower_bound,
                                "upper_bound": upper_bound,
                                "outlier_values": outliers[col].tolist()[:10]  # First 10
                            }
                        })
            return issues
        
        self.add_rule(ValidationRule(
            name="numerical_outliers",
            description="Check for numerical outliers using IQR method",
            validator=check_numerical_outliers,
            level=ValidationLevel.INFO
        ))
        
        # Date format rule
        def check_date_formats(df: pd.DataFrame) -> List[Dict[str, Any]]:
            issues = []
            date_cols = df.select_dtypes(include=['datetime64', 'object']).columns
            
            for col in date_cols:
                if col.lower() in ['date', 'timestamp', 'time'] or 'date' in col.lower():
                    try:
                        pd.to_datetime(df[col], errors='coerce')
                        invalid_dates = df[col].isna().sum()
                        if invalid_dates > 0:
                            issues.append({
                                "message": f"Column '{col}' has {invalid_dates} invalid date formats",
                                "column": col,
                                "count": invalid_dates
                            })
                    except Exception:
                        issues.append({
                            "message": f"Column '{col}' cannot be parsed as dates",
                            "column": col
                        })
            return issues
        
        self.add_rule(ValidationRule(
            name="date_formats",
            description="Check date column formats",
            validator=check_date_formats,
            level=ValidationLevel.WARNING
        ))
        
        # Stock symbol format rule (financial data specific)
        def check_stock_symbols(df: pd.DataFrame) -> List[Dict[str, Any]]:
            issues = []
            symbol_cols = [col for col in df.columns if 'symbol' in col.lower() or 'ticker' in col.lower()]
            
            for col in symbol_cols:
                if col in df.columns:
                    # Basic stock symbol pattern (1-5 letters, optionally followed by exchange suffix)
                    pattern = re.compile(r'^[A-Z]{1,5}(\.[A-Z]{1,3})?$')
                    invalid_symbols = df[~df[col].astype(str).str.match(pattern, na=False)]
                    
                    if len(invalid_symbols) > 0:
                        issues.append({
                            "message": f"Column '{col}' has {len(invalid_symbols)} invalid stock symbols",
                            "column": col,
                            "row_indices": invalid_symbols.index.tolist(),
                            "count": len(invalid_symbols),
                            "details": {"invalid_symbols": invalid_symbols[col].tolist()[:10]}
                        })
            return issues
        
        self.add_rule(ValidationRule(
            name="stock_symbols",
            description="Check stock symbol formats",
            validator=check_stock_symbols,
            level=ValidationLevel.ERROR
        ))
        
        # Negative prices rule (financial data specific)
        def check_negative_prices(df: pd.DataFrame) -> List[Dict[str, Any]]:
            issues = []
            price_cols = [col for col in df.columns 
                         if any(price_term in col.lower() 
                               for price_term in ['price', 'close', 'open', 'high', 'low', 'value'])]
            
            for col in price_cols:
                if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                    negative_prices = df[df[col] < 0]
                    if len(negative_prices) > 0:
                        issues.append({
                            "message": f"Column '{col}' has {len(negative_prices)} negative price values",
                            "column": col,
                            "row_indices": negative_prices.index.tolist(),
                            "count": len(negative_prices),
                            "details": {"negative_values": negative_prices[col].tolist()}
                        })
            return issues
        
        self.add_rule(ValidationRule(
            name="negative_prices",
            description="Check for negative price values",
            validator=check_negative_prices,
            level=ValidationLevel.ERROR
        ))
    
    def get_rule_list(self) -> List[Dict[str, Any]]:
        """Get list of all validation rules."""
        return [
            {
                "name": rule.name,
                "description": rule.description,
                "level": rule.level.value,
                "enabled": rule.enabled,
                "columns": rule.columns
            }
            for rule in self.rules.values()
        ]
"use client";

import { useState, useEffect } from "react";

// ML Service interfaces matching the backend
interface MLServiceInfo {
  id: string;
  name: string;
  type: 'ml_prediction' | 'feature_engineering' | 'ml_store' | 'ml_cache';
  status: 'healthy' | 'degraded' | 'offline' | 'initializing' | 'error';
  enabled: boolean;
  description: string;
  lastHealthCheck?: number;
  responseTime?: number;
  successRate?: number;
  errorRate?: number;
  features: string[];
  performance: {
    avgResponseTime: number;
    totalRequests: number;
    errorCount: number;
    uptime: number;
  };
  dependencies: string[];
}

interface MLTestResult {
  serviceId: string;
  serviceName: string;
  success: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
  testType: 'health' | 'integration' | 'performance' | 'stress';
  details?: any;
  metadata?: {
    confidence?: number;
    dataQuality?: number;
    cached?: boolean;
  };
}

interface MLPerformanceMetrics {
  serviceId: string;
  metrics: {
    requestsPerMinute: number;
    averageLatency: number;
    p95Latency: number;
    errorRate: number;
    cacheHitRate: number;
    featureGenerationTime: number;
    mlEnhancementTime: number;
    totalUptime: number;
  };
  timestamp: number;
}

export default function MLMonitoringPanel() {
  // State management
  const [mlServices, setMLServices] = useState<MLServiceInfo[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<MLPerformanceMetrics[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<MLTestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testType, setTestType] = useState<'health' | 'integration' | 'performance' | 'stress'>('health');
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'testing'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load ML services data
  useEffect(() => {
    loadMLServices();
    const interval = setInterval(loadMLServices, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadMLServices = async () => {
    try {
      const response = await fetch('/api/admin/ml-services', {
        headers: {
          'Authorization': 'Bearer dev-admin-token'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setMLServices(data.services || []);
        setPerformanceMetrics(data.performanceMetrics || []);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to load ML services');
      }
    } catch (error) {
      console.error('Failed to load ML services:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Handle service selection
  const handleServiceToggle = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSelectAll = () => {
    const enabledServiceIds = mlServices.filter(s => s.enabled).map(s => s.id);
    setSelectedServices(enabledServiceIds);
  };

  const handleDeselectAll = () => {
    setSelectedServices([]);
  };

  // Run ML service tests
  const handleRunTests = async () => {
    if (selectedServices.length === 0) return;

    setIsRunningTests(true);
    setTestResults([]);

    try {
      const response = await fetch('/api/admin/ml-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-admin-token'
        },
        body: JSON.stringify({
          action: 'test_services',
          serviceIds: selectedServices,
          testType
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.results) {
        setTestResults(data.results);
      } else {
        throw new Error(data.error || 'Test execution failed');
      }
    } catch (error) {
      console.error('ML service tests failed:', error);
      setError(error instanceof Error ? error.message : 'Test execution failed');
    } finally {
      setIsRunningTests(false);
    }
  };

  // Toggle ML service enabled/disabled
  const handleToggleService = async (serviceId: string) => {
    try {
      const response = await fetch(`/api/admin/ml-services/${serviceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-admin-token'
        },
        body: JSON.stringify({
          action: 'toggle'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Refresh services
        await loadMLServices();
      } else {
        throw new Error(data.message || 'Toggle failed');
      }
    } catch (error) {
      console.error(`Failed to toggle service ${serviceId}:`, error);
      setError(error instanceof Error ? error.message : 'Toggle failed');
    }
  };

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '🟢';
      case 'degraded':
        return '🟡';
      case 'offline':
        return '🔴';
      case 'initializing':
        return '🔵';
      case 'error':
        return '🔴';
      default:
        return '⚫';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ml_prediction':
        return '🧠';
      case 'feature_engineering':
        return '⚙️';
      case 'ml_store':
        return '💾';
      case 'ml_cache':
        return '⚡';
      default:
        return '📋';
    }
  };

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '20px',
        margin: '2rem 0'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
        <div style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Loading ML services...</div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '20px',
      padding: '2rem',
      margin: '2rem 0',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem'
      }}>
        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: '700',
          color: 'white',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          🤖 ML Services Monitoring
        </h2>

        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.7)'
          }}>
            {mlServices.filter(s => s.status === 'healthy').length}/{mlServices.length} Healthy
          </div>
          <button
            onClick={loadMLServices}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '8px',
              color: 'rgba(99, 102, 241, 0.9)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          color: 'rgba(239, 68, 68, 0.9)'
        }}>
          ❌ {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '1rem'
      }}>
        {(['overview', 'performance', 'testing'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1.5rem',
              background: activeTab === tab ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: activeTab === tab ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: activeTab === tab ? 'rgba(99, 102, 241, 0.9)' : 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Services Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            {mlServices.map(service => (
              <div
                key={service.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>{getTypeIcon(service.type)}</span>
                    <span style={{ fontSize: '1.2rem' }}>{getStatusIcon(service.status)}</span>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      color: 'white',
                      margin: 0
                    }}>
                      {service.name}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleToggleService(service.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: service.enabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      border: service.enabled ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '6px',
                      color: service.enabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {service.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                <div style={{
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.7)',
                  marginBottom: '1rem'
                }}>
                  {service.description}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  <div>Response: {service.responseTime ? `${service.responseTime}ms` : 'N/A'}</div>
                  <div>Success: {service.successRate ? `${(service.successRate * 100).toFixed(1)}%` : 'N/A'}</div>
                  <div>Requests: {service.performance.totalRequests}</div>
                  <div>Uptime: {formatUptime(service.performance.uptime)}</div>
                </div>

                {/* Features */}
                <div style={{
                  marginTop: '1rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.25rem'
                }}>
                  {service.features.slice(0, 3).map(feature => (
                    <span
                      key={feature}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: 'rgba(99, 102, 241, 0.2)',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        color: 'rgba(99, 102, 241, 0.9)'
                      }}
                    >
                      {feature.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {service.features.length > 3 && (
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                      +{service.features.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div>
          <h3 style={{
            fontSize: '1.2rem',
            fontWeight: '600',
            color: 'white',
            marginBottom: '1rem'
          }}>
            Performance Metrics
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem'
          }}>
            {performanceMetrics.map(metric => (
              <div
                key={metric.serviceId}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem'
                }}
              >
                <h4 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '1rem'
                }}>
                  {mlServices.find(s => s.id === metric.serviceId)?.name || metric.serviceId}
                </h4>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  <div>Avg Latency: {metric.metrics.averageLatency.toFixed(0)}ms</div>
                  <div>P95 Latency: {metric.metrics.p95Latency.toFixed(0)}ms</div>
                  <div>Error Rate: {(metric.metrics.errorRate * 100).toFixed(1)}%</div>
                  <div>Cache Hit: {(metric.metrics.cacheHitRate * 100).toFixed(1)}%</div>
                  <div>Requests/min: {metric.metrics.requestsPerMinute.toFixed(0)}</div>
                  <div>Uptime: {formatUptime(metric.metrics.totalUptime)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'testing' && (
        <div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '300px 1fr',
            gap: '2rem'
          }}>
            {/* Test Controls */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '600',
                color: 'white',
                marginBottom: '1rem'
              }}>
                Test Configuration
              </h3>

              {/* Service Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginBottom: '0.5rem',
                  display: 'block'
                }}>
                  Select Services
                </label>

                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <button
                    onClick={handleSelectAll}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      borderRadius: '4px',
                      color: 'rgba(99, 102, 241, 0.9)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '4px',
                      color: 'rgba(239, 68, 68, 0.9)',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Deselect All
                  </button>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {mlServices.filter(s => s.enabled).map(service => (
                    <div
                      key={service.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        marginBottom: '0.25rem',
                        background: selectedServices.includes(service.id) ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleServiceToggle(service.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service.id)}
                        onChange={() => handleServiceToggle(service.id)}
                        style={{ accentColor: 'rgba(99, 102, 241, 0.8)' }}
                      />
                      <span style={{
                        fontSize: '0.8rem',
                        color: 'white'
                      }}>
                        {service.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Type Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginBottom: '0.5rem',
                  display: 'block'
                }}>
                  Test Type
                </label>
                <select
                  value={testType}
                  onChange={e => setTestType(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    color: 'white',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="health" style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
                    🔍 Health Check
                  </option>
                  <option value="integration" style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
                    🔗 Integration Test
                  </option>
                  <option value="performance" style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
                    ⚡ Performance Test
                  </option>
                  <option value="stress" style={{ backgroundColor: '#1a1a1a', color: 'white' }}>
                    💪 Stress Test
                  </option>
                </select>
              </div>

              {/* Run Tests Button */}
              <button
                onClick={handleRunTests}
                disabled={selectedServices.length === 0 || isRunningTests}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: selectedServices.length > 0 && !isRunningTests
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(59, 130, 246, 0.9))'
                    : 'rgba(100, 100, 100, 0.3)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: selectedServices.length > 0 && !isRunningTests ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s ease'
                }}
              >
                {isRunningTests ? (
                  <>
                    <span style={{ animation: 'spin 1s linear infinite' }}>🔄</span>
                    {' '}Testing...
                  </>
                ) : (
                  <>🚀 Run Tests ({selectedServices.length} services)</>
                )}
              </button>
            </div>

            {/* Test Results */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '1.2rem',
                fontWeight: '600',
                color: 'white',
                marginBottom: '1rem'
              }}>
                Test Results
              </h3>

              {testResults.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  {isRunningTests ? 'Running tests...' : 'No test results yet. Select services and run tests.'}
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  {testResults.map((result, index) => (
                    <div
                      key={`${result.serviceId}-${result.timestamp}`}
                      style={{
                        background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: result.success ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '1rem'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem'
                      }}>
                        <span style={{
                          fontWeight: '600',
                          color: result.success ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)'
                        }}>
                          {result.serviceName}
                        </span>
                        <span style={{
                          fontSize: '0.8rem',
                          color: 'rgba(255, 255, 255, 0.6)'
                        }}>
                          {result.responseTime}ms
                        </span>
                      </div>

                      <div style={{
                        fontSize: '0.8rem',
                        color: 'rgba(255, 255, 255, 0.8)'
                      }}>
                        {result.success ? (
                          <div>
                            ✅ {result.testType} test successful
                            {result.metadata && (
                              <div style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>
                                {result.metadata.confidence && `Confidence: ${(result.metadata.confidence * 100).toFixed(1)}%`}
                                {result.metadata.dataQuality && ` | Quality: ${(result.metadata.dataQuality * 100).toFixed(1)}%`}
                                {result.metadata.cached && ' | Cached'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>❌ {result.error || 'Test failed'}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Test Summary */}
              {testResults.length > 0 && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  <div>✅ Success: {testResults.filter(r => r.success).length}</div>
                  <div>❌ Failed: {testResults.filter(r => !r.success).length}</div>
                  <div>⚡ Avg: {Math.round(testResults.reduce((sum, r) => sum + r.responseTime, 0) / testResults.length)}ms</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
"use client";

import React, { useState, useEffect } from 'react';
import OptionsPerformanceChart from './OptionsPerformanceChart';
import OptionsFeatureMatrix from './OptionsFeatureMatrix';
import OptionsErrorLog from './OptionsErrorLog';
import OptionsHealthIndicator from './OptionsHealthIndicator';

/**
 * OptionsTestingPanel - Main testing interface for options functionality
 * Integrates with VFR's existing admin dashboard design patterns
 */

export interface OptionsTestConfig {
  testType: 'performance' | 'memory' | 'cache' | 'benchmark' | 'stress';
  symbol: string;
  provider: 'standard' | 'unicornbay';
  concurrent: boolean;
  iterations: number;
}

export interface OptionsTestResult {
  testType: string;
  symbol: string;
  provider: string;
  success: boolean;
  duration: number;
  results: {
    totalAnalysisDuration?: number;
    analysisSuccess?: boolean;
    meetsTarget?: boolean;
    performance?: any;
    memoryDeltaMB?: number;
    hitRatio?: number;
    successRate?: number;
    throughput?: number;
  };
  summary: {
    status: 'PASS' | 'FAIL';
    efficiency: string;
    targetMet: boolean;
    recommendations: string[];
  };
  timestamp: number;
}

interface OptionsTestingPanelProps {
  onTestComplete?: (result: OptionsTestResult) => void;
}

export default function OptionsTestingPanel({ onTestComplete }: OptionsTestingPanelProps) {
  const [testConfig, setTestConfig] = useState<OptionsTestConfig>({
    testType: 'performance',
    symbol: 'AAPL',
    provider: 'unicornbay',
    concurrent: false,
    iterations: 1
  });

  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<OptionsTestResult[]>([]);
  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'charts' | 'errors'>('config');
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [featureMatrix, setFeatureMatrix] = useState<any>(null);

  // Load health status and feature matrix on mount
  useEffect(() => {
    loadOptionsHealth();
    loadFeatureMatrix();
  }, []);

  const loadOptionsHealth = async () => {
    try {
      const response = await fetch('/api/admin/options-performance?test=health');
      const data = await response.json();
      setHealthStatus(data);
    } catch (error) {
      console.error('Failed to load options health:', error);
    }
  };

  const loadFeatureMatrix = async () => {
    try {
      const response = await fetch('/api/admin/options-performance?test=features');
      const data = await response.json();
      setFeatureMatrix(data);
    } catch (error) {
      console.error('Failed to load feature matrix:', error);
    }
  };

  const runOptionsTest = async () => {
    if (isRunning) return;

    setIsRunning(true);
    try {
      const startTime = performance.now();

      // Build API URL with test parameters
      const params = new URLSearchParams({
        test: testConfig.testType,
        symbol: testConfig.symbol,
        provider: testConfig.provider,
        concurrent: testConfig.concurrent.toString(),
        iterations: testConfig.iterations.toString()
      });

      const response = await fetch(`/api/admin/options-performance?${params}`);
      const data = await response.json();

      if (data.success) {
        const result: OptionsTestResult = {
          ...data.data,
          duration: performance.now() - startTime,
          provider: testConfig.provider,
          timestamp: Date.now()
        };

        setTestResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
        onTestComplete?.(result);

        // Auto-switch to results tab
        setActiveTab('results');
      } else {
        throw new Error(data.error || 'Test failed');
      }
    } catch (error) {
      console.error('Options test failed:', error);
      // Add error result
      const errorResult: OptionsTestResult = {
        testType: testConfig.testType,
        symbol: testConfig.symbol,
        provider: testConfig.provider,
        success: false,
        duration: performance.now(),
        results: {},
        summary: {
          status: 'FAIL',
          efficiency: '0%',
          targetMet: false,
          recommendations: ['Check API connectivity', 'Verify symbol validity']
        },
        timestamp: Date.now()
      };
      setTestResults(prev => [errorResult, ...prev.slice(0, 9)]);
    } finally {
      setIsRunning(false);
    }
  };

  const getTestTypeIcon = (type: string) => {
    switch (type) {
      case 'performance': return '⚡';
      case 'memory': return '🧠';
      case 'cache': return '💾';
      case 'benchmark': return '📊';
      case 'stress': return '🔥';
      default: return '🧪';
    }
  };

  const getProviderIcon = (provider: string) => {
    return provider === 'unicornbay' ? '🦄' : '📈';
  };

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "20px",
        padding: "2rem",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
        marginTop: "2rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.8rem",
            fontWeight: "700",
            color: "white",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          📊 Options Testing Suite
        </h2>

        <OptionsHealthIndicator healthStatus={healthStatus} />
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "2rem",
        }}
      >
        {(['config', 'results', 'charts', 'errors'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "0.75rem 1.5rem",
              background: activeTab === tab
                ? "rgba(99, 102, 241, 0.3)"
                : "rgba(255, 255, 255, 0.1)",
              border: activeTab === tab
                ? "1px solid rgba(99, 102, 241, 0.5)"
                : "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "10px",
              color: activeTab === tab
                ? "rgba(99, 102, 241, 0.9)"
                : "rgba(255, 255, 255, 0.7)",
              fontSize: "0.9rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s ease",
              textTransform: "capitalize",
            }}
            onMouseEnter={e => {
              if (activeTab !== tab) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              }
            }}
            onMouseLeave={e => {
              if (activeTab !== tab) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
              }
            }}
          >
            {tab === 'config' && '⚙️'} {tab === 'results' && '📋'}
            {tab === 'charts' && '📈'} {tab === 'errors' && '⚠️'} {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ minHeight: "600px" }}>
        {activeTab === 'config' && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2rem",
            }}
          >
            {/* Test Configuration */}
            <div>
              <h3
                style={{
                  fontSize: "1.2rem",
                  fontWeight: "600",
                  color: "white",
                  marginBottom: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                ⚙️ Test Configuration
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Test Type Selection */}
                <div>
                  <label
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "rgba(255, 255, 255, 0.9)",
                      marginBottom: "0.5rem",
                      display: "block",
                    }}
                  >
                    Test Type
                  </label>
                  <select
                    value={testConfig.testType}
                    onChange={e => setTestConfig(prev => ({
                      ...prev,
                      testType: e.target.value as OptionsTestConfig['testType']
                    }))}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      background: "rgba(255, 255, 255, 0.1)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "0.9rem",
                      fontWeight: "500",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="performance" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
                      ⚡ Performance Test (Target: &lt;400ms)
                    </option>
                    <option value="memory" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
                      🧠 Memory Test (Target: &lt;2MB)
                    </option>
                    <option value="cache" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
                      💾 Cache Test (Target: &gt;85% hit ratio)
                    </option>
                    <option value="benchmark" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
                      📊 Benchmark Test (Multi-symbol)
                    </option>
                    <option value="stress" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
                      🔥 Stress Test (Concurrent requests)
                    </option>
                  </select>
                </div>

                {/* Provider Selection */}
                <div>
                  <label
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "rgba(255, 255, 255, 0.9)",
                      marginBottom: "0.5rem",
                      display: "block",
                    }}
                  >
                    Data Provider
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <button
                      onClick={() => setTestConfig(prev => ({ ...prev, provider: 'standard' }))}
                      style={{
                        padding: "0.75rem",
                        background: testConfig.provider === 'standard'
                          ? "rgba(34, 197, 94, 0.3)"
                          : "rgba(255, 255, 255, 0.1)",
                        border: testConfig.provider === 'standard'
                          ? "1px solid rgba(34, 197, 94, 0.5)"
                          : "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "8px",
                        color: testConfig.provider === 'standard'
                          ? "rgba(34, 197, 94, 0.9)"
                          : "rgba(255, 255, 255, 0.7)",
                        fontSize: "0.9rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                      }}
                    >
                      📈 Standard Options
                    </button>
                    <button
                      onClick={() => setTestConfig(prev => ({ ...prev, provider: 'unicornbay' }))}
                      style={{
                        padding: "0.75rem",
                        background: testConfig.provider === 'unicornbay'
                          ? "rgba(168, 85, 247, 0.3)"
                          : "rgba(255, 255, 255, 0.1)",
                        border: testConfig.provider === 'unicornbay'
                          ? "1px solid rgba(168, 85, 247, 0.5)"
                          : "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "8px",
                        color: testConfig.provider === 'unicornbay'
                          ? "rgba(168, 85, 247, 0.9)"
                          : "rgba(255, 255, 255, 0.7)",
                        fontSize: "0.9rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                      }}
                    >
                      🦄 UnicornBay Enhanced
                    </button>
                  </div>
                </div>

                {/* Symbol Input */}
                <div>
                  <label
                    style={{
                      fontSize: "1rem",
                      fontWeight: "500",
                      color: "rgba(255, 255, 255, 0.9)",
                      marginBottom: "0.5rem",
                      display: "block",
                    }}
                  >
                    Test Symbol
                  </label>
                  <input
                    type="text"
                    value={testConfig.symbol}
                    onChange={e => setTestConfig(prev => ({
                      ...prev,
                      symbol: e.target.value.toUpperCase()
                    }))}
                    placeholder="Enter symbol (e.g., AAPL)"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      background: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Advanced Options */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "1rem",
                      padding: "0.75rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      borderRadius: "8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={testConfig.concurrent}
                      onChange={e => setTestConfig(prev => ({
                        ...prev,
                        concurrent: e.target.checked
                      }))}
                      style={{
                        width: "16px",
                        height: "16px",
                        accentColor: "rgba(99, 102, 241, 0.8)",
                      }}
                    />
                    <label
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: "500",
                        color: "rgba(255, 255, 255, 0.9)",
                      }}
                    >
                      Enable concurrent testing (stress test mode)
                    </label>
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: "500",
                        color: "rgba(255, 255, 255, 0.9)",
                        marginBottom: "0.5rem",
                        display: "block",
                      }}
                    >
                      Test Iterations
                    </label>
                    <input
                      type="number"
                      value={testConfig.iterations}
                      onChange={e => setTestConfig(prev => ({
                        ...prev,
                        iterations: parseInt(e.target.value) || 1
                      }))}
                      min="1"
                      max="10"
                      style={{
                        width: "100%",
                        padding: "0.5rem",
                        background: "rgba(255, 255, 255, 0.1)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "6px",
                        color: "white",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Run Test Button */}
                <button
                  onClick={runOptionsTest}
                  disabled={isRunning || !testConfig.symbol}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.75rem",
                    background: !isRunning && testConfig.symbol
                      ? "linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(59, 130, 246, 0.9))"
                      : "rgba(100, 100, 100, 0.3)",
                    color: "white",
                    padding: "1rem 2rem",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    cursor: !isRunning && testConfig.symbol ? "pointer" : "not-allowed",
                    transition: "all 0.3s ease",
                    boxShadow: !isRunning && testConfig.symbol
                      ? "0 8px 25px rgba(99, 102, 241, 0.4)"
                      : "0 4px 15px rgba(0, 0, 0, 0.2)",
                  }}
                  onMouseEnter={e => {
                    if (!isRunning && testConfig.symbol) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 12px 35px rgba(99, 102, 241, 0.5)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isRunning && testConfig.symbol) {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 8px 25px rgba(99, 102, 241, 0.4)";
                    }
                  }}
                >
                  {isRunning ? (
                    <>
                      <span style={{ animation: "spin 1s linear infinite", fontSize: "1.2rem" }}>
                        🔄
                      </span>
                      Running {getTestTypeIcon(testConfig.testType)} Test...
                    </>
                  ) : (
                    <>
                      {getTestTypeIcon(testConfig.testType)} Run {testConfig.testType} Test
                      {getProviderIcon(testConfig.provider)}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Feature Matrix */}
            <div>
              <OptionsFeatureMatrix featureMatrix={featureMatrix} />
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div>
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: "600",
                color: "white",
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              📋 Test Results
            </h3>

            {testResults.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  color: "rgba(255, 255, 255, 0.6)",
                  background: "rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  border: "1px dashed rgba(255, 255, 255, 0.2)",
                }}
              >
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
                <div style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No test results yet</div>
                <div style={{ fontSize: "0.9rem" }}>Configure and run a test to see results here</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {testResults.map((result, index) => (
                  <div
                    key={`${result.timestamp}-${index}`}
                    style={{
                      background: result.success
                        ? "rgba(34, 197, 94, 0.1)"
                        : "rgba(239, 68, 68, 0.1)",
                      border: result.success
                        ? "1px solid rgba(34, 197, 94, 0.3)"
                        : "1px solid rgba(239, 68, 68, 0.3)",
                      borderRadius: "12px",
                      padding: "1.5rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          fontSize: "1rem",
                          fontWeight: "600",
                          color: result.success ? "rgba(34, 197, 94, 0.9)" : "rgba(239, 68, 68, 0.9)",
                        }}
                      >
                        {result.success ? '✅' : '❌'}
                        {getTestTypeIcon(result.testType)} {result.testType.toUpperCase()}
                        {getProviderIcon(result.provider)} {result.symbol}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "rgba(255, 255, 255, 0.6)",
                        }}
                      >
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: "1rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.6)" }}>
                          Duration
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: "600", color: "white" }}>
                          {result.duration.toFixed(0)}ms
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.6)" }}>
                          Status
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: "600", color: "white" }}>
                          {result.summary.status}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.6)" }}>
                          Efficiency
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: "600", color: "white" }}>
                          {result.summary.efficiency}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.6)" }}>
                          Target Met
                        </div>
                        <div style={{ fontSize: "1rem", fontWeight: "600", color: "white" }}>
                          {result.summary.targetMet ? '✅' : '❌'}
                        </div>
                      </div>
                    </div>

                    {result.summary.recommendations.length > 0 && (
                      <div>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            fontWeight: "600",
                            color: "rgba(255, 255, 255, 0.9)",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Recommendations:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
                          {result.summary.recommendations.map((rec, recIndex) => (
                            <li
                              key={recIndex}
                              style={{
                                fontSize: "0.8rem",
                                color: "rgba(255, 255, 255, 0.7)",
                                marginBottom: "0.25rem",
                              }}
                            >
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'charts' && (
          <OptionsPerformanceChart testResults={testResults} />
        )}

        {activeTab === 'errors' && (
          <OptionsErrorLog testResults={testResults} />
        )}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
"use client";

import React, { useMemo } from 'react';

/**
 * OptionsPerformanceChart - Real-time performance metrics visualization
 * Displays response times, success rates, and performance trends
 */

interface OptionsTestResult {
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

interface OptionsPerformanceChartProps {
  testResults: OptionsTestResult[];
}

export default function OptionsPerformanceChart({ testResults }: OptionsPerformanceChartProps) {
  const chartData = useMemo(() => {
    if (!testResults.length) return null;

    // Performance trends over time
    const performanceTrend = testResults
      .slice(0, 10) // Last 10 results
      .reverse()
      .map((result, index) => ({
        index: index + 1,
        duration: result.duration,
        success: result.success,
        provider: result.provider,
        testType: result.testType,
        target: getTargetForTestType(result.testType),
        timestamp: result.timestamp
      }));

    // Performance by test type
    const testTypePerformance = testResults.reduce((acc, result) => {
      if (!acc[result.testType]) {
        acc[result.testType] = {
          totalDuration: 0,
          count: 0,
          successes: 0,
          target: getTargetForTestType(result.testType)
        };
      }
      acc[result.testType].totalDuration += result.duration;
      acc[result.testType].count++;
      if (result.success) acc[result.testType].successes++;
      return acc;
    }, {} as Record<string, any>);

    // Provider comparison
    const providerComparison = testResults.reduce((acc, result) => {
      if (!acc[result.provider]) {
        acc[result.provider] = {
          totalDuration: 0,
          count: 0,
          successes: 0
        };
      }
      acc[result.provider].totalDuration += result.duration;
      acc[result.provider].count++;
      if (result.success) acc[result.provider].successes++;
      return acc;
    }, {} as Record<string, any>);

    return {
      performanceTrend,
      testTypePerformance,
      providerComparison
    };
  }, [testResults]);

  function getTargetForTestType(testType: string): number {
    switch (testType) {
      case 'performance': return 400;
      case 'memory': return 2; // MB
      case 'cache': return 85; // % hit ratio
      case 'benchmark': return 400;
      case 'stress': return 400;
      default: return 400;
    }
  }

  function getTargetUnit(testType: string): string {
    switch (testType) {
      case 'memory': return 'MB';
      case 'cache': return '%';
      default: return 'ms';
    }
  }

  if (!chartData || testResults.length === 0) {
    return (
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
          📈 Performance Charts
        </h3>

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
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📈</div>
          <div style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>No performance data yet</div>
          <div style={{ fontSize: "0.9rem" }}>Run tests to see performance visualization</div>
        </div>
      </div>
    );
  }

  return (
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
        📈 Performance Charts
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
        {/* Performance Trend Chart */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "12px",
            padding: "1.5rem",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <h4
            style={{
              fontSize: "1rem",
              fontWeight: "600",
              color: "white",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            📊 Response Time Trend
          </h4>

          <div style={{ position: "relative", height: "200px", overflow: "hidden" }}>
            {/* Chart Background Grid */}
            <svg
              width="100%"
              height="100%"
              style={{ position: "absolute", top: 0, left: 0 }}
            >
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(percent => (
                <line
                  key={percent}
                  x1="10%"
                  y1={`${percent}%`}
                  x2="90%"
                  y2={`${percent}%`}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="1"
                />
              ))}

              {/* Target line */}
              <line
                x1="10%"
                y1="50%"
                x2="90%"
                y2="50%"
                stroke="rgba(251, 191, 36, 0.6)"
                strokeWidth="2"
                strokeDasharray="5,5"
              />

              {/* Performance line */}
              {chartData.performanceTrend.length > 1 && (
                <polyline
                  points={chartData.performanceTrend
                    .map((point, index) => {
                      const x = 10 + (index / (chartData.performanceTrend.length - 1)) * 80;
                      const y = 100 - Math.min(100, (point.duration / point.target) * 50);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="rgba(99, 102, 241, 0.8)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {chartData.performanceTrend.map((point, index) => {
                const x = 10 + (index / Math.max(1, chartData.performanceTrend.length - 1)) * 80;
                const y = 100 - Math.min(100, (point.duration / point.target) * 50);
                return (
                  <circle
                    key={index}
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="4"
                    fill={point.success ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)"}
                    stroke="white"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>

            {/* Chart Legend */}
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                fontSize: "0.75rem",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <div
                  style={{
                    width: "12px",
                    height: "2px",
                    background: "rgba(251, 191, 36, 0.6)",
                  }}
                />
                Target
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "rgba(34, 197, 94, 0.8)",
                  }}
                />
                Success
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "rgba(239, 68, 68, 0.8)",
                  }}
                />
                Failed
              </div>
            </div>
          </div>
        </div>

        {/* Provider Comparison */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "12px",
            padding: "1.5rem",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <h4
            style={{
              fontSize: "1rem",
              fontWeight: "600",
              color: "white",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            🦄 Provider Comparison
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {Object.entries(chartData.providerComparison).map(([provider, data]: [string, any]) => {
              const avgDuration = data.totalDuration / data.count;
              const successRate = (data.successes / data.count) * 100;

              return (
                <div key={provider}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: "600",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {provider === 'unicornbay' ? '🦄' : '📈'}
                      {provider === 'unicornbay' ? 'UnicornBay' : 'Standard'}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "rgba(255, 255, 255, 0.7)",
                      }}
                    >
                      {avgDuration.toFixed(0)}ms avg
                    </div>
                  </div>

                  {/* Performance Bar */}
                  <div
                    style={{
                      width: "100%",
                      height: "8px",
                      background: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "4px",
                      overflow: "hidden",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, (avgDuration / 400) * 100)}%`,
                        height: "100%",
                        background: avgDuration < 400
                          ? "linear-gradient(90deg, rgba(34, 197, 94, 0.8), rgba(34, 197, 94, 0.6))"
                          : "linear-gradient(90deg, rgba(239, 68, 68, 0.8), rgba(239, 68, 68, 0.6))",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  {/* Success Rate */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                      color: "rgba(255, 255, 255, 0.6)",
                    }}
                  >
                    <span>Success Rate: {successRate.toFixed(0)}%</span>
                    <span>Tests: {data.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Test Type Performance Summary */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "12px",
          padding: "1.5rem",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <h4
          style={{
            fontSize: "1rem",
            fontWeight: "600",
            color: "white",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          🎯 Performance by Test Type
        </h4>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
          }}
        >
          {Object.entries(chartData.testTypePerformance).map(([testType, data]: [string, any]) => {
            const avgDuration = data.totalDuration / data.count;
            const successRate = (data.successes / data.count) * 100;
            const meetsTarget = avgDuration < data.target;

            const getTestIcon = (type: string) => {
              switch (type) {
                case 'performance': return '⚡';
                case 'memory': return '🧠';
                case 'cache': return '💾';
                case 'benchmark': return '📊';
                case 'stress': return '🔥';
                default: return '🧪';
              }
            };

            return (
              <div
                key={testType}
                style={{
                  padding: "1rem",
                  background: meetsTarget
                    ? "rgba(34, 197, 94, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                  border: meetsTarget
                    ? "1px solid rgba(34, 197, 94, 0.3)"
                    : "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    color: "white",
                  }}
                >
                  {getTestIcon(testType)} {testType.toUpperCase()}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "rgba(255, 255, 255, 0.8)",
                    }}
                  >
                    <span>Avg Duration:</span>
                    <span style={{ fontWeight: "600" }}>
                      {avgDuration.toFixed(0)}{getTargetUnit(testType)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "rgba(255, 255, 255, 0.8)",
                    }}
                  >
                    <span>Target:</span>
                    <span style={{ fontWeight: "600" }}>
                      &lt;{data.target}{getTargetUnit(testType)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "rgba(255, 255, 255, 0.8)",
                    }}
                  >
                    <span>Success Rate:</span>
                    <span style={{ fontWeight: "600" }}>{successRate.toFixed(0)}%</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                      color: "rgba(255, 255, 255, 0.8)",
                    }}
                  >
                    <span>Tests Run:</span>
                    <span style={{ fontWeight: "600" }}>{data.count}</span>
                  </div>

                  <div
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      borderRadius: "4px",
                      textAlign: "center",
                      fontSize: "0.8rem",
                      fontWeight: "600",
                      color: meetsTarget ? "rgba(34, 197, 94, 0.9)" : "rgba(239, 68, 68, 0.9)",
                    }}
                  >
                    {meetsTarget ? '✅ Target Met' : '❌ Needs Improvement'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
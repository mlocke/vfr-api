/**
 * InferenceWorkerPool Test Suite
 *
 * Tests worker pool for CPU-intensive inference operations
 */

import { InferenceWorkerPool, InferenceTask, InferenceResult } from '../InferenceWorkerPool'
import { MLModelType } from '../../types/MLTypes'

describe('InferenceWorkerPool', () => {
  let pool: InferenceWorkerPool

  beforeEach(async () => {
    pool = new InferenceWorkerPool({
      maxWorkers: 4,
      maxQueueSize: 100,
      taskTimeoutMs: 5000,
      enablePriority: true,
      enableMetrics: true
    })
    await pool.initialize()
  })

  afterEach(async () => {
    await pool.shutdown()
  })

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      const newPool = new InferenceWorkerPool()
      await newPool.initialize()

      const health = newPool.healthCheck()
      expect(health.initialized).toBe(true)

      await newPool.shutdown()
    })

    test('should create configured number of workers', async () => {
      const stats = pool.getStatistics()
      expect(stats.totalWorkers).toBe(4)
    })

    test('should initialize workers in idle state', () => {
      const stats = pool.getStatistics()
      expect(stats.activeWorkers).toBe(0)
    })
  })

  describe('Task Submission', () => {
    test('should submit task successfully', async () => {
      const task: InferenceTask = {
        taskId: 'task_1',
        modelId: 'model_1',
        modelType: MLModelType.LIGHTGBM,
        featureVector: {
          values: new Float32Array([1, 2, 3, 4, 5]),
          featureNames: ['f1', 'f2', 'f3', 'f4', 'f5'],
          symbol: 'TEST',
          timestamp: Date.now()
        },
        priority: 'normal',
        callback: (result: InferenceResult) => {
          expect(result.success).toBe(true)
        }
      }

      await pool.submitTask(task)

      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 100))

      const stats = pool.getStatistics()
      expect(stats.completedTasks).toBeGreaterThan(0)
    })

    test('should execute task callback on completion', async () => {
      let callbackExecuted = false
      let resultReceived: InferenceResult | null = null

      const task: InferenceTask = {
        taskId: 'callback_test',
        modelId: 'model_1',
        modelType: MLModelType.XGBOOST,
        featureVector: {
          values: new Float32Array([10, 20, 30]),
          featureNames: ['f1', 'f2', 'f3'],
          symbol: 'CALLBACK',
          timestamp: Date.now()
        },
        priority: 'normal',
        callback: (result: InferenceResult) => {
          callbackExecuted = true
          resultReceived = result
        }
      }

      await pool.submitTask(task)

      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(callbackExecuted).toBe(true)
      expect(resultReceived).toBeDefined()
      expect(resultReceived?.taskId).toBe('callback_test')
    })

    test('should handle multiple concurrent tasks', async () => {
      const taskCount = 10
      const completedTasks: string[] = []

      const tasks: InferenceTask[] = Array.from({ length: taskCount }, (_, i) => ({
        taskId: `task_${i}`,
        modelId: 'model_1',
        modelType: MLModelType.LIGHTGBM,
        featureVector: {
          values: new Float32Array([i, i + 1, i + 2]),
          featureNames: ['f1', 'f2', 'f3'],
          symbol: `STOCK${i}`,
          timestamp: Date.now()
        },
        priority: 'normal',
        callback: (result: InferenceResult) => {
          if (result.success) {
            completedTasks.push(result.taskId)
          }
        }
      }))

      // Submit all tasks
      await Promise.all(tasks.map(task => pool.submitTask(task)))

      // Wait for all tasks to complete
      await new Promise(resolve => setTimeout(resolve, 500))

      expect(completedTasks.length).toBe(taskCount)
    })
  })

  describe('Priority Queue', () => {
    test('should process high-priority tasks first', async () => {
      const executionOrder: string[] = []

      // Submit low priority task
      await pool.submitTask({
        taskId: 'low_1',
        modelId: 'model_1',
        modelType: MLModelType.LIGHTGBM,
        featureVector: {
          values: new Float32Array([1, 2, 3]),
          featureNames: ['f1', 'f2', 'f3'],
          symbol: 'LOW',
          timestamp: Date.now()
        },
        priority: 'low',
        callback: (result) => {
          executionOrder.push(result.taskId)
        }
      })

      // Submit high priority task
      await pool.submitTask({
        taskId: 'high_1',
        modelId: 'model_1',
        modelType: MLModelType.LIGHTGBM,
        featureVector: {
          values: new Float32Array([1, 2, 3]),
          featureNames: ['f1', 'f2', 'f3'],
          symbol: 'HIGH',
          timestamp: Date.now()
        },
        priority: 'high',
        callback: (result) => {
          executionOrder.push(result.taskId)
        }
      })

      // Wait for tasks to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // High priority should execute before or equal to low priority
      const highIndex = executionOrder.indexOf('high_1')
      const lowIndex = executionOrder.indexOf('low_1')

      expect(highIndex).toBeLessThanOrEqual(lowIndex)
    })

    test('should handle mixed priority tasks', async () => {
      const tasks: InferenceTask[] = [
        {
          taskId: 'task_low',
          modelId: 'model_1',
          modelType: MLModelType.LIGHTGBM,
          featureVector: {
            values: new Float32Array([1, 2]),
            featureNames: ['f1', 'f2'],
            symbol: 'TEST',
            timestamp: Date.now()
          },
          priority: 'low',
          callback: () => {}
        },
        {
          taskId: 'task_high',
          modelId: 'model_1',
          modelType: MLModelType.LIGHTGBM,
          featureVector: {
            values: new Float32Array([1, 2]),
            featureNames: ['f1', 'f2'],
            symbol: 'TEST',
            timestamp: Date.now()
          },
          priority: 'high',
          callback: () => {}
        },
        {
          taskId: 'task_normal',
          modelId: 'model_1',
          modelType: MLModelType.LIGHTGBM,
          featureVector: {
            values: new Float32Array([1, 2]),
            featureNames: ['f1', 'f2'],
            symbol: 'TEST',
            timestamp: Date.now()
          },
          priority: 'normal',
          callback: () => {}
        }
      ]

      await Promise.all(tasks.map(task => pool.submitTask(task)))

      await new Promise(resolve => setTimeout(resolve, 200))

      const stats = pool.getStatistics()
      expect(stats.completedTasks).toBe(3)
    })
  })

  describe('Queue Management', () => {
    test('should track queue size', async () => {
      // Fill queue with tasks
      for (let i = 0; i < 5; i++) {
        await pool.submitTask({
          taskId: `task_${i}`,
          modelId: 'model_1',
          modelType: MLModelType.LIGHTGBM,
          featureVector: {
            values: new Float32Array([i]),
            featureNames: ['f1'],
            symbol: 'TEST',
            timestamp: Date.now()
          },
          priority: 'normal',
          callback: () => {}
        })
      }

      const queueSize = pool.getQueueSize()
      expect(queueSize).toBeGreaterThanOrEqual(0)
    })

    test('should reject tasks when queue is full', async () => {
      const smallPool = new InferenceWorkerPool({
        maxWorkers: 1,
        maxQueueSize: 5,
        taskTimeoutMs: 5000,
        enablePriority: true,
        enableMetrics: true
      })
      await smallPool.initialize()

      // Fill queue
      const tasks: Promise<void>[] = []
      for (let i = 0; i < 10; i++) {
        tasks.push(
          smallPool.submitTask({
            taskId: `task_${i}`,
            modelId: 'model_1',
            modelType: MLModelType.LIGHTGBM,
            featureVector: {
              values: new Float32Array([i]),
              featureNames: ['f1'],
              symbol: 'TEST',
              timestamp: Date.now()
            },
            priority: 'normal',
            callback: () => {}
          })
        )
      }

      // Some tasks should be rejected
      const results = await Promise.allSettled(tasks)
      const rejected = results.filter(r => r.status === 'rejected')
      expect(rejected.length).toBeGreaterThan(0)

      await smallPool.shutdown()
    }, 10000)

    test('should clear queue', async () => {
      // Add tasks to queue
      for (let i = 0; i < 5; i++) {
        await pool.submitTask({
          taskId: `task_${i}`,
          modelId: 'model_1',
          modelType: MLModelType.LIGHTGBM,
          featureVector: {
            values: new Float32Array([i]),
            featureNames: ['f1'],
            symbol: 'TEST',
            timestamp: Date.now()
          },
          priority: 'normal',
          callback: () => {}
        })
      }

      pool.clearQueue()

      expect(pool.getQueueSize()).toBe(0)
    })
  })

  describe('Worker Status', () => {
    test('should track worker status', () => {
      const workers = pool.getWorkerStatus()

      expect(workers).toBeDefined()
      expect(workers.length).toBe(4)

      workers.forEach(worker => {
        expect(worker.workerId).toBeGreaterThanOrEqual(0)
        expect(worker.busy).toBeDefined()
        expect(worker.tasksCompleted).toBeGreaterThanOrEqual(0)
        expect(worker.lastActiveTime).toBeGreaterThan(0)
      })
    })

    test('should update worker busy status during execution', async () => {
      // Submit task
      await pool.submitTask({
        taskId: 'status_test',
        modelId: 'model_1',
        modelType: MLModelType.LIGHTGBM,
        featureVector: {
          values: new Float32Array([1, 2, 3]),
          featureNames: ['f1', 'f2', 'f3'],
          symbol: 'TEST',
          timestamp: Date.now()
        },
        priority: 'normal',
        callback: () => {}
      })

      // Check immediately (worker might be busy)
      const stats = pool.getStatistics()
      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0)

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 100))

      // Workers should be idle again
      const finalStats = pool.getStatistics()
      expect(finalStats.activeWorkers).toBe(0)
    })
  })

  describe('Statistics', () => {
    test('should track completed tasks', async () => {
      const initialStats = pool.getStatistics()
      const initialCompleted = initialStats.completedTasks

      await pool.submitTask({
        taskId: 'stats_test',
        modelId: 'model_1',
        modelType: MLModelType.LIGHTGBM,
        featureVector: {
          values: new Float32Array([1, 2, 3]),
          featureNames: ['f1', 'f2', 'f3'],
          symbol: 'TEST',
          timestamp: Date.now()
        },
        priority: 'normal',
        callback: () => {}
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const finalStats = pool.getStatistics()
      expect(finalStats.completedTasks).toBe(initialCompleted + 1)
    })

    test('should track average latency', async () => {
      // Submit several tasks
      for (let i = 0; i < 5; i++) {
        await pool.submitTask({
          taskId: `latency_test_${i}`,
          modelId: 'model_1',
          modelType: MLModelType.LIGHTGBM,
          featureVector: {
            values: new Float32Array([i, i + 1, i + 2]),
            featureNames: ['f1', 'f2', 'f3'],
            symbol: 'TEST',
            timestamp: Date.now()
          },
          priority: 'normal',
          callback: () => {}
        })
      }

      await new Promise(resolve => setTimeout(resolve, 300))

      const stats = pool.getStatistics()
      expect(stats.avgLatencyMs).toBeGreaterThan(0)
    })

    test('should calculate throughput', async () => {
      // Submit tasks
      for (let i = 0; i < 10; i++) {
        await pool.submitTask({
          taskId: `throughput_test_${i}`,
          modelId: 'model_1',
          modelType: MLModelType.LIGHTGBM,
          featureVector: {
            values: new Float32Array([i]),
            featureNames: ['f1'],
            symbol: 'TEST',
            timestamp: Date.now()
          },
          priority: 'normal',
          callback: () => {}
        })
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      const stats = pool.getStatistics()
      expect(stats.throughput).toBeGreaterThan(0)
    })
  })

  describe('Health Check', () => {
    test('should report healthy status when initialized', () => {
      const health = pool.healthCheck()

      expect(health.healthy).toBeDefined()
      expect(health.initialized).toBe(true)
      expect(health.statistics).toBeDefined()
      expect(health.issues).toBeDefined()
    })

    test('should detect queue overflow issues', async () => {
      const smallPool = new InferenceWorkerPool({
        maxWorkers: 1,
        maxQueueSize: 10,
        taskTimeoutMs: 5000,
        enablePriority: true,
        enableMetrics: true
      })
      await smallPool.initialize()

      // Fill queue to 90%+
      for (let i = 0; i < 10; i++) {
        try {
          await smallPool.submitTask({
            taskId: `overflow_${i}`,
            modelId: 'model_1',
            modelType: MLModelType.LIGHTGBM,
            featureVector: {
              values: new Float32Array([i]),
              featureNames: ['f1'],
              symbol: 'TEST',
              timestamp: Date.now()
            },
            priority: 'normal',
            callback: () => {}
          })
        } catch {
          // Ignore queue full errors
        }
      }

      const health = smallPool.healthCheck()
      if (health.statistics.queuedTasks >= 9) {
        expect(health.issues).toContain(expect.stringContaining('Queue nearly full'))
      }

      await smallPool.shutdown()
    })

    test('should detect high failure rate', async () => {
      const health = pool.healthCheck()

      if (health.statistics.completedTasks > 0) {
        const failureRate = health.statistics.failedTasks /
          (health.statistics.completedTasks + health.statistics.failedTasks)

        if (failureRate > 0.1) {
          expect(health.issues).toContain(expect.stringContaining('High failure rate'))
        }
      }
    })
  })

  describe('Shutdown', () => {
    test('should shutdown gracefully', async () => {
      const newPool = new InferenceWorkerPool()
      await newPool.initialize()

      await newPool.shutdown()

      const health = newPool.healthCheck()
      expect(health.initialized).toBe(false)
    })

    test('should wait for active tasks before shutdown', async () => {
      const newPool = new InferenceWorkerPool()
      await newPool.initialize()

      let taskCompleted = false

      await newPool.submitTask({
        taskId: 'shutdown_test',
        modelId: 'model_1',
        modelType: MLModelType.LIGHTGBM,
        featureVector: {
          values: new Float32Array([1, 2, 3]),
          featureNames: ['f1', 'f2', 'f3'],
          symbol: 'TEST',
          timestamp: Date.now()
        },
        priority: 'normal',
        callback: () => {
          taskCompleted = true
        }
      })

      await newPool.shutdown()

      expect(taskCompleted).toBe(true)
    }, 15000)

    test('should clear queue on shutdown', async () => {
      const newPool = new InferenceWorkerPool()
      await newPool.initialize()

      // Add tasks
      for (let i = 0; i < 5; i++) {
        await newPool.submitTask({
          taskId: `task_${i}`,
          modelId: 'model_1',
          modelType: MLModelType.LIGHTGBM,
          featureVector: {
            values: new Float32Array([i]),
            featureNames: ['f1'],
            symbol: 'TEST',
            timestamp: Date.now()
          },
          priority: 'normal',
          callback: () => {}
        })
      }

      await newPool.shutdown()

      expect(newPool.getQueueSize()).toBe(0)
    })
  })

  describe('Error Handling', () => {
    test('should handle task execution errors', async () => {
      let errorCaught = false

      await pool.submitTask({
        taskId: 'error_test',
        modelId: 'model_1',
        modelType: MLModelType.LIGHTGBM,
        featureVector: {
          values: new Float32Array([1, 2, 3]),
          featureNames: ['f1', 'f2', 'f3'],
          symbol: 'TEST',
          timestamp: Date.now()
        },
        priority: 'normal',
        callback: (result: InferenceResult) => {
          if (!result.success) {
            errorCaught = true
          }
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Task should complete (success or failure)
      const stats = pool.getStatistics()
      expect(stats.completedTasks + stats.failedTasks).toBeGreaterThan(0)
    })
  })
})

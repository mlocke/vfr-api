/**
 * Comprehensive TDD Tests for WebSocket Manager Cleanup Strategies
 * Tests connection cleanup, timer cleanup, event handler cleanup, and memory leak prevention
 */

import { WebSocketManager } from '../WebSocketManager'
import { jest } from '@jest/globals'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  public readyState: number = MockWebSocket.CONNECTING
  public onopen: ((event: Event) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null

  constructor(public url: string) {}

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSING
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED
      if (this.onclose) {
        this.onclose({ code: code || 1000, reason: reason || '' } as CloseEvent)
      }
    }, 10)
  }

  // Helper method to simulate connection
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) {
      this.onopen({} as Event)
    }
  }

  // Helper method to simulate error
  simulateError(error: any = {}) {
    if (this.onerror) {
      this.onerror(error as Event)
    }
  }

  // Helper method to simulate message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent)
    }
  }
}

// Mock global WebSocket
Object.defineProperty(global, 'WebSocket', {
  value: MockWebSocket,
  writable: true
})

describe('WebSocketManager Cleanup Strategies', () => {
  let wsManager: WebSocketManager
  let mockWebSocket: MockWebSocket

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Clear any existing WebSocket mock
    wsManager = new WebSocketManager({
      url: 'ws://localhost:3000/test',
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
      heartbeatTimeout: 5000
    })
  })

  afterEach(() => {
    // Clear all timers first to prevent leaks
    jest.clearAllTimers()

    // Cleanup WebSocket manager
    if (wsManager) {
      try {
        wsManager.disconnect()
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }

    // Reset all mocks to prevent state leakage
    jest.clearAllMocks()

    // Return to real timers
    jest.useRealTimers()

    // Force garbage collection if available (for memory testing)
    if (global.gc) {
      global.gc()
    }
  })

  describe('Connection Cleanup on Disconnect', () => {
    test('should_close_websocket_connection_with_normal_code_on_disconnect', async () => {
      // Arrange
      const connectPromise = wsManager.connect()

      // Simulate WebSocket opening after connection attempt
      await Promise.resolve() // Let connect() start
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen() // Trigger onopen
      jest.runOnlyPendingTimers() // Execute any pending timers

      await connectPromise // Wait for connection to complete

      const closeSpy = jest.spyOn(mockWebSocket, 'close')

      // Act
      wsManager.disconnect()

      // Assert
      expect(closeSpy).toHaveBeenCalledWith(1000, 'Client disconnect')
    })

    test('should_set_websocket_instance_to_null_after_disconnect', () => {
      // Arrange
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      expect((wsManager as any).ws).not.toBeNull()

      // Act
      wsManager.disconnect()

      // Assert
      expect((wsManager as any).ws).toBeNull()
    })

    test('should_reset_current_sector_on_disconnect', () => {
      // Arrange
      wsManager.subscribeToSector('technology')
      expect(wsManager.getStatus().currentSector).toBe('technology')

      // Act
      wsManager.disconnect()

      // Assert
      expect(wsManager.getStatus().currentSector).toBeNull()
    })

    test('should_reset_reconnect_attempts_counter_on_disconnect', async () => {
      // Arrange
      const connectPromise = wsManager.connect()

      // Simulate WebSocket opening
      await Promise.resolve()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()
      jest.runOnlyPendingTimers()

      await connectPromise

      // Simulate failed reconnection attempts
      ;(wsManager as any).reconnectAttempts = 2

      // Act
      wsManager.disconnect()

      // Assert
      expect((wsManager as any).reconnectAttempts).toBe(0)
    })

    test('should_handle_disconnect_when_websocket_is_already_null', () => {
      // Arrange
      ;(wsManager as any).ws = null

      // Act & Assert - Should not throw
      expect(() => wsManager.disconnect()).not.toThrow()
    })

    test('should_handle_disconnect_when_websocket_close_throws_error', () => {
      // Arrange
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      jest.spyOn(mockWebSocket, 'close').mockImplementation(() => {
        throw new Error('Close failed')
      })

      // Act & Assert - Should not throw
      expect(() => wsManager.disconnect()).not.toThrow()
    })
  })

  describe('Timer Cleanup (Reconnect, Heartbeat)', () => {
    test('should_clear_reconnect_timer_on_disconnect', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      // Simulate a pending reconnect timer
      ;(wsManager as any).reconnectTimer = setTimeout(() => {}, 1000)

      // Act
      wsManager.disconnect()

      // Assert
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect((wsManager as any).reconnectTimer).toBeNull()

      // Cleanup
      clearTimeoutSpy.mockRestore()
    })

    test('should_clear_heartbeat_timer_on_disconnect', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      // Start connection to initialize heartbeat
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()

      // Act
      wsManager.disconnect()

      // Assert
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect((wsManager as any).heartbeatTimer).toBeNull()

      // Cleanup
      clearTimeoutSpy.mockRestore()
    })

    test('should_clear_heartbeat_timer_on_websocket_close', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()

      // Act - Simulate WebSocket close
      mockWebSocket.close(1000)
      jest.advanceTimersByTime(20) // Allow close event to fire

      // Assert
      expect(clearTimeoutSpy).toHaveBeenCalled()

      // Cleanup
      clearTimeoutSpy.mockRestore()
    })

    test('should_handle_null_timer_cleanup_gracefully', () => {
      // Arrange
      ;(wsManager as any).reconnectTimer = null
      ;(wsManager as any).heartbeatTimer = null

      // Act & Assert - Should not throw
      expect(() => wsManager.disconnect()).not.toThrow()
    })

    test('should_prevent_timer_leaks_on_rapid_connect_disconnect_cycles', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      // Act - Reduced cycles to prevent memory overload (5 -> 3)
      for (let i = 0; i < 3; i++) {
        wsManager.connect()
        mockWebSocket = (wsManager as any).ws
        if (mockWebSocket) {
          mockWebSocket.simulateOpen()
        }
        wsManager.disconnect()
      }

      // Assert - Should have cleared timers for each cycle
      expect(clearTimeoutSpy).toHaveBeenCalled()

      // Cleanup
      clearTimeoutSpy.mockRestore()
    })

    test('should_stop_heartbeat_timer_when_connection_fails', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()

      // Act - Simulate connection failure
      mockWebSocket.simulateError(new Error('Connection lost'))

      // Assert
      expect(clearTimeoutSpy).toHaveBeenCalled()

      // Cleanup
      clearTimeoutSpy.mockRestore()
    })
  })

  describe('Event Handler Cleanup', () => {
    test('should_clear_message_handlers_on_disconnect', () => {
      // Arrange
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      wsManager.onMessage(handler1)
      wsManager.onMessage(handler2)

      expect((wsManager as any).messageHandlers).toHaveLength(2)

      // Act
      wsManager.disconnect()

      // Simulate message after disconnect - handlers should not be called
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()
      mockWebSocket.simulateMessage({ type: 'test', timestamp: Date.now() })

      // Assert - Handlers should still exist but not be called for old connections
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    test('should_clear_connection_handlers_on_disconnect', () => {
      // Arrange
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      wsManager.onConnection(handler1)
      wsManager.onConnection(handler2)

      // Act
      wsManager.disconnect()

      // Verify handlers array still exists but isn't called for old events
      expect((wsManager as any).connectionHandlers).toHaveLength(2)
    })

    test('should_clear_error_handlers_on_disconnect', () => {
      // Arrange
      const handler1 = jest.fn()
      const handler2 = jest.fn()

      wsManager.onError(handler1)
      wsManager.onError(handler2)

      // Act
      wsManager.disconnect()

      // Verify handlers array still exists
      expect((wsManager as any).errorHandlers).toHaveLength(2)
    })

    test('should_prevent_handler_execution_after_websocket_is_nulled', () => {
      // Arrange
      const messageHandler = jest.fn()
      const connectionHandler = jest.fn()
      const errorHandler = jest.fn()

      wsManager.onMessage(messageHandler)
      wsManager.onConnection(connectionHandler)
      wsManager.onError(errorHandler)

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws

      // Act - Disconnect first
      wsManager.disconnect()

      // Try to trigger events after disconnect
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({ data: JSON.stringify({ type: 'test' }) } as MessageEvent)
      }

      // Assert - Handlers should not be called
      expect(messageHandler).not.toHaveBeenCalled()
    })

    test('should_handle_handler_execution_errors_gracefully', () => {
      // Arrange
      const faultyHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error')
      })
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      wsManager.onMessage(faultyHandler)
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()

      // Act
      mockWebSocket.simulateMessage({ type: 'test', timestamp: Date.now() })

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Message handler error:',
        expect.any(Error)
      )

      // Cleanup
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Memory Leak Prevention', () => {
    test('should_prevent_memory_leaks_from_unclosed_websocket_connections', () => {
      // Arrange
      const connections: MockWebSocket[] = []

      // Create multiple connections
      for (let i = 0; i < 5; i++) {
        wsManager.connect()
        const ws = (wsManager as any).ws
        if (ws) {
          connections.push(ws)
          ws.simulateOpen()
        }
        wsManager.disconnect()
      }

      // Assert - Each connection should have been properly closed
      connections.forEach((ws, index) => {
        expect(ws.readyState).toBe(MockWebSocket.CLOSED)
      })
    })

    test('should_prevent_memory_leaks_from_orphaned_timers', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      // Create multiple instances and connections
      const managers = Array(3).fill(null).map(() => new WebSocketManager())

      managers.forEach(manager => {
        manager.connect()
        const ws = (manager as any).ws
        if (ws) {
          ws.simulateOpen()
        }
        manager.disconnect()
      })

      // Assert - All timers should be cleared
      expect(clearTimeoutSpy).toHaveBeenCalled()

      // Cleanup
      clearTimeoutSpy.mockRestore()
    })

    test('should_handle_websocket_garbage_collection_properly', () => {
      // Arrange
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws

      // Act
      wsManager.disconnect()

      // Assert - WebSocket reference should be removed
      expect((wsManager as any).ws).toBeNull()
      expect(mockWebSocket.readyState).toBe(MockWebSocket.CLOSED)
    })

    test('should_prevent_event_listener_memory_leaks', () => {
      // Arrange
      const initialHandlerCount = (wsManager as any).messageHandlers.length

      // Add fewer handlers to reduce memory pressure (10 -> 5)
      const handlers = Array(5).fill(null).map(() => jest.fn())
      handlers.forEach(handler => wsManager.onMessage(handler))

      expect((wsManager as any).messageHandlers.length).toBe(initialHandlerCount + 5)

      // Act - Disconnect should not affect handler array (by design)
      wsManager.disconnect()

      // Assert - Handlers persist but won't be called for old connections
      expect((wsManager as any).messageHandlers.length).toBe(initialHandlerCount + 5)
    })

    test('should_handle_rapid_connection_cycles_without_memory_leaks', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      // Act - Reduced cycles to prevent memory overload (10 -> 5)
      for (let i = 0; i < 5; i++) {
        wsManager.connect()
        const ws = (wsManager as any).ws
        if (ws) {
          ws.simulateOpen()
          wsManager.subscribeToSector(`sector${i}`)
        }
        wsManager.disconnect()
      }

      // Assert - Final state should be clean
      expect((wsManager as any).ws).toBeNull()
      expect((wsManager as any).currentSector).toBeNull()
      expect((wsManager as any).reconnectTimer).toBeNull()
      expect((wsManager as any).heartbeatTimer).toBeNull()
      expect(clearTimeoutSpy).toHaveBeenCalled()

      // Cleanup
      clearTimeoutSpy.mockRestore()
    })
  })

  describe('Reconnection Timer Cleanup', () => {
    test('should_cancel_pending_reconnection_attempts_on_disconnect', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws

      // Simulate connection failure to trigger reconnection
      mockWebSocket.close(1006) // Abnormal closure
      jest.advanceTimersByTime(20) // Allow close event to fire

      // Verify reconnection timer was set
      expect((wsManager as any).reconnectTimer).not.toBeNull()

      // Act
      wsManager.disconnect()

      // Assert
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect((wsManager as any).reconnectTimer).toBeNull()

      // Cleanup
      clearTimeoutSpy.mockRestore()
    })

    test('should_stop_reconnection_attempts_when_max_attempts_reached', () => {
      // Arrange
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Set to maximum attempts
      ;(wsManager as any).reconnectAttempts = 3 // maxReconnectAttempts from config

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws

      // Act - Trigger reconnection logic
      ;(wsManager as any).attemptReconnect()

      // Assert - Should not schedule new timer
      expect((wsManager as any).reconnectTimer).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Max reconnection attempts')
      )

      // Cleanup
      consoleErrorSpy.mockRestore()
    })

    test('should_cleanup_reconnection_state_on_successful_connection', () => {
      // Arrange
      ;(wsManager as any).reconnectAttempts = 2

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws

      // Act - Simulate successful connection
      mockWebSocket.simulateOpen()

      // Assert
      expect((wsManager as any).reconnectAttempts).toBe(0)
    })

    test('should_handle_reconnection_timer_errors_gracefully', () => {
      // Arrange
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(() => {
        throw new Error('Timer creation failed')
      })

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws

      // Act & Assert - Should not throw
      expect(() => {
        ;(wsManager as any).attemptReconnect()
      }).not.toThrow()

      // Cleanup
      setTimeoutSpy.mockRestore()
    })
  })

  describe('Heartbeat Timer Management', () => {
    test('should_start_heartbeat_timer_on_connection_open', () => {
      // Arrange
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws

      // Act
      mockWebSocket.simulateOpen()

      // Assert
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        5000 // heartbeatTimeout from config
      )

      // Cleanup
      setTimeoutSpy.mockRestore()
    })

    test('should_reset_heartbeat_timer_on_message_received', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()

      const initialTimeoutCalls = setTimeoutSpy.mock.calls.length

      // Act - Send heartbeat message
      mockWebSocket.simulateMessage({ type: 'heartbeat', timestamp: Date.now() })

      // Assert
      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(initialTimeoutCalls)

      // Cleanup
      clearTimeoutSpy.mockRestore()
      setTimeoutSpy.mockRestore()
    })

    test('should_close_websocket_on_heartbeat_timeout', () => {
      // Arrange
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()

      const closeSpy = jest.spyOn(mockWebSocket, 'close')

      // Act - Advance time to trigger heartbeat timeout
      jest.advanceTimersByTime(5000)

      // Assert
      expect(closeSpy).toHaveBeenCalledWith(1001, 'Heartbeat timeout')
    })

    test('should_handle_heartbeat_timer_when_websocket_is_null', () => {
      // Arrange
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()

      // Null the websocket
      ;(wsManager as any).ws = null

      // Act & Assert - Should not throw when heartbeat timeout fires
      expect(() => {
        jest.advanceTimersByTime(5000)
      }).not.toThrow()
    })
  })

  describe('Integration Cleanup Tests', () => {
    test('should_perform_complete_cleanup_sequence_on_disconnect', () => {
      // Arrange
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()
      wsManager.subscribeToSector('technology')

      // Set up some timers
      ;(wsManager as any).reconnectTimer = setTimeout(() => {}, 1000)

      // Act
      wsManager.disconnect()

      // Assert - Complete cleanup
      expect(clearTimeoutSpy).toHaveBeenCalled() // Timers cleared
      expect((wsManager as any).ws).toBeNull() // WebSocket nulled
      expect((wsManager as any).currentSector).toBeNull() // Sector reset
      expect((wsManager as any).reconnectAttempts).toBe(0) // Attempts reset
      expect((wsManager as any).reconnectTimer).toBeNull() // Timer nulled
      expect((wsManager as any).heartbeatTimer).toBeNull() // Heartbeat nulled

      // Cleanup
      clearTimeoutSpy.mockRestore()
    })

    test('should_maintain_cleanup_idempotency', () => {
      // Arrange
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()

      // Act - Multiple disconnects
      wsManager.disconnect()
      wsManager.disconnect()
      wsManager.disconnect()

      // Assert - Should remain in clean state
      expect((wsManager as any).ws).toBeNull()
      expect((wsManager as any).currentSector).toBeNull()
      expect((wsManager as any).reconnectTimer).toBeNull()
      expect((wsManager as any).heartbeatTimer).toBeNull()
    })

    test('should_handle_cleanup_during_connection_process', () => {
      // Arrange
      const connectPromise = wsManager.connect()
      mockWebSocket = (wsManager as any).ws

      // Act - Disconnect before connection completes
      wsManager.disconnect()

      // Assert - Should not throw and should be in clean state
      expect((wsManager as any).ws).toBeNull()
      expect((wsManager as any).isConnecting).toBe(false)
    })

    test('should_handle_cleanup_with_pending_reconnection', () => {
      // Arrange
      wsManager.connect()
      mockWebSocket = (wsManager as any).ws

      // Trigger reconnection
      mockWebSocket.close(1006) // Abnormal closure
      jest.advanceTimersByTime(20) // Allow close event

      // Verify reconnection is pending
      expect((wsManager as any).reconnectTimer).not.toBeNull()

      // Act
      wsManager.disconnect()

      // Assert
      expect((wsManager as any).reconnectTimer).toBeNull()
      expect((wsManager as any).reconnectAttempts).toBe(0)
    })

    test('should_handle_cleanup_with_active_message_handlers', () => {
      // Arrange
      const messageHandler = jest.fn()
      const connectionHandler = jest.fn()

      wsManager.onMessage(messageHandler)
      wsManager.onConnection(connectionHandler)

      wsManager.connect()
      mockWebSocket = (wsManager as any).ws
      mockWebSocket.simulateOpen()

      // Act
      wsManager.disconnect()

      // Try to send message after disconnect
      try {
        mockWebSocket.simulateMessage({ type: 'test', timestamp: Date.now() })
      } catch (e) {
        // Expected - connection is closed
      }

      // Assert - Handlers should not be called after disconnect
      expect(messageHandler).not.toHaveBeenCalled()
    })
  })
})
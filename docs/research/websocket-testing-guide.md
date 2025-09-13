# WebSocket Testing Guide

WebSocket tests hanging and failing is actually quite common! WebSocket testing does present some unique challenges compared to regular HTTP testing.

## Why WebSocket Tests Are Tricky

WebSocket connections are stateful and persistent, which introduces timing and lifecycle complexities. Unlike HTTP requests that have a clear request-response cycle, WebSockets maintain long-lived connections with bidirectional messaging. This creates several testing pitfalls.

## Common Causes of Hanging Tests

- **Connection lifecycle issues** - Tests don't properly close connections, leaving them open indefinitely
- **Async timing problems** - Tests don't wait for connection establishment or message delivery before making assertions
- **Event listener cleanup** - Accumulated event listeners from previous tests interfere with new ones
- **Server state pollution** - Previous tests leave the WebSocket server in an unexpected state

## General Testing Strategies

### Proper Connection Management
Always ensure connections are closed in test cleanup, even if tests fail. Use connection state checking (readyState property) before sending messages. Implement proper async patterns with promises or async/await rather than callbacks when possible.

### Handle Timing Issues
Build in proper wait conditions. Don't just use arbitrary timeouts - wait for specific connection states or message acknowledgments. Many testing frameworks have utilities for waiting on conditions.

### Strategic Mocking
For unit tests, consider mocking the WebSocket entirely. For integration tests, use a test WebSocket server that you can control and reset between tests.

## Testing Patterns That Work Well

- Set up dedicated test WebSocket endpoints that can be reset between tests
- Use connection pooling carefully in tests, or disable it entirely
- Implement proper test isolation by ensuring each test gets a fresh connection state

The key is being very explicit about connection lifecycle and async timing rather than hoping things "just work" like they might with simpler HTTP tests.

## Memory Leak Testing Challenges

Memory leak tests with WebSockets are particularly thorny and notorious for being flaky and hanging because they're trying to detect something (memory not being freed) that may not happen immediately or predictably.

### Why WebSocket Memory Leak Tests Are Especially Problematic

WebSockets hold onto various resources - the connection itself, message buffers, event listeners, and often application-level caches or state. Memory leak tests typically work by measuring memory before/after operations and waiting for garbage collection, but WebSockets complicate this because:

- **Garbage collection timing** - The GC may not run when your test expects it to, causing false positives
- **Connection cleanup delays** - WebSocket close handshakes and TCP cleanup happen asynchronously
- **Event listener accumulation** - Each connection can register multiple event handlers that need explicit cleanup
- **Browser/Node.js differences** - Memory management varies significantly between environments

### Common Patterns That Cause Hanging

Tests might be waiting for memory to drop below a threshold that never gets reached because of retained references. Or they're waiting for a GC cycle that doesn't happen during the test timeframe.

### Better Approaches for Memory Leak Testing

Instead of measuring raw memory usage, test for specific resource cleanup:
- Count active connections
- Verify event listeners are removed
- Check that message queues are cleared
- Use `WeakRef` or `FinalizationRegistry` (if available in your environment) to detect when objects are actually collected

### Practical Recommendations

- Set aggressive timeouts on memory leak tests
- Make them less strict than your functional tests
- Consider running them separately from your main test suite since they're inherently less reliable
- Focus on observable resource cleanup rather than raw memory measurements
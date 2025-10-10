# Parallel Progress Tracking - Test Plan

## Overview
This document describes how to test the new parallel progress visualization feature.

## Prerequisites
- Development server running (`npm run dev`)
- Admin dashboard accessible
- At least one stock symbol to analyze (e.g., AAPL)

## Test Scenarios

### Test 1: Basic Functionality
**Steps:**
1. Navigate to Admin Dashboard (`/admin`)
2. Enter stock symbol "AAPL"
3. Click "Analyze Stock"
4. Observe the progress modal

**Expected Results:**
- Modal appears with progress tracking
- Overall progress bar shows at top (0-100%)
- "Data Services" section displays below current status
- 7 service cards are visible:
  - Sentiment (💭)
  - VWAP (📉)
  - Macro (🌍)
  - ESG (🌱)
  - Short Interest (📊)
  - Extended Hours (🕐)
  - Options (📈)
- All cards start in "pending" state (gray with ⏳)

### Test 2: Parallel Progress Updates
**Steps:**
1. Continue observing from Test 1
2. Watch as services begin executing

**Expected Results:**
- Services transition from gray (pending) to blue (in progress)
- Blue service cards show spinning icon animation
- Status icon changes from ⏳ to 🔄
- Multiple services show "in progress" simultaneously (proving parallelization)
- Services complete at different times (not sequential)

### Test 3: Service Completion
**Steps:**
1. Continue observing until analysis completes
2. Watch each service finish

**Expected Results:**
- Completed services turn green
- Green service cards show ✅ icon
- Background color changes to green tint
- Border becomes green
- Services remain green until modal closes

### Test 4: Overall Progress
**Steps:**
1. Observe overall progress bar during analysis
2. Compare to service card states

**Expected Results:**
- Overall progress increases as services complete
- Progress percentage updates in real-time
- Estimated time remaining displayed (when > 0%)
- Progress bar fills smoothly from left to right

### Test 5: Activity Log
**Steps:**
1. Scroll to "Activity Log" section during analysis
2. Observe log entries

**Expected Results:**
- Log entries appear in chronological order
- Each service start/complete logged
- Timestamp displayed for each entry
- Duration shown for completed services
- Log entries include service-specific icons

### Test 6: Responsive Design (Mobile)
**Steps:**
1. Open browser DevTools
2. Switch to mobile view (e.g., iPhone 12)
3. Repeat Test 1

**Expected Results:**
- Modal fits within viewport (90vw width)
- Service cards stack responsively (1-2 columns)
- Text remains readable
- Cards maintain proper spacing
- No horizontal scroll

### Test 7: Responsive Design (Tablet)
**Steps:**
1. Open browser DevTools
2. Switch to tablet view (e.g., iPad)
3. Repeat Test 1

**Expected Results:**
- Service cards display in 2-3 columns
- Cards maintain aspect ratio
- Good use of available space

### Test 8: Error Handling
**Steps:**
1. Test with invalid symbol or when API fails
2. Observe error states

**Expected Results:**
- Failed services turn red
- Red service cards show ❌ icon
- Error message in activity log
- Other services continue processing

### Test 9: Fast Completion
**Steps:**
1. Test with a commonly cached symbol
2. Observe behavior when services complete quickly

**Expected Results:**
- Service cards update smoothly even with rapid state changes
- No flickering or UI jank
- Final state displayed correctly

### Test 10: Connection Status
**Steps:**
1. Observe connection indicator at top of modal
2. Monitor throughout analysis

**Expected Results:**
- Green dot (●) when connected
- "Connected" text displayed
- Indicator pulses with animation
- Remains connected throughout analysis

## Visual Verification Checklist

- [ ] Service cards have consistent sizing
- [ ] Icons are centered and clearly visible
- [ ] Service names are fully visible (not truncated)
- [ ] Status icons are distinguishable
- [ ] Color coding is clear and consistent
- [ ] Spinning animation is smooth (no jank)
- [ ] Grid layout adapts to screen size
- [ ] Overall progress bar matches actual progress
- [ ] Modal closes properly after completion
- [ ] No console errors

## Performance Verification

- [ ] UI remains responsive during updates
- [ ] No memory leaks (check DevTools)
- [ ] SSE connection closes after completion
- [ ] No excessive re-renders (React DevTools)
- [ ] Smooth animations (60fps target)

## Edge Cases to Test

1. **Very Fast Analysis**: Services complete in < 1 second
2. **Very Slow Analysis**: Services take > 30 seconds
3. **Partial Failures**: Some services fail, others succeed
4. **Network Issues**: Simulate slow/dropped connections
5. **Multiple Analyses**: Run multiple analyses in succession
6. **Browser Compatibility**: Test in Chrome, Firefox, Safari

## Debugging Tips

If issues occur:

1. **Check Console Logs**:
   ```javascript
   // Look for these log messages
   "📨 Progress update received:"
   "📊 Progress: X% Stage: service_name"
   ```

2. **Check SSE Connection**:
   ```javascript
   // Network tab -> Filter by "EventSource"
   // Should see connection to /api/stocks/analyze/progress/[sessionId]
   ```

3. **Check State Updates**:
   ```javascript
   // React DevTools -> Components -> AnalysisProgress
   // Inspect `serviceProgress` state
   ```

## Known Limitations

1. Services that complete very quickly (< 100ms) might not show "in progress" state
2. Service order in grid is fixed (not dynamic based on completion)
3. No individual progress bars per service (overall progress only)
4. No retry mechanism for failed services

## Success Criteria

All tests pass with:
- ✅ Visual consistency across devices
- ✅ Smooth animations and transitions
- ✅ Accurate progress reporting
- ✅ No console errors
- ✅ Responsive on mobile/tablet/desktop
- ✅ Clear status indicators
- ✅ Proper SSE connection handling

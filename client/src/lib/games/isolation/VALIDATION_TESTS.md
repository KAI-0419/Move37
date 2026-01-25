# Isolation AI Optimization - Validation Tests

This document provides test cases and benchmarks to validate the optimization work.

---

## Quick Validation Checklist

### ✅ 1. Code Compilation
```bash
npm run check
```
**Expected:** No TypeScript errors

### ✅ 2. Build Success
```bash
npm run build
```
**Expected:** Clean build with no errors

### ✅ 3. Game Functionality
```bash
npm run dev
# Navigate to game and play a few moves
```
**Expected:** Game works normally, AI responds correctly

---

## Performance Benchmarks

### Test Position 1: Early Game (Turn 5)
```json
{
  "playerPos": {"r": 3, "c": 2},
  "aiPos": {"r": 3, "c": 4},
  "destroyed": [
    {"r": 0, "c": 0},
    {"r": 0, "c": 6},
    {"r": 6, "c": 0},
    {"r": 6, "c": 6},
    {"r": 3, "c": 3}
  ]
}
```

**Metrics to Record:**
- Depth achieved: _____
- Nodes evaluated: _____
- Time elapsed: _____ ms
- NPS: _____

---

### Test Position 2: Mid Game (Turn 15)
```json
{
  "playerPos": {"r": 2, "c": 2},
  "aiPos": {"r": 4, "c": 4},
  "destroyed": [
    {"r": 0, "c": 0}, {"r": 0, "c": 6}, {"r": 6, "c": 0}, {"r": 6, "c": 6},
    {"r": 3, "c": 3}, {"r": 2, "c": 3}, {"r": 3, "c": 2}, {"r": 4, "c": 3},
    {"r": 3, "c": 4}, {"r": 1, "c": 1}, {"r": 5, "c": 5}, {"r": 2, "c": 4},
    {"r": 4, "c": 2}, {"r": 1, "c": 3}, {"r": 5, "c": 3}
  ]
}
```

**Metrics to Record:**
- Depth achieved: _____
- Nodes evaluated: _____
- Time elapsed: _____ ms
- NPS: _____

---

### Test Position 3: Late Game (Turn 30)
```json
{
  "playerPos": {"r": 1, "c": 0},
  "aiPos": {"r": 5, "c": 6},
  "destroyed": [
    (30 destroyed cells - partitioned board)
  ]
}
```

**Metrics to Record:**
- Endgame solver triggered: Yes/No
- Time elapsed: _____ ms
- Longest path found: _____

---

## Quality Validation

### Test Suite 1: Move Consistency
**Objective:** Verify optimized AI makes same moves as original on key positions

**Test Positions:**
1. Opening position (turn 1)
2. Standard mid-game position
3. Tactical position (forcing sequence)
4. Endgame position (partitioned board)

**Procedure:**
1. Record move chosen by optimized AI
2. Compare with original AI (if available)
3. Verify move quality using analysis

**Expected Result:** ≥ 95% identical moves, no obvious blunders

---

### Test Suite 2: Win Rate Validation
**Objective:** Ensure optimization doesn't degrade playing strength

**Setup:**
- Run 50 games: Optimized AI (White) vs Original AI (Black)
- Run 50 games: Original AI (White) vs Optimized AI (Black)
- Total: 100 games

**Expected Results:**
- Optimized AI win rate: 45-55% (±5% is acceptable variance)
- No consistent pattern of blunders or weak play

---

## Profiling Analysis

### Enable Profiling
```typescript
// In evaluation.ts, add at top:
import { enableProfiling, getProfiler } from './performance';

// In runMinimaxSearch(), after config:
enableProfiling();
const profiler = getProfiler();
profiler?.reset();

// Before return, add:
if (profiler) {
  console.log(profiler.formatReport());
}
```

### Metrics to Analyze

**1. Time Breakdown**
- Move Generation: Should be < 10% of total time
- Move Ordering: Should be < 5% (down from 20-30% before optimization)
- Evaluation: Should be 40-50% of total time
- Voronoi: Should be < 10% (down from 20-25% before optimization)

**2. Transposition Table**
- Hit Rate: Target > 25%
- Collisions: Should be < 5% of hits

**3. Move Ordering**
- Efficiency: Target > 55% (first move cutoffs / total cutoffs)
- First Move Cutoffs: Should be majority of all cutoffs

---

## Regression Tests

### Test 1: Voronoi Territory Calculation
```typescript
import { calculateBitboardVoronoi, calculateBitboardVoronoiOptimized } from './bitboard';

const testPosition = {
  playerPos: { r: 2, c: 2 },
  aiPos: { r: 4, c: 4 },
  destroyed: [{ r: 3, c: 3 }]
};

const original = calculateBitboardVoronoi(
  testPosition.playerPos,
  testPosition.aiPos,
  testPosition.destroyed
);

const optimized = calculateBitboardVoronoiOptimized(
  testPosition.playerPos,
  testPosition.aiPos,
  testPosition.destroyed
);

// Verify identical results
assert(original.playerCount === optimized.playerCount);
assert(original.aiCount === optimized.aiCount);
assert(original.contestedCount === optimized.contestedCount);
```

**Expected:** All assertions pass (identical results)

---

### Test 2: Critical Cells Memoization
```typescript
import { evaluateAdvanced } from './advancedEvaluation';

const board = { /* test board */ };
const config = getDifficultyConfig('NEXUS-7');

// Call twice with same board
const result1 = evaluateAdvanced(board, config);
const result2 = evaluateAdvanced(board, config);

// Second call should be faster (cached critical cells)
// Manual timing or profiler will show this
```

**Expected:** Second call faster, identical results

---

### Test 3: Move Ordering Quality
```typescript
// Compare ordering with and without evaluation
// This requires keeping old version for comparison

const moves = getAllMoves(board, false, config);
const ordered = orderMoves(moves, board, false, 5, config);

// Check that PV, killer, and winning moves are prioritized
const topMove = ordered[0];
// Should have high score from heuristics alone
assert(topMove.score > 8000); // Killer move threshold
```

**Expected:** Move ordering still effective without evaluateBoard

---

## Performance Comparison Template

### Before Optimization (Baseline)
| Difficulty | Avg Depth | Avg NPS | Avg Time (ms) |
|------------|-----------|---------|---------------|
| NEXUS-3    | 5         | 4,000   | 500           |
| NEXUS-5    | 6         | 2,500   | 3,000         |
| NEXUS-7    | 7         | 1,800   | 8,000         |

### After Optimization (Target)
| Difficulty | Avg Depth | Avg NPS | Avg Time (ms) | Improvement |
|------------|-----------|---------|---------------|-------------|
| NEXUS-3    | 5         | 5,600   | 350           | +40% NPS    |
| NEXUS-5    | 7         | 3,500   | 2,500         | +40% NPS    |
| NEXUS-7    | 9         | 2,900   | 7,000         | +60% NPS    |

---

## Manual Testing Checklist

### Functional Tests
- [ ] Opening book moves work correctly (turns 1-8)
- [ ] Mid-game evaluation provides good moves
- [ ] Endgame solver triggers appropriately
- [ ] Partition detection works correctly
- [ ] AI doesn't make obvious blunders
- [ ] No infinite loops or crashes
- [ ] Logs display correctly
- [ ] Time limits respected

### Edge Cases
- [ ] Board with 1 move available (forced move)
- [ ] Board with 0 moves (game over detection)
- [ ] Completely partitioned board
- [ ] Very early partition (turn 10)
- [ ] Symmetrical position
- [ ] Position with many valid moves (>40)

---

## Known Issues & Limitations

### Not a Bug
- AI may choose different but equally good moves (acceptable variance)
- Slight timing variations due to cache effects (normal)
- Opening book may not cover all positions (fallback to calculation)

### Potential Issues
- If NPS improvement < 30%, investigate:
  - Check profiling breakdown
  - Verify optimizations are actually used
  - Look for unexpected bottlenecks

- If win rate < 45%, investigate:
  - Check move ordering effectiveness
  - Verify Voronoi optimization correctness
  - Test on more positions

---

## Automated Test Script (Pseudocode)

```typescript
async function runValidationSuite() {
  console.log('=== Isolation AI Optimization Validation ===\n');

  // 1. Performance benchmarks
  const positions = [testPos1, testPos2, testPos3];
  for (const pos of positions) {
    const result = runMinimaxSearch(pos, null, 'NEXUS-7');
    console.log(`Position: ${pos.name}`);
    console.log(`Depth: ${result.depth}, NPS: ${result.nps}`);
  }

  // 2. Voronoi correctness
  const voronoiTests = runVoronoiTests();
  console.log(`Voronoi tests: ${voronoiTests.passed}/${voronoiTests.total}`);

  // 3. Move consistency
  const moveTests = runMoveConsistencyTests();
  console.log(`Move consistency: ${moveTests.consistent}/${moveTests.total}`);

  console.log('\n=== Validation Complete ===');
}
```

---

## Success Criteria

### Minimum Requirements (Must Pass)
- ✅ All code compiles without errors
- ✅ Game runs without crashes
- ✅ NPS improvement ≥ 30%
- ✅ Voronoi optimization produces identical results
- ✅ Win rate vs original AI ≥ 45%

### Target Goals (Should Pass)
- 🎯 NPS improvement ≥ 40%
- 🎯 NEXUS-7 reaches depth 8-10
- 🎯 Move ordering efficiency > 55%
- 🎯 Win rate vs original AI ≥ 50%

### Stretch Goals (Nice to Have)
- 🌟 NPS improvement ≥ 50%
- 🌟 TT hit rate > 30%
- 🌟 Move ordering efficiency > 60%
- 🌟 Win rate vs original AI ≥ 55%

---

## Reporting Template

```
Isolation AI Optimization - Test Results

Date: __________
Tester: __________

Performance Benchmarks:
- NEXUS-7 NPS: _____ (Target: 2,500-4,000)
- NEXUS-7 Depth: _____ (Target: 8-10)
- Move Ordering Efficiency: _____% (Target: >55%)

Correctness Tests:
- Voronoi Tests: PASS / FAIL
- Move Consistency: ___% identical
- Regression Tests: PASS / FAIL

Quality Validation:
- Win Rate: ___% (Target: ≥50%)
- Blunders Detected: _____
- Average Move Quality: _____

Overall: PASS / FAIL
Notes: __________
```

---

*Last Updated: 2026-01-25*
*Optimization Version: 1.0*

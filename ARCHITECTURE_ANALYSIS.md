# 🧬 코드베이스 아키텍처 심층 분석 보고서

## 📋 분석 개요

현재 코드베이스가 **다중 게임 지원**을 위해 최적화되어 있는지 나노 단위로 분석한 결과입니다.

---

## 🔴 **치명적 문제점 (Critical Issues)**

### 1. **데이터 스키마에 게임 타입 필드 부재**

#### 문제 위치
- `shared/schema.ts` (Line 5-20)
- `client/src/lib/storage.ts` (Line 8-23)

#### 문제 상세
```typescript
// ❌ 현재 스키마 - gameType 필드 없음
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  board: text("board").notNull(), // 체스 전용 FEN 형식
  // ... gameType 필드 없음
});

// ❌ LocalGame 인터페이스에도 gameType 없음
export interface LocalGame {
  id: number;
  board: string; // 체스 전용
  // ... gameType 필드 없음
}
```

#### 영향도
- **심각도**: 🔴 **CRITICAL**
- **영향**: 게임별 데이터 구분 불가, 통계 필터링 불가, 게임 복원 시 타입 불명확
- **수정 필요성**: 즉시 수정 필수

---

### 2. **게임 로직 완전 하드코딩 (체스 전용)**

#### 문제 위치
- `shared/gameLogic.ts` (전체 파일)
- `client/src/lib/gameEngine.ts` (전체 파일)

#### 문제 상세
```typescript
// ❌ 체스 전용 하드코딩
export const INITIAL_BOARD_FEN = "NPKPN/5/5/5/npkpn"; // 체스만
export type Piece = 'k' | 'n' | 'p' | 'K' | 'N' | 'P' | null; // 체스 기물만

// ❌ 체스 규칙만 구현
export function isValidMove(board: Board, from, to, isPlayer) {
  // 킹, 나이트, 폰 이동 규칙만 하드코딩
  if (type === 'k') { /* 킹만 */ }
  else if (type === 'n') { /* 나이트만 */ }
  else if (type === 'p') { /* 폰만 */ }
}

// ❌ 게임 엔진도 체스 전용
export async function createGame(difficulty) {
  return await gameStorage.createGame({
    board: INITIAL_BOARD_FEN, // 항상 체스 초기 보드
    // ...
  });
}
```

#### 영향도
- **심각도**: 🔴 **CRITICAL**
- **영향**: 다른 게임 추가 시 전체 로직 재작성 필요
- **수정 필요성**: 아키텍처 재설계 필수

---

### 3. **UI 컴포넌트 게임별 분리 부재**

#### 문제 위치
- `client/src/components/ChessBoard.tsx` (전체 파일)
- `client/src/pages/GameRoom.tsx` (전체 파일)

#### 문제 상세
```typescript
// ❌ ChessBoard는 체스 전용 컴포넌트
export function ChessBoard({ boardString, ... }) {
  // FEN 파싱 (체스 전용)
  const fenRows = boardString.split('/');
  // 체스 기물 렌더링만 (K, N, P)
  // 다른 게임의 보드 형식 지원 불가
}

// ❌ GameRoom도 체스 로직만 사용
export default function GameRoom() {
  // 체스 전용 로직
  const board = parseBoardString(game.board); // 체스 FEN만
  const validMoves = getValidMovesClient(board, selectedSquare, true); // 체스만
  return <ChessBoard ... />; // 체스 컴포넌트만
}
```

#### 영향도
- **심각도**: 🔴 **CRITICAL**
- **영향**: 다른 게임 추가 시 UI 컴포넌트 전체 재작성 필요
- **수정 필요성**: 게임별 컴포넌트 팩토리 패턴 도입 필요

---

### 4. **게임 엔진 단일 게임 종속**

#### 문제 위치
- `client/src/lib/gameEngine.ts` (Line 24-332)
- `client/src/hooks/use-game.ts` (전체 파일)

#### 문제 상세
```typescript
// ❌ createGame이 체스만 생성
export async function createGame(difficulty) {
  const game = await gameStorage.createGame({
    board: INITIAL_BOARD_FEN, // 항상 체스
    // gameType 파라미터 없음
  });
}

// ❌ makeGameMove가 체스 로직만 사용
export async function makeGameMove(gameId, from, to) {
  let board = parseFen(game.board); // 체스 FEN만
  if (!isValidMove(board, from, to, true)) { // 체스 규칙만
    throw new Error("gameRoom.errors.illegalMove");
  }
  // 체스 승리 조건만 체크
  let winner = checkWinner(board, ...); // 체스만
}

// ❌ 훅도 게임 타입 무시
export function useCreateGame() {
  return useMutation({
    mutationFn: async (difficulty) => {
      // gameType 파라미터 없음
      return await createGame(difficulty);
    },
  });
}
```

#### 영향도
- **심각도**: 🔴 **CRITICAL**
- **영향**: 다른 게임 추가 시 엔진 전체 재작성 필요
- **수정 필요성**: 게임별 엔진 인터페이스 및 팩토리 패턴 필요

---

### 5. **라우팅 게임별 분리 부재**

#### 문제 위치
- `client/src/App.tsx` (Line 10-18)
- `client/src/pages/Lobby.tsx` (Line 317-329)

#### 문제 상세
```typescript
// ❌ 모든 게임이 동일한 /game 경로 사용
function Router() {
  return (
    <Switch>
      <Route path="/" component={Lobby} />
      <Route path="/game" component={GameRoom} /> {/* 모든 게임 공통 */}
      <Route component={NotFound} />
    </Switch>
  );
}

// ❌ 게임 시작 시 gameType 전달 안 함
const handleStart = async () => {
  const game = await createGame.mutateAsync(selectedDifficulty);
  // selectedGameType 무시됨!
  setLocation("/game"); // gameType 정보 손실
};
```

#### 영향도
- **심각도**: 🟡 **HIGH**
- **영향**: 게임 타입 정보 손실, URL에서 게임 구분 불가
- **수정 필요성**: `/game/:gameType` 또는 쿼리 파라미터 도입 필요

---

## 🟡 **중요 문제점 (High Priority Issues)**

### 6. **통계 시스템 게임별 필터링 미구현**

#### 문제 위치
- `client/src/pages/Lobby.tsx` (Line 52-132)

#### 문제 상세
```typescript
// ⚠️ TODO 주석만 있고 실제 구현 없음
function calculatePlayerStats(gameType?: GameType) {
  const games = getAllGames();
  // TODO: 향후 gameType 필터링 로직 추가
  // const filteredGames = gameType ? games.filter(g => g.gameType === gameType) : games;
  // 실제로는 모든 게임 통계만 계산
}
```

#### 영향도
- **심각도**: 🟡 **HIGH**
- **영향**: 게임별 통계 표시 불가
- **수정 필요성**: 스키마 수정 후 즉시 구현 필요

---

### 7. **튜토리얼 시스템 게임별 분리 부재**

#### 문제 위치
- `client/src/components/TutorialModal.tsx` (전체 파일)

#### 문제 상세
```typescript
// ⚠️ gameType prop은 받지만 실제로 사용 안 함
export function TutorialModal({ open, onOpenChange, gameType = "MINI_CHESS" }) {
  // gameType 무시하고 항상 체스 튜토리얼만 표시
  const tutorialSteps = [/* 체스 전용 */];
  return <ChessBoard ... />; // 체스만
}
```

#### 영향도
- **심각도**: 🟡 **HIGH**
- **영향**: 다른 게임 튜토리얼 추가 불가
- **수정 필요성**: 게임별 튜토리얼 데이터 구조 필요

---

### 8. **난이도 시스템 게임별 독립성 부재**

#### 문제 위치
- `client/src/lib/storage.ts` (Line 132-191)

#### 문제 상세
```typescript
// ⚠️ 난이도가 전역으로 관리됨 (게임별 아님)
export function getUnlockedDifficulties(): Set<Difficulty> {
  // 모든 게임이 동일한 난이도 공유
  // 게임별로 다른 난이도 체계 불가
}

// ⚠️ 승리 시 해제도 게임 무관
export function handleVictoryUnlock(difficulty: Difficulty) {
  // 게임 타입 고려 안 함
  if (difficulty === "NEXUS-3") {
    unlockDifficulty("NEXUS-5"); // 모든 게임에 적용
  }
}
```

#### 영향도
- **심각도**: 🟡 **MEDIUM**
- **영향**: 게임별로 다른 난이도 체계 구현 불가
- **수정 필요성**: 게임별 난이도 관리 구조 필요

---

## 🟢 **개선 권장사항 (Recommendations)**

### 9. **게임별 설정 시스템 부재**

#### 문제 위치
- 전역 (설정 파일 없음)

#### 권장사항
```typescript
// ✅ 게임별 설정 인터페이스 필요
interface GameConfig {
  gameType: GameType;
  initialBoard: string;
  boardSize: { rows: number; cols: number };
  pieces: PieceDefinition[];
  rules: GameRules;
  aiStrategy: AIStrategy;
  timeSettings: TimeSettings;
}
```

---

### 10. **게임 팩토리 패턴 부재**

#### 권장사항
```typescript
// ✅ 게임별 엔진 팩토리 필요
class GameEngineFactory {
  static create(gameType: GameType): GameEngine {
    switch (gameType) {
      case "MINI_CHESS":
        return new MiniChessEngine();
      case "GAME_2":
        return new Game2Engine();
      // ...
    }
  }
}

// ✅ 게임별 UI 컴포넌트 팩토리 필요
class GameUIFactory {
  static createBoard(gameType: GameType): React.Component {
    switch (gameType) {
      case "MINI_CHESS":
        return <ChessBoard />;
      case "GAME_2":
        return <Game2Board />;
      // ...
    }
  }
}
```

---

## 📊 **종합 평가**

### 현재 상태 요약

| 영역 | 상태 | 심각도 | 수정 우선순위 |
|------|------|--------|--------------|
| 데이터 스키마 | ❌ gameType 필드 없음 | 🔴 CRITICAL | **P0 (즉시)** |
| 게임 로직 | ❌ 체스 하드코딩 | 🔴 CRITICAL | **P0 (즉시)** |
| UI 컴포넌트 | ❌ 게임별 분리 없음 | 🔴 CRITICAL | **P0 (즉시)** |
| 게임 엔진 | ❌ 단일 게임 종속 | 🔴 CRITICAL | **P0 (즉시)** |
| 라우팅 | ⚠️ 게임 타입 무시 | 🟡 HIGH | **P1 (긴급)** |
| 통계 시스템 | ⚠️ 필터링 미구현 | 🟡 HIGH | **P1 (긴급)** |
| 튜토리얼 | ⚠️ 게임별 분리 없음 | 🟡 HIGH | **P1 (긴급)** |
| 난이도 시스템 | ⚠️ 전역 관리 | 🟡 MEDIUM | **P2 (중요)** |

### 결론

**현재 코드베이스는 다중 게임 지원을 위해 최적화되어 있지 않습니다.**

- ✅ **잘 된 부분**: 게임 타입 선택 UI는 추가됨
- ❌ **문제점**: 실제 게임 로직, 데이터, 컴포넌트가 모두 체스에 하드코딩됨
- ⚠️ **위험**: 새로운 게임 추가 시 대규모 리팩토링 필요

### 권장 리팩토링 순서

1. **Phase 1 (P0)**: 스키마에 `gameType` 필드 추가
2. **Phase 2 (P0)**: 게임 엔진 인터페이스 및 팩토리 패턴 도입
3. **Phase 3 (P0)**: 게임별 로직 모듈화 (체스 로직을 `games/miniChess/`로 이동)
4. **Phase 4 (P0)**: 게임별 UI 컴포넌트 분리
5. **Phase 5 (P1)**: 라우팅에 게임 타입 반영
6. **Phase 6 (P1)**: 통계/튜토리얼 게임별 필터링 구현

---

## 🔧 **즉시 수정 필요 항목 (Quick Wins)**

### 1. 스키마에 gameType 추가
```typescript
// shared/schema.ts
export const games = pgTable("games", {
  // ...
  gameType: text("game_type").notNull().default("MINI_CHESS"), // 추가
});

// client/src/lib/storage.ts
export interface LocalGame {
  // ...
  gameType: "MINI_CHESS" | "GAME_2" | "GAME_3" | "GAME_4" | "GAME_5"; // 추가
}
```

### 2. createGame에 gameType 파라미터 추가
```typescript
// client/src/lib/gameEngine.ts
export async function createGame(
  gameType: GameType, // 추가
  difficulty: "NEXUS-3" | "NEXUS-5" | "NEXUS-7"
): Promise<Game> {
  // ...
}
```

### 3. 라우팅에 gameType 전달
```typescript
// client/src/pages/Lobby.tsx
const handleStart = async () => {
  const game = await createGame.mutateAsync({
    gameType: selectedGameType, // 추가
    difficulty: selectedDifficulty,
  });
  setLocation(`/game?type=${selectedGameType}`); // 수정
};
```

---

**분석 완료일**: 2026-01-XX  
**분석자**: AI Architecture Analyzer  
**다음 검토 권장일**: 리팩토링 완료 후

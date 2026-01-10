/**
 * Mini Chess Winner Check
 * 
 * Functions for determining game winners and draw conditions.
 */

import type { Board } from "./types";
import { getValidMoves } from "./moveValidation";
import { calculateMaterialBalance } from "./evaluation";

export function checkWinner(
  board: Board, 
  turnCount?: number,
  playerTimeRemaining?: number | null,
  aiTimeRemaining?: number | null
): 'player' | 'ai' | 'draw' | null {
  // Check if kings exist
  // 'k' (lowercase) = Player's King, 'K' (uppercase) = AI's King
  let playerKing = false;
  let aiKing = false;
  let playerKingPos: { r: number; c: number } | null = null;
  let aiKingPos: { r: number; c: number } | null = null;
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (board[r][c] === 'k') {
        playerKing = true;
        playerKingPos = { r, c };
        if (r === 0) return 'player'; // Player King reached row 0 (AI side)
      }
      if (board[r][c] === 'K') {
        aiKing = true;
        aiKingPos = { r, c };
        if (r === 4) return 'ai'; // AI King reached row 4 (Player side)
      }
    }
  }

  if (!playerKing) return 'ai'; // Player's King captured
  if (!aiKing) return 'player'; // AI's King captured
  
  // Check for time out conditions (must check before other conditions)
  if (playerTimeRemaining !== undefined && playerTimeRemaining !== null && playerTimeRemaining <= 0) {
    return 'ai'; // Player ran out of time
  }
  if (aiTimeRemaining !== undefined && aiTimeRemaining !== null && aiTimeRemaining <= 0) {
    return 'player'; // AI ran out of time
  }
  
  // Check for draw condition: 30 turns without winner
  // 판정승 시스템: 30턴 시 킹 전진도와 기물 점수로 승패 결정
  if (turnCount !== undefined && turnCount >= 30) {
    // 킹이 존재하는지 확인 (이미 위에서 확인했지만 안전을 위해)
    if (!playerKingPos || !aiKingPos) {
      return 'draw'; // 킹 위치를 찾을 수 없으면 무승부
    }
    
    // 기물 점수 계산 (King 제외)
    const material = calculateMaterialBalance(board);
    const playerMaterial = material.playerMaterial - 1000; // King 값 제외
    const aiMaterial = material.aiMaterial - 1000; // King 값 제외
    
    // 킹의 전진 거리 계산 (목표 지점까지의 근접도)
    // 플레이어 킹은 0행이 목표, AI 킹은 4행이 목표
    const playerAdvancement = playerKingPos.r; // 0에 가까울수록 좋음 (최대 4)
    const aiAdvancement = 4 - aiKingPos.r; // 4에 가까울수록 좋음 (최대 4)
    
    // 종합 점수 계산 (전진 거리에 더 높은 가중치 부여)
    // 전진도는 승리 조건이므로 기물보다 훨씬 중요
    const playerScore = (playerAdvancement * 3) + playerMaterial;
    const aiScore = (aiAdvancement * 3) + aiMaterial;
    
    // 점수 비교로 승패 결정
    if (playerScore > aiScore) return 'player';
    if (aiScore > playerScore) return 'ai';
    
    // 점수가 완전히 같을 때만 무승부 (거의 발생하지 않음)
    return 'draw';
  }
  
  // Check for stalemate (no valid moves available for current player)
  // Check if player has any valid moves
  let playerHasMoves = false;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      // Player uses lowercase pieces
      if (piece && piece === piece.toLowerCase() && piece !== piece.toUpperCase()) {
        const moves = getValidMoves(board, { r, c }, true);
        if (moves.length > 0) {
          playerHasMoves = true;
          break;
        }
      }
    }
    if (playerHasMoves) break;
  }
  
  // Check if AI has any valid moves
  let aiHasMoves = false;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const piece = board[r][c];
      // AI uses uppercase pieces
      if (piece && piece === piece.toUpperCase() && piece !== piece.toUpperCase()) {
        const moves = getValidMoves(board, { r, c }, false);
        if (moves.length > 0) {
          aiHasMoves = true;
          break;
        }
      }
    }
    if (aiHasMoves) break;
  }
  
  // If neither player has moves, it's a draw (stalemate)
  if (!playerHasMoves && !aiHasMoves) {
    return 'draw';
  }
  
  return null;
}

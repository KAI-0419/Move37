using System.Collections.Generic;
using Move37.GameLogic;
using UnityEngine;

namespace Move37.AI
{
    /// <summary>
    /// Minimax + Alpha-Beta 로 최선의 수를 찾는 두뇌.
    /// 실제 Unity 오브젝트는 건드리지 않고 VirtualBoard만 사용한다.
    /// </summary>
    public class AI_Brain
    {
        public struct BoardState
        {
            public int[,] Grid;
        }

        // 검색 깊이: 5x5 보드 기준 3 수 앞이면 충분히 빠르면서도 안정적.
        private const int MaxDepth = 3;
        private int _nodesSearched;

        public Move? GetBestMove(BoardState currentBoard)
        {
            _nodesSearched = 0;

            var vBoard = ToVirtualBoard(currentBoard);
            var moves = new List<Move>(vBoard.GetValidMoves(Unit.Owner.AI));

            if (moves.Count == 0) return null;

            Move? best = null;
            float bestScore = float.NegativeInfinity;

            foreach (var move in moves)
            {
                var clone = vBoard.Clone();
                clone.Move(move.FromX, move.FromY, move.ToX, move.ToY);

                var score = Minimax(clone, depth: 1, maximizing: false, alpha: float.NegativeInfinity, beta: float.PositiveInfinity);

                if (score > bestScore)
                {
                    bestScore = score;
                    best = new Move(move.FromX, move.FromY, move.ToX, move.ToY, (int)score);
                }
            }

            if (best.HasValue)
            {
                Debug.Log($"AI Best Move Score: {best.Value.Score}, Nodes Searched: {_nodesSearched}");
            }
            else
            {
                Debug.Log($"AI Best Move Not Found. Nodes Searched: {_nodesSearched}");
            }

            return best;
        }

        private float Minimax(VirtualBoard board, int depth, bool maximizing, float alpha, float beta)
        {
            _nodesSearched++;

            if (depth >= MaxDepth)
            {
                return board.Evaluate(Unit.Owner.AI);
            }

            var owner = maximizing ? Unit.Owner.AI : Unit.Owner.Player;
            var moves = board.GetValidMoves(owner);

            float bestScore = maximizing ? float.NegativeInfinity : float.PositiveInfinity;
            bool hasMove = false;

            foreach (var move in moves)
            {
                hasMove = true;
                var clone = board.Clone();
                clone.Move(move.FromX, move.FromY, move.ToX, move.ToY);

                var score = Minimax(clone, depth + 1, !maximizing, alpha, beta);

                if (maximizing)
                {
                    bestScore = score > bestScore ? score : bestScore;
                    alpha = score > alpha ? score : alpha;
                    if (beta <= alpha) break; // beta cut
                }
                else
                {
                    bestScore = score < bestScore ? score : bestScore;
                    beta = score < beta ? score : beta;
                    if (beta <= alpha) break; // alpha cut
                }
            }

            if (!hasMove)
            {
                return board.Evaluate(Unit.Owner.AI);
            }

            return bestScore;
        }

        private static VirtualBoard ToVirtualBoard(BoardState state)
        {
            var vb = new VirtualBoard();
            if (state.Grid == null) return vb;

            // 기대 포맷: 0=빈칸, 양수=Player, 음수=AI (절대값: 1 Pawn, 2 Knight, 3 King)
            int sizeX = state.Grid.GetLength(0);
            int sizeY = state.Grid.GetLength(1);

            for (int x = 0; x < sizeX && x < VirtualBoard.Size; x++)
            {
                for (int y = 0; y < sizeY && y < VirtualBoard.Size; y++)
                {
                    int v = state.Grid[x, y];
                    if (v == 0) continue;

                    var owner = v > 0 ? Unit.Owner.Player : Unit.Owner.AI;
                    var abs = v > 0 ? v : -v;
                    var type = abs switch
                    {
                        3 => Unit.UnitType.King,
                        2 => Unit.UnitType.Knight,
                        1 => Unit.UnitType.Pawn,
                        _ => Unit.UnitType.Pawn
                    };

                    vb.SetPiece(x, y, owner, type);
                }
            }

            return vb;
        }
    }
}


using System;
using System.Collections.Generic;
using Move37.GameLogic;

namespace Move37.AI
{
    /// <summary>
    /// 가상 보드 상태를 표현하는 순수 C# 클래스 (Unity 의존 없음).
    /// 5x5 그리드에서 각 칸에 소유자와 유닛 타입을 보관한다.
    /// </summary>
    public class VirtualBoard
    {
        public const int Size = 5;

        private struct Piece
        {
            public Unit.Owner owner;
            public Unit.UnitType type;
        }

        private readonly Piece?[,] _grid = new Piece?[Size, Size];

        public VirtualBoard Clone()
        {
            var copy = new VirtualBoard();
            for (int y = 0; y < Size; y++)
            {
                for (int x = 0; x < Size; x++)
                {
                    copy._grid[x, y] = _grid[x, y];
                }
            }
            return copy;
        }

        public void SetPiece(int x, int y, Unit.Owner owner, Unit.UnitType type)
        {
            _grid[x, y] = new Piece { owner = owner, type = type };
        }

        public void Clear(int x, int y)
        {
            _grid[x, y] = null;
        }

        public bool Move(int fromX, int fromY, int toX, int toY)
        {
            if (!InBounds(fromX, fromY) || !InBounds(toX, toY)) return false;
            var piece = _grid[fromX, fromY];
            if (piece == null) return false;

            _grid[toX, toY] = piece;
            _grid[fromX, fromY] = null;
            return true;
        }

        public IEnumerable<Move> GetValidMoves(Unit.Owner owner)
        {
            var moves = new List<Move>();

            for (int y = 0; y < Size; y++)
            {
                for (int x = 0; x < Size; x++)
                {
                    var piece = _grid[x, y];
                    if (piece == null || piece.Value.owner != owner) continue;

                    AppendMovesForPiece(owner, piece.Value.type, x, y, moves);
                }
            }

            return moves;
        }

        public float Evaluate(Unit.Owner perspective)
        {
            float materialScore = 0f;
            float positionScore = 0f;
            float attackScore = 0f;

            (int x, int y)? myKingPos = null;
            (int x, int y)? enemyKingPos = null;
            var friendPieces = new List<(Piece piece, int x, int y)>();
            var enemyPieces = new List<(Piece piece, int x, int y)>();

            for (int y = 0; y < Size; y++)
            {
                for (int x = 0; x < Size; x++)
                {
                    var piece = _grid[x, y];
                    if (piece == null) continue;

                    var isFriend = piece.Value.owner == perspective;
                    var sign = isFriend ? 1f : -1f;

                    materialScore += sign * GetPieceValue(piece.Value.type);
                    positionScore += sign * GetPositionBias(piece.Value.owner, piece.Value.type, x, y);

                    if (isFriend && HasAttackOpportunity(piece.Value, x, y))
                    {
                        attackScore += 50f;
                    }
                    else if (!isFriend && HasAttackOpportunity(piece.Value, x, y))
                    {
                        attackScore -= 50f;
                    }

                    if (piece.Value.type == Unit.UnitType.King)
                    {
                        if (isFriend)
                            myKingPos = (x, y);
                        else
                            enemyKingPos = (x, y);
                    }

                    if (isFriend) friendPieces.Add((piece.Value, x, y));
                    else enemyPieces.Add((piece.Value, x, y));
                }
            }

            // King 존재 여부: 잡혔다면 즉시 큰 점수
            if (enemyKingPos == null) return 999_999f;
            if (myKingPos == null) return -999_999f;

            // 즉시 킹 포획 가능 / 위협 감지
            if (CanCaptureKing(perspective, enemyKingPos.Value.x, enemyKingPos.Value.y))
                return 999_999f;

            var opponent = perspective == Unit.Owner.AI ? Unit.Owner.Player : Unit.Owner.AI;
            if (CanCaptureKing(opponent, myKingPos.Value.x, myKingPos.Value.y))
                return -999_999f;

            // 희생 가중치: 상대 King 주변 2칸 내 내 유닛이 2개 이상이면 보너스
            float threatScore = 0f;
            if (enemyKingPos.HasValue)
            {
                int threatCount = 0;
                foreach (var fp in friendPieces)
                {
                    if (IsWithinDistance(fp.x, fp.y, enemyKingPos.Value.x, enemyKingPos.Value.y, 2))
                    {
                        threatCount++;
                    }
                }
                if (threatCount >= 2)
                {
                    threatScore += 2000f;
                }
            }

            // 공격 지향: 상대가 우리 King 주변을 장악하면 위협을 약간 감점하여 균형
            if (myKingPos.HasValue)
            {
                int enemyThreat = 0;
                foreach (var ep in enemyPieces)
                {
                    if (IsWithinDistance(ep.x, ep.y, myKingPos.Value.x, myKingPos.Value.y, 2))
                    {
                        enemyThreat++;
                    }
                }
                if (enemyThreat >= 2)
                {
                    threatScore -= 1500f;
                }
            }

            return materialScore + positionScore + attackScore + threatScore;
        }

        private static float GetPieceValue(Unit.UnitType type)
        {
            return type switch
            {
                Unit.UnitType.King => 10000f,
                Unit.UnitType.Knight => 500f,
                Unit.UnitType.Pawn => 100f,
                _ => 0f
            };
        }

        private static float GetPositionBias(Unit.Owner owner, Unit.UnitType type, int x, int y)
        {
            switch (type)
            {
                case Unit.UnitType.Pawn:
                    {
                        int progress = owner == Unit.Owner.Player ? (Size - 1 - y) : y;
                        return progress * 10f;
                    }
                case Unit.UnitType.Knight:
                    {
                        int dist = Math.Abs(x - 2) + Math.Abs(y - 2);
                        float bonus = Math.Max(0, 20 - dist * 5);
                        return bonus;
                    }
                default:
                    return 0f;
            }
        }

        private bool CanCaptureKing(Unit.Owner owner, int kingX, int kingY)
        {
            foreach (var move in GetValidMoves(owner))
            {
                if (move.ToX == kingX && move.ToY == kingY)
                    return true;
            }
            return false;
        }

        private static bool IsWithinDistance(int x1, int y1, int x2, int y2, int maxDist)
        {
            return Math.Max(Math.Abs(x1 - x2), Math.Abs(y1 - y2)) <= maxDist;
        }

        private bool HasAttackOpportunity(Piece piece, int x, int y)
        {
            switch (piece.type)
            {
                case Unit.UnitType.Pawn:
                    {
                        int forward = piece.owner == Unit.Owner.Player ? -1 : 1;
                        int ny = y + forward;
                        int[] dxs = { -1, 1 };
                        foreach (var dx in dxs)
                        {
                            int tx = x + dx;
                            if (!InBounds(tx, ny)) continue;
                            var target = _grid[tx, ny];
                            if (target != null && target.Value.owner != piece.owner)
                                return true;
                        }
                        return false;
                    }
                case Unit.UnitType.King:
                    for (int dy = -1; dy <= 1; dy++)
                    {
                        for (int dx = -1; dx <= 1; dx++)
                        {
                            if (dx == 0 && dy == 0) continue;
                            int tx = x + dx;
                            int ty = y + dy;
                            if (!InBounds(tx, ty)) continue;
                            var target = _grid[tx, ty];
                            if (target != null && target.Value.owner != piece.owner)
                                return true;
                        }
                    }
                    return false;
                case Unit.UnitType.Knight:
                    int[,] offsets = {
                        { 1, 2 }, { 2, 1 }, { -1, 2 }, { -2, 1 },
                        { 1, -2 }, { 2, -1 }, { -1, -2 }, { -2, -1 }
                    };
                    for (int i = 0; i < offsets.GetLength(0); i++)
                    {
                        int tx = x + offsets[i, 0];
                        int ty = y + offsets[i, 1];
                        if (!InBounds(tx, ty)) continue;
                        var target = _grid[tx, ty];
                        if (target != null && target.Value.owner != piece.owner)
                            return true;
                    }
                    return false;
                default:
                    return false;
            }
        }

        private void AppendMovesForPiece(Unit.Owner owner, Unit.UnitType type, int x, int y, List<Move> moves)
        {
            switch (type)
            {
                case Unit.UnitType.Pawn:
                    AppendPawnMoves(owner, x, y, moves);
                    break;
                case Unit.UnitType.King:
                    AppendKingMoves(owner, x, y, moves);
                    break;
                case Unit.UnitType.Knight:
                    AppendKnightMoves(owner, x, y, moves);
                    break;
            }
        }

        private void AppendPawnMoves(Unit.Owner owner, int x, int y, List<Move> moves)
        {
            int forward = owner == Unit.Owner.Player ? -1 : 1;
            int ny = y + forward;

            // 전진: 한 칸 앞이 비어있을 때만
            if (InBounds(x, ny) && _grid[x, ny] == null)
            {
                moves.Add(new Move(x, y, x, ny));
            }

            // 대각선 공격: 적이 있을 때만
            int[] dxs = { -1, 1 };
            foreach (var dx in dxs)
            {
                int tx = x + dx;
                int ty = ny;
                if (!InBounds(tx, ty)) continue;
                var target = _grid[tx, ty];
                if (target != null && target.Value.owner != owner)
                {
                    moves.Add(new Move(x, y, tx, ty));
                }
            }
        }

        private void AppendKingMoves(Unit.Owner owner, int x, int y, List<Move> moves)
        {
            for (int dy = -1; dy <= 1; dy++)
            {
                for (int dx = -1; dx <= 1; dx++)
                {
                    if (dx == 0 && dy == 0) continue;
                    int tx = x + dx;
                    int ty = y + dy;
                    if (!InBounds(tx, ty)) continue;

                    var target = _grid[tx, ty];
                    if (target == null || target.Value.owner != owner)
                    {
                        moves.Add(new Move(x, y, tx, ty));
                    }
                }
            }
        }

        private void AppendKnightMoves(Unit.Owner owner, int x, int y, List<Move> moves)
        {
            int[,] offsets = {
                { 1, 2 }, { 2, 1 }, { -1, 2 }, { -2, 1 },
                { 1, -2 }, { 2, -1 }, { -1, -2 }, { -2, -1 }
            };

            for (int i = 0; i < offsets.GetLength(0); i++)
            {
                int tx = x + offsets[i, 0];
                int ty = y + offsets[i, 1];
                if (!InBounds(tx, ty)) continue;

                var target = _grid[tx, ty];
                if (target == null || target.Value.owner != owner)
                {
                    moves.Add(new Move(x, y, tx, ty));
                }
            }
        }

        private static bool InBounds(int x, int y)
        {
            return x >= 0 && x < Size && y >= 0 && y < Size;
        }
    }
}



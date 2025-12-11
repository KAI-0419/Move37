using System.Collections.Generic;
using UnityEngine;
using Move37.AI;
using TMPro;

namespace Move37.GameLogic
{
    public class BoardManager : MonoBehaviour
    {
        public GameObject tilePrefab;
        public GameObject unitPrefab;
        public Transform boardGrid;
        public Unit selectedUnit;
        public Turn CurrentTurn = Turn.Player;
        public AIAgent aiAgent;
        public ParticleSystem explosionPrefab;
        public Sprite kingSprite;
        public Sprite knightSprite;
        public Sprite pawnSprite;
        public TextMeshProUGUI systemMessageText;
        private bool _isGameOver;
        private bool _isAnimating;

        private const int BoardSize = 5;
        private Tile[,] _tiles = new Tile[BoardSize, BoardSize];

        public enum Turn
        {
            Player,
            AI
        }

        public enum Winner
        {
            None,
            Player,
            AI
        }

        private void Start()
        {
            if (tilePrefab == null || boardGrid == null || unitPrefab == null)
            {
                Debug.LogError("[BoardManager] Missing references: tilePrefab, unitPrefab, or boardGrid.");
                return;
            }

            // GridLayoutGroup는 자식 생성 순서대로 좌->우, 상->하로 배치되므로
            // y(행) 우선, x(열) 순으로 생성해야 시각적 좌표와 일치한다.
            for (int y = 0; y < BoardSize; y++)
            {
                for (int x = 0; x < BoardSize; x++)
                {
                    var tileObj = Instantiate(tilePrefab, boardGrid);
                    var tile = tileObj.GetComponent<Tile>();

                    if (tile != null)
                    {
                        tile.Init(x, y, this);
                        _tiles[x, y] = tile;
                    }
                    else
                    {
                        Debug.LogWarning("[BoardManager] Tile prefab missing Tile component.");
                    }
                }
            }

            SpawnInitialUnits();
        }

        public Tile GetTile(int x, int y)
        {
            return IsInBounds(x, y) ? _tiles[x, y] : null;
        }

        public IEnumerable<Tile> GetAllTiles()
        {
            for (int y = 0; y < BoardSize; y++)
            {
                for (int x = 0; x < BoardSize; x++)
                {
                    if (_tiles[x, y] != null)
                    {
                        yield return _tiles[x, y];
                    }
                }
            }
        }

        private void SpawnInitialUnits()
        {
            // AI front row (y = 0, 상단)
            SpawnUnit(0, 0, Unit.Owner.AI, Unit.UnitType.Knight);
            SpawnUnit(1, 0, Unit.Owner.AI, Unit.UnitType.Pawn);
            SpawnUnit(2, 0, Unit.Owner.AI, Unit.UnitType.King);
            SpawnUnit(3, 0, Unit.Owner.AI, Unit.UnitType.Pawn);
            SpawnUnit(4, 0, Unit.Owner.AI, Unit.UnitType.Knight);

            // Player back row (y = 4, 하단)
            SpawnUnit(0, 4, Unit.Owner.Player, Unit.UnitType.Knight);
            SpawnUnit(1, 4, Unit.Owner.Player, Unit.UnitType.Pawn);
            SpawnUnit(2, 4, Unit.Owner.Player, Unit.UnitType.King);
            SpawnUnit(3, 4, Unit.Owner.Player, Unit.UnitType.Pawn);
            SpawnUnit(4, 4, Unit.Owner.Player, Unit.UnitType.Knight);
        }

        public void SpawnUnit(int x, int y, Unit.Owner owner, Unit.UnitType type)
        {
            if (!IsInBounds(x, y))
            {
                Debug.LogWarning($"[BoardManager] SpawnUnit out of bounds: {x},{y}");
                return;
            }

            var tile = _tiles[x, y];
            if (tile == null)
            {
                Debug.LogWarning($"[BoardManager] Tile not found at: {x},{y}");
                return;
            }

            var unitObj = Instantiate(unitPrefab, tile.transform);
            var unit = unitObj.GetComponent<Unit>();

            if (unit != null)
            {
                unit.Init(owner, type);
                var sprite = GetSpriteForType(type);
                if (sprite != null)
                {
                    unit.SetSprite(sprite);
                }
                tile.SetUnit(unit);
            }
            else
            {
                Debug.LogWarning("[BoardManager] Unit prefab missing Unit component.");
            }
        }

        private bool IsInBounds(int x, int y)
        {
            return x >= 0 && x < BoardSize && y >= 0 && y < BoardSize;
        }

        private Sprite GetSpriteForType(Unit.UnitType type)
        {
            return type switch
            {
                Unit.UnitType.King => kingSprite,
                Unit.UnitType.Knight => knightSprite,
                Unit.UnitType.Pawn => pawnSprite,
                _ => null
            };
        }

        public void OnTileClicked(Tile tile)
        {
            if (tile == null || _isGameOver || _isAnimating) return;

            if (CurrentTurn != Turn.Player) return;

            Debug.Log($"Tile Clicked: {tile.x}, {tile.y}");

            // 선택: 플레이어 유닛만 대상
            if (tile.CurrentUnit != null && tile.CurrentUnit.owner == Unit.Owner.Player)
            {
                SelectUnit(tile.CurrentUnit);
                return;
            }

            // 이동/공격: 선택된 유닛이 있고, 이동 규칙을 만족하는 경우만
            if (selectedUnit != null)
            {
                if (!selectedUnit.IsMoveValid(tile)) return;

                var fromTile = selectedUnit.CurrentTile;
                if (fromTile != null)
                {
                    fromTile.SetUnit(null);
                }

                string captureContext = null;
                var capturedUnit = tile.CurrentUnit;
                // 공격 처리: 적이 있으면 제거
                if (tile.CurrentUnit != null && tile.CurrentUnit.owner != selectedUnit.owner)
                {
                    if (explosionPrefab != null)
                    {
                        var fx = Instantiate(explosionPrefab, tile.CurrentUnit.transform.position, Quaternion.identity);
                        fx.Play();
                        Destroy(fx.gameObject, 1f);
                    }
                    Destroy(tile.CurrentUnit.gameObject);
                    tile.SetUnit(null);
                    captureContext = $"Player captured {capturedUnit.owner} {capturedUnit.type} at ({tile.x},{tile.y})";
                }

                _isAnimating = true;
                var movingUnit = selectedUnit;
                movingUnit.MoveTo(tile, () =>
                {
                    tile.SetUnit(movingUnit);
                    movingUnit.SetSelected(false);
                    selectedUnit = null;

                    var moveContext = captureContext ?? $"Player moved {movingUnit.type} to ({tile.x},{tile.y})";
                    ShowComment(moveContext);

                    if (CheckWinCondition())
                    {
                        _isAnimating = false;
                        return;
                    }

                    _isAnimating = false;
                    EndTurn();
                });
            }
        }

        private void SelectUnit(Unit unit)
        {
            if (selectedUnit == unit) return;

            if (selectedUnit != null)
            {
                selectedUnit.SetSelected(false);
            }

            selectedUnit = unit;
            selectedUnit.SetSelected(true);
        }

        public bool CheckWinCondition()
        {
            bool playerKingAlive = false;
            bool aiKingAlive = false;

            for (int y = 0; y < BoardSize; y++)
            {
                for (int x = 0; x < BoardSize; x++)
                {
                    var tile = _tiles[x, y];
                    if (tile == null || tile.CurrentUnit == null) continue;

                    var unit = tile.CurrentUnit;
                    if (unit.type == Unit.UnitType.King)
                    {
                        if (unit.owner == Unit.Owner.Player)
                        {
                            playerKingAlive = true;
                            if (tile.y == 0)
                            {
                                GameOver(Winner.Player);
                                return true;
                            }
                        }
                        else
                        {
                            aiKingAlive = true;
                            if (tile.y == BoardSize - 1)
                            {
                                GameOver(Winner.AI);
                                return true;
                            }
                        }
                    }
                }
            }

            if (!playerKingAlive)
            {
                GameOver(Winner.AI);
                return true;
            }

            if (!aiKingAlive)
            {
                GameOver(Winner.Player);
                return true;
            }

            return false;
        }

        public void GameOver(Winner winner)
        {
            if (_isGameOver) return;
            _isGameOver = true;

            Debug.Log($"{winner} Win");
            CurrentTurn = Turn.Player;
            selectedUnit = null;
        }

        public void EndTurn()
        {
            if (_isGameOver) return;

            CurrentTurn = CurrentTurn == Turn.Player ? Turn.AI : Turn.Player;

            Debug.Log($"{CurrentTurn} Turn");

            if (CurrentTurn == Turn.AI)
            {
                if (aiAgent != null)
                {
                    aiAgent.StartCoroutine(aiAgent.PlayTurn());
                }
                else
                {
                    Debug.LogWarning("[BoardManager] aiAgent reference is missing.");
                    // Fail-safe: revert to player turn to avoid deadlock
                    CurrentTurn = Turn.Player;
                }
            }
            else
            {
                // Player turn: 입력 허용 (OnTileClicked가 CurrentTurn 검사)
            }
        }

        public AI_Brain.BoardState ExportBoardState()
        {
            var grid = new int[BoardSize, BoardSize];

            for (int x = 0; x < BoardSize; x++)
            {
                for (int y = 0; y < BoardSize; y++)
                {
                    var tile = _tiles[x, y];
                    if (tile == null || tile.CurrentUnit == null) continue;

                    var unit = tile.CurrentUnit;
                    int val = unit.type switch
                    {
                        Unit.UnitType.King => 3,
                        Unit.UnitType.Knight => 2,
                        Unit.UnitType.Pawn => 1,
                        _ => 0
                    };

                    if (unit.owner == Unit.Owner.AI)
                        val = -val;

                    grid[x, y] = val;
                }
            }

            return new AI_Brain.BoardState
            {
                Grid = grid
            };
        }

        public void SetAnimating(bool value)
        {
            _isAnimating = value;
        }

        public void ShowComment(string context)
        {
            if (string.IsNullOrEmpty(context)) return;

            string msg = context;
            var brain = NeuralBrain.Instance;
            if (brain != null)
            {
                msg = brain.GenerateComment(context);
            }

            if (systemMessageText != null)
            {
                systemMessageText.text = msg;
            }
            else
            {
                Debug.Log($"[SystemMessage] {msg}");
            }
        }
    }
}


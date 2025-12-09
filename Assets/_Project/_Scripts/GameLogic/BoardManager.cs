using UnityEngine;

namespace Move37.GameLogic
{
    public class BoardManager : MonoBehaviour
    {
        public GameObject tilePrefab;
        public GameObject unitPrefab;
        public Transform boardGrid;
        public Unit selectedUnit;

        private const int BoardSize = 5;
        private Tile[,] _tiles = new Tile[BoardSize, BoardSize];

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

        public void OnTileClicked(Tile tile)
        {
            if (tile == null) return;

            Debug.Log($"Tile Clicked: {tile.x}, {tile.y}");

            // 선택: 플레이어 유닛만 대상
            if (tile.CurrentUnit != null && tile.CurrentUnit.owner == Unit.Owner.Player)
            {
                SelectUnit(tile.CurrentUnit);
                return;
            }

            // 이동: 선택된 유닛이 있고, 빈 타일로 이동
            if (selectedUnit != null && tile.CurrentUnit == null)
            {
                var fromTile = selectedUnit.CurrentTile;
                if (fromTile != null)
                {
                    fromTile.SetUnit(null);
                }

                selectedUnit.MoveTo(tile);
                tile.SetUnit(selectedUnit);
                selectedUnit.SetSelected(false);
                selectedUnit = null;
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
    }
}


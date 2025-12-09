using UnityEngine;
using UnityEngine.UI;

namespace Move37.GameLogic
{
    public class Tile : MonoBehaviour
    {
        public int x;
        public int y;
        public Unit CurrentUnit;

        [SerializeField] private Image background;
        [SerializeField] private Button button;
        private BoardManager _boardManager;

        public void Init(int x, int y, BoardManager boardManager = null)
        {
            this.x = x;
            this.y = y;
            _boardManager = boardManager;

            if (button != null && _boardManager != null)
            {
                button.onClick.RemoveAllListeners();
                button.onClick.AddListener(() => _boardManager.OnTileClicked(this));
            }
        }

        public void SetUnit(Unit unit)
        {
            CurrentUnit = unit;
            if (unit != null)
            {
                unit.SetCurrentTile(this);
            }
        }

        public void SetColor(Color color)
        {
            if (background != null)
            {
                background.color = color;
            }
        }
    }
}


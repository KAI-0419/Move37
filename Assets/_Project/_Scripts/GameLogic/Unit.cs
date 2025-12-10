using UnityEngine;
using UnityEngine.UI;

namespace Move37.GameLogic
{
    public class Unit : MonoBehaviour
    {
        public enum Owner
        {
            Player,
            AI
        }

        public enum UnitType
        {
            King,
            Knight,
            Pawn
        }

        public Owner owner;
        public UnitType type;
        public Image unitImage;

        public Tile CurrentTile { get; private set; }

        private const float BaseScale = 1f;
        private const float KingBonusScale = 1.12f;
        private const float SelectedScaleMultiplier = 1.2f;

        public void Init(Owner owner, UnitType type)
        {
            this.owner = owner;
            this.type = type;

            if (unitImage != null)
            {
                unitImage.color = owner == Owner.Player ? Color.blue : Color.red;
            }

            // King 시각 강조: 살짝 확대
            ApplyBaseScale();
        }

        public void SetCurrentTile(Tile tile)
        {
            CurrentTile = tile;
        }

        public void MoveTo(Tile targetTile)
        {
            transform.SetParent(targetTile.transform, false);

            if (transform is RectTransform rectTransform)
            {
                rectTransform.anchoredPosition = Vector2.zero;
            }
            else
            {
                transform.localPosition = Vector3.zero;
            }
        }

        public bool IsMoveValid(Tile targetTile)
        {
            if (targetTile == null || CurrentTile == null) return false;
            if (targetTile == CurrentTile) return false;

            // 팀킬 방지
            if (targetTile.CurrentUnit != null && targetTile.CurrentUnit.owner == owner) return false;

            int dx = targetTile.x - CurrentTile.x;
            int dy = targetTile.y - CurrentTile.y;

            switch (type)
            {
                case UnitType.Pawn:
                    {
                        int forward = owner == Owner.Player ? -1 : 1;

                        // 전진: 빈 칸만, 앞 한 칸
                        if (dy == forward && dx == 0 && targetTile.CurrentUnit == null)
                            return true;

                        // 대각선 공격: 적이 있을 때만
                        if (dy == forward && Mathf.Abs(dx) == 1 && targetTile.CurrentUnit != null &&
                            targetTile.CurrentUnit.owner != owner)
                            return true;

                        return false;
                    }
                case UnitType.King:
                    return Mathf.Abs(dx) <= 1 && Mathf.Abs(dy) <= 1 && (dx != 0 || dy != 0);
                case UnitType.Knight:
                    return (Mathf.Abs(dx) == 1 && Mathf.Abs(dy) == 2) || (Mathf.Abs(dx) == 2 && Mathf.Abs(dy) == 1);
                default:
                    return false;
            }
        }

        public void SetSelected(bool isSelected)
        {
            var baseScale = type == UnitType.King ? KingBonusScale : BaseScale;
            var targetScale = isSelected ? baseScale * SelectedScaleMultiplier : baseScale;
            transform.localScale = Vector3.one * targetScale;

            if (unitImage != null)
            {
                var baseColor = owner == Owner.Player ? Color.blue : Color.red;
                var highlight = isSelected ? 1.15f : 1f;
                unitImage.color = baseColor * highlight;
            }
        }

        private void ApplyBaseScale()
        {
            var baseScale = type == UnitType.King ? KingBonusScale : BaseScale;
            transform.localScale = Vector3.one * baseScale;
        }
    }
}


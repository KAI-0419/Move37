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


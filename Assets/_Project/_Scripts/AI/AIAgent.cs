using System.Collections;
using UnityEngine;
using Move37.GameLogic;

namespace Move37.AI
{
    public class AIAgent : MonoBehaviour
    {
        [SerializeField] private BoardManager boardManager;
        private AI_Brain _brain = new AI_Brain();

        public IEnumerator PlayTurn()
        {
            if (boardManager == null)
            {
                yield break;
            }

            // 생각 연출
            yield return new WaitForSeconds(1.5f);

            var best = _brain.GetBestMove(boardManager.ExportBoardState());

            if (best == null)
            {
                Debug.Log("AI: no valid moves.");
                boardManager.EndTurn();
                yield break;
            }

            var move = best.Value;

            var fromTile = boardManager.GetTile(move.FromX, move.FromY);
            var toTile = boardManager.GetTile(move.ToX, move.ToY);

            if (fromTile == null || toTile == null || fromTile.CurrentUnit == null)
            {
                Debug.LogWarning("AI: invalid move data.");
                boardManager.EndTurn();
                yield break;
            }

            var unit = fromTile.CurrentUnit;
            fromTile.SetUnit(null);

            string captureContext = null;
            // 공격 처리: 목적지에 적이 있으면 제거
            if (toTile.CurrentUnit != null && toTile.CurrentUnit.owner != unit.owner)
            {
                if (boardManager.explosionPrefab != null)
                {
                    var fx = Instantiate(boardManager.explosionPrefab, toTile.CurrentUnit.transform.position, Quaternion.identity);
                    fx.Play();
                    Destroy(fx.gameObject, 1f);
                }
                captureContext = $"AI captured {toTile.CurrentUnit.owner} {toTile.CurrentUnit.type} at ({move.ToX},{move.ToY})";
                Destroy(toTile.CurrentUnit.gameObject);
                toTile.SetUnit(null);
            }

            boardManager.SetAnimating(true);
            unit.MoveTo(toTile, () =>
            {
                toTile.SetUnit(unit);
                Debug.Log($"AI moved {unit.type} to ({move.ToX},{move.ToY}) [score: {move.Score}]");
                var context = captureContext ?? $"AI moved {unit.type} to ({move.ToX},{move.ToY})";
                boardManager.ShowComment(context);

                if (boardManager.CheckWinCondition())
                {
                    boardManager.SetAnimating(false);
                    return;
                }

                boardManager.SetAnimating(false);
                boardManager.EndTurn();
            });
        }
    }
}


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
            unit.MoveTo(toTile);
            toTile.SetUnit(unit);

            Debug.Log($"AI moved {unit.type} to ({move.ToX},{move.ToY}) [score: {move.Score}]");

            if (boardManager.CheckWinCondition()) yield break;

            boardManager.EndTurn();
        }
    }
}


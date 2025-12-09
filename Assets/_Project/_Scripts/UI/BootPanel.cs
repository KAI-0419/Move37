using System.Collections;
using TMPro;
using UnityEngine;

namespace Move37.UI
{
    public class BootPanel : MonoBehaviour
    {
        public TextMeshProUGUI logText;

        private readonly string[] _lines =
        {
            "System Initializing...",
            "Loading Modules...",
            "Accessing Neural Network...",
            "Connection Established."
        };

        private void Start()
        {
            StartCoroutine(ShowBootProcess());
        }

        private IEnumerator ShowBootProcess()
        {
            if (logText == null)
            {
                yield break;
            }

            logText.text = string.Empty;

            foreach (var line in _lines)
            {
                foreach (var ch in line)
                {
                    logText.text += ch;
                    yield return new WaitForSeconds(0.05f);
                }

                logText.text += "\n";
                yield return new WaitForSeconds(0.5f);
            }

            logText.text += "Done.";
        }
    }
}


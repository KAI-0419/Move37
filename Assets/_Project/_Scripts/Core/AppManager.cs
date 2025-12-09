using UnityEngine;

namespace Move37.Core
{
    /// <summary>
    /// App-wide state machine controlling high-level panels as defined in STEP 5.
    /// Single scene lifecycle: Boot -> Lobby -> Game -> Analysis.
    /// </summary>
    public sealed class AppManager : MonoBehaviour
    {
        public enum AppState
        {
            Boot,
            Lobby,
            Game,
            Analysis
        }

        private static AppManager _instance;
        public static AppManager Instance
        {
            get
            {
                if (_instance == null)
                {
                    _instance = FindObjectOfType<AppManager>();
                    if (_instance == null)
                    {
                        Debug.LogError("[AppManager] Instance not found in scene.");
                    }
                }
                return _instance;
            }
        }

        [SerializeField] private AppState _currentState = AppState.Boot;

        public AppState CurrentState => _currentState;

        private void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }

            _instance = this;
            // 단일 씬 구조: DontDestroyOnLoad 사용하지 않음.
            SetState(AppState.Boot);
        }

        /// <summary>
        /// 상태를 전환하고, 필요 시 추가 훅을 연결한다.
        /// </summary>
        public void SetState(AppState next)
        {
            if (_currentState == next) return;

            _currentState = next;
            HandleStateEntered(next);
        }

        private void HandleStateEntered(AppState state)
        {
            switch (state)
            {
                case AppState.Boot:
                    // Boot 패널 활성화, 초기 로드 작업 트리거 등.
                    break;
                case AppState.Lobby:
                    // 로비 UI 전환, 데이터 초기화 등.
                    break;
                case AppState.Game:
                    // 게임 진입: 보드 세팅, AI 초기화 등.
                    break;
                case AppState.Analysis:
                    // 리플레이/인사이트 패널 전환 등.
                    break;
                default:
                    Debug.LogWarning($"[AppManager] Unhandled state: {state}");
                    break;
            }
        }
    }
}


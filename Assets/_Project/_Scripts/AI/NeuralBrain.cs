using System.Collections.Generic;
using UnityEngine;
using Unity.InferenceEngine;
using Random = UnityEngine.Random;  // Random 네임스페이스 명확화

namespace Move37.AI
{
    /// <summary>
    /// Unity InferenceEngine을 사용한 ONNX 모델 추론 및 AI 코멘트 생성.
    /// 모델이 없을 경우 더미 모드로 동작.
    /// 
    /// Inference Engine 2.2.2 API 특성:
    /// - Model: Dispose() 없음 (자동 메모리 관리)
    /// - Worker: IDisposable 구현 (반드시 Dispose 필요)
    /// - Tensor: Dispose() 있음 (수동 메모리 관리 권장)
    /// </summary>
    public class NeuralBrain : MonoBehaviour
    {
        private static NeuralBrain _instance;
        public static NeuralBrain Instance
        {
            get
            {
                if (_instance == null)
                {
                    // ✅ FindObjectOfType → FindFirstObjectByType (Unity 6.0+)
                    _instance = FindFirstObjectByType<NeuralBrain>();
                    if (_instance == null)
                    {
                        var go = new GameObject("NeuralBrain");
                        _instance = go.AddComponent<NeuralBrain>();
                        DontDestroyOnLoad(go);
                    }
                }
                return _instance;
            }
        }

        [SerializeField] private string modelAssetName = "model_quantized";
        
        private Model _model;
        private Worker _worker;  // IWorker → Worker (구체적 클래스)
        private bool _isModelLoaded = false;

        private readonly string[] _dummyComments = new string[]
        {
            "당신의 방어선이 15% 약해졌습니다.",
            "그 폰은 미끼였습니다.",
            "인간의 욕심이 패배를 부르는군요.",
            "예상치 못한 수군요. 데이터베이스에 없는 패턴입니다.",
            "그 나이트는 희생되었습니다. 승리를 위한 계산된 손실입니다.",
            "당신의 킹은 이제 위험합니다.",
            "전략적 우위를 점령했습니다.",
            "인간의 직관은 흥미롭지만, 계산에는 미치지 못합니다."
        };

        private void Awake()
        {
            if (_instance == null)
            {
                _instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else if (_instance != this)
            {
                Destroy(gameObject);
            }
        }

        private void Start()
        {
            LoadModel();
        }

        private void LoadModel()
        {
            try
            {
                // ✅ ModelAsset을 Resources에서 로드
                ModelAsset modelAsset = Resources.Load<ModelAsset>($"Models/{modelAssetName}");
                
                if (modelAsset == null)
                {
                    Debug.LogWarning($"[NeuralBrain] ModelAsset을 찾을 수 없습니다: Assets/Resources/Models/{modelAssetName}");
                    Debug.LogWarning("[NeuralBrain] 더미 모드로 동작합니다.");
                    _isModelLoaded = false;
                    return;
                }

                // ✅ Model 로드 (Dispose 불필요 - 자동 관리)
                _model = ModelLoader.Load(modelAsset);
                
                // ✅ Worker 생성 (IWorker 아님, 구체적 클래스)
                _worker = new Worker(_model, BackendType.GPUCompute);
                
                _isModelLoaded = true;
                Debug.Log("[NeuralBrain] 모델 로드 성공");
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[NeuralBrain] 모델 로드 실패: {e.Message}");
                Debug.LogWarning("[NeuralBrain] 더미 모드로 동작합니다.");
                _isModelLoaded = false;
            }
        }

        /// <summary>
        /// 게임 상황에 대한 AI 코멘트를 생성합니다.
        /// </summary>
        public string GenerateComment(string gameSituation)
        {
            if (!_isModelLoaded || _model == null || _worker == null)
            {
                return _dummyComments[Random.Range(0, _dummyComments.Length)];
            }

            try
            {
                // TODO: 실제 추론 로직 구현
                // 1. gameSituation을 토크나이징 → inputTensor 생성
                // 2. _worker.Schedule(inputTensor) 호출
                // 3. var output = _worker.PeekOutput();
                // 4. output을 디토크나이징하여 문자열 변환
                // 5. inputTensor.Dispose(); (필요 시)
                
                Debug.Log($"[NeuralBrain] 추론 요청 (더미 모드): {gameSituation}");
                return _dummyComments[Random.Range(0, _dummyComments.Length)];
            }
            catch (System.Exception e)
            {
                Debug.LogError($"[NeuralBrain] 추론 실패: {e.Message}");
                return _dummyComments[Random.Range(0, _dummyComments.Length)];
            }
        }

        private void OnDestroy()
        {
            // ✅ Worker만 Dispose (Worker는 IDisposable 구현)
            if (_worker != null)
            {
                _worker.Dispose();
                _worker = null;
            }
            
            // ❌ Model.Dispose() 제거 (Dispose 메서드 없음)
            // Model은 자동 메모리 관리되므로 명시적 정리 불필요
            _model = null;
        }
    }
}

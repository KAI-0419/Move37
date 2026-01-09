# 📂 STEP 6: 기술적 아키텍처 (Technical Stack & Structure)

## 1\. Technology Stack (핵심 기술 스택)

우리는 외부 서버 없이 모바일 기기의 NPU/GPU를 극한으로 활용하는 'Native AI Stack'을 사용합니다.

  * **Engine:** Unity 6 (또는 2023.2+ LTS)
      * *Reason:* Unity Sentis의 최신 기능(NPU 가속, 양자화 모델 지원)을 안정적으로 사용하기 위함.
  * **Language:** C\# 9.0+ (Unity Default)
  * **AI Inference Engine:** **Unity Sentis 2.1+**
      * *Role:* ONNX 포맷의 AI 모델을 로드하고, GPU/NPU 가속을 통해 연산(Inference)을 수행.
      * *Backend:* `BackendType.GPUCompute` (Android Vulkan / iOS Metal).
  * **AI Model Format:** `.onnx` (Opset Version 14 이상)
      * *Target Model:* DeepSeek-R1-Distill-Qwen-1.5B (Int4 Quantized via `optimum-cli`).
  * **Async Framework:** **UniTask**
      * *Reason:* AI 추론 중 UI가 멈추지 않도록(Non-blocking), 코루틴 대신 최신 비동기 처리 방식 사용.
  * **Data Serialization:** `Newtonsoft.Json` (Unity Package)

-----

## 2\. Project Directory Structure (폴더 구조)

아래 구조대로 폴더를 생성합니다. `_Project` 폴더 하위에 우리가 작성할 코드를 모아두어, 플러그인과 명확히 분리합니다.

```text
Assets/
├── _Project/                  <-- Main Development Folder
│   ├── _Scripts/
│   │   ├── Core/              (Managers: AppManager, InputManager)
│   │   ├── AI/                (Sentis Logic: NeuralEngine, Tokenizer)
│   │   ├── GameLogic/         (Rules: Board, Piece, Referee)
│   │   ├── UI/                (View Controllers)
│   │   └── Data/              (ScriptableObjects: GameSettings, UnitStats)
│   ├── _Scenes/               (MainScene only)
│   ├── Art/                   (Sprites, Materials, Shaders)
│   ├── Prefabs/
│   └── Resources/             (Configuration Data)
├── StreamingAssets/           <-- IMPORTANT: Large AI Models go here
│   └── Models/
│       ├── model_quantized.onnx
│       └── tokenizer.json
└── Plugins/                   (UniTask, DOTween, etc.)
```

-----

## 3\. AI Pipeline Architecture (SLM 연동 핵심)

Unity에서 LLM/SLM을 돌리는 것은 일반적인 게임 개발과 다릅니다. 아래 파이프라인을 엄격히 준수해야 합니다.

### A. The Pipeline Steps

1.  **Input Processing:** 유저의 게임 상태(Board State)를 텍스트 프롬프트로 변환.
      * *Ex:* `[FEN: rnbqk...] User moved Knight to C3. Analyze threat.`
2.  **Tokenization (C\# Implementation):**
      * Unity에는 파이썬의 `transformers` 라이브러리가 없습니다.
      * **Action:** `tokenizer.json` (HuggingFace) 파일을 파싱하여 텍스트를 정수 ID 배열(`int[]`)로 변환하는 **Custom C\# Tokenizer**를 작성시켜야 합니다. (가장 난이도 높은 구간)
3.  **Inference (Unity Sentis):**
      * `Worker.Execute(inputs)`를 통해 연산 수행.
      * **Optimization:** `IEnumerator` 또는 `UniTask`를 사용하여 한 프레임에 모든 연산을 하지 않고, 프레임당 토큰 1개씩 생성(Streaming)하도록 분산 처리.
4.  **Detokenization:** 출력된 토큰 ID를 다시 문자열로 변환하고 UI에 표시.

### B. Sentis Worker Strategy (최적화 전략)

```csharp
// Cursor AI 가이드용 의사 코드 (Pseudo-code)
public class NeuralBrain : MonoBehaviour {
    private IWorker _worker;
    private Model _model;

    // 모바일 메모리 절약을 위한 'Layer by Layer' 실행 고려
    // 하지만 속도를 위해 GPUCompute 백엔드 사용 권장
    public async UniTask<string> GenerateReasoning(string prompt) {
        var tokens = Tokenizer.Encode(prompt);
        
        // 1GB 모델을 한 번에 돌리면 폰이 멈출 수 있음.
        // UniTask.Yield()를 적절히 섞어 메인 스레드 방어.
        await UniTask.SwitchToThreadPool(); 
        
        // ... Inference Logic (Sentis) ...
        
        await UniTask.SwitchToMainThread();
        return generatedText;
    }
}
```

-----

## 4\. Game Logic Design Patterns (코드 설계 패턴)

유지보수와 확장을 위해 다음 패턴을 적용합니다.

### A. Command Pattern (명령 패턴)

  * **Purpose:** 'Move 37'의 핵심인 \*\*복기(Replay)\*\*와 \*\*되감기(Undo)\*\*를 구현하기 위함.
  * **Implementation:** 모든 유닛의 이동은 `ICommand` 인터페이스를 통해 실행되고, `CommandHistory` 스택에 저장됩니다.

### B. Observer Pattern (옵저버 패턴)

  * **Purpose:** 게임 로직(Data)과 UI(View)의 완전한 분리.
  * **Implementation:** `BoardState`가 변경되면 `OnBoardStateChanged` 이벤트를 발행하고, UI와 AI가 이를 구독(Subscribe)하여 각자 반응합니다.

### C. Singleton (제한적 사용)

  * `AppManager`, `SoundManager` 등 전역 관리자만 싱글톤으로 사용. 나머지는 참조 주입(Dependency Injection) 지향.

-----

## 5\. Mobile Performance Optimization (성능 최적화)

온디바이스 AI 게임의 성패는 **발열**과 **배터리**에 달려 있습니다.

### A. Thermal Throttling Control (발열 제어)

  * **Dynamic Resolution:** AI가 연산 중일 때는 3D 렌더링 해상도를 낮추거나, UI 업데이트 빈도를 줄입니다.
  * **Frame Rate Governance:**
      * 평소: 60 FPS.
      * **AI Thinking:** 30 FPS로 강제 하향 조정하여 GPU 자원을 AI 연산에 몰아줍니다.

### B. Memory Management (메모리 관리)

  * **Quantization (양자화):** 반드시 **Int4** 또는 **Float16**으로 양자화된 `.onnx` 모델을 사용해야 합니다. (Sentis 최신 버전은 런타임 양자화도 지원하지만, 사전에 변환된 모델 사용 권장)
  * **Disposable:** `Tensor` 객체는 사용 즉시 `Dispose()` 해야 메모리 릭(Leak)을 막을 수 있습니다. Cursor AI에게 `using` 구문을 철저히 쓰도록 지시해야 합니다.

-----

## 6\. Cursor AI Prompt Strategy (개발 가이드)

Cursor AI에게 작업을 지시할 때 사용할 구체적인 프롬프트 전략입니다.

**Phase 1: Foundation Setup**

> "Unity 6 환경이다. `06_TECHNICAL_ARCHITECTURE.md`를 참고하여 `_Project` 폴더 구조를 생성하고, `AppManager.cs`를 싱글톤 패턴으로 작성해. 상태 머신(State Machine)은 Boot, Lobby, Game, Analysis로 구성된다."

**Phase 2: Game Logic**

> "5x5 체스 게임을 위한 `Board.cs`와 `Unit.cs`를 작성해. Command Pattern을 사용하여 이동 명령을 캡슐화하고, Undo가 가능하도록 `CommandHistory` 클래스를 구현해."

**Phase 3: AI Core (Hardest Part)**

> "이제 Unity Sentis를 연동할 차례야. `StreamingAssets/Models` 폴더에 있는 onnx 모델을 로드하는 `NeuralEngine.cs`를 작성해. 특히 입력 텍스트를 토큰화하는 `SimpleTokenizer.cs`를 구현해야 해. `vocab.json`을 딕셔너리로 파싱해서 매핑하는 방식을 사용해."
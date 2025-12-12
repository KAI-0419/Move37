# 🎯 Move 37

> **"두려움을 경외감으로, 패배를 진화로."**

**Move 37**은 온디바이스 AI와 인간의 직관이 충돌하는 비대칭 전략 게임입니다. 알파고의 전설적인 37수처럼, AI의 예측 불가능한 전략을 경험하고 극복하는 것이 목표입니다.

## 📋 목차

- [프로젝트 개요](#프로젝트-개요)
- [핵심 특징](#핵심-특징)
- [기술 스택](#기술-스택)
- [게임 규칙](#게임-규칙)
- [프로젝트 구조](#프로젝트-구조)
- [설치 및 실행](#설치-및-실행)
- [개발 원칙](#개발-원칙)
- [아키텍처 개요](#아키텍처-개요)
- [주요 컴포넌트](#주요-컴포넌트)
- [라이선스](#라이선스)

---

## 🎮 프로젝트 개요

### 미션

Move 37은 단순한 킬링타임 게임이 아닙니다. 이 프로젝트의 목적은:

1. **Sovereignty (주권)**: 인터넷 연결 없이 내 손안에서 돌아가는 강력한 지능을 소유하는 경험
2. **Challenge (도전)**: AI는 완벽하지 않으며, 인간의 변칙과 직관으로 공략 가능하다는 쾌감
3. **Insight (통찰)**: 상식을 파괴하는 AI의 수를 통해 인간 플레이어가 고정관념을 깨닫게 하는 것

### 플랫폼

- **Platform**: iOS / Android (Mobile Only)
- **Engine**: Unity 6 (또는 2025.12 최신 LTS)
- **Genre**: On-Device AI Logic & Strategy

---

## ✨ 핵심 특징

### 🤖 온디바이스 AI 추론
- **Unity InferenceEngine**을 사용한 완전 오프라인 AI
- 외부 API 호출 없음 (프라이버시 보호, 서버 비용 0원)
- 모바일 GPU/NPU 가속 지원

### 🧠 고도화된 AI 전략
- **Minimax + Alpha-Beta Pruning** 알고리즘
- 깊이 3 수 앞을 계산하는 전략적 AI
- "Move 37" 희생 전략 구현 (단기 손실을 감수하고 장기 이득을 추구)

### 🎯 체스 변형 게임
- 5x5 그리드 보드
- King, Knight, Pawn 유닛
- 실시간 전략 대결

### 💬 AI 코멘트 시스템
- 게임 상황에 따른 AI의 냉철한 분석 코멘트
- SLM 기반 자연어 생성 (더미 모드 지원)

---

## 🛠 기술 스택

### 핵심 기술
- **Unity 6** (또는 2023.2+ LTS)
- **C# 9.0+**
- **Unity InferenceEngine 2.2.2+** (ONNX 모델 추론)
- **TextMeshPro** (UI 텍스트)

### AI 모델
- **Format**: `.onnx` (Opset Version 14 이상)
- **Target Model**: DeepSeek-R1-Distill-Qwen-1.5B (Int4 Quantized)
- **Backend**: `BackendType.GPUCompute` (Android Vulkan / iOS Metal)

### 디자인 패턴
- **Singleton Pattern**: AppManager, NeuralBrain
- **Command Pattern**: 이동 명령 캡슐화 (향후 Undo/Replay 지원)
- **Observer Pattern**: 게임 로직과 UI 분리

---

## 🎲 게임 규칙

### 보드 구성
- **크기**: 5x5 그리드 (총 25칸)
- **초기 배치**:
  - **AI (상단, y=0)**: Knight-Pawn-King-Pawn-Knight
  - **Player (하단, y=4)**: Knight-Pawn-King-Pawn-Knight

### 유닛 이동 규칙

#### Pawn (폰)
- **이동**: 앞으로 1칸만 (전진만 가능)
- **공격**: 대각선 앞 1칸에 적이 있을 때만 이동 가능

#### Knight (나이트)
- **이동**: L자 이동 (dx, dy가 1,2 또는 2,1)
- **특징**: 다른 유닛을 뛰어넘을 수 있음

#### King (킹)
- **이동**: 전후좌우대각선 1칸 (모든 방향)

### 승리 조건
1. **상대 King 제거**: 적 King을 잡으면 즉시 승리
2. **King 골라인 도달**: 내 King이 상대 진영 끝줄에 도달하면 승리
   - Player: y=0 도달
   - AI: y=4 도달

---

## 📁 프로젝트 구조

```
Assets/
├── _Project/                  # 메인 개발 폴더
│   ├── _Scripts/
│   │   ├── Core/              # AppManager (상태 머신)
│   │   ├── AI/                # AI 로직
│   │   │   ├── AI_Brain.cs    # Minimax 알고리즘
│   │   │   ├── AIAgent.cs     # AI 턴 관리
│   │   │   ├── VirtualBoard.cs # 가상 보드 상태
│   │   │   ├── NeuralBrain.cs # SLM 추론 엔진
│   │   │   └── Move.cs        # 이동 데이터 구조
│   │   ├── GameLogic/         # 게임 규칙
│   │   │   ├── BoardManager.cs
│   │   │   ├── Unit.cs
│   │   │   └── Tile.cs
│   │   └── UI/                # UI 컨트롤러
│   │       └── BootPanel.cs
│   ├── _Scenes/               # MainScene (단일 씬)
│   ├── Art/                   # 스프라이트, 머티리얼
│   ├── Prefabs/
│   └── Resources/            # 설정 데이터
├── StreamingAssets/           # 대용량 AI 모델
│   └── Models/
│       └── model_quantized.onnx
└── Plugins/                   # 외부 라이브러리
```

---

## 🚀 설치 및 실행

### 요구사항
- Unity 6.0 이상 (또는 Unity 2023.2+ LTS)
- .NET Framework 4.8 이상
- 모바일 빌드: Android SDK / iOS Xcode

### 설정 단계

1. **프로젝트 열기**
   ```bash
   # Unity Hub에서 프로젝트 열기
   ```

2. **AI 모델 준비** (선택사항)
   - `StreamingAssets/Models/` 폴더에 `.onnx` 모델 파일 배치
   - 모델이 없어도 더미 모드로 동작 가능

3. **씬 설정**
   - `MainScene` 열기
   - `BoardManager` 인스펙터에서 필수 참조 할당:
     - `tilePrefab`
     - `unitPrefab`
     - `boardGrid`
     - `aiAgent`
     - `systemMessageText` (TextMeshProUGUI)
     - `kingSprite`, `knightSprite`, `pawnSprite`
     - `explosionPrefab` (선택사항)

4. **빌드 및 실행**
   - File → Build Settings
   - 플랫폼 선택 (Android/iOS)
   - Build & Run

---

## 🎯 개발 원칙

### 원칙 1: Absolute On-Device (절대적 온디바이스)
- ❌ 외부 API 호출 금지 (OpenAI, Google Cloud 등)
- ✅ 완전 오프라인 동작
- ✅ 프라이버시 보호, 서버 비용 0원

### 원칙 2: The "Alien" Logic (이질적인 논리)
- AI는 인간 흉내를 내지 않음
- 데이터와 확률에 기반한 '기계적인 답'
- "냉철한 효율", "수학적 최적화" 우선

### 원칙 3: Tension over Graphics (그래픽보다 긴장감)
- 화려한 3D 이펙트보다 AI의 '생각하는 시간'과 '로그'가 주는 심리적 압박감
- 텍스트, 타이포그래피, 글리치 효과, 터미널 스타일 UI

---

## 🏗 아키텍처 개요

### 상태 머신 (AppManager)
```
Boot → Lobby → Game → Analysis
```
- 단일 씬 구조 (씬 전환 없음)
- 상태에 따른 UI 패널 전환

### 게임 플로우
```
Player Turn → [이동/공격] → AI Turn → [AI 계산] → Player Turn ...
```

### AI 의사결정 파이프라인
1. **현재 보드 상태 수집** (`BoardManager.ExportBoardState()`)
2. **가상 보드 생성** (`VirtualBoard`)
3. **Minimax 탐색** (깊이 3, Alpha-Beta Pruning)
4. **최적 수 선택** (`AI_Brain.GetBestMove()`)
5. **이동 실행** (`AIAgent.PlayTurn()`)
6. **코멘트 생성** (`NeuralBrain.GenerateComment()`)

---

## 🔧 주요 컴포넌트

### BoardManager
- 게임 보드 관리 및 턴 시스템
- 유닛 생성, 이동, 공격 처리
- 승리 조건 체크
- NeuralBrain과 연동하여 AI 코멘트 표시

### AI_Brain
- **Minimax + Alpha-Beta Pruning** 알고리즘 구현
- 깊이 3 수 앞 계산
- 노드 탐색 수 추적 및 디버깅

### VirtualBoard
- 순수 C# 클래스 (Unity 의존 없음)
- 가상 보드 상태 관리
- 유효 이동 계산 (체스 규칙 적용)
- 평가 함수 (Heuristic):
  - 기물 점수 (Material Score)
  - 위치 점수 (Position Score)
  - 공격 기회 점수 (Attack Score)
  - 희생 전략 보너스 (Sacrifice Bonus)

### NeuralBrain
- Unity InferenceEngine을 사용한 ONNX 모델 추론
- 게임 상황에 따른 AI 코멘트 생성
- 모델이 없을 경우 더미 모드로 동작
- 싱글톤 패턴으로 전역 접근

### Unit
- 유닛 타입 (King, Knight, Pawn)
- 이동 규칙 검증 (`IsMoveValid`)
- 부드러운 이동 애니메이션 (코루틴 기반)

---

## 📊 성능 최적화

### 메모리 관리
- **양자화**: Int4 또는 Float16 양자화된 모델 사용
- **Tensor Dispose**: 사용 즉시 `Dispose()` 호출
- **Worker Dispose**: AI 추론 완료 후 리소스 정리

### 발열 제어
- AI 연산 중 프레임레이트 30 FPS로 조정
- 동적 해상도 조절 (향후 구현)

### 애니메이션 최적화
- 이동 중 입력 잠금 (`_isAnimating` 플래그)
- 코루틴 기반 부드러운 이동 (0.2초)

---

## 🎨 사용자 경험

### 감정의 흐름
1. **Arrogance (오만)**: "AI 별거 아니네, 내가 이기겠지."
2. **Shock (충격)**: "방금 뭐야? 왜 내 유닛을 무시하고 저기로 가지?" (Move 37 발생)
3. **Defeat & Analysis (패배와 분석)**: AI의 논리 로그를 보고 고정관념 깨닫음
4. **Evolution (진화)**: AI의 패턴을 역이용하거나 AI처럼 사고하여 승리

---

## 📝 라이선스

이 프로젝트는 교육 및 연구 목적으로 개발되었습니다.

---

## 🙏 기여

프로젝트 개선을 위한 제안과 기여를 환영합니다. 이슈 등록 또는 Pull Request를 통해 참여해주세요.

---

## 📚 참고 문서

프로젝트의 상세 기획 및 아키텍처 문서는 `Move 37_Instruction/` 폴더를 참고하세요:
- `01_MISSION_STATEMENT.md`: 프로젝트 미션 및 철학
- `02_TARGET_AUDIENCE.md`: 타겟 오디언스 분석
- `03_USER_JOURNEY.md`: 사용자 여정 설계
- `04_GAME_MODES_MVP.md`: 게임 모드 및 MVP 우선순위
- `05_APP_ARCHITECTURE.md`: 앱 구조 및 와이어프레임
- `06_TECHNICAL_ARCHITECTURE.md`: 기술 스택 및 구조
- `07_MONETIZATION.md`: 상업화 전략

---

**"Can You Beat AI?"** 🎯


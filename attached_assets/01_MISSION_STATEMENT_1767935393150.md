# 📂 STEP 1: 프로젝트 정의 및 개발 목적 (Mission Statement)

## 1. Project Identity (프로젝트 정체성)
* **Project Name:** **Move 37**
* **Genre:** On-Device AI Logic & Strategy (온디바이스 AI 논리/전략)
* **Core Concept:** "Can You Beat AI?" - 인간의 직관(Intuition)과 AI의 연산(Computation)이 충돌하는 비대칭 대결.
* **Platform:** iOS / Android (Mobile Only)
* **Engine:** Unity 6 (또는 2025.12 최신 LTS)
* **Key Tech:** Unity Sentis (On-Device Inference), SLM (DeepSeek-R1-Distill-Qwen-1.5B or similar)

## 2. Mission Statement (개발 목적 및 철학)

> **"두려움을 경외감으로, 패배를 진화로."**

이 프로젝트는 단순한 킬링타임용 모바일 게임이 아닙니다. **'Move 37'의 개발 목적**은 현재 인류가 느끼는 AI에 대한 막연한 공포를 **'직접적인 대결과 상호작용'**을 통해 해소하고, 기계적 사고방식(Machine Reasoning)을 경험함으로써 인간의 사고를 확장하는 데 있습니다.

우리는 다음 3가지를 증명하기 위해 이 게임을 개발합니다:
1.  **Sovereignty (주권):** 인터넷 연결 없이 내 손안에서 돌아가는 강력한 지능을 소유하는 경험.
2.  **Challenge (도전):** AI는 완벽하지 않으며, 인간의 변칙(Anomaly)과 직관으로 공략 가능하다는 쾌감.
3.  **Insight (통찰):** 알파고의 37수처럼, 상식을 파괴하는 AI의 수를 통해 인간 플레이어가 고정관념을 깨닫게 하는 것.

## 3. Development Core Principles (개발 3대 원칙)

코드를 작성할 때, 모든 결정은 아래 3가지 원칙을 따릅니다.

**원칙 1: Absolute On-Device (절대적 온디바이스)**
* **Rule:** 어떤 경우에도 외부 API(OpenAI, Google Cloud 등)를 호출하지 않는다.
* **Reasoning:** 프라이버시 보호, 서버 비용 0원, 그리고 오프라인 상태에서의 완벽한 동작 보장.
* **Constraint:** 모델 용량은 1.5GB 미만, 램 사용량은 모바일 환경을 고려하여 최적화한다.

**원칙 2: The "Alien" Logic (이질적인 논리 구현)**
* **Rule:** AI는 인간 흉내를 내지 않는다. AI는 철저히 데이터와 확률에 기반한 '기계적인 답'을 내놓아야 한다.
* **Implementation:** SLM의 프롬프트 엔지니어링 시 "공감"보다는 "냉철한 효율", "수학적 최적화"를 우선시한다. 인간적인 척하는 AI가 아니라, **'차가운 지성'**을 구현한다.

**원칙 3: Tension over Graphics (그래픽보다 긴장감)**
* **Rule:** 화려한 3D 이펙트보다 AI가 '생각하는 시간'과 '로그(Log)'가 주는 심리적 압박감을 UI/UX의 최우선으로 둔다.
* **Visual:** 텍스트, 타이포그래피, 글리치(Glitch) 효과, 터미널 스타일의 UI를 통해 'System'과 싸우는 느낌을 강조한다.

## 4. The "Move 37" Experience (정의된 사용자 경험)

이 게임을 플레이한 유저가 느껴야 할 감정의 흐름은 다음과 같습니다.

1.  **Arrogance (오만):** "AI 별거 아니네, 내가 이기겠지." (튜토리얼 단계)
2.  **Shock (충격):** "방금 뭐야? 왜 내 유닛을 무시하고 저기로 가지?" (AI의 Move 37 발생)
3.  **Defeat & Analysis (패배와 분석):** AI가 제시한 '승률 그래프'와 '논리 로그'를 보고 자신의 고정관념을 깨닫음.
4.  **Evolution (진화):** AI의 패턴을 역이용하거나, AI처럼 사고하여 승리. (Humanity Score 획득)
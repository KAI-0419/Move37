# 📂 STEP 3: 핵심 유스 케이스 (Core User Journey)

## 1. Design Philosophy: "Invisible Interface"
* **Less is More:** 버튼, 팝업, 튜토리얼 텍스트를 최소화합니다.
* **Immersion:** 앱을 켜는 순간 '게임'이 아니라 '미래의 운영체제(OS)'에 접속한 느낌을 줍니다.
* **Flow:** 모든 화면 전환은 페이드 아웃(Fade-out)이 아닌, **글리치(Glitch) 효과**나 **터미널 타이핑 효과**로 끊김 없이 이어집니다.

---

## 2. User Journey Flowchart (Phase by Phase)

### Phase 1: The Awakening (앱 실행 & 로딩)
> **목표:** "로딩 중"이라는 지루한 시간을 "AI가 깨어나는 시간"으로 리브랜딩하여 기대감을 줌.

* **Screen: [Splash / Loading Scene]**
    * **Visual:** 검은 화면. 중앙에 아주 작은 커서 하나가 깜빡거림 (`_`).
    * **Action (System):**
        * 배경에서 SLM 모델(1.5GB)을 로드함.
        * 화면에 로그가 빠르게 올라감.
        * `> Initializing Neural Network... [OK]`
        * `> Loading Logic Modules... [OK]`
        * `> Connecting to Local Intelligence... [Connected]`
    * **Action (User):** 아무것도 하지 않고 지켜봄 (약 3~5초).
    * **Transition:** 모든 로딩이 끝나면 화면 중앙에 **"Are you human?"** 이라는 텍스트가 타이핑되고, 지문 인식(또는 터치) 아이콘이 뜸.

### Phase 2: The Dashboard (메인 로비)
> **목표:** 복잡한 메뉴 없이, 나의 '지능 상태'를 직관적으로 보여주고 바로 게임으로 유도.

* **Screen: [Main Lobby]**
    * **Layout:**
        * **Center:** **[Humanity Radar Chart]** (오각형 그래프: 논리, 직관, 창의, 속도, 정확성). 내 현재 능력을 실시간으로 시각화.
        * **Bottom:** 단 하나의 큰 버튼 **[START CHALLENGE]**.
        * **Top Right:** 작은 톱니바퀴 (설정).
    * **Action (User):** [START CHALLENGE] 버튼 탭.
    * **Action (System):**
        * 카메라가 줌인(Zoom-in) 되며 그래프 속으로 빨려 들어가는 연출.
        * 랜덤하게 3가지 게임 모드 중 하나가 선택되거나, 'Daily Mission'으로 진입.

### Phase 3: The Arena (게임 플레이 - 핵심)
> **목표:** 'Game 3: Sacrifice Tactics (전략)'을 기준으로, 긴장감과 몰입감 극대화.

* **Screen: [Game Scene]**
    * **Layout:**
        * **Top (AI Area):** AI의 아바타(추상적인 기하학 도형) + **Status Bar** (AI가 현재 계산 중인 수의 개수: "Analyzing 14,203 futures...").
        * **Center (Board):** 미니멀한 5x5 또는 8x8 그리드 보드.
        * **Bottom (Player Area):** 내 유닛 정보 + 간단한 로그 창.
    * **Step 1 (Player Turn):**
        * 유저가 유닛을 드래그 앤 드롭하여 이동/공격.
        * *Feedback:* 틱(Taptic) 진동 피드백. 아주 경쾌하고 기계적인 사운드.
    * **Step 2 (AI Turn - The Tension):**
        * AI가 즉시 두지 않음. (의도적 딜레이 0.5초 ~ 2초)
        * Top 영역의 AI 도형이 불규칙하게 고동침.
        * **Text Output:** `<think>` 태그 내용을 요약해서 보여줌. (예: "User defense weak at C4...", "Sacrificing Pawn confirmed.")
        * AI가 유닛을 이동.
    * **Step 3 (Interaction):**
        * AI가 치명적인 수(Move 37)를 두었을 때, 화면이 잠시 흑백 반전(Invert)되며 충격 효과.
        * 하단 로그창에 AI의 도발 멘트 출력: "그 룩(Rook)은 미끼였습니다."

### Phase 4: The Insight (결과 및 분석)
> **목표:** 승패보다 **'배움'**을 강조. 유저가 가장 오래 머물러야 할 화면.

* **Screen: [Analysis Scene]**
    * **Condition:** 게임 종료 (승리/패배) 직후.
    * **Layout:**
        * **Top:** 결과 텍스트 (e.g., "LOGIC FAILURE" or "HUMANITY PROVED").
        * **Center:** **[Replay Timeline]**. 게임의 진행 상황을 슬라이더로 조절 가능.
        * **Highlight:** 타임라인에 **빨간 점(Critical Moment)**이 찍혀 있음.
    * **Action (User):** 빨간 점(AI가 승기를 잡은 결정적 순간)을 탭함.
    * **Action (System - SLM Reasoning):**
        * 해당 턴의 상황을 복기.
        * **SLM Explanation:** "당신은 A를 지키려 했지만, 저는 B를 공격해 당신의 퇴로를 차단했습니다. 인간은 보통 '손실 회피' 성향 때문에 이 수를 보지 못합니다."
    * **Bottom Buttons:**
        * [Rematch (재대결)]
        * [Share Insight (이 통찰 공유하기 - SNS용 이미지 생성)]

---

## 3. Implementation Guide (Technical Checkpoints)
* **Scene Architecture:** `SceneManager`를 쓰지 말고, 단일 씬(Single Scene)에서 카메라 워킹과 UI Canvas의 Enable/Disable로 처리하여 로딩 없는 경험을 만들 것.
* **Input Manager:** 터치 반응 속도(Latency)를 최우선으로 최적화할 것. (Unity New Input System 사용).
* **SLM Streaming:** AI의 생각(Thinking) 텍스트는 한 번에 뜨지 않고, 타자기 효과(Typewriter Effect)로 한 글자씩 출력되게 할 것.
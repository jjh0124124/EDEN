# EDEN

한국어 우선의 2D 횡스크롤 사이버 고딕 보스 액션 게임입니다. 별도 설치나 외부 에셋 없이 HTML5 Canvas와 바닐라 JavaScript로 실행됩니다.

## 실행

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 여세요. 진행 상황은 브라우저의 `localStorage`에 보관됩니다.

## 조작

- `A` / `D`: 이동
- `Space`: 점프
- `Shift`: 회피
- `J` / `K`: 기본 / 강 공격
- `Q` / `W` / `E` / `R`: 전투 기술
- `Esc`: 일시정지
- 메뉴: 방향키 또는 `W` / `S`, `Enter`

## 현재 범위

SURGEON부터 DIRECTOR까지 일곱 보스의 연속 진행, 체크포인트 저장, 재도전, 엔딩과 새 게임 흐름이 구현되어 있습니다. 모든 시각 효과와 효과음은 자체 절차 생성 방식입니다.

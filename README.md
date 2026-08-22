# Easy Writing Goal

Scrivener-style **writing goals** for Obsidian. Group multiple notes into one **project** with frontmatter, track a **draft target** across all linked files, and see **today’s session** progress with deadline-aware daily targets.

Inspired by Scrivener’s Project Targets — but built for vaults where one manuscript lives in many notes.

## Features

- **Project goals** — Notes sharing `writing-project: <id>` count toward one draft target
- **Session goals** — Deadline + writing days → auto daily target (recalculates as you write)
- **Sidebar** — Shows the **active note’s** project progress (or a short empty message)
- **Status bar** — Project + today’s progress when the active note belongs to a project
- **Settings manager** — Create, search, edit (Targets), and delete projects
- **History** — Calendar heatmap + recent daily deltas per project

## Commands

| Command | Description |
| --- | --- |
| Easy Writing Goal: Open writing goals view | Open the sidebar view |
| Easy Writing Goal: Show project targets | Targets modal for the active note’s project |
| Easy Writing Goal: Create writing project | Create a new project |
| Easy Writing Goal: Assign note to writing project | Link the active note to a project |
| Easy Writing Goal: Show writing history | History for the active note’s project |

## Settings

- **Project property** — Frontmatter key that groups notes (default `writing-project`)
- **Default count unit** — Characters / characters (no spaces) / words
- **Exclude frontmatter / code blocks** — Count options
- **Status bar** — Toggle project and session lines
- **Projects** — Compact list: search, New project, Targets, Delete

## Usage

1. **Settings → Easy Writing Goal → Projects → New project**, or run **Create writing project**.
2. On each note in that project:

```yaml
---
writing-project: dissertation-ch3
---
```

Or run **Assign note to writing project** on the active note.

3. Open any note in the project — the **sidebar** and **status bar** show combined progress.
4. **Targets** (sidebar, status bar, or settings list) — set total goal, deadline, writing days, session reset hour.

### Scrivener-like behaviour

- **Draft target** = sum of all notes in the project
- **Session target** = remaining ÷ writing days left until deadline
- **Writing days** = weekdays you plan to write (Mon–Fri by default)
- Progress updates as you save notes (debounced)

## Installation

### Community plugins (after approval)

Search for **Easy Writing Goal** in Obsidian Settings → Community plugins.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Creative781/easy-writing-goal/releases).
2. Create a folder named `easy-writing-goal` inside your vault’s `.obsidian/plugins/` directory.
3. Place the downloaded files in that folder.
4. Enable the plugin in Obsidian settings.

### BRAT (beta)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. Add beta plugin: `https://github.com/Creative781/easy-writing-goal`

## Develop

```bash
npm install
npm run build
```

Copy or symlink this folder to `.obsidian/plugins/easy-writing-goal/` (needs `manifest.json`, `main.js`, `styles.css`).

## License

MIT

## Connect

- **YouTube**: [Creative781](https://www.youtube.com/@creative781)
- **Blog**: [Creative781 Blog](https://creative781.cafe24.com/)

## Support

- **Buy me a coffee**: [Support the developer](https://www.buymeacoffee.com/creative781)

---

# Easy Writing Goal (한국어)

스크리브너식 **글쓰기 목표**를 옵시디안에서 쓸 수 있게 한 플러그인입니다. 여러 노트를 frontmatter로 **프로젝트**에 묶고, **전체 원고 목표**와 **오늘 세션 목표**를 한곳에서 봅니다.

## 기능

- **프로젝트 목표** — `writing-project: <id>`를 공유하는 노트 글자/단어 합산
- **세션 목표** — 마감일 + 글쓰는 요일 → 하루 목표 자동 계산
- **사이드바** — **지금 연 노트**의 프로젝트 진행만 표시
- **Status bar** — 프로젝트 + 오늘 진행 (해당 노트가 프로젝트에 속할 때)
- **설정에서 관리** — 검색, 생성, Targets, 삭제
- **히스토리** — 캘린더·최근 일별 증가량

## 명령

| 명령 | 설명 |
| --- | --- |
| Easy Writing Goal: Open writing goals view | 사이드바 뷰 열기 |
| Easy Writing Goal: Show project targets | 활성 노트 프로젝트 Targets |
| Easy Writing Goal: Create writing project | 새 프로젝트 |
| Easy Writing Goal: Assign note to writing project | 활성 노트를 프로젝트에 연결 |
| Easy Writing Goal: Show writing history | 활성 노트 프로젝트 히스토리 |

## 설정

- **Project property** — 노트를 묶는 속성 키 (기본 `writing-project`)
- **Default count unit** — 글자 / 글자(공백 제외) / 단어
- **Exclude frontmatter / code blocks** — 집계 옵션
- **Status bar** — 프로젝트·세션 표시 토글
- **Projects** — 컴팩트 목록 (검색, 새 프로젝트, Targets, 삭제)

## 사용

1. **설정 → Easy Writing Goal → Projects → New project** 또는 명령 **Create writing project**.
2. 프로젝트에 넣을 각 노트:

```yaml
---
writing-project: dissertation-ch3
---
```

또는 **Assign note to writing project** 실행.

3. 프로젝트 노트를 열면 **사이드바**·**status bar**에 합산 진행률 표시.
4. **Targets**에서 총 목표, 마감일, 글쓰는 요일, 세션 리셋 시각 설정.

### 스크리브너와 비슷한 점

- **Draft** = 프로젝트에 속한 모든 노트 합
- **Session** = 남은 분량 ÷ 마감까지 남은 작업일
- **Writing days** = 글 쓸 요일 (기본 월–금)
- 저장 시 자동 갱신 (디바운스)

## 설치

### 커뮤니티 플러그인 (승인 후)

옵시디안 설정 → 커뮤니티 플러그인에서 **Easy Writing Goal** 검색.

### 수동 설치

1. [최신 릴리스](https://github.com/Creative781/easy-writing-goal/releases)에서 `main.js`, `manifest.json`, `styles.css` 다운로드.
2. 볼트 `.obsidian/plugins/` 아래 `easy-writing-goal` 폴더 생성.
3. 파일을 넣고 설정에서 플러그인 활성화.

### BRAT (베타)

1. [BRAT 플러그인](https://github.com/TfTHacker/obsidian42-brat) 설치.
2. 베타 플러그인: `https://github.com/Creative781/easy-writing-goal`

## 개발

```bash
npm install
npm run build
```

`.obsidian/plugins/easy-writing-goal/`에 복사 또는 심볼릭 링크 (`manifest.json`, `main.js`, `styles.css`).

## 라이선스

MIT

## 연결

- **유튜브**: [Creative781](https://www.youtube.com/@creative781)
- **블로그**: [Creative781 블로그](https://creative781.cafe24.com/)

## 후원

- **바이미커피**: [개발자 후원하기](https://www.buymeacoffee.com/creative781)

# Internationalization (i18n) 스펙

> **목표**: 전 세계 사용자가 모국어로 Ferrum IDE를 사용할 수 있도록 지원

## 1. 지원 범위

### 1.1 초기 지원 언어 (MVP)

| 언어 | 코드 | 우선순위 |
|------|------|----------|
| English | en | 기본 |
| 한국어 | ko | 1순위 |
| 日本語 | ja | 1순위 |
| 简体中文 | zh-CN | 1순위 |
| Español | es | 2순위 |
| Deutsch | de | 2순위 |
| Français | fr | 2순위 |

### 1.2 확장 지원 (Post-MVP)

- 繁體中文 (zh-TW)
- Português (pt-BR)
- Русский (ru)
- العربية (ar) - RTL 지원 필요
- עברית (he) - RTL 지원 필요

---

## 2. 아키텍처

### 2.1 번역 파일 구조

```
locales/
├─ en/
│   ├─ common.json         # 공통 UI
│   ├─ editor.json         # 에디터 관련
│   ├─ file-explorer.json  # 파일 탐색기
│   ├─ settings.json       # 설정
│   ├─ menu.json           # 메뉴
│   └─ messages.json       # 알림/에러 메시지
├─ ko/
│   ├─ common.json
│   └─ ...
└─ ja/
    ├─ common.json
    └─ ...
```

### 2.2 JSON 포맷

```json
// locales/en/editor.json
{
    "title": "Editor",
    "actions": {
        "save": "Save",
        "saveAs": "Save As...",
        "saveAll": "Save All",
        "undo": "Undo",
        "redo": "Redo"
    },
    "messages": {
        "fileSaved": "File saved successfully",
        "unsavedChanges": "You have unsaved changes. Do you want to save?",
        "errorSaving": "Error saving file: {{error}}"
    },
    "status": {
        "line": "Ln {{line}}",
        "column": "Col {{col}}",
        "lines": "{{count}} lines",
        "selected": "{{count}} selected"
    }
}
```

```json
// locales/ko/editor.json
{
    "title": "에디터",
    "actions": {
        "save": "저장",
        "saveAs": "다른 이름으로 저장...",
        "saveAll": "모두 저장",
        "undo": "실행 취소",
        "redo": "다시 실행"
    },
    "messages": {
        "fileSaved": "파일이 저장되었습니다",
        "unsavedChanges": "저장되지 않은 변경 사항이 있습니다. 저장하시겠습니까?",
        "errorSaving": "파일 저장 오류: {{error}}"
    },
    "status": {
        "line": "{{line}}번째 줄",
        "column": "{{col}}번째 열",
        "lines": "{{count}}줄",
        "selected": "{{count}}개 선택됨"
    }
}
```

---

## 3. Frontend 구현 (SolidJS)

### 3.1 i18n 라이브러리 선택

**@solid-primitives/i18n** 사용

```typescript
// src/i18n/index.ts
import { createI18n, I18nProvider } from '@solid-primitives/i18n';

// 번역 로더
async function loadLocale(locale: string): Promise<Record<string, unknown>> {
    const modules = import.meta.glob('../locales/**/*.json');
    const translations: Record<string, unknown> = {};

    for (const [path, loader] of Object.entries(modules)) {
        if (path.includes(`/${locale}/`)) {
            const namespace = path.split('/').pop()?.replace('.json', '') || 'common';
            translations[namespace] = await loader();
        }
    }

    return translations;
}

// i18n 컨텍스트 생성
export function createI18nContext() {
    const [locale, setLocale] = createSignal(detectLocale());
    const [translations, setTranslations] = createSignal<Record<string, unknown>>({});

    // 로케일 변경 시 번역 로드
    createEffect(async () => {
        const loaded = await loadLocale(locale());
        setTranslations(loaded);
    });

    const t = (key: string, params?: Record<string, string | number>) => {
        const keys = key.split('.');
        let value: unknown = translations();

        for (const k of keys) {
            value = (value as Record<string, unknown>)?.[k];
        }

        if (typeof value !== 'string') {
            console.warn(`Translation missing: ${key}`);
            return key;
        }

        // 파라미터 치환
        if (params) {
            return value.replace(/\{\{(\w+)\}\}/g, (_, name) =>
                String(params[name] ?? `{{${name}}}`)
            );
        }

        return value;
    };

    return { locale, setLocale, t };
}

// 로케일 자동 감지
function detectLocale(): string {
    // 1. 저장된 설정
    const saved = localStorage.getItem('ferrum.locale');
    if (saved) return saved;

    // 2. 시스템 언어
    const browserLang = navigator.language.split('-')[0];
    const supported = ['en', 'ko', 'ja', 'zh', 'es', 'de', 'fr'];

    if (supported.includes(browserLang)) {
        return browserLang;
    }

    // 3. 기본값
    return 'en';
}
```

### 3.2 사용법

```tsx
// 컴포넌트에서 사용
function SaveButton() {
    const { t } = useI18n();

    return (
        <button
            onClick={handleSave}
            title={t('editor.actions.save')}
        >
            {t('editor.actions.save')}
        </button>
    );
}

// 파라미터 사용
function StatusBar(props: { line: number; col: number }) {
    const { t } = useI18n();

    return (
        <div class="status-bar">
            <span>{t('editor.status.line', { line: props.line })}</span>
            <span>{t('editor.status.column', { col: props.col })}</span>
        </div>
    );
}

// 복수형
function SelectedCount(props: { count: number }) {
    const { t } = useI18n();

    // 언어별 복수형 처리
    return (
        <span>
            {t('editor.status.selected', { count: props.count })}
        </span>
    );
}
```

### 3.3 복수형 처리

```json
// locales/en/common.json
{
    "items": {
        "zero": "No items",
        "one": "{{count}} item",
        "other": "{{count}} items"
    }
}

// locales/ko/common.json
{
    "items": {
        "other": "{{count}}개 항목"  // 한국어는 복수형 구분 없음
    }
}

// locales/ja/common.json
{
    "items": {
        "other": "{{count}}個のアイテム"  // 일본어도 복수형 구분 없음
    }
}
```

```typescript
// 복수형 선택 로직
function pluralize(key: string, count: number, locale: string): string {
    const rules = new Intl.PluralRules(locale);
    const category = rules.select(count);  // 'zero', 'one', 'two', 'few', 'many', 'other'

    const translations = getTranslation(key);

    return translations[category] || translations['other'] || key;
}
```

---

## 4. Backend 구현 (Rust)

### 4.1 에러 메시지 국제화

```rust
// src/i18n/mod.rs
use rust_i18n::t;

rust_i18n::i18n!("locales", fallback = "en");

pub fn set_locale(locale: &str) {
    rust_i18n::set_locale(locale);
}

// 사용
fn handle_error(err: &Error) -> String {
    match err {
        Error::FileNotFound(path) => t!("errors.file_not_found", path = path),
        Error::PermissionDenied => t!("errors.permission_denied"),
        Error::InvalidSyntax { line, message } => {
            t!("errors.invalid_syntax", line = line, message = message)
        }
    }
}
```

### 4.2 로케일 파일 (Rust)

```yaml
# locales/en.yml
errors:
  file_not_found: "File not found: %{path}"
  permission_denied: "Permission denied"
  invalid_syntax: "Syntax error on line %{line}: %{message}"

# locales/ko.yml
errors:
  file_not_found: "파일을 찾을 수 없습니다: %{path}"
  permission_denied: "권한이 거부되었습니다"
  invalid_syntax: "%{line}번째 줄에 구문 오류: %{message}"
```

---

## 5. 날짜/시간/숫자 포맷

### 5.1 Intl API 활용

```typescript
// 날짜 포맷
function formatDate(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
}

// 시간 포맷
function formatTime(date: Date, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

// 상대 시간
function formatRelativeTime(date: Date, locale: string): string {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const diff = date.getTime() - Date.now();
    const diffDays = Math.round(diff / (1000 * 60 * 60 * 24));

    if (Math.abs(diffDays) < 1) {
        const diffHours = Math.round(diff / (1000 * 60 * 60));
        return rtf.format(diffHours, 'hour');
    }

    return rtf.format(diffDays, 'day');
}

// 숫자 포맷
function formatNumber(num: number, locale: string): string {
    return new Intl.NumberFormat(locale).format(num);
}

// 파일 크기
function formatFileSize(bytes: number, locale: string): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(size)} ${units[unitIndex]}`;
}
```

### 5.2 사용 예시

```typescript
// Git blame 시간 표시
function BlameInfo(props: { date: Date }) {
    const { locale } = useI18n();

    return (
        <span title={formatDate(props.date, locale())}>
            {formatRelativeTime(props.date, locale())}
            {/* "2 days ago" / "2일 전" / "2日前" */}
        </span>
    );
}

// 파일 정보
function FileInfo(props: { size: number; modified: Date }) {
    const { locale, t } = useI18n();

    return (
        <div>
            <span>{formatFileSize(props.size, locale())}</span>
            <span>
                {t('file.modified')}: {formatDate(props.modified, locale())}
            </span>
        </div>
    );
}
```

---

## 6. RTL (Right-to-Left) 지원

### 6.1 CSS 설정

```css
/* RTL 기본 설정 */
[dir="rtl"] {
    direction: rtl;
    text-align: right;
}

/* 논리적 속성 사용 */
.sidebar {
    padding-inline-start: 16px;   /* RTL에서 자동 전환 */
    margin-inline-end: 8px;
    border-inline-start: 1px solid var(--border);
}

/* 아이콘 방향 전환 */
[dir="rtl"] .icon-arrow-right {
    transform: scaleX(-1);
}

/* 코드 에디터는 항상 LTR */
.code-editor {
    direction: ltr;
    text-align: left;
}
```

### 6.2 RTL 감지

```typescript
const rtlLocales = ['ar', 'he', 'fa', 'ur'];

function useDirection() {
    const { locale } = useI18n();

    const direction = createMemo(() =>
        rtlLocales.includes(locale()) ? 'rtl' : 'ltr'
    );

    createEffect(() => {
        document.documentElement.dir = direction();
    });

    return direction;
}
```

---

## 7. 언어 전환 UI

### 7.1 언어 선택기

```tsx
function LanguageSelector() {
    const { locale, setLocale, t } = useI18n();

    const languages = [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'ko', name: 'Korean', nativeName: '한국어' },
        { code: 'ja', name: 'Japanese', nativeName: '日本語' },
        { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' },
        { code: 'de', name: 'German', nativeName: 'Deutsch' },
        { code: 'fr', name: 'French', nativeName: 'Français' },
    ];

    return (
        <div class="language-selector">
            <label>{t('settings.language')}</label>
            <select
                value={locale()}
                onChange={(e) => {
                    setLocale(e.target.value);
                    localStorage.setItem('ferrum.locale', e.target.value);
                }}
            >
                <For each={languages}>
                    {(lang) => (
                        <option value={lang.code}>
                            {lang.nativeName} ({lang.name})
                        </option>
                    )}
                </For>
            </select>
            <p class="hint">
                {t('settings.languageHint')}
            </p>
        </div>
    );
}
```

### 7.2 설정 페이지

```
┌────────────────────────────────────────────────────┐
│ LANGUAGE & REGION                                  │
├────────────────────────────────────────────────────┤
│                                                    │
│ Display Language                                   │
│ [한국어 (Korean)___________________] ▼            │
│                                                    │
│ Some UI elements may require restart to update.    │
│                                                    │
│ ─────────────────────────────────────────────────  │
│                                                    │
│ Date & Time Format                                 │
│ ○ Follow system settings                           │
│ ● Custom                                           │
│                                                    │
│ Date format: [YYYY-MM-DD____] ▼                   │
│ Time format: [24-hour_______] ▼                   │
│                                                    │
│ Preview: 2024-01-15 14:30                          │
│                                                    │
│ ─────────────────────────────────────────────────  │
│                                                    │
│ Number Format                                      │
│ Decimal separator: [. (period)___] ▼              │
│ Thousands separator: [, (comma)__] ▼              │
│                                                    │
│ Preview: 1,234.56                                  │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 8. 번역 워크플로우

### 8.1 번역 키 추출

```bash
# 코드에서 번역 키 추출
npm run i18n:extract

# 출력: missing-translations.json
{
    "ko": [
        "settings.newFeature.title",
        "settings.newFeature.description"
    ],
    "ja": [
        "settings.newFeature.title",
        "settings.newFeature.description"
    ]
}
```

### 8.2 번역 검증

```typescript
// scripts/validate-i18n.ts
import en from '../locales/en/common.json';
import ko from '../locales/ko/common.json';

function validateTranslations(base: object, target: object, path = ''): string[] {
    const missing: string[] = [];

    for (const key of Object.keys(base)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (!(key in target)) {
            missing.push(currentPath);
        } else if (typeof base[key] === 'object') {
            missing.push(...validateTranslations(base[key], target[key], currentPath));
        }
    }

    return missing;
}

const missingKo = validateTranslations(en, ko);
if (missingKo.length > 0) {
    console.error('Missing Korean translations:', missingKo);
    process.exit(1);
}
```

### 8.3 CI 통합

```yaml
# .github/workflows/i18n.yml
name: i18n Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4

      - name: Install dependencies
        run: npm ci

      - name: Extract translation keys
        run: npm run i18n:extract

      - name: Validate translations
        run: npm run i18n:validate

      - name: Check for missing translations
        run: |
          if [ -s missing-translations.json ]; then
            echo "Missing translations found!"
            cat missing-translations.json
            exit 1
          fi
```

---

## 9. 구현 로드맵

### Phase 1: 기본 인프라 (Week 1-2)
- [ ] i18n 라이브러리 설정
- [ ] 영어 기본 번역 파일
- [ ] 번역 컨텍스트 구현

### Phase 2: 핵심 번역 (Week 2-3)
- [ ] 한국어 번역
- [ ] 일본어 번역
- [ ] 중국어(간체) 번역

### Phase 3: 추가 기능 (Week 3-4)
- [ ] 날짜/시간/숫자 포맷
- [ ] 복수형 처리
- [ ] 언어 선택 UI

### Phase 4: 확장 (Week 4-5)
- [ ] RTL 지원 (아랍어, 히브리어)
- [ ] 번역 CI/CD 파이프라인
- [ ] 커뮤니티 번역 가이드

# Supabase 설정 가이드

이 가이드는 초청장 웹앱에 Supabase 데이터베이스를 연동하는 방법을 설명합니다.

## 1. Supabase 프로젝트 설정

### 1.1 Supabase 계정 생성 및 로그인
- https://supabase.com 접속
- GitHub 계정으로 로그인 (ms3000 / msifx42))

### 1.2 새 프로젝트 생성
1. "New Project" 클릭
2. 프로젝트 이름: `invitation-app`
3. 데이터베이스 비밀번호 설정 (강력한 비밀번호 사용)
4. 지역 선택: `Seoul (ap-northeast-2)`

## 2. 데이터베이스 스키마 설정

### 2.1 SQL Editor에서 스키마 실행
1. Supabase 대시보드 → SQL Editor
2. `database-schema.sql` 파일의 내용을 복사
3. SQL Editor에 붙여넣기
4. "Run" 버튼 클릭하여 실행

### 2.2 테이블 확인
생성된 테이블들:
- `events` - 행사 정보
- `rsvp_responses` - RSVP 응답
- `guestbook_messages` - 방명록 메시지
- `gallery_images` - 갤러리 이미지
- `qr_codes` - QR 코드 정보

## 3. API 키 설정

### 3.1 API 키 확인
1. Supabase 대시보드 → Settings → API
2. 다음 정보 복사:
   - `Project URL`
   - `anon public` 키

### 3.2 웹앱에 키 설정

#### 방법 1: 직접 수정
`supabase-config.js` 파일에서:
```javascript
this.supabaseUrl = 'YOUR_SUPABASE_URL'; // 실제 URL로 변경
this.supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // 실제 키로 변경
```

#### 방법 2: 브라우저 콘솔에서 설정
1. 웹페이지를 열고 F12 키를 눌러 개발자 도구 열기
2. Console 탭에서 다음 명령어 실행:
```javascript
await debugSupabase.testConnection('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');
```

## 4. 연결 테스트

### 4.1 브라우저에서 테스트
1. `index.html` 파일을 브라우저에서 열기
2. F12 키를 눌러 개발자 도구 열기
3. Console 탭에서 로그 확인:
   - ✅ "Supabase 연결 성공!" → 정상 연결
   - ❌ "Supabase 연결 실패" → 설정 확인 필요

### 4.2 기능 테스트
1. 방명록에 메시지 작성 → DB에 저장되는지 확인
2. RSVP 응답 → DB에 저장되는지 확인
3. Supabase 대시보드에서 데이터 확인

### 4.3 디버깅 명령어
브라우저 콘솔에서 사용 가능한 명령어들:
```javascript
// 연결 상태 확인
debugSupabase.checkStatus();

// 테스트 데이터 생성
debugSupabase.createTestData();

// 수동 연결 테스트
await debugSupabase.testConnection('URL', 'KEY');
```

## 5. Row Level Security (RLS) 설정

현재 설정된 보안 정책:
- **읽기**: 모든 사용자가 활성화된 데이터 읽기 가능
- **쓰기**: 모든 사용자가 RSVP, 방명록 작성 가능
- **관리**: 인증된 관리자만 수정/삭제 가능

## 6. 실시간 기능

### 6.1 자동 업데이트
- 새로운 방명록 메시지가 작성되면 자동으로 화면에 표시
- RSVP 응답이 등록되면 실시간으로 반영

### 6.2 오프라인 지원
- 인터넷 연결이 없어도 기본 기능 동작
- 연결 복구 시 자동으로 데이터 동기화

## 7. 문제 해결

### 7.1 일반적인 오류들

**"Failed to fetch" 오류**
- API URL이 올바른지 확인
- CORS 설정 확인

**"Invalid API key" 오류**
- anon 키가 올바른지 확인
- 키에 불필요한 공백이 없는지 확인

**데이터가 저장되지 않는 경우**
- RLS 정책 확인
- 테이블 구조 확인

### 7.2 로그 확인
브라우저 개발자 도구 → Console 탭에서 에러 메시지 확인

## 8. 백업 및 보안

### 8.1 데이터 백업
- Supabase 대시보드 → Database → Backups
- 정기적으로 백업 수행

### 8.2 보안 권장사항
- API 키를 공개 저장소에 커밋하지 않기
- 강력한 데이터베이스 비밀번호 사용
- 필요시 RLS 정책 강화

## 9. 성능 최적화

### 9.1 인덱스 추가
대량의 데이터가 예상되는 경우:
```sql
-- 방명록 메시지 날짜 인덱스
CREATE INDEX idx_guestbook_created_at ON guestbook_messages(created_at DESC);

-- RSVP 응답 날짜 인덱스
CREATE INDEX idx_rsvp_created_at ON rsvp_responses(created_at DESC);
```

### 9.2 쿼리 최적화
- 불필요한 컬럼 선택 제한
- 페이지네이션 구현

---

문의사항이나 문제가 발생하면 Supabase 공식 문서를 참조하거나 개발팀에 문의하세요.
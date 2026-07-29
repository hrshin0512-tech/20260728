# 로또 추첨기

웹에서 바로 열어 사용할 수 있는 6/45 로또 추첨기입니다.
추첨 결과는 Supabase에 저장됩니다.

## 실행

1. `index.html`을 브라우저에서 직접 엽니다.
2. Supabase 저장까지 보려면 Vercel 배포 상태에서 열거나 `vercel dev`로 실행합니다.

## Supabase 설정

1. Supabase SQL 에디터에서 [`supabase.sql`](/Users/hrshin/0728/supabase.sql#L1)을 실행합니다.
2. Vercel 프로젝트 환경 변수에 다음 값을 넣습니다.
3. 배포를 다시 실행합니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 기능

- 1부터 45까지의 번호 중 6개 추첨
- 보너스 번호 자동 생성
- 추첨 애니메이션
- 최근 결과 5개 저장

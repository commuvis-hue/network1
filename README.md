# Network Commerce

Next.js(App Router) + Supabase + MetaMask(wagmi/viem)로 만든 **상품 판매 기반 네트워크 마케팅 플랫폼**입니다. Vercel에 그대로 배포할 수 있습니다.

- 수당 4종: **유니레벨**(압축/롤업), **바이너리**(소실적 매칭·이월·1인 상한), **매트릭스**(폭×깊이 자동 배치), **직급 차등(롤업) 보너스**
- 모든 수당은 **결제 완료된 상품 주문의 PV**에서만 발생
- 후원수당 총액 **매출의 35% 이하 강제** (주문 단위 + 정산 기간 단위 비례 축소, 설정으로도 35% 초과 불가)
- **환불 시 수당 자동 회수**, 바이너리 실적 차감
- MetaMask 지갑 연결(서명 검증), **스테이블코인(ERC-20) 결제 온체인 검증**, 관리자 지갑에서 출금 지급
- 관리자: 상품 등록/수정, 주문 확인·환불, 회원 정지·권한, 출금 처리, 수당 플랜·직급 설정, 수동 정산

## 1. Supabase 준비

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. **SQL Editor**에 `supabase/migrations/0001_schema.sql` 전체를 붙여넣고 실행
3. **Authentication → URL Configuration**
   - Site URL: 배포 주소 (예: `https://your-app.vercel.app`)
   - Redirect URLs: `https://your-app.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`
4. **Authentication → Emails → Confirm signup** 템플릿의 링크를 아래로 교체 (다른 기기에서 메일을 열어도 인증되도록)
   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">이메일 인증하기</a>
   ```
5. **Project Settings → API**에서 URL, `anon` 키, `service_role` 키 복사

### Google 계정 가입/로그인 (선택)

1. [Google Cloud Console](https://console.cloud.google.com) → API 및 서비스 → **OAuth 동의 화면** 설정 (외부, 앱 이름·지원 이메일 입력 후 게시)
2. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID** → 애플리케이션 유형 **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://your-app.vercel.app`, `http://localhost:3000`
   - 승인된 리디렉션 URI: `https://<프로젝트ID>.supabase.co/auth/v1/callback`
3. 발급된 **클라이언트 ID / 클라이언트 보안 비밀번호**를 Supabase **Authentication → Sign In / Providers → Google**에 붙여넣고 사용 설정
4. 위 3번의 Redirect URLs에 `/auth/callback` 주소가 들어가 있는지 확인

가입 화면에서 Google로 가입하면 입력한 추천인 코드·바이너리 위치가 그대로 적용됩니다. 로그인 화면에서 처음 Google로 들어온 사람은 추천인 없이 최상위 관리자 아래에 배치됩니다.

> **첫 번째로 가입한 계정이 자동으로 관리자 겸 조직 최상위(루트)** 가 됩니다. 운영 계정으로 먼저 가입하세요.

## 2. 로컬 실행

```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
npm test                     # 수당 엔진 단위 테스트
```

## 3. Vercel 배포

1. GitHub에 push → Vercel에서 Import
2. **Environment Variables**에 `.env.example`의 모든 항목 입력 (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`은 서버 전용)
3. 배포 후 `NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 설정
4. `vercel.json`의 크론이 매일 15:00 UTC(= 00:00 KST)에 `/api/cron/settle` 실행 → 바이너리 정산 + 직급 평가
   (Vercel이 `CRON_SECRET`을 `Authorization: Bearer` 헤더로 자동 전송)

## 4. 결제 체인 설정

| 변수 | 설명 |
|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | 1, 11155111(Sepolia), 137, 80002, 56, 97, 8453, 84532, 42161 |
| `NEXT_PUBLIC_RPC_URL` | Alchemy/Infura 등 RPC (비우면 공용 RPC) |
| `NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS` | 결제 토큰(USDT/USDC 등) 컨트랙트 |
| `NEXT_PUBLIC_PAYMENT_TOKEN_DECIMALS` | USDT: Ethereum/Polygon **6**, BSC **18** |
| `NEXT_PUBLIC_TREASURY_ADDRESS` | 판매 대금 수령 회사 지갑 |
| `PAYMENT_MIN_CONFIRMATIONS` | 결제 확정 블록 수 |

먼저 테스트넷(Sepolia 등)과 테스트 토큰으로 전체 흐름을 확인하세요.

## 5. 수당 흐름

```
상품 주문 → 결제(지갑 결제 온체인 검증 / 무통장 관리자 확인)
        → 재고 차감
        → 즉시 수당: 유니레벨 + 직급 차등 + 매트릭스  (주문 금액 × 35% 이내로 축소)
        → 바이너리 상위 전체 좌/우 PV 누적
정산(크론/수동) → 바이너리: min(L,R) × 요율, 1인 상한, 이월
               → 기간 매출 × 35% − 즉시 수당 = 바이너리 한도 안으로 비례 축소
               → 직급 평가(개인 PV·그룹 PV·직추천 수, 승급만)
환불 → 해당 주문 수당 전부 '회수' 처리, 바이너리 PV 차감
출금 → 회원 신청(1건씩) → 관리자 지갑에서 전송 → tx 해시 기록
```

| 플랜 | 기준 트리 | 비활성 회원 처리 |
|---|---|---|
| 유니레벨 | 추천(스폰서) | 압축 ON: 건너뛰고 다음 활성자에게 롤업 / OFF: 몫 소멸 |
| 직급 차등 | 추천(스폰서) | 건너뛰고 상위 적격자에게 롤업 |
| 매트릭스 | 매트릭스(BFS 자동 배치) | 몫 소멸 |
| 바이너리 | 바이너리(가입 시 L/R 선택, 바깥쪽 스필오버) | 정지 회원 미지급 |

"활성"은 상태가 정상이고, 최근 30일 개인 PV가 설정한 기준 이상인 회원입니다.

## 6. 폴더 구조

```
app/
  (auth)/        로그인·회원가입·서버 액션
  dashboard/     회원: 대시보드, 상품 구매, 주문/결제, 조직도, 수당, 지갑·출금
  admin/         관리자: 개요·정산, 상품, 주문, 회원, 출금, 수당 설정
  api/           지갑 연결, 결제 검증, 정산 크론
lib/commission/  수당 엔진·배치 알고리즘 (순수 함수, tests/에서 테스트)
lib/server/      DB 연동 서비스 (배치, 결제, 수당 처리, 정산)
supabase/        스키마·RLS·트리 함수
```

## 7. 운영 전 체크리스트 (법률)

이 소프트웨어는 법적 요건을 대신 충족해 주지 않습니다. 실제 운영 전에 다음을 확인하고, 다단계 전문 변호사의 검토를 받으세요.

- [ ] 「방문판매 등에 관한 법률」에 따른 **다단계판매업자 등록**(시·도) 및 **공제조합 가입**(직접판매공제조합/한국특수판매공제조합)
- [ ] 판매 상품은 **실물 재화나 용역**만 등록. 가상자산·투자상품·예치는 상품으로 등록하지 말 것 (유사수신·미등록 다단계 위험)
- [ ] 후원수당 총액 35% 이하 (시스템이 강제하지만 회계 기준으로도 확인)
- [ ] 판매원 등록 시 가입비·의무 구매·재고 부담 요구 금지, 청약철회(환불) 절차 고지
- [ ] 후원수당 산정·지급 기준을 판매원에게 공개, 변경 시 사전 통지
- [ ] 개인정보처리방침, 이용약관, 판매원 약관 작성
- [ ] 스테이블코인으로 결제받는 경우 회계·세무 처리와 관련 규제(특정금융정보법 등) 검토

## 8. 확장 메모

- 회원 수만 명 이상이면 직급 평가(전체 트리 로드)를 Postgres 함수나 백그라운드 작업으로 옮기세요.
- 정산 중에 결제가 들어오면 바이너리 실적 반영 시점이 다음 정산으로 넘어갈 수 있습니다. 정산을 트래픽이 적은 시간에 실행하세요.
- 이미 정산된 바이너리 수당은 환불 시 회수되지 않고, 대신 이월 PV에서 차감(음수 가능)되어 다음 매칭에 반영됩니다.

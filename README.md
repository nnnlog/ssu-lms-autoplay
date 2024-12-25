# ssu-lms-autoplay

## Build
```bash
pnpm install
npx tsc
```

## Configuration
Create the file named `.env`.
```text
HEADLESS=true

KCU_ID=<숭실사이버대학교 LMS 학번>
KCU_PW=<숭실사이버대학교 LMS 비밀번호>

LMS_ID=<숭실대학교 학번>
LMS_PW=<숭실대학교 비밀번호>
```

## Run
```bash
node dist/kcu.js # 숭실사이버대학교 LMS
node dist/lms.js # 숭실대학교 LMS
```

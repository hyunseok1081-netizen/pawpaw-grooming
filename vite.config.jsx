import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // 안드로이드 앱 내 흰 화면 오류 방지용 상대 경로 설정
})

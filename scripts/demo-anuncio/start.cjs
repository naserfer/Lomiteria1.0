// Ejecutar desde la raíz del proyecto: node scripts/demo-anuncio/start.cjs
const { spawn } = require('node:child_process')
const path = require('node:path')
const root = path.resolve(__dirname,'../..')
const api = spawn(process.execPath,[path.join(__dirname,'server.cjs')],{cwd:root,stdio:'inherit'})
const app = spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3000'],{
 cwd:root,stdio:'inherit',env:{...process.env,NEXT_DISABLE_TRACE_FILE:'1',NEXT_PUBLIC_SUPABASE_TARGET:'prod',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'karubox-local-demo',NEXT_PUBLIC_GTM_ID:''}
})
let closing=false
function close(){if(closing)return;closing=true;api.kill('SIGTERM');app.kill('SIGTERM')}
process.on('SIGINT',close);process.on('SIGTERM',close)
api.on('exit',close);app.on('exit',close)
console.log('Demo local: http://127.0.0.1:3000/login · demo@example.com / KaruboxDemo2026!')

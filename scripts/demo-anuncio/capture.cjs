const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/Users/ivanortiz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const out = path.resolve('artifacts/karubox-anuncio')
async function main() {
 await fs.mkdir(out,{recursive:true})
 const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'})
 const state='/private/tmp/karubox-demo-session.json'
 const hasState=await fs.access(state).then(()=>true,()=>false)
 const context = await browser.newContext({viewport:{width:1600,height:1200},deviceScaleFactor:2,locale:'es-PY',timezoneId:'America/Asuncion',...(hasState?{storageState:state}:{})})
 const page=await context.newPage(), errors=[]
 page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE_ERROR',e.message)})
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE_ERROR',m.text())})
 page.on('requestfailed',r=>console.log('REQUEST_FAILED',r.url(),r.failure()?.errorText))
 if(!hasState){
  await page.goto('http://127.0.0.1:3000/login',{waitUntil:'networkidle'})
  await page.locator('input[type=email]').fill('demo@example.com')
  await page.locator('input[type=password]').fill('KaruboxDemo2026!')
  await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click()
  await page.waitForURL('**/home',{timeout:30000})
 }
 try {
 if(!process.argv.includes('--admin-only') && !process.argv.includes('--summary-fit') && !process.argv.includes('--full-fit')) {
 await page.goto('http://127.0.0.1:3000/home/pos',{waitUntil:'networkidle'})
 await page.getByRole('button',{name:'Agregar Smash Karú Doble',exact:true}).last().waitFor({timeout:60000})
 await page.addStyleTag({content:'nextjs-portal { display:none !important; }'})
 if(!await page.locator('html').evaluate(el=>el.classList.contains('dark'))){
  await page.getByTitle('Karú Burger · Demo · Equipo KarúBox',{exact:true}).click()
  await page.getByRole('button',{name:'Modo oscuro',exact:true}).click()
 }
 await page.waitForFunction(()=>document.documentElement.classList.contains('dark'))
 const add=async(name,n=1)=>{for(let i=0;i<n;i++)await page.getByRole('button',{name:`Agregar ${name}`,exact:true}).last().click()}
 await add('Smash Karú Doble',2)
 await add('Lomito Completo')
 await page.getByRole('button',{name:'Acompañamientos',exact:true}).click()
 await add('Papas Cheddar & Bacon')
 await page.getByRole('button',{name:'Bebidas',exact:true}).click()
 await add('Gaseosa 500 ml',2)
 await page.getByRole('button',{name:'Hamburguesas',exact:true}).click()
 await page.getByRole('button',{name:'+ Agregar Cliente',exact:true}).click()
 await page.getByPlaceholder('Juan Pérez',{exact:true}).fill('Camila')
 await page.getByText('Camila Benítez',{exact:true}).click()
 await page.getByRole('button',{name:'✓ Usar este cliente',exact:true}).click()
 await page.getByRole('button',{name:'Para llevar',exact:true}).click()
 await page.getByTitle('Editar ingredientes',{exact:true}).first().click()
 await page.getByRole('button',{name:'Quitar una',exact:true}).nth(5).click()
 await page.getByRole('button',{name:'Sumar una',exact:true}).nth(2).click()
 await page.getByPlaceholder('Notas (ej: sin cortar)',{exact:true}).fill('Bien cocida · sin cebolla')
 await page.getByRole('button',{name:'Guardar',exact:true}).click()
 await page.mouse.move(10,10)
 await page.waitForTimeout(700)
 await page.screenshot({path:path.join(out,'01-pos-pedido-oscuro.png')})
 console.log('POS_READY', (await page.locator('body').innerText()).slice(-3000))
 await page.getByTitle('Editar ingredientes',{exact:true}).first().click()
 await page.waitForTimeout(400)
 await page.screenshot({path:path.join(out,'02-pos-personalizacion-oscuro.png')})
 await page.getByRole('button',{name:'Cerrar',exact:true}).click()
 await page.getByRole('button',{name:'Combos',exact:true}).click()
 await page.mouse.move(10,10)
 await page.screenshot({path:path.join(out,'06-pos-combos-oscuro.png')})
 await context.storageState({path:state})
 }
 await page.goto('http://127.0.0.1:3000/home/admin',{waitUntil:'networkidle'})
 await page.getByText('Ventas del período',{exact:true}).waitFor({timeout:60000})
 await page.getByRole('radio',{name:'7 días',exact:true}).first().click()
 await page.waitForTimeout(2200)
 await page.addStyleTag({content:'nextjs-portal { display:none !important; }'})
 await page.mouse.move(10,10)
 if(process.argv.includes('--summary-fit') || process.argv.includes('--full-fit')) {
  const measurements=await page.evaluate(()=>{
   const labels=['Ventas del período','Ganancia estimada']
   return labels.map(label=>{
    const title=[...document.querySelectorAll('p')].find(el=>el.textContent===label && el.parentElement.classList.contains('bg-gradient-to-br'))
    if(!title)throw new Error(`No se encontró ${label}`)
    const card=title.parentElement,value=title.nextElementSibling
    card.style.minHeight=`${card.getBoundingClientRect().height}px`
    value.style.whiteSpace='nowrap'
    value.style.letterSpacing='-0.025em'
    value.style.fontVariantNumeric='tabular-nums'
    let size=parseFloat(getComputedStyle(value).fontSize)
    const range=document.createRange();range.selectNodeContents(value)
    while(range.getBoundingClientRect().width>value.clientWidth-2 && size>20){size-=.5;value.style.fontSize=`${size}px`}
    const textBounds=range.getBoundingClientRect(),rects=[...range.getClientRects()]
    const oneLine=rects.every(rect=>Math.abs(rect.top-rects[0].top)<1)
    if(!oneLine||textBounds.width>value.clientWidth)throw new Error(`El monto no cabe: ${label}`)
    return {label,text:value.textContent,fontSize:size,availableWidth:value.clientWidth,textWidth:textBounds.width,oneLine}
   })
  })
  const fullPage=process.argv.includes('--full-fit')
  const destination=path.resolve('artifacts/karubox-capturas-modo-oscuro',fullPage?'04-admin-completo-oscuro-ajustado.png':'03-admin-resumen-oscuro-ajustado.png')
  await fs.mkdir(path.dirname(destination),{recursive:true})
  await page.screenshot({path:destination,fullPage})
  console.log('CAPTURA_AJUSTADA',JSON.stringify({destination,measurements,errors}))
  return
 }
 await page.screenshot({path:path.join(out,'03-admin-resumen-oscuro.png')})
 await page.screenshot({path:path.join(out,'04-admin-completo-oscuro.png'),fullPage:true})
 console.log('ADMIN_READY',(await page.locator('body').innerText()).slice(0,9000))
 await page.getByText('Distribución por canal',{exact:true}).scrollIntoViewIfNeeded()
 await page.waitForTimeout(400)
 await page.locator('section').filter({has:page.getByText('Distribución por canal',{exact:true})}).screenshot({path:path.join(out,'05-admin-analisis-oscuro.png')})
 await page.getByText('Ventas del período',{exact:true}).evaluate(el=>{const grid=el.closest('.grid');const header=document.querySelector('header');window.scrollTo({top:grid.getBoundingClientRect().top+window.scrollY-(header?.getBoundingClientRect().height||120)-24,behavior:'instant'})})
 await page.waitForTimeout(300)
 await page.screenshot({path:path.join(out,'08-admin-kpis-grafico-oscuro.png')})
 await page.goto('http://127.0.0.1:3000/home/pedidos',{waitUntil:'networkidle'})
 await page.getByRole('table').waitFor({timeout:30000})
 await page.addStyleTag({content:'nextjs-portal { display:none !important; }'})
 await page.screenshot({path:path.join(out,'07-historial-pedidos-oscuro.png')})
 await fs.writeFile(path.join(out,'verificacion.json'),JSON.stringify({createdAt:new Date().toISOString(),demo:true,realAuthValidated:false,viewport:{width:1600,height:1200},scale:2,errors},null,2))
 console.log('UI_ERRORS',JSON.stringify(errors))
 } catch(e) { await page.screenshot({path:path.join(out,'debug.png')});console.log('DEBUG_STATE',await page.locator('body').innerText());throw e }
 finally{
 await browser.close()
 }
}
main().catch(e=>{console.error(e);process.exit(1)})

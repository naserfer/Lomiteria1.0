// Servidor de datos ficticios para capturas. Escucha solamente en loopback.
// No conecta con Supabase ni almacena datos fuera de la memoria del proceso.
const http = require('node:http')
const { createHash } = require('node:crypto')
const uid = (key) => { const h = createHash('md5').update(key).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20)}` }
const tenantId = uid('karubox-demo')
const authId = uid('demo-auth')
const tenant = { id: tenantId, nombre: 'Karú Burger · Demo', slug: 'karu-burger-demo', activo: true, is_deleted: false, gestion_mesas: false, has_delivery: true, puntos_retorno_pct: 5, logo_url: null, direccion: 'Asunción · Local de demostración', email: 'demo@example.com', extra_precio_min_estandar: 2000, extra_precio_max_estandar: 3000, extra_precio_min_proteina: 6000 }
const usuario = { id: uid('admin'), tenant_id: tenantId, auth_user_id: authId, nombre: 'Equipo KarúBox', email: 'demo@example.com', rol: 'admin', activo: true, is_deleted: false, tenants: tenant }
const user = { id: authId, aud: 'authenticated', role: 'authenticated', email: 'demo@example.com', email_confirmed_at: '2026-10-01T12:00:00Z', created_at: '2026-10-01T12:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { nombre: 'Equipo KarúBox' }, identities: [] }
const session = () => { const now = Math.floor(Date.now()/1000); const b = x => Buffer.from(JSON.stringify(x)).toString('base64url'); return { access_token: `${b({alg:'HS256',typ:'JWT'})}.${b({sub:authId,aud:'authenticated',role:'authenticated',iat:now,exp:now+86400})}.local-demo-only`, refresh_token: 'local-demo-refresh', token_type:'bearer', expires_in:86400, expires_at:now+86400, user } }
const categorias = ['Hamburguesas','Lomitos','Combos','Acompañamientos','Bebidas','Salsas'].map((nombre, orden) => ({ id:uid(nombre), tenant_id:tenantId, nombre, orden, activa:true, mostrar_en_pos:nombre!=='Salsas', is_deleted:false }))
const catalogo = [
  ['Smash Karú Doble','Doble carne, cheddar, cebolla y salsa de la casa',35000,0,500],
  ['Bacon BBQ','Carne a la parrilla, bacon crocante y BBQ',38000,0,300],
  ['Clásica de la Casa','Carne, queso, lechuga, tomate y mayonesa',28000,0,0],
  ['Cheddar Lovers','Doble cheddar, cebolla caramelizada y carne',34000,0,200],
  ['Pollo Crispy','Pollo crocante, lechuga y alioli',30000,0,0],
  ['Veggie Grill','Medallón vegetal, rúcula y salsa especial',32000,0,0],
  ['Lomito Completo','Lomito, jamón, queso, huevo y vegetales',33000,1,200],
  ['Lomito Árabe','Carne salteada, vegetales y salsa de ajo',30000,1,0],
  ['Lomito de Pollo','Pollo a la plancha, queso y salsa de la casa',28000,1,0],
  ['Combo Smash','Smash doble + papas + gaseosa',48000,2,500],
  ['Combo para Dos','Dos clásicas + papas grandes + dos gaseosas',79000,2,1000],
  ['Combo Lomito','Lomito completo + papas + gaseosa',45000,2,400],
  ['Papas Clásicas','Papas doradas con sal y especias',12000,3,0],
  ['Papas Cheddar & Bacon','Papas con cheddar fundido y bacon',22000,3,0],
  ['Aros de Cebolla','Porción de aros crocantes con salsa',16000,3,0],
  ['Gaseosa 500 ml','Bien fría · sabores a elección',8000,4,0],
  ['Limonada de la Casa','Limón, menta y mucho hielo',12000,4,0],
  ['Agua Mineral','Botella de 500 ml',6000,4,0],
  ['Salsa de Ajo','Vasito de salsa de ajo',3000,5,0],
  ['Salsa BBQ','Vasito de salsa barbacoa',3000,5,0],
]
const productos = catalogo.map(([nombre,descripcion,precio,cat,puntos_extra])=>({id:uid(nombre),tenant_id:tenantId,nombre,descripcion,precio,categoria_id:categorias[cat].id,disponible:true,tiene_receta:cat<2||cat===3,puntos_extra,is_deleted:false}))
const combo_items = [[9,0,1],[9,12,1],[9,15,1],[10,2,2],[10,12,2],[10,15,2],[11,6,1],[11,12,1],[11,15,1]].map(([c,p,cantidad])=>({tenant_id:tenantId,combo_id:productos[c].id,producto_id:productos[p].id,cantidad,producto:productos[p]}))
const insumos = [
 ['Pan Brioche','unidad',180,40,2000,'🍞'],['Carne vacuna','g',18000,5000,6000,'🥩'],['Queso Cheddar','g',4200,1500,3000,'🧀'],['Bacon','g',1800,2000,3000,'🥓'],['Lechuga','g',3000,800,2000,'🥬'],['Tomate','g',5000,1000,2000,'🍅'],['Cebolla','g',4500,1000,2000,'🧅'],['Papas','g',28000,8000,3000,'🍟'],['Pollo','g',12000,3000,6000,'🍗'],['Huevo','unidad',90,30,2000,'🥚'],['Jamón','g',3500,1000,2500,'🥩'],['Salsa de la casa','ml',800,1000,2000,'🥣'],['Pan Árabe','unidad',75,20,2000,'🥙'],['Aceite','ml',10000,3000,0,'🫗'],['Sal','g',2000,500,0,'🧂'],['Rúcula','g',1000,250,2000,'🥬'],['Mayonesa','ml',4500,1000,2000,'🥣'],['BBQ','ml',3000,800,2000,'🥣'],['Limón','unidad',80,20,2000,'🍋'],['Menta','g',500,100,1000,'🌿'],['Gaseosa','unidad',120,24,0,'🥤'],['Agua','unidad',80,20,0,'💧'],['Envases','unidad',320,80,0,'📦'],['Servilletas','unidad',1500,300,0,'📄']
]
const ingredientes = insumos.map(([nombre,unidad,stock,min,precio_publico,icono], i)=>({id:uid(`ing-${i}`),tenant_id:tenantId,nombre,slug:`ingrediente-${i}`,unidad,precio_publico,icono,activo:true,permite_extra_en_carrito:precio_publico>0,tipo_recargo_extra:i===1||i===8?'proteina':'estandar',stock_minimo_sugerido:min}))
ingredientes[2].unidad='unidad'
const inventario = insumos.map(([nombre,unidad,stock_actual,stock_minimo],i)=>({id:uid(`stock-${i}`),tenant_id:tenantId,nombre,unidad,stock_actual,stock_minimo,controlar_stock:true,producto_id:null,productos:null}))
const recetas_producto = []
for(let p=0;p<9;p++) { for(const [i,cantidad] of [[0,1],[p===4||p===8?8:1,180],[2,2],[4,20],[5,30],[6,15],[11,20]]) recetas_producto.push({tenant_id:tenantId,producto_id:productos[p].id,ingrediente_id:ingredientes[i].id,cantidad,unidad:ingredientes[i].unidad,ingrediente:ingredientes[i]}) }
inventario[2].unidad='unidad';inventario[2].stock_actual=180;inventario[2].stock_minimo=60
for(const p of [12,13]) recetas_producto.push({tenant_id:tenantId,producto_id:productos[p].id,ingrediente_id:ingredientes[7].id,cantidad:200,unidad:'g',ingrediente:ingredientes[7]})
const nombres = ['Camila Benítez','Diego Acosta','Sofía López','Mateo González','Valentina Rojas','Lucía Martínez','Nicolás Duarte','Ana Pereira','Bruno Ferreira','Paula Gómez','Santiago Vera','Emma Torres']
const clientes = Array.from({length:248},(_,i)=>({id:uid(`cliente-${i}`),tenant_id:tenantId,nombre:i<nombres.length?nombres[i]:`Cliente Demo ${String(i+1).padStart(3,'0')}`,telefono:null,ci:null,email:null,direccion:'Asunción · Dirección de ejemplo',puntos_totales:15000+(i%9)*5000,total_pedidos:4+i%20,total_gastado:240000+(i%20)*35000,is_deleted:false,created_at:'2026-10-01T12:00:00Z'}))
const firstNames=['Martina','Joaquín','Carolina','Lucas','María','Gabriel','Julieta','Tomás','Victoria','Sebastián','Daniela','Emiliano','Isabella','Agustín','Renata','Alejandro']
const lastNames=['Vera','Giménez','Paredes','Franco','Gómez','Pereira','Benítez','Acosta','Ortiz','Ramírez','Torres','Duarte','Rojas','Sosa','Ayala','Medina']
clientes.forEach((c,i)=>{if(i>=nombres.length)c.nombre=`${firstNames[i%16]} ${lastNames[Math.floor(i/16)%16]}`})
const pedidos=[],items_pedido=[]
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Asuncion',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const midnight = new Date(`${today}T00:00:00-03:00`).getTime()
const counts=[68,74,81,76,96,112,86]
for(let d=0;d<7;d++) for(let j=0;j<counts[d];j++) {
 const basket = [[j%10<6?0:j%10<8?1:j%10===8?2:3,1+(j%5===0?1:0)],[12+(j%2),1],[15+(j%3===0?1:0),1]]
 const id=uid(`pedido-${d}-${j}`),total=basket.reduce((s,[p,q])=>s+productos[p].precio*q,0)
 const hora=d===6?8+((j*7)%180)/60:17+(j/counts[d])*6
 const created_at=new Date(midnight-(6-d)*86400000+hora*3600000).toISOString()
 const cliente_id=j%5===0?null:clientes[j%44].id
 const pedido={id,tenant_id:tenantId,numero_pedido:100+pedidos.length,numero_ciclo:1,total,subtotal:total,created_at,updated_at:created_at,tipo:j%10<5?'local':j%10<8?'delivery':'para_llevar',puntos_generados:cliente_id?Math.floor(total*.05):0,cliente_id,cliente_nombre:clientes.find(c=>c.id===cliente_id)?.nombre??'Cliente ocasional',clientes:clientes.find(c=>c.id===cliente_id)??null,estado:'completado',estado_pedido:'FACT',estado_cocina:'listo',estado_pago:'pagado',metodo_pago:j%3===0?'transferencia':'efectivo',usuario_id:usuario.id,usuarios:usuario,is_deleted:false}
 pedidos.push(pedido)
 basket.forEach(([p,cantidad],k)=>items_pedido.push({id:uid(`${id}-${k}`),tenant_id:tenantId,pedido_id:id,producto_id:productos[p].id,producto_nombre:productos[p].nombre,cantidad,precio_unitario:productos[p].precio,subtotal:productos[p].precio*cantidad,pedidos:pedido,notas:null}))
 pedido.items_pedido=basket.map(([p,cantidad])=>({producto_nombre:productos[p].nombre,cantidad,created_at}))
}
const sesiones_caja=[{id:uid('caja'),tenant_id:tenantId,abierto_por_id:usuario.id,apertura_at:new Date(midnight+8*3600000).toISOString(),cierre_at:null,total_ventas:0,total_costo_estimado:0,monto_pagado_empleados:0,ganancia_neta:0,cantidad_pedidos:0}]
const db={tenants:[tenant],usuarios:[usuario],categorias,productos,combo_items,ingredientes,inventario,recetas_producto,clientes,pedidos,items_pedido,sesiones_caja,mesas:[],promociones:[],printer_config:[],facturacion_config:[]}
function compare(v,expression) {
 if(expression.startsWith('not.')) return !compare(v,expression.slice(4))
 const dot=expression.indexOf('.'),op=expression.slice(0,dot),raw=expression.slice(dot+1)
 const value=raw==='null'?null:raw==='true'?true:raw==='false'?false:raw
 if(op==='eq') return String(v)===String(value)
 if(op==='neq') return String(v)!==String(value)
 if(op==='is') return value===null?v==null:v===value
 if(op==='in') return raw.slice(1,-1).split(',').map(s=>s.replaceAll('"','')).includes(String(v))
 if(op==='gte') return v>=value
 if(op==='gt') return v>value
 if(op==='lte') return v<=value
 if(op==='lt') return v<value
 if(op==='ilike') return String(v).toLowerCase().includes(raw.replaceAll('%','').toLowerCase())
 return true
}
function filterRows(rows,params) {
 for(const [key,value] of params) {
  if(['select','order','limit','offset','or','and'].includes(key)) continue
  rows=rows.filter(row=>compare(key.split('.').reduce((v,k)=>v?.[k],row),value))
 }
 const order=params.get('order'); if(order){const [key,dir]=order.split('.');rows=[...rows].sort((a,b)=>(a[key]>b[key]?1:a[key]<b[key]?-1:0)*(dir==='desc'?-1:1))}
 return rows
}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:54321')
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,HEAD,POST,OPTIONS');res.setHeader('Access-Control-Expose-Headers','Content-Range');res.setHeader('Content-Type','application/json')
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
 const send=(data,status=200)=>{res.statusCode=status;res.end(req.method==='HEAD'?undefined:JSON.stringify(data))}
 if(url.pathname==='/health')return send({demo:true,productos:productos.length,pedidos:pedidos.length,clientes:clientes.length})
 if(url.pathname==='/auth/v1/token')return send(session())
 if(url.pathname==='/auth/v1/user')return send(user)
 if(url.pathname==='/auth/v1/logout')return send({})
 if(url.pathname.startsWith('/rest/v1/rpc/')) {
  const fn=url.pathname.split('/').pop()
  if(fn==='get_pos_ventas_por_producto')return send(productos.map((p,i)=>({producto_id:p.id,total_cantidad:100-i})))
  if(fn==='get_pos_ventas_por_categoria')return send(categorias.map((c,i)=>({categoria_id:c.id,total_cantidad:100-i})))
  return send([])
 }
 if(url.pathname.startsWith('/rest/v1/')) {
  const table=url.pathname.split('/').pop()
  if(req.method!=='GET'&&req.method!=='HEAD')return send({message:'Demo de capturas: escritura deshabilitada'},403)
  if(!db[table]){console.log('Tabla sin fixture:',table);return send([])}
  let rows=filterRows(db[table],url.searchParams),count=rows.length
  const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||rows.length)
  rows=rows.slice(offset,offset+limit)
  res.setHeader('Content-Range',`${rows.length?offset:0}-${Math.max(0,offset+rows.length-1)}/${count}`)
  if((req.headers.accept||'').includes('vnd.pgrst.object'))return send(rows[0]??null)
  return send(rows)
 }
 send({message:'Ruta no disponible en la demo'},404)
})
server.listen(54321,'127.0.0.1',()=>console.log(`Demo API http://127.0.0.1:54321 · ${pedidos.length} pedidos · ${productos.length} productos · ${clientes.length} clientes ficticios`))

/* Supabase sync for Pedidos Ko'eju Rory */
(() => {
  const SUPABASE_URL = 'https://dazdaiutdbvotmzislxr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_LvTZSQUAAUvBC5MZtdiirQ_rBxkruAC';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);
  const setValue = (id, value) => { const el=$(id); if(el) el.value=value; };
  const getValue = (id) => { const el=$(id); if(!el) throw new Error('No se encontró el campo '+id+' en la pantalla.'); return el.value; };
  let user = null, profile = null, assignments = [];
  let syncQueue = Promise.resolve();
  const owners = new Map();
  const labelOptions = Array.from($('vendedor-input').options).map(o => o.value).filter(Boolean);
  const css = document.createElement('style');
  css.textContent = `
    .cloud-bar{padding:8px 12px;background:#34443D;color:#EAE3D3;font:13px sans-serif;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .cloud-bar input{min-width:0;flex:1;padding:8px;border-radius:6px;border:1px solid #aaa}
    .cloud-bar button{padding:8px 10px;border-radius:6px;background:#C99A3C;color:#20302B;font-weight:700}
    .cloud-status{font-size:12px;opacity:.98;flex:1 1 calc(100% - 24px);line-height:1.4}
    .cloud-status-dot{width:10px;height:10px;border-radius:50%;background:#D6B65D;flex:0 0 10px;box-shadow:0 0 0 3px rgba(255,255,255,.12)}
    .cloud-status-dot.connected{background:#72D69A}.cloud-status-dot.error,.cloud-status-dot.offline{background:#FF7777}
    .cloud-last-sync{flex-basis:100%;font-size:11px;color:#E2C47E;padding-left:18px;line-height:1.35}
    .admin-panel-content{padding:14px 12px 100px}.admin-heading{margin:2px 2px 12px}.admin-heading h2{margin:0;font-size:21px}.admin-heading p,.admin-note{color:#65716a;font-size:12px;line-height:1.5}
    .admin-section{background:#fff;border:1px solid #d8ddd7;border-radius:12px;padding:13px;margin:10px 0}.admin-section h3{margin:0 0 10px;font-size:16px}
    .admin-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px}.admin-filters label,.admin-user-form label{display:block;font-size:12px;color:#526057}
    .admin-filters input,.admin-filters select,.admin-user-form input{width:100%;min-width:0;padding:9px;border:1px solid #cbd2ca;border-radius:7px;background:#fff;margin-top:4px}.admin-filters .wide{grid-column:1/-1}
    .admin-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}.admin-metric{background:#20302B;color:#fff;border-radius:9px;padding:11px}.admin-metric span{display:block;color:#e2c47e;font-size:11px}.admin-metric strong{display:block;font-size:19px;margin-top:4px}
    .admin-report-row{display:flex;justify-content:space-between;gap:8px;padding:9px 2px;border-bottom:1px solid #e5e8e3;font-size:13px}.admin-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.admin-actions button{padding:9px 12px;border-radius:7px;background:#20302B;color:#fff;font-weight:600}.admin-actions button.secondary{background:#fff;color:#20302B;border:1px solid #cbd2ca}
    .admin-seller-chart{margin:12px 0 8px;padding:11px;background:#f7f8f5;border:1px solid #e1e6df;border-radius:9px}.admin-seller-chart h4{margin:0 0 10px;font-size:12px;color:#526057}.admin-bar-row{display:grid;grid-template-columns:minmax(74px,105px) 1fr;gap:8px;align-items:center;margin:8px 0;font-size:11px}.admin-bar-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:#34443D}.admin-bar-track{height:10px;background:#e2e7e0;border-radius:99px;overflow:hidden}.admin-bar-fill{height:100%;min-width:2px;background:#C99A3C;border-radius:99px}.admin-bar-value{grid-column:2;color:#65716a;font-size:10px;margin-top:-5px}
    .admin-user-form{display:grid;gap:8px}
    body.auth-locked > :not(#auth-gate):not(#password-recovery-layer){display:none!important}
    #auth-gate{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:#20302B;min-height:100vh;box-sizing:border-box}
    .auth-card{width:100%;max-width:390px;box-sizing:border-box;background:#fff;border-radius:16px;padding:26px;box-shadow:0 18px 50px #0004;display:grid;gap:10px;font-family:Arial,sans-serif}
    .auth-brand{font-size:12px;letter-spacing:3px;font-weight:800;color:#A87925}.auth-card h1{margin:0;color:#20302B;font-size:23px}.auth-card p{margin:0 0 8px;color:#65716a;font-size:13px;line-height:1.45}
    .auth-card label{font-size:13px;font-weight:700;color:#34443D}.auth-card input{width:100%;box-sizing:border-box;padding:13px;border:1px solid #cbd2ca;border-radius:8px;font-size:16px}
    .auth-card button{margin-top:6px;padding:13px;border:0;border-radius:8px;background:#C99A3C;color:#20302B;font-size:16px;font-weight:800}.auth-card #auth-status{min-height:18px;margin-top:4px;font-size:12px}
  `;
  document.head.appendChild(css);
  document.body.classList.add('auth-locked');
  const gate = document.createElement('section');
  gate.id = 'auth-gate';
  gate.innerHTML = '<form id="auth-form" class="auth-card"><div class="auth-brand">AB SYSTEM</div><h1>Pedidos Ko\'eju Rory</h1><p>Ingresá con tu correo y contraseña registrados.</p><label for="auth-email">Correo electrónico</label><input id="auth-email" type="email" required autocomplete="username" placeholder="Correo registrado"><label for="auth-password">Contraseña</label><input id="auth-password" type="password" required autocomplete="current-password" placeholder="Contraseña"><button id="auth-login" type="submit">Ingresar</button><p id="auth-status" role="status" aria-live="polite">Verificando acceso...</p></form>';
  document.body.appendChild(gate);
  const bar = document.createElement('section');
  bar.className = 'cloud-bar';
  bar.innerHTML = '<span id="cloud-status-dot" class="cloud-status-dot" aria-hidden="true"></span><span id="cloud-status" class="cloud-status" role="status" aria-live="polite">Verificando conexión...</span><span id="cloud-last-sync" class="cloud-last-sync">Última sincronización: todavía no registrada</span>';
  document.querySelector('.topbar').appendChild(bar);
  let lastSyncAt = null;
  const syncStampKey = () => user ? 'koeju_last_sync_user_'+user.id : '';
  const formatSyncTime = value => value ? new Date(value).toLocaleString('es-PY',{dateStyle:'short',timeStyle:'short'}) : 'todavía no registrada';
  function paintConnection(kind){
    const dot=$('cloud-status-dot');
    if(dot) dot.className='cloud-status-dot '+kind;
  }
  function updateLastSync(value){
    lastSyncAt=value||null;
    const el=$('cloud-last-sync');
    if(el) el.textContent='Última sincronización: '+formatSyncTime(lastSyncAt);
  }
  function markSynced(){
    if(!user) return;
    const stamp=new Date().toISOString();
    try{localStorage.setItem(syncStampKey(),stamp);}catch(_){}
    updateLastSync(stamp);
    paintConnection(navigator.onLine?'connected':'offline');
  }
  function status(s){
    const message=String(s||'');
    const el=$('cloud-status');
    if(el) el.textContent=message;
    const auth=$('auth-status');if(auth) auth.textContent=message;
    const bad=/error|no se pudo|no se sincronizó|sin conexión|desconectad/i.test(message);
    paintConnection(!navigator.onLine?'offline':bad?'error':'connected');
  }
  window.addEventListener('online',()=>status('Conexión a internet restablecida. Verificando sincronización...'));
  window.addEventListener('offline',()=>status('Sin conexión a internet. Los cambios locales podrían no llegar a la nube hasta recuperar conexión.'));
  const toastSafe = (s) => { if (typeof showToast === 'function') showToast(s); else status(s); };
  const orderKey = (source,id) => source+':'+String(id);
  const mergeById = (base, incoming) => {
    const map = new Map((Array.isArray(base)?base:[]).map(x=>[String(x.id),x]));
    incoming.forEach(x=>map.set(String(x.id),x));
    return [...map.values()].sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));
  };
  function applySellerPermissions() {
    const select = $('vendedor-input');
    const allowed = profile.role === 'admin' ? labelOptions : assignments;
    select.innerHTML = '<option value="">Vendedor</option>' + allowed.map(v=>'<option value="'+String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+v+'</option>').join('');
    if (state.vendedor && allowed.includes(state.vendedor)) select.value = state.vendedor;
    else if (profile.role === 'seller' && allowed.length === 1) {
      state.vendedor = allowed[0]; select.value = allowed[0]; saveState();
    } else if (!allowed.includes(state.vendedor)) {
      state.vendedor = ''; select.value = ''; saveState();
    }
  }
  const scopedKey = (base) => base + '_user_' + user.id;
  const readArray = (key) => {
    try { const value=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(value)?value:[]; }
    catch (_) { return []; }
  };
  function persistCurrentCollections() {
    if(!user || !profile) return;
    const aKey=profile.role==='admin'?ARCHIVE_KEY:scopedKey(ARCHIVE_KEY);
    const hKey=profile.role==='admin'?HISTORICO_KEY:scopedKey(HISTORICO_KEY);
    localStorage.setItem(aKey,JSON.stringify(archive));
    localStorage.setItem(hKey,JSON.stringify(historico));
  }
  async function loadCloudOrders() {
    const {data,error}=await client.from('orders').select('id,owner_id,legacy_id,legacy_source,payload,updated_at');
    if(error) throw error;
    owners.clear();
    const a=[],h=[];
    (data||[]).forEach(row=>{
      owners.set(orderKey(row.legacy_source,row.legacy_id),row.owner_id);
      const p=row.payload||{};
      if(row.legacy_source==='archive') a.push(p);
      if(row.legacy_source==='history') h.push(p);
    });
    const archiveKey=profile.role==='admin'?ARCHIVE_KEY:scopedKey(ARCHIVE_KEY);
    const historyKey=profile.role==='admin'?HISTORICO_KEY:scopedKey(HISTORICO_KEY);
    // Admin conserva y combina el archivo histórico legado del dispositivo.
    // Cada vendedor utiliza una caché separada por UID y nunca lee la caché global.
    archive=mergeById(readArray(archiveKey),a);
    historico=mergeById(readArray(historyKey),h);
    persistCurrentCollections();
    renderArchive(); renderHistorico(); renderRankings();
    markSynced();
    status('Conectado: datos descargados y sincronizados con la nube.');
  }
  function syncCollection(items,source) {
    if(!user || !profile || !Array.isArray(items)) return Promise.resolve();
    const snapshot=items.filter(x=>x && x.id && x.vendedor);
    syncQueue=syncQueue.then(async()=>{
      const allowed = profile.role==='admin' ? labelOptions : assignments;
      const rows=snapshot.filter(x=>allowed.includes(x.vendedor)).map(x=>({
        owner_id:owners.get(orderKey(source,x.id)) || user.id,
        legacy_id:String(x.id),legacy_source:source,payload:x,updated_at:new Date().toISOString()
      }));
      if(snapshot.length && !rows.length){
        status('No se sincronizó: ningún pedido coincide con los vendedores asignados a esta cuenta.');
        return;
      }
      if(rows.length){
        const {data:saved,error}=await client.from('orders')
          .upsert(rows,{onConflict:'owner_id,legacy_source,legacy_id'})
          .select('id,owner_id,legacy_id');
        if(error) throw error;
        if(!saved || saved.length!==rows.length){
          throw new Error('Supabase no confirmó todos los pedidos enviados ('+(saved||[]).length+'/'+rows.length+').');
        }
        rows.forEach(r=>owners.set(orderKey(source,r.legacy_id),r.owner_id));
      }
      const currentIds=new Set(snapshot.map(x=>String(x.id)));
      const obsolete=[...owners.entries()].filter(([key,ownerId])=>
        key.startsWith(source+':') && !currentIds.has(key.slice(source.length+1)) &&
        (profile.role==='admin' || ownerId===user.id)
      );
      for(const [key,ownerId] of obsolete){
        const legacyId=key.slice(source.length+1);
        const {data:deleted,error}=await client.from('orders').delete()
          .eq('owner_id',ownerId).eq('legacy_source',source).eq('legacy_id',legacyId)
          .select('id');
        if(error) throw error;
        if(!deleted || deleted.length!==1) throw new Error('No se confirmó la eliminación del pedido '+legacyId+'.');
        owners.delete(key);
      }
      if(rows.length){
        markSynced();
        status('Sincronización confirmada: '+rows.length+' pedido(s) de '+(source==='archive'?'Archivo':'Histórico')+'.');
      }else{
        markSynced();
        status('Conectado: no hay cambios pendientes en '+(source==='archive'?'Archivo':'Histórico')+'.');
      }
    }).catch(error=>{status('Error al sincronizar: '+(error.message||error));});
    return syncQueue;
  }
  function installSaveHooks() {
    const oldA=saveArchive, oldH=saveHistorico;
    saveArchive=function(){
      if(user && profile && profile.role==='seller') localStorage.setItem(scopedKey(ARCHIVE_KEY),JSON.stringify(archive));
      else oldA();
      return syncCollection(archive,'archive');
    };
    saveHistorico=function(){
      if(user && profile && profile.role==='seller') localStorage.setItem(scopedKey(HISTORICO_KEY),JSON.stringify(historico));
      else oldH();
      return syncCollection(historico,'history');
    };
  }
  async function migrateLocal() {
    if(!user || profile.role!=='admin') return;
    const localA=JSON.parse(localStorage.getItem(ARCHIVE_KEY)||'[]');
    const localH=JSON.parse(localStorage.getItem(HISTORICO_KEY)||'[]');
    const localS=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    const records=[];
    localA.forEach(x=>{if(x && x.id && x.vendedor) records.push({legacy_id:String(x.id),legacy_source:'archive',vendedor:x.vendedor,payload:x});});
    localH.forEach(x=>{if(x && x.id && x.vendedor) records.push({legacy_id:String(x.id),legacy_source:'history',vendedor:x.vendedor,payload:x});});
    if(localS && localS.lines && localS.lines.length && localS.vendedor) {
      const draft={...localS,id:'draft_'+user.id,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      records.push({legacy_id:draft.id,legacy_source:'draft',vendedor:draft.vendedor,payload:draft});
    }
    if(!records.length){status('No se encontraron pedidos locales para migrar.');return;}
    if(!confirm('Se enviarán '+records.length+' registros a Supabase. Los datos locales no se borrarán. ¿Continuar?')) return;
    $('cloud-migrate').disabled=true; status('Migrando '+records.length+' registros...');
    try{
      for(let i=0;i<records.length;i+=100){
        const {error}=await client.rpc('admin_import_legacy_orders',{p_orders:records.slice(i,i+100)});
        if(error) throw error;
      }
      await loadCloudOrders();
      status('Migración completada: '+records.length+' registros procesados. Datos locales conservados.');
    }catch(e){status('No se completó la migración: '+e.message);}
    finally{$('cloud-migrate').disabled=false;}
  }
  async function activateSession(sessionUser) {
    user=sessionUser;
    window.KOEJU_EMITTER_EMAIL=String(user.email||'');
    const {data:p,error:pe}=await client.from('profiles').select('role,seller_label').eq('id',user.id).single();
    if(pe) throw pe;
    profile=p;
    try{updateLastSync(localStorage.getItem(syncStampKey()));}catch(_){updateLastSync(null);}
    const {data:as,error:ae}=await client.from('seller_assignments').select('seller_label').eq('user_id',user.id);
    if(ae && profile.role!=='admin') throw ae;
    assignments=(as||[]).map(x=>x.seller_label);
    if(profile.role==='seller' && !assignments.length) throw new Error('Esta cuenta no tiene vendedores asignados.');
    if(profile.role!=='admin' && profile.role!=='seller') throw new Error('El perfil no tiene un rol autorizado.');
    // Al cambiar de cuenta, nunca reutilizar en memoria los pedidos de la sesión anterior.
    archive=profile.role==='admin'?readArray(ARCHIVE_KEY):readArray(scopedKey(ARCHIVE_KEY));
    historico=profile.role==='admin'?readArray(HISTORICO_KEY):readArray(scopedKey(HISTORICO_KEY));
    applySellerPermissions();
    try{await loadSharedInventory();}catch(inventoryError){status('No se pudieron cargar los datos compartidos de stock y precios: '+(inventoryError.message||inventoryError));}
    await loadCloudOrders();
    document.body.classList.remove('auth-locked');
    gate.style.display='none';
    $('cloud-logout').style.display='';
    $('cloud-migrate').style.display=profile.role==='admin'?'':'none';
    adminTab.style.display=profile.role==='admin'?'':'none';
    if(profile.role==='admin') renderAdminPanel();
    status('Conectado: '+(profile.role==='admin'?'Administrador':assignments.join(', '))+' · sincronización activa');
    // El formulario superior anterior ya no existe; el campo se limpia en login().
  }
  async function login(event) {
    if(event) event.preventDefault();
    const email=String(getValue('auth-email')||'').trim(), password=getValue('auth-password');
    if(!email || !password){status('Ingresá correo y contraseña.');return;}
    $('auth-login').disabled=true; status('Verificando acceso...');
    try{
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error) throw error;
      await activateSession(data.user);
      setValue('auth-password','');
    }catch(e){
      await client.auth.signOut(); user=null;profile=null;assignments=[];
      document.body.classList.add('auth-locked');gate.style.display='flex';
      status('No se pudo ingresar: '+(e.message||e));
    }finally{$('auth-login').disabled=false;}
  }
  async function logout() {
    await client.auth.signOut(); user=null;profile=null;assignments=[];owners.clear();
    window.KOEJU_EMITTER_EMAIL='';
    // Vaciar la vista al cerrar sesión; las cachés y el archivo legado permanecen intactos.
    archive=[]; historico=[];
    renderArchive(); renderHistorico(); renderRankings();
    const select=$('vendedor-input');
    select.innerHTML='<option value="">Vendedor</option>'+labelOptions.map(v=>'<option value="'+String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+v+'</option>').join('');
    $('cloud-logout').style.display='none';$('cloud-migrate').style.display='none';
    adminTab.style.display='none';$('panel-admin').classList.remove('active');
    gate.style.display='flex';document.body.classList.add('auth-locked');
    setValue('auth-email','');setValue('auth-password','');
    status('Sesión cerrada. Ingresá nuevamente para usar la aplicación.');
  }
  $('auth-form').addEventListener('submit',login);
  $('cloud-logout').addEventListener('click',logout);
  $('cloud-migrate').addEventListener('click',migrateLocal);

  const adminTab=$('admin-menu-tab'), adminContent=$('admin-panel-content');
  function adminDate(e){return new Date(e.createdAt||e.updatedAt||0);}
  function adminFiltered(){const from=$('admin-date-from').value,to=$('admin-date-to').value,sellers=Array.from(document.querySelectorAll('#admin-seller-filter input[type=checkbox]:checked')).map(o=>o.value);return archive.concat(historico).filter(e=>{const d=adminDate(e);return (!from||d>=new Date(from+'T00:00:00'))&&(!to||d<=new Date(to+'T23:59:59.999'))&&(!sellers.length||sellers.includes(e.vendedor));});}
  function renderAdminReport(){
    if(!user||!profile||profile.role!=='admin')return;
    const orders=adminFiltered(), total=orders.reduce((n,e)=>n+archiveOrderTotal(e),0), groups=new Map();
    const unitsOf=e=>(e.lines||[]).reduce((n,l)=>n+Math.max(0,Number(l.qty)||0),0);
    const units=orders.reduce((n,e)=>n+unitsOf(e),0);
    orders.forEach(e=>{const k=e.vendedor||'Sin vendedor',v=groups.get(k)||{count:0,total:0,units:0};v.count++;v.total+=archiveOrderTotal(e);v.units+=unitsOf(e);groups.set(k,v);});
    $('admin-total-orders').textContent=orders.length.toLocaleString('es-PY');
    $('admin-total-units').textContent=units.toLocaleString('es-PY');
    $('admin-total-sales').textContent='Gs. '+fmtMoney(total);
    $('admin-seller-count').textContent=groups.size.toLocaleString('es-PY');
    const ranked=[...groups.entries()].sort((a,b)=>b[1].total-a[1].total);
    const maxSales=Math.max(0,...ranked.map(([,v])=>v.total));
    $('admin-report-list').innerHTML=ranked.length?'<div class="admin-seller-chart"><h4>Comparativo de ventas por vendedor</h4>'+ranked.map(([name,v])=>{const pct=maxSales>0?Math.max(1,v.total/maxSales*100):0;return '<div class="admin-bar-row"><span class="admin-bar-name" title="'+escapeAttr(name)+'">'+escapeHtml(name)+'</span><div class="admin-bar-track"><div class="admin-bar-fill" style="width:'+pct.toFixed(1)+'%"></div></div><small class="admin-bar-value">Gs. '+fmtMoney(v.total)+'</small></div>';}).join('')+'</div>'+ranked.map(([name,v])=>'<div class="admin-report-row admin-seller-stat"><span>'+escapeHtml(name)+'<br><small>'+v.count.toLocaleString('es-PY')+' pedidos · '+v.units.toLocaleString('es-PY')+' unidades</small></span><strong>Gs. '+fmtMoney(v.total)+'</strong></div>').join(''):'<p class="admin-note">No hay pedidos para el período seleccionado.</p>';
  }
  function exportAdminReport(){
    const orders=adminFiltered();if(!orders.length){toastSafe('No hay ventas para exportar con esos filtros.');return;}
    const rows=[['Vendedor','Cliente','Código cliente','Fecha','Estado','Cantidad de artículos','Total Gs.']];
    orders.forEach(e=>rows.push([e.vendedor||'',e.cliente||'',e.clienteCodigo||'',adminDate(e).toLocaleString('es-PY'),e.estado||'',(e.lines||[]).reduce((n,l)=>n+(Number(l.qty)||0),0),archiveOrderTotal(e)]));
    const csv='\uFEFF'+rows.map(row=>row.map(v=>{const s=String(v==null?'':v);return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='resumen_ventas_'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);
  }
  async function sendSellerRecovery(){
    const email=$('admin-recovery-email').value.trim();if(!email){toastSafe('Ingresá el correo del vendedor.');return;}
    $('admin-recovery-btn').disabled=true;
    try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;toastSafe('Si el correo está registrado, recibirá un enlace de recuperación.');setValue('admin-recovery-email','');}
    catch(e){toastSafe('No se pudo solicitar el cambio: '+(e.message||e));}finally{$('admin-recovery-btn').disabled=false;}
  }

  let pendingSharedInventory = null;
  async function loadSharedInventory() {
    const {data,error}=await client.from('inventory_current')
      .select('items,imported_at').eq('id',1).maybeSingle();
    if(error) throw error;
    if(!data || !Array.isArray(data.items)) return;
    let applied=0;
    data.items.forEach(row=>{
      const item=byCode.get(String(row.code));
      if(!item) return;
      item.sc=Number(row.central)||0;
      item.sd=Number(row.cde)||0;
      item.p1=Number(row.p1)||0;
      item.p2=Number(row.p2)||0;
      item.p3=Number(row.p3)||0;
      applied++;
    });
    if(typeof renderResults==='function') renderResults();
    if(typeof renderStockPanel==='function') renderStockPanel();
    const stamp=data.imported_at?new Date(data.imported_at).toLocaleString('es-PY'):'';
    const note=$('stock-updated');
    if(note) note.textContent='Datos compartidos actualizados: '+stamp+' · '+applied.toLocaleString('es-PY')+' artículos del catálogo.';
  }
  function parseSharedInventoryFile(file) {
    return new Promise((resolve,reject)=>{
      if(!window.XLSX){reject(new Error('No se pudo cargar el lector de Excel.'));return;}
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));
      reader.onload=event=>{
        try{
          const workbook=XLSX.read(event.target.result,{type:'array'});
          const sheet=workbook.Sheets[workbook.SheetNames[0]];
          const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''});
          const headerIndex=matrix.findIndex(row=>{
            const h=row.map(normalizeStockHeader);
            return h.includes('CODARTICULO')&&h.includes('CENTRAL')&&h.includes('CDE');
          });
          if(headerIndex<0) throw new Error('No se detectaron las columnas Cód.Artículo, CENTRAL y CDE.');
          const headers=matrix[headerIndex].map(normalizeStockHeader);
          const find=(names)=>headers.findIndex(h=>names.includes(h));
          const idx={
            code:find(['CODARTICULO']),central:find(['CENTRAL']),cde:find(['CDE']),
            p1:find(['1','M1','PRECIO1']),p2:find(['2','M2','PRECIO2']),p3:find(['3','M3','PRECIO3'])
          };
          if([idx.p1,idx.p2,idx.p3].some(i=>i<0)) throw new Error('Faltan columnas de precios 1, 2 y 3 (M1, M2 y M3).');
          const items=[],seen=new Set();
          for(const row of matrix.slice(headerIndex+1)){
            const code=normalizeStockCode(row[idx.code]);
            if(!code||seen.has(code)) continue;
            seen.add(code);
            items.push({
              code,
              central:parseStockNumber(row[idx.central]),
              cde:parseStockNumber(row[idx.cde]),
              p1:parseStockNumber(row[idx.p1]),
              p2:parseStockNumber(row[idx.p2]),
              p3:parseStockNumber(row[idx.p3])
            });
          }
          if(!items.length) throw new Error('El archivo no contiene artículos con código.');
          const matched=items.filter(x=>byCode.has(x.code)).length;
          resolve({items,matched,filename:file.name});
        }catch(e){reject(e);}
      };
      reader.readAsArrayBuffer(file);
    });
  }
  async function confirmSharedInventoryUpload() {
    if(!user||!profile||profile.role!=='admin'||!pendingSharedInventory) return;
    const btn=$('admin-inventory-confirm');
    if(btn) btn.disabled=true;
    try{
      const payload={
        id:1,items:pendingSharedInventory.items,
        imported_at:new Date().toISOString(),imported_by:user.id
      };
      status('Subiendo '+payload.items.length.toLocaleString('es-PY')+' artículos a la nube...');
      const {error}=await client.from('inventory_current').upsert(payload,{onConflict:'id'});
      if(error) throw error;
      await loadSharedInventory();
      const msg='Actualización compartida completada: '+payload.items.length.toLocaleString('es-PY')+' filas del Excel; '+pendingSharedInventory.matched.toLocaleString('es-PY')+' coincidencias con el catálogo.';
      pendingSharedInventory=null;
      $('admin-inventory-preview').textContent=msg;
      $('admin-inventory-confirm').style.display='none';
      status(msg);
      toastSafe(msg);
    }catch(e){
      const el=$('admin-inventory-preview');
      if(el) el.textContent='No se pudo actualizar: '+(e.message||e);
      status('Error al actualizar stock y precios: '+(e.message||e));
    }finally{if(btn)btn.disabled=false;}
  }
  async function handleSharedInventoryFile(file) {
    if(!file) return;
    const preview=$('admin-inventory-preview');
    if(preview) preview.textContent='Leyendo y validando '+file.name+'...';
    $('admin-inventory-confirm').style.display='none';
    try{
      const parsed=await parseSharedInventoryFile(file);
      pendingSharedInventory=parsed;
      preview.textContent='Archivo: '+parsed.filename+' · '+parsed.items.length.toLocaleString('es-PY')+' filas válidas · '+parsed.matched.toLocaleString('es-PY')+' coincidencias con el catálogo. Al confirmar, reemplazará los datos compartidos actuales de stock Central, stock CDE y precios M1/M2/M3 para todos los usuarios.';
      $('admin-inventory-confirm').style.display='';
    }catch(e){
      pendingSharedInventory=null;
      preview.textContent='No se pudo validar el Excel: '+(e.message||e);
    }
  }

  function renderAdminPanel(){
    if(!adminContent||!profile||profile.role!=='admin')return;
    adminContent.innerHTML=`
      <div class="admin-heading"><h2>Administración</h2><p>Panel exclusivo de la cuenta administradora</p></div>
      <section class="admin-section"><h3>Resumen de ventas por vendedor</h3>
        <div class="admin-filters"><label>Desde<input type="date" id="admin-date-from"></label><label>Hasta<input type="date" id="admin-date-to"></label>
        <div class="wide"><strong>Vendedores</strong><small style="display:block;margin:4px 0 8px">Marcá todos los vendedores que quieras incluir:</small><div id="admin-seller-filter" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;padding:10px;border:1px solid #bbb;border-radius:8px;background:#fff">${labelOptions.map(v=>'<label style="display:flex;align-items:center;gap:8px;padding:6px;min-height:38px"><input type="checkbox" value="'+escapeAttr(v)+'" style="width:18px;height:18px;flex:0 0 auto"> <span>'+escapeHtml(v)+'</span></label>').join('')}</div><small>Sin marcar ninguno se muestran todos.</small></div></div>
        <div class="admin-metrics"><div class="admin-metric"><span>Pedidos</span><strong id="admin-total-orders">0</strong></div><div class="admin-metric"><span>Unidades vendidas</span><strong id="admin-total-units">0</strong></div><div class="admin-metric"><span>Total vendido</span><strong id="admin-total-sales">Gs. 0</strong></div></div>
        <div class="admin-report-row"><span>Vendedores con ventas</span><strong id="admin-seller-count">0</strong></div><div id="admin-report-list"></div>
        <div class="admin-actions"><button id="admin-export-report">Exportar resumen CSV</button><button class="secondary" id="admin-reset-filters">Limpiar filtros</button></div>
        <p class="admin-note">Comparación por vendedor según el período elegido. Incluye pedidos del Archivo y del Histórico disponibles en la cuenta administradora; las unidades se calculan sumando las cantidades de sus artículos.</p>
      </section>
      <section class="admin-section"><h3>Cambios de contraseña</h3><p class="admin-note">Enviá un enlace seguro de recuperación al correo registrado del vendedor. El cambio se completa desde ese enlace.</p>
        <div class="admin-user-form"><label>Correo del vendedor<input id="admin-recovery-email" type="email" placeholder="vendedor@correo.com"></label></div><div class="admin-actions"><button id="admin-recovery-btn">Enviar enlace de recuperación</button></div>
      </section>
      <section class="admin-section"><h3>Actualizar stock y precios desde Excel</h3>
        <p class="admin-note">Importación compartida para todos los usuarios. El Excel debe incluir Cód.Artículo, CENTRAL, CDE y las columnas de precios 1, 2 y 3 (M1, M2 y M3).</p>
        <input type="file" id="admin-inventory-file" accept=".xlsx,.xls" style="width:100%;margin:6px 0">
        <div class="admin-actions"><button id="admin-inventory-confirm" style="display:none">Confirmar y actualizar para todos</button></div>
        <p id="admin-inventory-preview" class="admin-note" aria-live="polite">Elegí el Excel actualizado para validar sus filas antes de reemplazar los datos compartidos.</p>
      </section>
      <section class="admin-section"><h3>Agregar usuarios vendedores</h3><p class="admin-note">Esta opción requiere configurar una función segura en Supabase. No es seguro incluir la clave de administración en la aplicación pública.</p><p class="admin-note"><strong>Pendiente:</strong> alta de nuevas cuentas y asignación inicial desde este menú. Las cuentas existentes siguen funcionando sin cambios.</p></section>`;
    ['admin-date-from','admin-date-to'].forEach(id=>$(id).addEventListener('change',renderAdminReport));$('admin-seller-filter').addEventListener('change',renderAdminReport);
    $('admin-export-report').addEventListener('click',exportAdminReport);
    $('admin-reset-filters').addEventListener('click',()=>{$('admin-date-from').value='';$('admin-date-to').value='';$('admin-seller-filter').querySelectorAll('input[type=checkbox]').forEach(o=>o.checked=false);renderAdminReport();});
    $('admin-recovery-btn').addEventListener('click',sendSellerRecovery);renderAdminReport();
    $('admin-inventory-file').addEventListener('change',e=>{const file=e.target.files&&e.target.files[0];handleSharedInventoryFile(file);e.target.value='';});
    $('admin-inventory-confirm').addEventListener('click',()=>{if(confirm('¿Reemplazar el stock y los tres niveles de precios compartidos para todos los usuarios?'))confirmSharedInventoryUpload();});
  }

  const recoveryLayer=document.createElement('div');
  recoveryLayer.id='password-recovery-layer';
  recoveryLayer.style.cssText='display:none;position:fixed;inset:0;background:#20302bcc;z-index:10002;align-items:center;justify-content:center;padding:18px';
  recoveryLayer.innerHTML='<form id="password-recovery-form" style="background:#fff;padding:20px;border-radius:12px;width:100%;max-width:380px"><h3 style="margin-top:0">Nueva contraseña</h3><p>Ingresá la nueva contraseña para esta cuenta.</p><input id="password-recovery-new" type="password" minlength="8" required autocomplete="new-password" placeholder="Nueva contraseña" style="width:100%;padding:10px;margin:8px 0;border:1px solid #bbb;border-radius:7px"><input id="password-recovery-confirm" type="password" minlength="8" required autocomplete="new-password" placeholder="Repetir contraseña" style="width:100%;padding:10px;margin:8px 0;border:1px solid #bbb;border-radius:7px"><button type="submit" style="padding:10px 14px;background:#20302B;color:white;border-radius:7px">Guardar contraseña</button><p id="password-recovery-status" aria-live="polite"></p></form>';
  document.body.appendChild(recoveryLayer);
  $('password-recovery-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const a=$('password-recovery-new').value,b=$('password-recovery-confirm').value;
    if(a.length<8){$('password-recovery-status').textContent='Usá al menos 8 caracteres.';return;}
    if(a!==b){$('password-recovery-status').textContent='Las contraseñas no coinciden.';return;}
    const btn=$('password-recovery-form').querySelector('button');btn.disabled=true;
    const {error}=await client.auth.updateUser({password:a});
    btn.disabled=false;
    if(error){$('password-recovery-status').textContent='No se pudo cambiar: '+error.message;return;}
    recoveryLayer.style.display='none';toastSafe('Contraseña actualizada correctamente.');
  });
  client.auth.onAuthStateChange(event=>{
    if(event==='PASSWORD_RECOVERY') recoveryLayer.style.display='flex';
  });
  installSaveHooks();
  function clearUnauthenticatedView() {
    archive=[]; historico=[];
    renderArchive(); renderHistorico(); renderRankings();
  }
  // app.js carga primero el archivo local global. Ocultarlo inmediatamente:
  // solo una sesión autenticada puede volver a cargar su caché correspondiente.
  clearUnauthenticatedView();
  client.auth.getSession().then(async ({data,error})=>{
    if(error){clearUnauthenticatedView();status('No se pudo recuperar la sesión: '+error.message);return;}
    if(data.session){
      status('Recuperando sesión...');
      try{await activateSession(data.session.user);}
      catch(e){await client.auth.signOut();user=null;profile=null;assignments=[];clearUnauthenticatedView();status('Sesión cerrada: '+(e.message||e));}
    } else {
      clearUnauthenticatedView();
      gate.style.display='flex';document.body.classList.add('auth-locked');
      status('Ingresá con tu correo y contraseña registrados.');
    }
  });
})();
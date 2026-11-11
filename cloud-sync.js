/* Supabase sync for Pedidos Ko'eju Rory */
(() => {
  const SUPABASE_URL = 'https://dazdaiutdbvotmzislxr.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_LvTZSQUAAUvBC5MZtdiirQ_rBxkruAC';
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const $ = (id) => document.getElementById(id);
  let user = null, profile = null, assignments = [];
  let syncQueue = Promise.resolve();
  const owners = new Map();
  const labelOptions = Array.from($('vendedor-input').options).map(o => o.value).filter(Boolean);
  const css = document.createElement('style');
  css.textContent = `
    .cloud-bar{padding:8px 12px;background:#34443D;color:#EAE3D3;font:13px sans-serif;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .cloud-bar input{min-width:0;flex:1;padding:8px;border-radius:6px;border:1px solid #aaa}
    .cloud-bar button{padding:8px 10px;border-radius:6px;background:#C99A3C;color:#20302B;font-weight:700}
    .cloud-status{font-size:12px;opacity:.9;flex-basis:100%}
  `;
  document.head.appendChild(css);
  const bar = document.createElement('section');
  bar.className = 'cloud-bar';
  bar.innerHTML = '<input id="cloud-email" type="email" placeholder="Correo de acceso" autocomplete="username"><input id="cloud-password" type="password" placeholder="Contraseña" autocomplete="current-password"><button id="cloud-login">Ingresar</button><button id="cloud-logout" style="display:none">Salir</button><button id="cloud-migrate" style="display:none">Migrar datos de este dispositivo</button><span id="cloud-status" class="cloud-status">Sin conexión a la cuenta</span>';
  document.querySelector('.topbar').appendChild(bar);
  const status = (s) => $('cloud-status').textContent = s;
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
      if(rows.length) status('Nube confirmada: '+rows.length+' pedido(s) de '+source+' guardado(s).');
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
    const {data:p,error:pe}=await client.from('profiles').select('role,seller_label').eq('id',user.id).single();
    if(pe) throw pe;
    profile=p;
    const {data:as,error:ae}=await client.from('seller_assignments').select('seller_label').eq('user_id',user.id);
    if(ae && profile.role!=='admin') throw ae;
    assignments=(as||[]).map(x=>x.seller_label);
    if(profile.role==='seller' && !assignments.length) throw new Error('Esta cuenta no tiene vendedores asignados.');
    if(profile.role!=='admin' && profile.role!=='seller') throw new Error('El perfil no tiene un rol autorizado.');
    // Al cambiar de cuenta, nunca reutilizar en memoria los pedidos de la sesión anterior.
    archive=profile.role==='admin'?readArray(ARCHIVE_KEY):readArray(scopedKey(ARCHIVE_KEY));
    historico=profile.role==='admin'?readArray(HISTORICO_KEY):readArray(scopedKey(HISTORICO_KEY));
    applySellerPermissions();
    await loadCloudOrders();
    $('cloud-email').style.display='none'; $('cloud-password').style.display='none';
    $('cloud-login').style.display='none'; $('cloud-logout').style.display='';
    $('cloud-migrate').style.display=profile.role==='admin'?'':'none';
    status('Conectado: '+(profile.role==='admin'?'Administrador':assignments.join(', '))+' · sincronización activa');
    $('cloud-password').value='';
  }
  async function login() {
    const email=$('cloud-email').value.trim(), password=$('cloud-password').value;
    if(!email || !password){status('Ingresá correo y contraseña.');return;}
    $('cloud-login').disabled=true; status('Verificando acceso...');
    try{
      const {data,error}=await client.auth.signInWithPassword({email,password});
      if(error) throw error;
      await activateSession(data.user);
    }catch(e){
      await client.auth.signOut(); user=null;profile=null;assignments=[];
      status('No se pudo ingresar: '+(e.message||e));
    }finally{$('cloud-login').disabled=false;}
  }
  async function logout() {
    await client.auth.signOut(); user=null;profile=null;assignments=[];owners.clear();
    // Vaciar la vista al cerrar sesión; las cachés y el archivo legado permanecen intactos.
    archive=[]; historico=[];
    renderArchive(); renderHistorico(); renderRankings();
    const select=$('vendedor-input');
    select.innerHTML='<option value="">Vendedor</option>'+labelOptions.map(v=>'<option value="'+String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+v+'</option>').join('');
    $('cloud-email').style.display='';$('cloud-password').style.display='';
    $('cloud-login').style.display='';$('cloud-logout').style.display='none';$('cloud-migrate').style.display='none';
    status('Sesión cerrada. Los datos guardados en este dispositivo permanecen.');
  }
  $('cloud-login').addEventListener('click',login);
  $('cloud-logout').addEventListener('click',logout);
  $('cloud-migrate').addEventListener('click',migrateLocal);
  installSaveHooks();
  client.auth.getSession().then(async ({data,error})=>{
    if(error){status('No se pudo recuperar la sesión: '+error.message);return;}
    if(data.session){
      status('Recuperando sesión...');
      try{await activateSession(data.session.user);}
      catch(e){await client.auth.signOut();user=null;profile=null;assignments=[];status('Sesión cerrada: '+(e.message||e));}
    }
  });
})();
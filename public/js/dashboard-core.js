/* Shared member-3 dashboard utilities. Assumes same-origin cookie-based auth.
 * Coordinate /api/auth/me and the dashboard response contracts with Member 2.
 * No localStorage identities, test data, or client-side authorization claims.
 */
(function () {
  'use strict';
  const root = document.documentElement;
  const role = root.dataset.role;
  const loginPath = root.dataset.loginPath || '/login.html';
  const fmtCurrency = new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0});
  const fmtDate = new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  const $ = (selector, parent=document) => parent.querySelector(selector);

  function setNotice(message, kind='info') {
    const notice = $('#page-notice');
    if (!notice) return;
    notice.className = 'notice' + (kind==='error'?' error':kind==='success'?' success':'');
    notice.textContent = message;
    notice.hidden = false;
  }
  function clearNotice() { const n=$('#page-notice'); if(n) n.hidden=true; }
  function loading(enabled) {
    const refresh = $('#refresh-dashboard');
    if (refresh) {refresh.disabled=enabled; refresh.textContent=enabled?'Refreshing…':'↻ Refresh';}
    const body=$('#recent-bookings');
    if(body && enabled) body.replaceChildren(makeEmptyRow('Loading bookings…'));
    document.querySelectorAll('[data-stat]').forEach(el=>{if(enabled) el.textContent='—';});
  }
  function makeEmptyRow(message) {
    const row=document.createElement('tr');const cell=document.createElement('td');
    cell.colSpan=6;cell.className='empty';cell.textContent=message;row.append(cell);return row;
  }
  function cleanText(value, fallback='—') {return value===null||value===undefined||value===''?fallback:String(value);}
  function statusBadge(status) {
    const element=document.createElement('span');const s=String(status||'unknown').toLowerCase();
    element.className='status '+(['pending','approved','confirmed','active','completed','rejected','cancelled','suspended','blocked'].includes(s)?'status-'+s:'status-neutral');
    element.textContent=cleanText(status,'Unknown');return element;
  }
  function renderRows(rows, kind){
    const body=$('#recent-bookings');if(!body)return;
    body.replaceChildren();
    if(!rows.length){body.append(makeEmptyRow('No recent bookings found.'));return;}
    for(const b of rows){
      const tr=document.createElement('tr');
      const values=[b.booking_id,b.customer_name,b.package_title,b.travel_date,b.total_amount,b.booking_status];
      values.forEach((v,i)=>{const td=document.createElement('td');
        if(i===5)td.append(statusBadge(v));
        else if(i===4)td.textContent=typeof v==='number'&&Number.isFinite(v)?fmtCurrency.format(v):'—';
        else if(i===3){const d=new Date(v);td.textContent=v&&!Number.isNaN(d.valueOf())?fmtDate.format(d):'—';}
        else td.textContent=cleanText(v);
        tr.append(td);
      });body.append(tr);
    }
  }
  async function request(path){
    const response=await fetch(path,{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});
    if(response.status===401){const error=new Error('Please sign in to continue.');error.code=401;throw error;}
    if(response.status===403){const error=new Error('Your account does not have permission to view this dashboard.');error.code=403;throw error;}
    if(!response.ok)throw new Error(`Dashboard API failed (HTTP ${response.status}).`);
    let data;try{data=await response.json();}catch{throw new Error('Dashboard API returned invalid JSON.');}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Unexpected API response.');
    return data;
  }
  async function getSession(){
    const data=await request('/api/auth/me');
    // Contract: {user:{user_id,name,role,status},permissions:[...]}.
    if(!data.user||!data.user.role)throw new Error('Authentication response is missing user/role.');
    const sessionRole=String(data.user.role).toLowerCase().replace(/[\s-]+/g,'_');
    const expected=role==='provider'?['provider','local_tourist']:['admin','super_admin','superadmin'];
    if(!expected.includes(sessionRole)){const error=new Error('This dashboard is not available to your account.');error.code=403;throw error;}
    if(String(data.user.status||'active').toLowerCase()!=='active'){const error=new Error('Your account is not active.');error.code=403;throw error;}
    const account=$('#account-name');if(account)account.textContent=cleanText(data.user.name,'Signed-in user');
    const badge=$('#account-avatar');if(badge)badge.textContent=String(data.user.name||'U').slice(0,1).toUpperCase();
    return data;
  }
  function applyStats(data){
    const stats=data.stats;
    if(!stats||typeof stats!=='object')throw new Error('Stats are missing from the API response.');
    const keys=role==='provider'?['total_packages','total_bookings','pending_bookings','total_revenue']:['pending_packages','total_providers','total_bookings','total_revenue'];
    for(const key of keys){
      if(typeof stats[key]!=='number'||!Number.isFinite(stats[key])||stats[key]<0)throw new Error(`Invalid statistic: ${key}.`);
    }
    document.querySelectorAll('[data-stat]').forEach(el=>{
      const key=el.dataset.stat;el.textContent=key==='total_revenue'?fmtCurrency.format(stats[key]):new Intl.NumberFormat('en-IN').format(stats[key]);
    });
    if(!Array.isArray(data.recent_bookings))throw new Error('recent_bookings must be an array.');
    renderRows(data.recent_bookings.slice(0,8),role);
    const updated=$('#last-updated');if(updated)updated.textContent='Updated just now';
  }
  async function reload(){
    clearNotice();loading(true);
    try{
      await getSession();
      const data=await request(role==='provider'?'/api/provider/dashboard':'/api/admin/dashboard');
      applyStats(data);
    }catch(error){
      renderRows([]);
      const message=error instanceof TypeError?'Cannot reach the server. Check your connection.':error.message;
      setNotice(message,'error');
      if(error.code===401){const link=$('#login-link');if(link){link.href=loginPath;link.hidden=false;}}
    }finally{loading(false);}
  }
  function setup(){
    const toggle=$('#menu-toggle');const overlay=$('#mobile-overlay');
    const close=()=>{document.body.classList.remove('nav-open');toggle?.setAttribute('aria-expanded','false');};
    toggle?.addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');toggle.setAttribute('aria-expanded',String(open));});
    overlay?.addEventListener('click',close);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    $('#refresh-dashboard')?.addEventListener('click',reload);
    document.querySelectorAll('a[data-future]').forEach(el=>{
      el.setAttribute('aria-disabled','true');el.removeAttribute('href');el.setAttribute('title','Available in a later milestone');
    });
    reload();
  }
  document.addEventListener('DOMContentLoaded',setup);
})();

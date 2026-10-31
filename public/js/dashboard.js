/* LocalTrails dashboards: real session-authenticated APIs, no mock data. */
(() => {
  'use strict';
  const role = document.body.dataset.role;
  const provider = role === 'provider';
  const superAdmin = role === 'super_admin';
  const apiRoot = provider ? '/api/provider' : '/api/admin';
  const sections = provider
    ? [['overview','Overview'],['packages','My packages'],['availability','Availability'],['bookings','Bookings'],['reviews','Reviews'],['earnings','Earnings']]
    : [['overview','Overview'],['providers','Provider approvals'],['packages','Package approvals'],['bookings','All bookings'],['customers','Customers'],...(superAdmin?[['admins','Administrators']]:[])];
  let section='overview', cache={}, catalog=null, account=null;
  const app=document.getElementById('app');
  const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=s=>s?new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—';
  const iso=s=>s?(s instanceof Date?s.toISOString().slice(0,10):/^\d{4}-\d{2}-\d{2}/.test(String(s))?String(s).slice(0,10):new Date(s).toISOString().slice(0,10)):'';
  const money=n=>'₹'+Number(n||0).toLocaleString('en-IN');
  const formatStatus=s=>`<span class="status status-${e(s)}">${e(s||'—')}</span>`;
  async function request(path,method='GET',body) {
    const resp=await fetch(path,{method,credentials:'include',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const json=await resp.json().catch(()=>({}));
    if(!resp.ok) throw Error(json.message||`Request failed (${resp.status})`);
    return json.data ?? json;
  }
  const api=(path='',method='GET',body)=>request(apiRoot+path,method,body);
  const cell=s=>`<td>${e(s??'—')}</td>`;
  function table(headers,rows) {return `<div class="panel"><div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${e(x)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="empty">No records found</td></tr>`}</tbody></table></div></div>`;}
  const btn=(name,id,label,cls='')=>`<button type="button" class="table-btn ${cls}" data-task="${e(name)}" data-id="${e(id)}">${e(label)}</button>`;
  const stat=(label,value)=>`<article class="stat-card"><div class="stat-head">${e(label)}</div><strong>${e(value)}</strong></article>`;
  const stats=items=>`<div class="stats-grid">${items.map(([k,v])=>stat(k,v)).join('')}</div>`;
  function flash(message,error=false){const node=document.getElementById('message');node.textContent=message;node.className='message '+(error?'error':'success');}
  function shell(){app.innerHTML=`<div class="layout"><aside class="sidebar" id="sidebar"><a class="brand" href="/"><span class="brand-icon">L</span><span><strong>LocalTrails</strong><small>TOURISM PLATFORM</small></span></a><div class="work-label">${provider?'PROVIDER':superAdmin?'SUPER ADMIN':'ADMIN'} WORKSPACE</div><nav class="nav">${sections.map(([key,label])=>`<a href="#${key}" data-nav="${key}">${e(label)}</a>`).join('')}</nav><div class="sidebar-bottom"><a href="/">Website</a><button class="btn" id="sign-out">Sign out</button></div></aside><div class="main-shell"><header class="topbar"><button class="menu-toggle" id="toggle-menu">☰</button><span class="breadcrumb">LocalTrails / <strong id="crumb">Overview</strong></span><div class="topbar-right"><span class="account-name">${e(account.name)}</span><span class="avatar">${e(account.name.slice(0,2).toUpperCase())}</span></div></header><main class="content"><div class="page-heading"><div><span class="eyebrow">OPERATIONS</span><h1 id="heading">Overview</h1><p id="summary">Current information from LocalTrails</p></div><div id="page-action"></div></div><p id="message" class="message" role="status"></p><section id="body"><div class="loading">Loading…</div></section></main></div></div><dialog id="editor" class="lt-dialog"><form id="editor-form" method="dialog"><header><h2 id="editor-title"></h2></header><div id="editor-fields"></div><footer><button class="btn" type="button" id="cancel-dialog">Cancel</button><button class="btn primary" type="submit">Save</button></footer></form></dialog>`;
    document.getElementById('sign-out').onclick=async()=>{try{await request('/api/auth/logout','POST');location.href='/login.html';}catch(err){flash(err.message,true);}};
    document.getElementById('toggle-menu').onclick=()=>document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('cancel-dialog').onclick=()=>document.getElementById('editor').close();
  }
  function setAction(label,fn){const parent=document.getElementById('page-action');parent.replaceChildren();if(label){const b=document.createElement('button');b.className='btn primary';b.textContent=label;b.onclick=fn;parent.append(b);}}
  function showError(err){document.getElementById('body').innerHTML=`<div class="error-panel"><h2>Unable to load ${e(section)}</h2><p>${e(err.message)}</p><button class="btn" id="retry">Retry</button></div>`;document.getElementById('retry').onclick=load;}
  async function load(){section=location.hash.slice(1);if(!sections.some(([k])=>k===section))section='overview';
    document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===section));
    const label=sections.find(([k])=>k===section)[1];document.getElementById('heading').textContent=label;document.getElementById('crumb').textContent=label;document.getElementById('body').innerHTML='<div class="loading">Loading live records…</div>';document.getElementById('message').textContent='';setAction();
    try{await render();}catch(err){showError(err);}}
  async function render(){let rows,body=document.getElementById('body');
    if(section==='overview'){
      const o=await api(provider?'/dashboard':'/overview');
      body.innerHTML=provider?stats([['Packages',o.total_packages],['Active packages',o.active_packages],['Bookings',o.total_bookings],['Booking value',money(o.revenue)]]):stats([['Providers',o.providers],['Pending providers',o.pending_providers],['Packages',o.packages],['Pending packages',o.pending_packages],['Bookings',o.bookings],['Customers',o.customers],['Booking value',money(o.booked_value)]]);
      body.innerHTML+='<div class="panel padded"><h2>Manage operations</h2><p class="muted">Select a section on the left to view real records and available actions.</p></div>';return;
    }
    if(section==='earnings'){const o=await api('/earnings');body.innerHTML=stats([['Paid bookings',o.paid_bookings],['Total earnings',money(o.total_earnings)]]);return;}
    if(section==='packages'){
      rows=await api('/packages');cache.packages=rows;
      body.innerHTML=table(provider?['Package','Destination','Price','Capacity','Status','Actions']:['Package','Provider','Price','Status','Actions'],rows.map(p=>`<tr>${cell(p.title)}${cell(provider?p.destination_name:p.provider)}${cell(money(p.price))}${provider?cell(p.capacity):''}<td>${formatStatus(p.status)}</td><td>${provider?btn('package-edit',p.package_id,'Edit')+btn('package-delete',p.package_id,'Delete','danger'):p.status==='pending'?btn('package-status',p.id,'Approve')+btn('package-reject',p.id,'Reject','danger'):btn('package-status',p.id,'Activate')}</td></tr>`));
      if(provider)setAction('+ Add package',()=>packageEditor());return;
    }
    if(section==='availability'){
      rows=await api('/availability');cache.availability=rows; cache.packages=await api('/packages');
      body.innerHTML=table(['Package','Date','Capacity','Booked','Status','Actions'],rows.map(a=>`<tr>${cell(a.title)}${cell(date(a.available_date))}${cell(a.total_capacity)}${cell(a.booked_seats)}<td>${formatStatus(a.status)}</td><td>${btn('availability-edit',a.availability_id,'Edit')}</td></tr>`));
      setAction('+ Add departure',()=>availabilityEditor());return;
    }
    if(section==='bookings'){
      rows=await api('/bookings');cache.bookings=rows;
      body.innerHTML=table(['Booking','Package','Customer','Guests','Total','Status',...(provider?['Actions']:[])],rows.map(b=>`<tr>${cell('#'+(b.booking_id??b.id))}${cell(b.title??b.package_title)}${cell(b.customer_name??b.customer)}${cell(b.number_of_people)}${cell(money(b.total_amount))}<td>${formatStatus(b.booking_status??b.status)}</td>${provider?`<td>${btn('booking-update',b.booking_id,'Update')}</td>`:''}</tr>`));return;
    }
    if(section==='reviews'){
      rows=await api('/reviews');body.innerHTML=table(['Package','Customer','Rating','Comment','Date'],rows.map(r=>`<tr>${cell(r.title)}${cell(r.customer_name)}${cell('★ '+r.rating)}${cell(r.comment)}${cell(date(r.review_date))}</tr>`));return;
    }
    if(section==='providers'||section==='customers'||section==='admins'){
      rows=await api('/'+section);cache[section]=rows;
      body.innerHTML=table(['Name','Email','Joined','Status',...(section==='customers'?[]:['Actions'])],rows.map(u=>`<tr>${cell(u.name)}${cell(u.email)}${cell(date(u.created_at))}<td>${formatStatus(u.status)}</td>${section==='customers'?'':`<td>${btn(section==='admins'?'admin-status':'provider-status',u.id,u.status==='active'?'Block':'Activate')}${u.status==='pending'?btn('provider-reject',u.id,'Reject','danger'):''}</td>`}</tr>`));return;
    }
  }
  const input=(label,name,value='',type='text',extra='')=>`<label class="form-field"><span>${e(label)}</span><input name="${e(name)}" type="${type}" value="${e(value)}" ${extra}></label>`;
  const select=(label,name,options,value)=>`<label class="form-field"><span>${e(label)}</span><select name="${e(name)}" required>${options.map(([v,t])=>`<option value="${e(v)}" ${String(v)===String(value)?'selected':''}>${e(t)}</option>`).join('')}</select></label>`;
  const text=(label,name,value='')=>`<label class="form-field full"><span>${e(label)}</span><textarea name="${e(name)}">${e(value)}</textarea></label>`;
  async function catalogOptions(){if(!catalog)catalog=await request('/api/catalog/options');return catalog;}
  async function editor(title,fields,save){document.getElementById('editor-title').textContent=title;document.getElementById('editor-fields').innerHTML=`<div class="form-grid">${fields}</div>`;let form=document.getElementById('editor-form');form.onsubmit=async ev=>{ev.preventDefault();const b=form.querySelector('[type=submit]');b.disabled=true;try{await save(Object.fromEntries(new FormData(form)));document.getElementById('editor').close();flash('Saved successfully');await load();}catch(err){alert(err.message);}finally{b.disabled=false;}};document.getElementById('editor').showModal();}
  async function packageEditor(p){try{const opts=await catalogOptions();if(!opts.destinations.length||!opts.categories.length)throw Error('Add destinations and categories to the database before creating packages.');
    const f=input('Title','title',p?.title,'text','required')+select('Destination','destination_id',opts.destinations.map(x=>[x.id,x.name]),p?.destination_id)+select('Category','category_id',opts.categories.map(x=>[x.id,x.name]),p?.category_id)+input('Duration (days)','duration',p?.duration||1,'number','min="1" required')+input('Price (₹)','price',p?.price||'','number','min="1" step="0.01" required')+input('Capacity','capacity',p?.capacity||1,'number','min="1" required')+input('Available from','available_from',iso(p?.available_from),'date')+input('Image URL','image_url',p?.image_url||'','url')+text('Description','description',p?.description||'');
    await editor(p?'Edit package':'Create package',f,async data=>{for(let key of ['destination_id','category_id','duration','price','capacity'])data[key]=Number(data[key]);await api('/packages'+(p?'/'+p.package_id:''),p?'PUT':'POST',data);});
  }catch(err){flash(err.message,true);}}
  async function availabilityEditor(a){try{const pkgs=cache.packages??await api('/packages');if(!pkgs.length)throw Error('Create a package first.');
    const f=select('Package','package_id',pkgs.map(p=>[p.package_id,p.title]),a?.package_id)+input('Departure date','available_date',iso(a?.available_date),'date','required')+input('Total capacity','total_capacity',a?.total_capacity||1,'number','min="1" required')+(a?select('Status','status',[['available','Available'],['closed','Closed']],a.status):'');
    await editor(a?'Edit departure':'Add departure',f,async d=>{d.package_id=Number(d.package_id);d.total_capacity=Number(d.total_capacity);await api('/availability'+(a?'/'+a.availability_id:''),a?'PUT':'POST',d);});
  }catch(err){flash(err.message,true);}}
  app.addEventListener('click',async ev=>{
    const b=ev.target.closest('[data-task]');if(!b)return;
    const task=b.dataset.task,id=Number(b.dataset.id);try{
      if(task==='package-edit')return packageEditor(cache.packages.find(x=>x.package_id===id));
      if(task==='availability-edit')return availabilityEditor(cache.availability.find(x=>x.availability_id===id));
      if(task==='package-delete'){if(!confirm('Delete this package? This cannot be undone.'))return;await api('/packages/'+id,'DELETE');}
      if(task==='booking-update'){const booking=cache.bookings.find(x=>x.booking_id===id);await editor('Update booking',select('Status','booking_status',[['confirmed','Confirmed'],['completed','Completed'],['cancelled','Cancelled']],booking.booking_status),async d=>api('/bookings/'+id,'PATCH',d));return;}
      if(task==='provider-status'||task==='provider-reject'||task==='admin-status'){
        const key=task==='admin-status'?'admins':'providers',u=cache[key].find(x=>x.id===id);
        const status=task==='provider-reject'?'rejected':u.status==='active'?'blocked':'active';if(!confirm(`Set ${u.name} to ${status}?`))return;
        await api('/'+key+'/'+id,'PATCH',{status});
      }
      if(task==='package-status'||task==='package-reject'){if(!confirm('Change package approval status?'))return;await api('/packages/'+id,'PATCH',{status:task==='package-reject'?'rejected':'active'});}
      await load();
    }catch(err){flash(err.message,true);}
  });
  window.addEventListener('hashchange',load);
  (async()=>{try{const session=await request('/api/auth/me');account=session.user;if(!account||account.role!==role)throw Error('This dashboard requires a '+role.replace('_',' ')+' account.');shell();load();}catch(err){app.innerHTML=`<main class="access-gate"><h1>Sign in required</h1><p>${e(err.message)}</p><a class="btn primary" href="/login.html">Go to login</a></main>`;}})();
})();

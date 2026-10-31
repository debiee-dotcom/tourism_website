/* Single backend adapter: modify endpoints here to match your team API. */
(function(){
const cfg=window.LocalTrailsConfig;
const resources={packages:'/packages',bookings:'/bookings',providers:'/providers',customers:'/customers',availability:'/availability',reviews:'/reviews'};
async function request(path,opts={}){
 const token=sessionStorage.getItem(cfg.AUTH_TOKEN_KEY)||localStorage.getItem(cfg.AUTH_TOKEN_KEY);
 const response=await fetch(cfg.PUBLIC_API_BASE+path,{
  method:opts.method||'GET',headers:{'Accept':'application/json',...(opts.body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{}),...opts.headers},
  ...(opts.body!==undefined?{body:JSON.stringify(opts.body)}:{})
 });
 if(response.status===204)return null;
 let body;try{body=await response.json()}catch{body=null}
 if(!response.ok)throw Error(body?.message||body?.error||`Request failed (${response.status})`);
 return body;
}
function unwrap(result){return Array.isArray(result)?result:(result?.data??result?.items??result?.results??result)}
const demo=window.LocalTrailsDemo;
const api={
 async list(resource,params={}){
  if(cfg.DEMO_MODE)return demo.list(resource,params);
  const qs=new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!==''));
  const result=await request(resources[resource]+(qs.size?'?'+qs:''));return unwrap(result);
 },
 async one(resource,id){return cfg.DEMO_MODE?demo.one(resource,id):unwrap(await request(resources[resource]+'/'+encodeURIComponent(id)))},
 async create(resource,data){return cfg.DEMO_MODE?demo.create(resource,data):unwrap(await request(resources[resource],{method:'POST',body:data}))},
 async update(resource,id,data){return cfg.DEMO_MODE?demo.update(resource,id,data):unwrap(await request(resources[resource]+'/'+encodeURIComponent(id),{method:'PATCH',body:data}))},
 async remove(resource,id){return cfg.DEMO_MODE?demo.remove(resource,id):request(resources[resource]+'/'+encodeURIComponent(id),{method:'DELETE'})},
 async getSettings(){return cfg.DEMO_MODE?demo.settings():unwrap(await request('/settings'))},
 async updateSettings(data){return cfg.DEMO_MODE?demo.saveSettings(data):unwrap(await request('/settings',{method:'PATCH',body:data}))},
 async login(credentials){return request('/auth/login',{method:'POST',body:credentials})}
};
window.LocalTrailsAPI=api;
})();

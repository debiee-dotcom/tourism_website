'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../public');
for(const role of ['provider','admin']){
 const h=fs.readFileSync(path.join(root,role,'dashboard.html'),'utf8');
 for(const token of ['data-role="'+role+'"','dashboard-core.js','dashboard.css','id="recent-bookings"','data-stat="total_revenue"','id="page-notice"']) assert.ok(h.includes(token),`${role}: missing ${token}`);
 for(const match of h.matchAll(/<script\s+src="([^"]+)"|<link\s+rel="stylesheet"\s+href="([^"]+)"/g)) assert.ok(fs.existsSync(path.resolve(root,role,match[1]||match[2])),'broken asset link');
}
const core=fs.readFileSync(path.join(root,'js/dashboard-core.js'),'utf8');
assert.ok(core.includes("'/api/auth/me'"));
assert.ok(!/localStorage\.(getItem|setItem)/.test(core));
console.log('PASS: 2 dashboard pages, shared assets and API integration references.');
console.log('NOTE: Backend authentication, authorization and API integration require live server testing.');

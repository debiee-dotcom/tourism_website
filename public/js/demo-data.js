(function(){
const seed={
 packages:[
 {id:101,title:'Ooty Hills Weekend',destination:'Ooty, Tamil Nadu',category:'Nature',price:4999,duration:'2D / 1N',capacity:16,status:'Active',providerId:1,provider:'Bluebird Travels',description:'A scenic escape to tea gardens and viewpoints.',image:''},
 {id:102,title:'Pondicherry Heritage Walk',destination:'Puducherry',category:'Culture',price:2499,duration:'1 Day',capacity:20,status:'Active',providerId:1,provider:'Bluebird Travels',description:'Explore French Quarter streets and seaside landmarks.',image:''},
 {id:103,title:'Meghalaya Falls Trail',destination:'Shillong, Meghalaya',category:'Adventure',price:11999,duration:'4D / 3N',capacity:12,status:'Draft',providerId:1,provider:'Bluebird Travels',description:'Waterfalls, caves, and local culture.',image:''},
 {id:104,title:'Jaipur Fort Discovery',destination:'Jaipur, Rajasthan',category:'Culture',price:6999,duration:'3D / 2N',capacity:18,status:'Active',providerId:2,provider:'Royal Routes',description:'Explore iconic forts and markets.',image:''},
 {id:105,title:'Coorg Coffee Escape',destination:'Madikeri, Karnataka',category:'Nature',price:5799,duration:'2D / 1N',capacity:14,status:'Pending',providerId:3,provider:'Green Trails',description:'Coffee plantations and lush green trails.',image:''}
 ],
 bookings:[
 {id:5001,customer:'Aarav Kumar',customerId:31,packageId:101,package:'Ooty Hills Weekend',providerId:1,date:'2026-11-08',guests:2,total:9998,status:'Confirmed',payment:'Paid'},
 {id:5002,customer:'Priya Nair',customerId:32,packageId:102,package:'Pondicherry Heritage Walk',providerId:1,date:'2026-11-12',guests:3,total:7497,status:'Pending',payment:'Pending'},
 {id:5003,customer:'Rohan Shah',customerId:33,packageId:104,package:'Jaipur Fort Discovery',providerId:2,date:'2026-11-18',guests:2,total:13998,status:'Confirmed',payment:'Paid'},
 {id:5004,customer:'Nisha Das',customerId:34,packageId:101,package:'Ooty Hills Weekend',providerId:1,date:'2026-11-23',guests:1,total:4999,status:'Cancelled',payment:'Refunded'},
 {id:5005,customer:'Meera Iyer',customerId:35,packageId:105,package:'Coorg Coffee Escape',providerId:3,date:'2026-12-02',guests:2,total:11598,status:'Pending',payment:'Pending'}
 ],
 providers:[
 {id:1,name:'Bluebird Travels',email:'hello@bluebird.example',location:'Chennai',phone:'9876500011',status:'Approved',joined:'2026-08-04'},
 {id:2,name:'Royal Routes',email:'team@royalroutes.example',location:'Jaipur',phone:'9876500022',status:'Approved',joined:'2026-09-12'},
 {id:3,name:'Green Trails',email:'trips@greentrails.example',location:'Coorg',phone:'9876500033',status:'Pending',joined:'2026-10-15'}
 ],
 customers:[
 {id:31,name:'Aarav Kumar',email:'aarav@example.com',joined:'2026-09-04',status:'Active'},
 {id:32,name:'Priya Nair',email:'priya@example.com',joined:'2026-09-17',status:'Active'},
 {id:33,name:'Rohan Shah',email:'rohan@example.com',joined:'2026-10-02',status:'Active'},
 {id:34,name:'Nisha Das',email:'nisha@example.com',joined:'2026-10-10',status:'Inactive'},
 {id:35,name:'Meera Iyer',email:'meera@example.com',joined:'2026-10-20',status:'Active'}
 ],
 availability:[
 {id:701,packageId:101,date:'2026-11-08',slots:16,booked:2,status:'Open'},
 {id:702,packageId:102,date:'2026-11-12',slots:20,booked:3,status:'Open'},
 {id:703,packageId:103,date:'2026-11-20',slots:12,booked:0,status:'Closed'}
 ],
 reviews:[
 {id:801,packageId:101,customer:'Aarav Kumar',rating:5,comment:'Beautiful viewpoints and smooth coordination.',date:'2026-10-20',reply:''},
 {id:802,packageId:102,customer:'Priya Nair',rating:4,comment:'Great guide and interesting history.',date:'2026-10-22',reply:'Thanks for joining us!'},
 {id:803,packageId:104,customer:'Rohan Shah',rating:5,comment:'Wonderful fort tour.',date:'2026-10-19',reply:''}
 ],
 settings:{siteName:'LocalTrails',supportEmail:'support@localtrails.example',bookingFee:5,maintenance:false}
};
const key='localtrails_dashboard_demo_v1';
let db;try {db=JSON.parse(localStorage.getItem(key))}catch{};
if(!db||!Array.isArray(db.packages)){db=structuredClone(seed);localStorage.setItem(key,JSON.stringify(db))}
const clone=v=>structuredClone(v), save=()=>localStorage.setItem(key,JSON.stringify(db));
window.LocalTrailsDemo={
 reset(){db=structuredClone(seed);save()},
 async list(name,params={}){let records=clone(db[name]||[]);if(params.providerId)records=records.filter(x=>Number(x.providerId)===Number(params.providerId));return records},
 async one(name,id){const x=(db[name]||[]).find(x=>String(x.id)===String(id));if(!x)throw Error('Record not found');return clone(x)},
 async create(name,data){const id=Math.max(100,...(db[name]||[]).map(x=>Number(x.id)||0))+1;const item={...clone(data),id};db[name].unshift(item);save();return clone(item)},
 async update(name,id,data){let i=db[name].findIndex(x=>String(x.id)===String(id));if(i<0)throw Error('Record not found');db[name][i]={...db[name][i],...clone(data),id:db[name][i].id};save();return clone(db[name][i])},
 async remove(name,id){db[name]=db[name].filter(x=>String(x.id)!==String(id));save();return {success:true}},
 async settings(){return clone(db.settings)},
 async saveSettings(data){db.settings={...db.settings,...clone(data)};save();return clone(db.settings)}
};
})();

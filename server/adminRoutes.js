// Role-restricted administration routes. All changes use the authenticated session.
module.exports = function createAdminRoutes({db, sessions, getRequestBody}) {
  const send = (res,status,body) => { res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body)); };
  return async (req,res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/admin/')) return;
    const requestedRole = url.searchParams.get('role') || 'admin';
    if (!['admin','super_admin'].includes(requestedRole)) return send(res,400,{message:'Invalid admin role'});
    const cookieName = requestedRole === 'super_admin' ? 'superAdminSessionId' : 'adminSessionId';
    const cookie = (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='));
    const session = cookie && sessions.get(cookie.slice(cookieName.length+1));
    if (!session || session.expiresAt <= Date.now()) return send(res,401,{message:'Please log in'});
    if (session.role !== requestedRole) return send(res,403,{message:'Admin access required'});
    try {
      const [roles] = await db.query('SELECT role, status FROM users WHERE user_id = ?', [session.userId]);
      if (!roles.length || roles[0].role!==session.role || roles[0].status!=='active') return send(res,403,{message:'Admin account is not active'});
      const p=url.pathname;
      if (req.method==='GET' && p==='/api/admin/overview') {
        const [[u]]=await db.query("SELECT COUNT(*) AS customers FROM users WHERE role='customer'");
        const [[v]]=await db.query("SELECT COUNT(*) AS providers, COALESCE(SUM(status='pending'),0) AS pending_providers FROM users WHERE role='provider'");
        const [[pkg]]=await db.query("SELECT COUNT(*) AS packages, COALESCE(SUM(status='pending'),0) AS pending_packages FROM packages");
        const [[b]]=await db.query('SELECT COUNT(*) AS bookings, COALESCE(SUM(total_amount),0) AS booked_value FROM bookings');
        return send(res,200,{data:{...u,...v,...pkg,...b}});
      }
      if (req.method==='GET' && p==='/api/admin/providers') {
        const [rows]=await db.query("SELECT user_id AS id,name,email,mobile,status,created_at FROM users WHERE role='provider' ORDER BY created_at DESC");
        return send(res,200,{data:rows});
      }
      if (req.method==='PATCH' && /^\/api\/admin\/providers\/\d+$/.test(p)) {
        const id=Number(p.split('/').pop()), {status}=await getRequestBody(req);
        if (!['active','pending','rejected','blocked'].includes(status)) return send(res,400,{message:'Invalid provider status'});
        const [result]=await db.query("UPDATE users SET status=? WHERE user_id=? AND role='provider'",[status,id]);
        return send(res,result.affectedRows?200:404,{message:result.affectedRows?'Provider updated':'Provider not found'});
      }
      if (req.method==='GET' && p==='/api/admin/packages') {
        const [rows]=await db.query('SELECT p.package_id AS id,p.title,p.price,p.capacity,p.status,p.duration,d.name AS destination,u.name AS provider FROM packages p LEFT JOIN destinations d ON d.destination_id=p.destination_id LEFT JOIN users u ON u.user_id=p.provider_id ORDER BY p.created_at DESC');
        return send(res,200,{data:rows});
      }
      if (req.method==='PATCH' && /^\/api\/admin\/packages\/\d+$/.test(p)) {
        const id=Number(p.split('/').pop()), {status}=await getRequestBody(req);
        if (!['active','pending','rejected','inactive'].includes(status)) return send(res,400,{message:'Invalid package status'});
        const [result]=await db.query('UPDATE packages SET status=? WHERE package_id=?',[status,id]);
        return send(res,result.affectedRows?200:404,{message:result.affectedRows?'Package updated':'Package not found'});
      }
      if (req.method==='GET' && p==='/api/admin/bookings') {
        const [rows]=await db.query('SELECT b.booking_id AS id,b.booking_status AS status,b.total_amount,b.number_of_people,b.booking_date,p.title AS package_title,u.name AS customer FROM bookings b JOIN packages p ON p.package_id=b.package_id JOIN users u ON u.user_id=b.customer_id ORDER BY b.booking_date DESC');
        return send(res,200,{data:rows});
      }
      if (req.method==='GET' && p==='/api/admin/customers') {
        const [rows]=await db.query("SELECT user_id AS id,name,email,mobile,status,created_at FROM users WHERE role='customer' ORDER BY created_at DESC");
        return send(res,200,{data:rows});
      }
      if (req.method==='GET' && p==='/api/admin/admins' && session.role==='super_admin') {
        const [rows]=await db.query("SELECT user_id AS id,name,email,status,created_at FROM users WHERE role='admin' ORDER BY created_at DESC");
        return send(res,200,{data:rows});
      }
      if (req.method==='PATCH' && /^\/api\/admin\/admins\/\d+$/.test(p) && session.role==='super_admin') {
        const id=Number(p.split('/').pop()), {status}=await getRequestBody(req);
        if (!['active','blocked'].includes(status)) return send(res,400,{message:'Invalid status'});
        const [result]=await db.query("UPDATE users SET status=? WHERE user_id=? AND role='admin'",[status,id]);
        return send(res,result.affectedRows?200:404,{message:result.affectedRows?'Admin updated':'Admin not found'});
      }
      return send(res,404,{message:'Admin endpoint unavailable'});
    } catch(err) {console.error('Admin API error:',err);return send(res,500,{message:'Admin operation failed; check database schema and server logs'});}
  };
};

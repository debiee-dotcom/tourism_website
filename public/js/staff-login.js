(() => {
  'use strict';
  const role = document.body.dataset.role;
  const form = document.getElementById('staffLogin');
  const message = document.getElementById('loginFeedback');
  const submit = document.getElementById('submitLogin');
  const pass = document.getElementById('password');
  const email = document.getElementById('email');
  const dashboard = role === 'admin' ? '/admin/dashboard.html' : '/superadmin/dashboard.html';
  document.getElementById('showPassword').addEventListener('click', (event) => {
    const visible = pass.type === 'text'; pass.type = visible ? 'password' : 'text';
    event.currentTarget.textContent = visible ? 'Show' : 'Hide';
    event.currentTarget.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); message.textContent = ''; message.className = 'feedback';
    if (!email.validity.valid || !pass.value) {message.textContent = 'Please enter a valid email and password.'; return;}
    submit.disabled = true; submit.textContent = 'Signing in…';
    try {
      const response = await fetch('/api/auth/login', {
        method:'POST', credentials:'include', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email:email.value.trim(), password:pass.value, requestedRole:role})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(data.message || 'Unable to sign in. Please try again.');
      if (data.user?.role !== role) throw Error('This account is not authorized for this portal.');
      window.location.assign(dashboard);
    } catch (error) {message.textContent = error.message; message.classList.add('visible');}
    finally {submit.disabled = false; submit.innerHTML = 'Sign in <span aria-hidden="true">→</span>';}
  });
})();

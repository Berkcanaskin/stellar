(function(){
  const API_BASE = (window && window.API_BASE) ? window.API_BASE.replace(/\/$/, '') : '';
  function el(id){return document.getElementById(id)}
  function showFeedback(msg, cls){ const fb = el('feedback'); fb.className = cls||''; fb.textContent = msg; }
  async function postJSON(url, body){
    const full = url.startsWith('/') ? (API_BASE + url) : url;
    const res = await fetch(full, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const data = await res.json().catch(()=>({ error: 'Invalid JSON response' }));
    return { ok: res.ok, status: res.status, data };
  }
  el('btn-login').addEventListener('click', async function(){
    const username = el('username').value.trim();
    const password = el('password').value;
    if(!username || !password){ showFeedback('Kullanıcı adı ve şifre gerekli', 'error'); return; }
    showFeedback('Giriş yapılıyor...', '');
    try{
      // Normal user login
      const r = await postJSON('/api/users/login', { username, password });
      if(r.ok){ showFeedback('Giriş başarılı — ana sayfaya yönlendiriliyorsunuz', 'success');
        setTimeout(()=>{ window.location.href = '/'; }, 600);
      } else {
        const err = r.data && (r.data.error || r.data.message) || JSON.stringify(r.data);
        showFeedback('Hata: ' + err, 'error');
      }
    }catch(e){ showFeedback('Ağ hatası: ' + e.message, 'error'); }
  });

  // admin button now opens a modal to collect admin credentials separately
  const adminBtn = document.getElementById('btn-admin-login');
  const adminModal = document.getElementById('admin-modal');
  const adminUserInput = document.getElementById('admin-modal-username');
  const adminPassInput = document.getElementById('admin-modal-password');
  const adminCancel = document.getElementById('admin-modal-cancel');
  const adminSubmit = document.getElementById('admin-modal-submit');
  const adminFeedback = document.getElementById('admin-modal-feedback');

  // When Admin button is clicked, go directly to admin page (no modal)
  adminBtn?.addEventListener('click', function(){
    window.location.href = '/admin.html';
  });

  adminCancel?.addEventListener('click', function(){ if(adminModal) adminModal.style.display = 'none'; });

  adminSubmit?.addEventListener('click', async function(){
    const auser = adminUserInput.value.trim();
    const apass = adminPassInput.value;
    if(!auser || !apass){ adminFeedback.textContent = 'Admin kullanıcı adı ve şifre gerekli'; return; }
    adminFeedback.textContent = 'Admin girişi deneniyor...';
    try{
      const a = await postJSON('/api/admin/login', { user: auser, pass: apass });
      if(a.ok){ adminFeedback.textContent = 'Admin girişi başarılı, yönlendiriliyorsunuz...';
        setTimeout(()=>{ window.location.href = '/admin.html'; }, 300);
      } else {
        const err = a.data && (a.data.error||a.data.message) || JSON.stringify(a.data);
        adminFeedback.textContent = 'Giriş başarısız: ' + err;
      }
    }catch(e){ adminFeedback.textContent = 'Ağ hatası: ' + (e && e.message ? e.message : String(e)); }
  });
})();

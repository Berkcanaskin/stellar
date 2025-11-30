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

  el('btn-register').addEventListener('click', async function(){
    const username = el('username').value.trim();
    const password = el('password').value;
    const password2 = el('password2').value;
    if(!username){ showFeedback('Kullanıcı adı boş olamaz', 'error'); return; }
    if(password.length < 6){ showFeedback('Şifre en az 6 karakter olmalı', 'error'); return; }
    if(password !== password2){ showFeedback('Şifreler eşleşmiyor', 'error'); return; }
    showFeedback('Kayıt yapılıyor...', '');
    try{
      const r = await postJSON('/api/users/register', { username, password, password2 });
      if(r.ok){ showFeedback('Kayıt başarıyla oluşturuldu — ana sayfaya yönlendiriliyorsunuz', 'success');
        setTimeout(()=>{ window.location.href = '/'; }, 900);
      } else {
        const err = r.data && (r.data.error || r.data.message) || JSON.stringify(r.data);
        showFeedback('Hata: ' + err, 'error');
      }
    }catch(e){ showFeedback('Ağ hatası: ' + e.message, 'error'); }
  });
})();

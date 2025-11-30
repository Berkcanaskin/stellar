(function(){
  const API_BASE = (window && window.API_BASE) ? window.API_BASE.replace(/\/$/, '') : '';
  function el(id){return document.getElementById(id)}
  function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function fetchJSON(url){
    const res = await fetch((url.startsWith('/')? API_BASE+url: url), { credentials: 'include' });
    if(!res.ok) throw await res.json().catch(()=>({ error: 'bad' }));
    return res.json();
  }

  async function init(){
    try{
      const me = await fetchJSON('/api/users/me');
      el('username').textContent = me.username || '—';
      // show masked password placeholder (we never expose real password)
      el('password').textContent = '••••••••';
      if(me.createdAt){
        try{
          const d = new Date(me.createdAt);
          el('createdAt').textContent = d.toLocaleString();
        }catch(e){ el('createdAt').textContent = me.createdAt }
      } else {
        el('createdAt').textContent = '—';
      }
      // load wallets
      await loadWallets();
    }catch(err){
      // not logged in -> redirect to login
      window.location.href = '/login.html';
    }
  }

  async function loadWallets(){
    const listEl = el('wallet-list');
    listEl.innerHTML = 'Loading...';
    try{
      const res = await fetchJSON('/api/users/wallets');
      if(!res.wallets || res.wallets.length===0){ listEl.innerHTML = '<div class="muted">No wallets yet</div>'; return; }
      listEl.innerHTML = '';
      // also populate payment sender select if present
      const paySel = document.getElementById('user-pay-wallet');
      if(paySel){ paySel.innerHTML = '<option value="">(Select)</option>'; }
      res.wallets.forEach(w => {
        const row = document.createElement('div');
        row.style.padding = '.5rem';
        row.style.borderBottom = '1px solid rgba(255,255,255,0.02)';
        row.className = 'wallet-row';
        row.style.cursor = 'pointer';
        // show name (if present) and a shortened public key
        const shortPk = (w.publicKey||'').slice(0,6) + '…' + (w.publicKey||'').slice(-4);
        const displayName = (w.name && w.name.trim()) ? escapeHtml(w.name) : null;
        // Show the user-provided name prominently; show the short public key below as muted text to reduce clutter
        row.innerHTML = `<div style="display:flex;justify-content:space-between;gap:1rem;align-items:center">
          <div style="flex:1">
            <div style="font-weight:700;font-size:1rem">${displayName ? displayName : escapeHtml(shortPk)}</div>
            <div class="small muted">${escapeHtml(shortPk)} — Balance: ${typeof w.balance !== 'undefined' ? w.balance : '0'} XLM</div>
          </div>
          <div style="display:flex;gap:.5rem">
            <button class="secondary remove-btn" data-pk="${w.publicKey}">Remove</button>
          </div>
        </div>`;
        listEl.appendChild(row);
        // wire up the remove button for this row
        const removeBtn = row.querySelector('.remove-btn');
        if(removeBtn){
          removeBtn.addEventListener('click', async function(ev){
            ev.stopPropagation();
            const pk = this.dataset.pk;
            if(!confirm('Bu cüzdanı kaldırmak istediğinizden emin misiniz?')) return;
            try{
              const r = await fetch((API_BASE||'') + '/api/users/wallets', { method: 'DELETE', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ publicKey: pk }) });
              const j = await r.json().catch(()=>null);
              if(!r.ok){ const msg = j && (j.error||j.message) ? (j.error||j.message) : ('Sunucu hatası ' + r.status); alert('Hata: ' + msg); return; }
              await loadWallets();
            }catch(err){ alert('Hata: ' + (err && err.error ? err.error : JSON.stringify(err))); }
          });
        }
        // navigate to wallet detail when clicking the row (but not the remove button)
        row.addEventListener('click', (ev) => {
          if(ev.target && ev.target.closest('.remove-btn')) return; // ignore clicks on remove
          window.location.href = '/wallet.html?pk=' + encodeURIComponent(w.publicKey);
        });
        // add to pay select
        if(paySel){ const opt = document.createElement('option'); opt.value = w.publicKey; opt.textContent = w.name ? `${w.name} (${(w.publicKey||'').slice(0,8)}…${(w.publicKey||'').slice(-6)})` : `${(w.publicKey||'').slice(0,8)}…${(w.publicKey||'').slice(-6)}`; paySel.appendChild(opt); }
      });
      // legacy global remove handler kept for compatibility (not used by current bindings)
      window.__removeWallet = async function(e){
        const btn = e.currentTarget || e.target;
        const pk = btn && btn.dataset && btn.dataset.pk;
        if(!pk) return;
        if(!confirm('Bu cüzdanı kaldırmak istediğinizden emin misiniz?')) return;
        try{
          const r = await fetch((API_BASE||'') + '/api/users/wallets', { method: 'DELETE', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ publicKey: pk }) });
          const j = await r.json().catch(()=>null); if(!r.ok) throw j;
          await loadWallets();
        }catch(err){ alert('Hata: ' + (err && err.error ? err.error : JSON.stringify(err))); }
      };
    }catch(err){ listEl.innerHTML = '<div class="muted">Hata yükleniyor</div>'; }
  }

  el('btn-refresh-wallets').addEventListener('click', loadWallets);

  // user payment handlers
  const paySend = el('user-pay-send');
  const payRefresh = el('user-pay-refresh');
  if(payRefresh) payRefresh.addEventListener('click', loadWallets);
  if(paySend){
    paySend.addEventListener('click', async ()=>{
      const out = el('user-pay-out');
      const sel = el('user-pay-wallet');
      const to = el('user-pay-to').value.trim();
      const amount = el('user-pay-amount').value;
      if(!sel || !sel.value){ out.textContent = 'Lütfen gönderen cüzdanı seçin.'; return; }
      if(!to){ out.textContent = 'Alıcı public key gerekli.'; return; }
      if(!amount){ out.textContent = 'Miktar gerekli.'; return; }
      paySend.disabled = true; paySend.textContent = 'Gönderiliyor...'; out.textContent = 'Bekleniyor...';
      try{
        const res = await fetch((API_BASE||'') + '/api/users/donate', { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ publicKey: sel.value, to, amount }) });
        const j = await res.json().catch(()=>null);
        if(!res.ok){
          const msg = j && (j.error||j.message) ? (j.error||j.message) : ('Sunucu hatası ' + res.status);
          out.textContent = 'Hata: ' + msg; if(res.status===401) window.location.href='/login.html'; return;
        }
        out.textContent = 'Gönderildi — tx hash: ' + (j && j.hash ? j.hash : (j && j.hash));
        // refresh wallets and campaigns
        setTimeout(()=>{ loadWallets(); refreshCampaigns(); }, 800);
      }catch(e){ out.textContent = 'Ağ hatası: ' + (e && e.message ? e.message : JSON.stringify(e)); }
      finally{ paySend.disabled = false; paySend.textContent = 'Gönder'; }
    });
  }

  // wallet add modal behavior
  const modal = el('wallet-modal');
  const btnAdd = el('btn-add-wallet');
  const btnCancel = el('wallet-cancel');
  const btnSave = el('wallet-save');
  const feedback = el('wallet-modal-feedback');

  btnAdd.addEventListener('click', ()=>{ feedback.textContent=''; el('wallet-name').value=''; el('wallet-secret').value=''; modal.style.display='flex'; el('wallet-name').focus(); });
  btnCancel.addEventListener('click', ()=>{ modal.style.display='none'; });

  btnSave.addEventListener('click', async ()=>{
    const name = el('wallet-name').value.trim();
    const secret = el('wallet-secret').value.trim();
    if(!name){ feedback.textContent = 'Cüzdan ismi gerekli'; return; }
    if(!secret){ feedback.textContent = 'Secret gerekli'; return; }
    feedback.textContent = 'Ekleniyor...';
    btnSave.disabled = true;
    try{
      const r = await fetch((API_BASE || '') + '/api/users/wallets', { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, secret }) });
      let j;
      try { j = await r.json(); } catch(e){ j = null; }
      if (r.status === 401) { window.location.href = '/login.html'; return; }
      if(!r.ok) {
        const msg = (j && (j.error || j.message)) ? (j.error || j.message) : (`Sunucu hatası (${r.status})`);
        feedback.textContent = 'Hata: ' + msg;
        btnSave.disabled = false;
        return;
      }
      // success
      modal.style.display='none';
      feedback.textContent = '';
      await loadWallets();
    }catch(err){ feedback.textContent = 'Ağ hatası: ' + (err && err.message ? err.message : JSON.stringify(err)); }
    finally{ btnSave.disabled = false; }
  });

  // wallets panel toggle
  const toggle = el('wallets-toggle');
  const panel = el('wallets-panel');
  const ind = el('wallets-toggle-ind');
  let open = true;
  function setOpen(v){ open = !!v; panel.style.display = open ? 'block' : 'none'; ind.textContent = open ? '▼' : '▶'; }
  toggle.addEventListener('click', ()=>{ setOpen(!open); });
  setOpen(true);

  init();
})();

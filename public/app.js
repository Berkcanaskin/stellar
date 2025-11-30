// Allow overriding API base (set window.API_BASE before deploy if backend is on a different host)
const API_BASE = (window && window.API_BASE) ? window.API_BASE.replace(/\/$/, '') : '';

async function postJSON(url, body) {
  const fullUrl = url.startsWith('/') ? (API_BASE + url) : url;
  const res = await fetch(fullUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    // use include so cookies are sent when frontend is on a different origin (Netlify)
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

// (popup helper removed) donate should open the in-page modal instead

const btnBalance = document.getElementById('btn-balance');
if (btnBalance) {
  btnBalance.addEventListener('click', async () => {
    const secretEl = document.getElementById('balance-secret');
    const out = document.getElementById('balance-out');
    out.textContent = 'Bekleniyor...';
    try {
      const secret = secretEl ? secretEl.value.trim() : '';
      const data = await postJSON('/api/balance', { secret });
      out.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      out.textContent = 'Hata: ' + (err && err.error ? err.error : JSON.stringify(err));
    }
  });
}



// Campaigns: create and list
// Note: campaign creation moved to Admin panel (admin.html)

async function refreshCampaigns() {
  const out = document.getElementById('campaign-list');
  out.innerHTML = 'Refreshing...';
  try {
  const res = await fetch(API_BASE + '/api/campaigns', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw data;
    if (!data.campaigns || data.campaigns.length === 0) { out.innerHTML = '<div class="muted">No campaigns yet</div>'; return; }
    out.innerHTML = '';
    data.campaigns.forEach(c => {
      const row = document.createElement('div');
      row.className = 'campaign-row';

      const left = document.createElement('div');
      left.style.flex = '1';
  // build title with optional introduction info tooltip (use intro, introduction, or description)
  const introText = (c.intro || c.introduction || c.description || '').toString();
  const infoSpan = introText ? `<span class="info-icon" title="${attrEscape(introText)}">i</span>` : '';
  // add a simple tooltip "hello" on the campaign title
  left.innerHTML = `<strong title="hello">${escapeHtml(c.title)}</strong>${infoSpan} <div class="muted">Public: <code>${c.publicKey}</code></div>`;

      const right = document.createElement('div');
      right.style.width = '260px';

      const pct = Math.min(100, Math.round(( (c.balance||0) / (c.goal||1) ) * 100));

  // show campaign goal and a small raised summary
  const goalDiv = document.createElement('div');
  goalDiv.className = 'muted';
  goalDiv.style.fontSize = '.95rem';
  goalDiv.textContent = `Goal: ${c.goal} XLM`;

  const raisedLine = document.createElement('div');
  raisedLine.className = 'small muted';
  raisedLine.style.marginTop = '.25rem';
  raisedLine.textContent = `${c.goal} XLM`;

      const prog = document.createElement('div');
      prog.className = 'progress';
      prog.title = `${pct}%`;
      const progI = document.createElement('i');
      progI.style.width = `${pct}%`;
      prog.appendChild(progI);

      const controls = document.createElement('div');
      controls.style.display = 'flex';
      controls.style.gap = '.5rem';
      controls.style.marginTop = '.5rem';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'secondary';
      copyBtn.type = 'button';
      copyBtn.dataset.id = c.id;
      copyBtn.dataset.pk = c.publicKey;
      copyBtn.textContent = 'Copy Public';
      copyBtn.addEventListener('click', copyPub);

      const donateBtn = document.createElement('button');
  donateBtn.type = 'button';
  donateBtn.style.cursor = 'pointer';
      donateBtn.dataset.pk = c.publicKey;
      donateBtn.dataset.id = c.id;
      donateBtn.textContent = 'Donate';
      donateBtn.addEventListener('click', donateTo);

      controls.appendChild(copyBtn);
      controls.appendChild(donateBtn);

  right.appendChild(goalDiv);
  right.appendChild(raisedLine);
  right.appendChild(prog);
      right.appendChild(controls);

      row.appendChild(left);
      row.appendChild(right);
      out.appendChild(row);
    });
    // also refresh donation feed
    refreshDonations();
  } catch (err) {
    out.innerHTML = '<div class="muted">Hata: ' + escapeHtml(JSON.stringify(err)) + '</div>';
  }
}

document.getElementById('btn-refresh-campaigns').addEventListener('click', refreshCampaigns);

// Auto-refresh on load
refreshCampaigns();

// No delegated click handler — campaign buttons use inline handlers (donateTo / copyPub)

// Render auth actions in the header: show Register/Login when anonymous,
// or show a user button + logout when logged in.
async function renderAuthActions(){
  const container = document.getElementById('auth-actions');
  if(!container) return;
  try{
    const res = await fetch(API_BASE + '/api/users/me', { credentials: 'include' });
    if(!res.ok){
      // anonymous: ensure Register/Login buttons exist
  container.innerHTML = '<button id="btn-register" class="secondary">SignUp</button>' +
            '<a id="login-link" href="/login.html"><button class="secondary">LogIn</button></a>';
      document.getElementById('btn-register')?.addEventListener('click', ()=>{ window.location.href = '/register.html'; });
      return;
    }
    const data = await res.json();
    const name = data.username || 'Hesabım';
    container.innerHTML = `<button id="btn-user" class="secondary">${escapeHtml(name)}</button> <button id="btn-logout" class="secondary">Log Out</button>`;
    document.getElementById('btn-user')?.addEventListener('click', ()=>{ window.location.href = '/user.html'; });
    document.getElementById('btn-logout')?.addEventListener('click', async ()=>{
      await fetch(API_BASE + '/api/users/logout', { method: 'POST', credentials: 'include' });
      window.location.reload();
    });
  }catch(e){ console.warn('renderAuthActions error', e); }
}

// initialize auth actions
renderAuthActions();

// temporary admin button: navigate to admin page with the default admin token
// (removed temporary admin button wiring) admin access is available from the login page now

// Payment UI removed from the homepage (moved to user dashboard)

function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function attrEscape(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function copyPub(e){ const pk = e.currentTarget.dataset.pk; navigator.clipboard?.writeText(pk).then(()=>alert('Public key copied')); }

async function viewTxs(e){
  const id = e.currentTarget.dataset.id;
  const area = document.getElementById('campaign-out');
  area.textContent = 'Loading txs...';
  try {
  const res = await fetch(API_BASE + `/api/campaigns/${id}/txs`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw data;
    if (!data.txs || data.txs.length===0) area.textContent = 'No recent transactions';
    else area.textContent = data.txs.map(t=>`${t.created_at} ${t.type} ${t.from} -> ${t.to} ${t.amount||''} (id:${t.id})`).join('\n');
  } catch (err) {
    area.textContent = 'Error: ' + JSON.stringify(err);
  }
}

function donateTo(e){
  console.log('donateTo called', e && e.currentTarget && e.currentTarget.dataset);
  // Open modal and prefill target + title
  const pk = e.currentTarget.dataset.pk;
  const title = e.currentTarget.dataset.title || '';
  const target = document.getElementById('donate-target-pk');
  const modal = document.getElementById('donate-modal');
  const aInp = document.getElementById('donate-amount');
  const fb = document.getElementById('donate-feedback');
  // require user account to donate via saved wallets; if not logged-in redirect to user page
  (async function checkAuthAndOpen(){
    let jw = null;
    try{
      const res = await fetch(API_BASE + '/api/users/me', { credentials: 'include' });
      if (!res.ok) {
        // Instead of redirecting to login, show the donate modal with a login-required message
        // so the user can choose to login themselves.
        modal.style.display = 'flex';
        fb.className = 'donate-error';
        fb.innerHTML = 'Please log in to donate. You can log in using the <strong>LogIn</strong> button above or register here <a href="/register.html">SignUp</a>';
        // populate wallet select with a single disabled hint option
        try{
          const walletSelect = document.getElementById('donate-wallet-select');
          if(walletSelect){ walletSelect.innerHTML = '<option value="">(Giriş yapınız - cüzdanlar görünmüyor)</option>'; }
        }catch(e){}
        return;
      }
      // fetch stored wallets to populate the modal's wallet selector
      try{
        const wres = await fetch(API_BASE + '/api/users/wallets', { credentials: 'include' });
        if (wres.ok) jw = await wres.json();
      }catch(e){ /* ignore */ }
    }catch(err){
      // network error or unexpected; show modal with login hint instead of redirecting
      modal.style.display = 'flex';
      fb.className = 'donate-error';
      fb.innerHTML = 'Bağış yapabilmek için giriş yapmanız gerekiyor. Lütfen giriş yapın.';
      try{ const walletSelect = document.getElementById('donate-wallet-select'); if(walletSelect) walletSelect.innerHTML = '<option value="">(Giriş yapınız - cüzdanlar görünmüyor)</option>'; }catch(e){}
      return;
    }
  // set campaign title and receiving account
  const titleEl = document.getElementById('donate-title');
  if(titleEl) titleEl.textContent = title || 'Donate to campaign';
  target.textContent = pk;
  // populate the wallet select with stored wallets (if any)
  const walletSelect = document.getElementById('donate-wallet-select');
  if(walletSelect){
    walletSelect.innerHTML = '<option value="">(Select Wallet)</option>';
    if(jw && jw.wallets && jw.wallets.length){
      jw.wallets.forEach(w => {
        const label = w.name ? `${w.name} (${(w.publicKey||'').slice(0,8)}…${(w.publicKey||'').slice(-6)})` : `${(w.publicKey||'').slice(0,8)}…${(w.publicKey||'').slice(-6)}`;
        const opt = document.createElement('option'); opt.value = w.publicKey; opt.textContent = label; walletSelect.appendChild(opt);
      });
    } else {
      // no wallets — show hint (user will be redirected to add one when sending)
      const opt = document.createElement('option'); opt.value = ''; opt.textContent = '(Kayıtlı cüzdan yok)'; walletSelect.appendChild(opt);
    }
  }
  modal.style.display = 'flex';
  fb.textContent = '';
  aInp.value = '1';
  })();
  // attach handlers (idempotent)
  document.getElementById('donate-cancel').onclick = ()=>{ modal.style.display='none'; };
  const sendBtn = document.getElementById('donate-send');
  sendBtn.onclick = async ()=>{
    fb.className = '';
    fb.textContent = '';
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    // use selected stored wallet
    const selectedPk = document.getElementById('donate-wallet-select') ? document.getElementById('donate-wallet-select').value : '';
    const amt = document.getElementById('donate-amount').value;
    if(!selectedPk){ fb.className = 'donate-error'; fb.textContent = 'Lütfen gönderen cüzdanı seçin.'; sendBtn.disabled = false; sendBtn.textContent = 'Send'; return; }
    if(!amt){ fb.className = 'donate-error'; fb.textContent = 'Miktar gerekli.'; sendBtn.disabled = false; sendBtn.textContent = 'Send'; return; }
    try{
      const d = await postJSON('/api/users/donate', { publicKey: selectedPk, to: pk, amount: amt });
      fb.className = 'donate-success'; fb.textContent = 'Gönderildi — tx hash: ' + (d && d.hash ? d.hash : '');
      modal.style.display = 'none';
      setTimeout(refreshCampaigns, 800);
    }catch(err){
      console.error('donate error', err);
      fb.className = 'donate-error';
      let msg = '';
      if(!err) msg = 'Bilinmeyen hata';
      else if (typeof err === 'string') msg = err;
      else if (err.error || err.message) msg = err.error || err.message;
      else msg = JSON.stringify(err);
      fb.textContent = 'Hata: ' + msg;
      // if server indicated not logged in, redirect to login
      if(err && (err.error === 'not logged in' || err.message === 'not logged in')) window.location = '/login.html';
    }finally{ sendBtn.disabled = false; sendBtn.textContent = 'Send'; }
  };
}

// Live donation feed: fetch recent txs for all campaigns and render on the right
async function refreshDonations(){
  const feed = document.getElementById('donation-feed');
  feed.innerHTML = 'Loading...';
  try{
  const res = await fetch(API_BASE + '/api/campaigns', { credentials: 'include' });
    const data = await res.json(); if(!res.ok) throw data;
    const items = [];
    for(const c of data.campaigns){
      try{
  const r2 = await fetch(API_BASE + `/api/campaigns/${c.id}/txs`, { credentials: 'include' });
  const d2 = await r2.json(); if(!r2.ok) throw d2;
        if(d2.txs && d2.txs.length){
          for(const t of d2.txs.slice(0,10)){
            // Only include payment-type entries (if amount present)
            items.push({ time: t.created_at, from: t.from||'', to: t.to||'', amount: t.amount||'', campaign: c.title });
          }
        }
      }catch(e){ /* ignore per-campaign errors */ }
    }
    // sort by time desc (best-effort string compare)
    items.sort((a,b)=> b.time.localeCompare(a.time));
    if(items.length===0){ feed.innerHTML = '<div class="muted">Henüz bağış yok</div>'; return; }
    feed.innerHTML = items.slice(0,50).map(it=>`<div class="donation-item"><div style="font-weight:600">${escapeHtml(it.campaign)}</div>
      <div class="small muted">${escapeHtml(it.time)}</div>
      <div style="margin-top:.25rem">${escapeHtml(it.from)} → ${escapeHtml(it.amount)} XLM</div></div>`).join('');
  }catch(err){ feed.innerHTML = '<div class="muted">Hata yükleniyor: '+ escapeHtml(JSON.stringify(err)) +'</div>'; }
}

// Auto-refresh donations every 12s
setInterval(refreshDonations, 12000);

// API base override (set window.API_BASE when deploying frontend to Netlify)
const API_BASE = (window && window.API_BASE) ? window.API_BASE.replace(/\/$/, '') : '';
// Support an admin_token passed via query string for temporary admin access (x-admin-token header)
const ADMIN_TOKEN = (new URLSearchParams(window.location.search)).get('admin_token') || null;

async function fetchWithToken(url, opts = {}){
  const fullUrl = url.startsWith('/') ? (API_BASE + url) : url;
  opts = Object.assign({}, opts);
  opts.credentials = opts.credentials || 'include';
  opts.headers = Object.assign({}, opts.headers || {});
  if (ADMIN_TOKEN) opts.headers['x-admin-token'] = ADMIN_TOKEN;
  return fetch(fullUrl, opts);
}

async function postJSON(url, body, headers={}){
  const baseHeaders = Object.assign({'Content-Type':'application/json'}, headers || {});
  const res = await fetchWithToken(url, { method: 'POST', headers: baseHeaders, body: JSON.stringify(body) });
  const data = await res.json(); if(!res.ok) throw data; return data;
}

document.getElementById('btn-admin-login').addEventListener('click', async () =>{
  const user = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value;
  const out = document.getElementById('admin-out');
  out.textContent = 'Logging in...';
  try{
    const res = await postJSON('/api/admin/login', { user, pass });
    out.textContent = 'Logged in';
    document.getElementById('login-area').style.display = 'none';
    document.getElementById('admin-area').style.display = '';
    await refreshAdminList();
  }catch(err){ out.textContent = 'Login failed: '+JSON.stringify(err); }
});

document.getElementById('btn-admin-create').addEventListener('click', async () =>{
  const title = document.getElementById('admin-title').value.trim();
  const goal = document.getElementById('admin-goal').value;
  const publicKey = document.getElementById('admin-public').value.trim();
  const out = document.getElementById('admin-log');
  out.textContent = 'Creating...';
  try{
    const body = { title, goal };
    // require publicKey (we no longer accept secrets from admin UI)
    if(!publicKey) { out.textContent = 'Error: publicKey is required'; return; }
    body.publicKey = publicKey;
    const data = await postJSON('/api/campaigns', body);
    out.textContent = JSON.stringify(data, null, 2);
    // clear secret input for safety
    // clear public key input to avoid accidental reuse
    document.getElementById('admin-public').value = '';
    await refreshAdminList();
  }catch(err){ out.textContent = 'Error: '+JSON.stringify(err); }
});

async function refreshAdminList(token){
  const list = document.getElementById('admin-list');
  list.textContent = 'Refreshing...';
  try{
  const res = await fetchWithToken(API_BASE + '/api/campaigns', { credentials: 'include' });
    const data = await res.json(); if(!res.ok) throw data;
    list.innerHTML = '';
  const showPerKey = !!(document.getElementById('admin-perkey-toggle') && document.getElementById('admin-perkey-toggle').checked);

  data.campaigns.forEach(c=>{
      const div = document.createElement('div');
      div.className = 'campaign-row';
      const introText = (c.intro || c.introduction || c.description || '').toString();
      const infoSpan = introText ? `<span class="info-icon" title="${escapeHtml(introText).replace(/\"/g,'&quot;')}">i</span>` : '';
      div.innerHTML = `<div style="flex:1"><strong title=\"hello\">${escapeHtml(c.title)}</strong>${infoSpan}
        <div class=\"muted\">Public: <code>${escapeHtml(c.publicKey)}</code></div>
        <div class=\"muted\" id=\"txs-${c.id}\">Loading recent txs...</div>
        <div class=\"muted\" id=\"sum-${c.id}\">Toplam: —</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.5rem;align-items:flex-end;">
        <div style="display:flex;gap:.5rem;">
          <button class="secondary" data-id="${c.id}" onclick="viewTxsAdmin(${c.id})">View TXS</button>
          <button class="danger" data-id="${c.id}" onclick="deleteCampaign(event)">Delete</button>
        </div>
      </div>`;
      list.appendChild(div);
      // fetch recent txs and show under campaign
      (async function showTxs(id, pubkey){
        try{
          const res = await fetchWithToken(API_BASE + `/api/campaigns/${id}/txs`, { credentials: 'include' });
          const data = await res.json(); if(!res.ok) throw data;
          const area = document.getElementById(`txs-${id}`);
          if(!data.txs || data.txs.length===0) { area.textContent = 'No recent transactions'; return; }
          area.innerHTML = data.txs.map(t=>`<div style="font-size:.9rem">${escapeHtml(t.created_at)} ${escapeHtml(t.type)} ${escapeHtml(t.from||'')} → ${escapeHtml(t.to||'')} ${escapeHtml(t.amount||'')}</div>`).join('');
          // compute sum
          const sum = data.txs.reduce((acc,t)=>{ const a = parseFloat(t.amount||0); return acc + (isNaN(a)?0:a); }, 0);
          const sumArea = document.getElementById(`sum-${id}`);
          if(sumArea) sumArea.textContent = 'Toplam gelen: ' + sum + ' XLM';
          // nothing here for per-key — totals are fetched from server endpoint below
        }catch(err){
          const area = document.getElementById(`txs-${id}`);
          if(area) area.textContent = 'Error loading txs';
        }
      })(c.id, c.publicKey);
    });

    // If admin requested per-key totals, fetch them from server-side endpoint and render as a table
    if(showPerKey){
      try{
  const res = await fetchWithToken(API_BASE + '/api/stats/per-key', { credentials: 'include' });
  const d = await res.json(); if(!res.ok) throw d;
        const perkeyDiv = document.createElement('div');
        perkeyDiv.style.marginTop = '.75rem';
        // Build a simple table mapping publicKey -> campaign title(s) -> total
        const rows = [];
        const titleByPk = {};
        data.campaigns.forEach(c => { titleByPk[c.publicKey] = titleByPk[c.publicKey] || []; titleByPk[c.publicKey].push(c.title); });
        const keys = Object.keys(d.totals).sort((a,b)=> (d.totals[b]||0) - (d.totals[a]||0));
        perkeyDiv.innerHTML = `<h4>Per-key totals</h4>`;
        const table = document.createElement('table'); table.className = 'perkey-table';
        const thead = document.createElement('thead'); thead.innerHTML = '<tr><th>Public Key</th><th>Campaign(s)</th><th style="text-align:right">Total (XLM)</th></tr>';
        const tbody = document.createElement('tbody');
        keys.forEach(pk => {
          const tr = document.createElement('tr');
          const titleCell = (titleByPk[pk] || []).join(', ');
          tr.innerHTML = `<td><span class="perkey-badge">${escapeHtml(pk)}</span></td><td>${escapeHtml(titleCell)}</td><td style="text-align:right"><span class="perkey-amount">${d.totals[pk]}</span></td>`;
          tbody.appendChild(tr);
        });
        table.appendChild(thead); table.appendChild(tbody);
        perkeyDiv.appendChild(table);
        list.insertBefore(perkeyDiv, list.firstChild);
      }catch(e){
        const perkeyDiv = document.createElement('div'); perkeyDiv.className='muted'; perkeyDiv.textContent='Error loading per-key totals'; list.insertBefore(perkeyDiv, list.firstChild);
      }
    }
  }catch(err){ list.textContent = 'Error: '+JSON.stringify(err); }
}

// On load: if admin cookie/token exists, automatically show admin area
(async function checkAdminOnLoad(){
  try{
    const res = await fetchWithToken(API_BASE + '/api/admin/check', { credentials: 'include' });
    if (res && res.ok){
      // show admin area
      document.getElementById('login-area').style.display = 'none';
      document.getElementById('admin-area').style.display = '';
      await refreshAdminList();
    }
  }catch(e){ /* not admin - ignore */ }
})();

async function deleteCampaign(e){
  const id = e.currentTarget ? e.currentTarget.dataset.id : e;
  if(!id) return alert('Invalid campaign id');
  if(!confirm('Bu kampanyayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) return;
  try{
  const res = await fetchWithToken(API_BASE + `/api/campaigns/${id}`, { method: 'DELETE', credentials: 'include' });
  const data = await res.json(); if(!res.ok) throw data;
    alert('Kampanya silindi');
    await refreshAdminList();
  }catch(err){
    alert('Silme hatası: ' + JSON.stringify(err));
  }
}

function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function viewTxsAdmin(id){
  const out = document.getElementById('admin-out');
  out.textContent = 'Loading txs...';
  try{
  const res = await fetchWithToken(API_BASE + `/api/campaigns/${id}/txs`, { credentials: 'include' });
  const data = await res.json(); if(!res.ok) throw data;
    out.textContent = JSON.stringify(data, null, 2);
  }catch(err){ out.textContent = 'Error: '+JSON.stringify(err); }
}

document.getElementById('btn-admin-refresh').addEventListener('click', ()=>refreshAdminList());
document.getElementById('btn-admin-logout').addEventListener('click', async ()=>{
  await postJSON('/api/admin/logout', {});
  document.getElementById('login-area').style.display = '';
  document.getElementById('admin-area').style.display = 'none';
  document.getElementById('admin-out').textContent = 'Logged out';
});


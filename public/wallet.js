(function(){
  function q(name){ const u = new URL(window.location.href); return u.searchParams.get(name); }
  const pk = q('pk');
  const pkEl = document.getElementById('pk');
  const balEl = document.getElementById('balances');
  if(!pk){ balEl.textContent = 'Public key belirtilmedi'; }
  else {
    pkEl.textContent = pk;
    fetch('/api/account/' + encodeURIComponent(pk)).then(async r => {
      if(!r.ok){ const j = await r.json().catch(()=>({})); balEl.textContent = 'Hata: ' + (j && j.error ? j.error : r.statusText); return; }
      const j = await r.json();
      if(!j.balances || j.balances.length===0){ balEl.textContent = 'Bakiye yok veya hesap bulunamadı'; return; }
      balEl.innerHTML = '<ul style="list-style:none;padding:0;margin:0">' + j.balances.map(b=>`<li style="padding:.5rem 0">${b.asset}: <strong>${b.balance}</strong></li>`).join('') + '</ul>';
    }).catch(e=>{ balEl.textContent = 'Ağ hatası: ' + e.message; });
  }
  document.getElementById('btn-back').addEventListener('click', ()=>{ window.history.back(); });
})();

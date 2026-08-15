function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById(id);
  if (t) { t.classList.add('active'); const c = t.querySelector('.content'); if(c) c.scrollTop = 0; }
  if (id === 's-analyzing') {
    let p = 0;
    const bar = document.getElementById('pbar');
    const st = document.getElementById('pstatus');
    const steps = ["Détection de l'étiquette…","Lecture des médailles…","Recherche en base de données…","Génération du profil complet…"];
    let si = 0;
    const iv = setInterval(() => {
      p += 2; if (bar) bar.style.width = p + '%';
      if (p % 25 === 0 && si < steps.length) st.textContent = steps[si++];
      if (p >= 100) { clearInterval(iv); setTimeout(() => go('s-result'), 300); }
    }, 40);
  }
}

function toggleHist() {
  const more = document.getElementById('hist-more');
  const btn = document.getElementById('hist-btn');
  if (more.style.display === 'none') { more.style.display = 'block'; btn.textContent = 'Voir moins ↑'; }
  else { more.style.display = 'none'; btn.textContent = 'Voir plus ↓'; }
}

function filterToggle(el) {
  el.closest('.filter-row').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function switchTab(tab) {
  document.getElementById('sec-food').style.display = tab === 'food' ? 'block' : 'none';
  document.getElementById('sec-cocktail').style.display = tab === 'cocktail' ? 'block' : 'none';
  document.getElementById('tab-food').classList.toggle('active', tab === 'food');
  document.getElementById('tab-cocktail').classList.toggle('active', tab === 'cocktail');
}

function setTheme(name, swatchId) {
  document.body.className = name === 'blonde' ? '' : 'theme-' + name;
  document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
  document.getElementById(swatchId).classList.add('active');
}

function setLang(lang) {
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('lang-' + lang).classList.add('active');
}

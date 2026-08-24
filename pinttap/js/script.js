// ═══════════════════════════════════════════════════════
// CONFIG — à remplir après déploiement du Worker Cloudflare
// ═══════════════════════════════════════════════════════
const WORKER_URL = 'https://TON-WORKER.TON-SOUS-DOMAINE.workers.dev'; // ⚠️ remplace par ton URL réelle
const BREWERY_DB_URL = 'https://api.openbrewerydb.org/v1/breweries/search';

// ═══════════════════════════════════════════════════════
// STOCKAGE LOCAL RÉEL (localStorage — persiste après fermeture de l'app)
// ═══════════════════════════════════════════════════════
const KEYS = { HISTORY: 'pinttap_history', FAVORITES: 'pinttap_favorites' };

function getHistory() {
  return JSON.parse(localStorage.getItem(KEYS.HISTORY) || '[]');
}
function addToHistory(beer) {
  const updated = [beer, ...getHistory()].slice(0, 100);
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
}
function getFavorites() {
  return JSON.parse(localStorage.getItem(KEYS.FAVORITES) || '[]');
}
function toggleFavorite(beer) {
  const favs = getFavorites();
  const exists = favs.find(f => f.name === beer.name && f.brewery === beer.brewery);
  const updated = exists
    ? favs.filter(f => !(f.name === beer.name && f.brewery === beer.brewery))
    : [beer, ...favs];
  localStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));
  return !exists;
}

// ═══════════════════════════════════════════════════════
// NAVIGATION (reprise de l'existant, sans le faux minuteur)
// ═══════════════════════════════════════════════════════
function go(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const t = document.getElementById(id);
  if (t) { t.classList.add('active'); const c = t.querySelector('.content'); if (c) c.scrollTop = 0; }
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

// ═══════════════════════════════════════════════════════
// SCAN RÉEL — déclenche la caméra du téléphone
// ═══════════════════════════════════════════════════════
function openCamera(fromGallery) {
  const input = document.getElementById('camera-input');
  input.removeAttribute('capture');
  if (!fromGallery) input.setAttribute('capture', 'environment'); // ouvre l'appareil photo arrière
  input.value = '';
  input.click();
}

async function handlePhotoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  go('s-analyzing');
  setAnalyzingStatus("Détection de l'étiquette…");

  try {
    const base64 = await fileToBase64(file);
    setAnalyzingStatus('Analyse par IA en cours…');

    const beerData = await analyzeBeerLabel(base64, file.type);

    setAnalyzingStatus('Recherche en base de données…');
    const breweryInfo = await findBrewery(beerData.brewery, beerData.country);
    if (breweryInfo && !beerData.city) beerData.city = breweryInfo.city;

    setAnalyzingStatus('Génération du profil complet…');
    const beer = {
      ...beerData,
      id: `scan_${Date.now()}`,
      addedAt: Date.now(),
      source: 'scan',
    };

    addToHistory(beer);
    renderResultScreen(beer);
    setTimeout(() => go('s-result'), 300);

  } catch (err) {
    console.error(err);
    go('s-scanning');
    if (err.message === 'not_a_beer_label') {
      alert("Hmm 🍺 Je ne vois pas d'étiquette de bière. Rapprochez-vous et réessayez !");
    } else {
      alert('Analyse impossible. Vérifiez votre connexion et réessayez.');
    }
  }
}

function setAnalyzingStatus(text) {
  const el = document.getElementById('pstatus');
  const bar = document.getElementById('pbar');
  if (el) el.textContent = text;
  if (bar) bar.style.width = '60%'; // barre approximative, pas de fausse simulation
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════
// APPEL AU WORKER (qui appelle Claude Vision côté serveur)
// ═══════════════════════════════════════════════════════
async function analyzeBeerLabel(base64, mediaType) {
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mediaType }),
  });

  if (!res.ok) throw new Error(`worker_error_${res.status}`);

  const parsed = await res.json();
  if (parsed.error === 'not_a_beer_label') throw new Error('not_a_beer_label');
  if (parsed.error) throw new Error(parsed.error);

  return parsed;
}

// ═══════════════════════════════════════════════════════
// OPEN BREWERY DB — gratuit, sans clé
// ═══════════════════════════════════════════════════════
async function findBrewery(name, country) {
  if (!name) return null;
  try {
    const query = encodeURIComponent(name);
    const res = await fetch(`${BREWERY_DB_URL}?query=${query}&per_page=3`);
    if (!res.ok) return null;
    const results = await res.json();
    if (!results.length) return null;
    if (country) {
      const match = results.find(b =>
        b.country?.toLowerCase().includes(country.toLowerCase()) ||
        b.name?.toLowerCase().includes(name.toLowerCase())
      );
      return match || results[0];
    }
    return results[0];
  } catch {
    return null; // on ne bloque jamais le scan si l'enrichissement échoue
  }
}

// ═══════════════════════════════════════════════════════
// AFFICHAGE DYNAMIQUE DE LA FICHE RÉSULTAT
// (remplace les valeurs fixes "Tripel Karmeliet" par les vraies données)
// ═══════════════════════════════════════════════════════
function renderResultScreen(beer) {
  setText('res-name', beer.name);
  setText('res-origin', `${beer.brewery || ''}${beer.city ? ' · ' + beer.city : ''}${beer.country ? ', ' + beer.country : ''}`);
  setText('res-description', beer.description || '');
  setText('res-serving', beer.servingTemp ? `Servir à ${beer.servingTemp} dans un ${beer.glassType || 'verre adapté'}.` : '');

  const tagsEl = document.getElementById('res-tags');
  if (tagsEl) {
    tagsEl.innerHTML = '';
    [beer.style, beer.abv ? `${beer.abv}% ABV` : null, beer.color, beer.ibu ? `${beer.ibu} IBU` : null]
      .filter(Boolean)
      .forEach(t => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = t;
        tagsEl.appendChild(span);
      });
  }

  const pairingsEl = document.getElementById('res-pairings');
  if (pairingsEl) {
    pairingsEl.innerHTML = '';
    (beer.foodPairings || []).forEach(p => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = p;
      pairingsEl.appendChild(span);
    });
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || '';
}

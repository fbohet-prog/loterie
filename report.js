import { db, auth } from './firebase.js';
import { collection, collectionGroup, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Adaptez uniquement ces noms si vos collections Firestore sont différentes.
const CONFIG = {
  participantCollections: ['users', 'participants'],
  standCollections: ['stands', 'qrCodes', 'companies'],
  scanCollections: ['scans'],
  adminPage: 'admin.html'
};

let rows = [];
const $ = id => document.getElementById(id);
const text = value => value == null ? '' : String(value);
const html = value => text(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const dateValue = value => {
  if (!value) return '';
  const d = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-BE');
};
const first = (obj, keys, fallback='') => keys.map(k => obj?.[k]).find(v => v !== undefined && v !== null && v !== '') ?? fallback;

async function firstReadableCollection(names) {
  for (const name of names) {
    try {
      const snap = await getDocs(collection(db, name));
      if (!snap.empty || name === names[names.length - 1]) return {name, snap};
    } catch (e) { console.warn(`Collection ${name} non accessible`, e); }
  }
  return {name: names[0], snap: {docs: []}};
}

async function loadReport() {
  $('status').textContent = 'Chargement du rapport…';
  $('errorBox').classList.add('hidden');
  try {
    const [{snap: participants}, {snap: stands}] = await Promise.all([
      firstReadableCollection(CONFIG.participantCollections),
      firstReadableCollection(CONFIG.standCollections)
    ]);

    const standMap = new Map();
    stands.docs.forEach(doc => {
      const d = doc.data();
      const company = first(d, ['companyName','societe','société','company','name','nom','standName'], doc.id);
      [doc.id, d.code, d.qrCode, d.qrId, d.slug].filter(Boolean).forEach(k => standMap.set(String(k), company));
    });

    let globalScans = [];
    try {
      const scanSnap = await getDocs(collectionGroup(db, CONFIG.scanCollections[0]));
      globalScans = scanSnap.docs.map(doc => ({id: doc.id, path: doc.ref.path, ...doc.data()}));
    } catch (e) { console.warn('Lecture collectionGroup(scans) impossible', e); }

    rows = participants.docs.map(doc => {
      const p = doc.data();
      const uid = first(p, ['uid','userId'], doc.id);
      const embedded = first(p, ['scans','scannedCodes','qrScans','visitedStands'], []);
      const embeddedScans = Array.isArray(embedded) ? embedded : Object.keys(embedded || {}).filter(k => embedded[k]);
      const related = globalScans.filter(s => {
        const owner = first(s, ['uid','userId','participantId','participantUid']);
        return owner === uid || s.path.includes(`/${uid}/`);
      });
      const scanCodes = [...embeddedScans, ...related.map(s => first(s, ['qrCode','qrId','code','standId','companyId'], s.id))]
        .filter(Boolean).map(String);
      const uniqueCodes = [...new Set(scanCodes)];
      const companies = [...new Set(uniqueCodes.map(code => standMap.get(code) || code))];
      return {
        uid,
        name: first(p, ['displayName','fullName','name','nomComplet'], `${first(p,['firstName','prenom','prénom'])} ${first(p,['lastName','nom'])}`.trim() || 'Sans nom'),
        email: first(p, ['email','mail']),
        participantCompany: first(p, ['company','companyName','societe','société','organisation']),
        registrationDate: dateValue(first(p, ['createdAt','registeredAt','registrationDate','dateInscription'])),
        scanCodes: uniqueCodes,
        companies,
        scanCount: uniqueCodes.length
      };
    });
    render();
    $('status').textContent = rows.length ? `Rapport généré le ${new Date().toLocaleString('fr-BE')}` : 'Aucun participant trouvé.';
  } catch (error) {
    console.error(error);
    $('status').textContent = '';
    $('errorBox').textContent = `Impossible de générer le rapport : ${error.message}. Vérifiez les droits Firestore et les noms de collections dans CONFIG.`;
    $('errorBox').classList.remove('hidden');
  }
}

function filteredRows() {
  const q = $('searchInput').value.trim().toLowerCase();
  const filter = $('scanFilter').value;
  const sort = $('sortSelect').value;
  const result = rows.filter(r => {
    const haystack = [r.name,r.email,r.participantCompany,...r.scanCodes,...r.companies].join(' ').toLowerCase();
    return (!q || haystack.includes(q)) && (filter === 'all' || (filter === 'with' ? r.scanCount > 0 : r.scanCount === 0));
  });
  result.sort((a,b) => sort === 'scans' ? b.scanCount-a.scanCount : sort === 'date' ? b.registrationDate.localeCompare(a.registrationDate) : a.name.localeCompare(b.name,'fr'));
  return result;
}

function render() {
  const current = filteredRows();
  $('reportBody').innerHTML = current.map(r => `<tr>
    <td>${html(r.name)}</td><td>${html(r.email)}</td><td>${html(r.participantCompany)}</td><td>${html(r.registrationDate)}</td>
    <td>${r.scanCodes.length ? r.scanCodes.map(x=>`<span class="tag">${html(x)}</span>`).join('') : '<span class="muted">Aucun</span>'}</td>
    <td>${r.companies.length ? r.companies.map(x=>`<span class="tag">${html(x)}</span>`).join('') : '<span class="muted">Aucune</span>'}</td><td>${r.scanCount}</td></tr>`).join('');
  $('participantCount').textContent = current.length;
  $('scanCount').textContent = current.reduce((n,r)=>n+r.scanCount,0);
  $('companyCount').textContent = new Set(current.flatMap(r=>r.companies)).size;
}

function csvCell(v){ return `"${text(v).replace(/"/g,'""')}"`; }
function download(name, content, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type})); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function exportCsv(){
  const lines = [['Participant','E-mail','Société du participant',"Date d'inscription",'QR scannés','Sociétés visitées','Total'], ...filteredRows().map(r=>[r.name,r.email,r.participantCompany,r.registrationDate,r.scanCodes.join(' | '),r.companies.join(' | '),r.scanCount])];
  download('rapport-loterie.csv', '\ufeff'+lines.map(line=>line.map(csvCell).join(';')).join('\n'), 'text/csv;charset=utf-8');
}
function exportWord(){
  const table = $('reportTable').outerHTML;
  const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport loterie</title><style>body{font-family:Arial}table{border-collapse:collapse;width:100%}th,td{border:1px solid #777;padding:7px}th{background:#ddd}</style></head><body><h1>Rapport des inscriptions et scans QR</h1><p>Généré le ${new Date().toLocaleString('fr-BE')}</p>${table}</body></html>`;
  download('rapport-loterie.doc', '\ufeff'+doc, 'application/msword');
}

['searchInput','scanFilter','sortSelect'].forEach(id => $(id).addEventListener(id==='searchInput'?'input':'change', render));
$('printBtn').addEventListener('click', () => window.print());
$('wordBtn').addEventListener('click', exportWord);
$('csvBtn').addEventListener('click', exportCsv);
$('refreshBtn').addEventListener('click', loadReport);

onAuthStateChanged(auth, user => user ? loadReport() : location.replace('login.html'));

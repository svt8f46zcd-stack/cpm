let _gvCache=null;
async function ladeGrundversorgerDaten(){if(_gvCache)return _gvCache;const r=await fetch('/data/grundversorger-rp-he.json');if(!r.ok)throw new Error('DB nicht ladbar');_gvCache=await r.json();return _gvCache;}
function normalisiere(t){return (t||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
async function findeGrundversorger({plz,ort,ortsteil,sparte}){
const db=await ladeGrundversorgerDaten();
const plzN=(plz||'').trim();const ortN=normalisiere(ort);const otN=normalisiere(ortsteil);const spN=(sparte||'').toLowerCase();
const treffer=db.eintraege.filter(e=>{
if(spN&&e.sparte.toLowerCase()!==spN)return false;
const pM=plzN&&Array.isArray(e.plz)&&e.plz.includes(plzN);
const oM=ortN&&normalisiere(e.gemeinde).includes(ortN);
const otM=otN&&e.ortsteil&&normalisiere(e.ortsteil).includes(otN);
return pM||oM||otM;});
if(treffer.length===0){return {status:'manuelle_pruefung',nachricht:'Wir pruefen Ihr Netzgebiet persoenlich und melden uns mit dem passenden Grundversorger.',eingabe:{plz,ort,ortsteil,sparte}};}
const b=treffer.find(e=>e.ortsteil&&otN&&normalisiere(e.ortsteil).includes(otN))||treffer[0];
return {status:'verifiziert',bundesland:b.bundesland,netzbetreiber:b.netzbetreiber,gemeinde:b.gemeinde,ortsteil:b.ortsteil||null,grundversorger:b.grundversorger,sparte:b.sparte,gueltig_von:db.meta.gueltig_von,gueltig_bis:db.meta.gueltig_bis,hinweis:b.hinweis||null,nachricht:'Voraussichtlicher '+b.sparte+'-Grundversorger: '+b.grundversorger+' (Netzgebiet '+b.netzbetreiber+')',weitereTreffer:treffer.length>1};}
export {findeGrundversorger, ladeGrundversorgerDaten};
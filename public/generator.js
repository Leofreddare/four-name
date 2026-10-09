/* Original browser generator for Four Name. Yields periodically to keep Stop responsive. */
const WORDS=[];
export async function generateCandidates(f, stopped=()=>false) {
 const n=f.length, alphabet={letters:'abcdefghijklmnopqrstuvwxyz',mixed:'abcdefghijklmnopqrstuvwxyz0123456789',all:'abcdefghijklmnopqrstuvwxyz0123456789_',digits:'0123456789'}[f.chars];
 if(!alphabet||!Number.isInteger(n)||n<2||n>32||!Number.isInteger(f.limit)||f.limit<1||f.limit>10000)throw Error('Invalid search settings.');
 const keys=['pattern','prefix','suffix','contains','exclude','required','allowed'];
 for(const k of keys)if(!new RegExp(k==='pattern'?'^[a-z0-9_?]*$':'^[a-z0-9_]*$','i').test(f[k]||''))throw Error('Use letters, numbers or underscores.');
 const value=k=>(f[k]||'').toLowerCase();
 for(const k of ['pattern','prefix','suffix','contains'])if(value(k).length>n)throw Error('A name filter exceeds the selected length.');
 const leet={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','9':'g'},min=f.word_min||3,mode=f.word_mode||'contains';
 const extra=(f.word_custom||'').toLowerCase();
 if(extra.length>500||!/^[a-z,\s]*$/.test(extra)||extra.split(/[,\s]+/).some(w=>w&&!/^[a-z]{3,7}$/.test(w)))throw Error('Extra words must contain 3–7 letters, separated by spaces or commas.');
 const words=new Set([...WORDS,...extra.split(/[,\s]+/).filter(Boolean)]);
 const wordMatch=name=>{const versions=[name];if(f.word_leet)versions.push([...name].map(c=>leet[c]||c).join(''));return versions.some(text=>{for(let size=min;size<=Math.min(n,7);size++){if(mode==='whole'&&size!==n)continue;const starts=mode==='whole'||mode==='start'?[0]:mode==='end'?[n-size]:Array.from({length:n-size+1},(_,i)=>i);if(starts.some(i=>words.has(text.slice(i,i+size))))return true}return false})};
 const type=(c,t)=>t==='any'||!t||t==='letter'&&/[a-z]/.test(c)||t==='digit'&&/[0-9]/.test(c)||t==='vowel'&&'aeiou'.includes(c)||t==='consonant'&&/[a-z]/.test(c)&&!'aeiou'.includes(c);
 let pools=Array.from({length:n},(_,i)=>[...alphabet].filter(c=>!value('exclude').includes(c)&&(!value('allowed')||value('allowed').includes(c))&&(!value('pattern')[i]||value('pattern')[i]==='?'||value('pattern')[i]===c)&&(!value('prefix')[i]||value('prefix')[i]===c)&&(!(i>=n-value('suffix').length)||value('suffix')[i-(n-value('suffix').length)]===c)&&(i!==0||type(c,f.first))&&(i!==n-1||type(c,f.last))&&(!['cvcv','vcvc'].includes(f.shape)||(i%2===(f.shape==='cvcv'?1:0)?'aeiou'.includes(c):/[a-z]/.test(c)&&!'aeiou'.includes(c)))));
 const groups=Array.from({length:n},(_,i)=>[i]);const join=(a,b)=>{const merged=[...new Set([...groups[a],...groups[b]])];for(const i of merged)groups[i]=merged};
 if(f.shape==='palindrome')for(let i=0;i<n/2;i++)join(i,n-1-i);
 if(f.shape==='aabb'){if(n%2)return [];for(let i=0;i<n;i+=2)join(i,i+1)}
 if(f.shape==='abab')for(let i=2;i<n;i++)join(i%2,i);
 const independent=[...new Map(groups.map(g=>[g.join(','),g])).values()];
 for(const g of independent){const common=pools[g[0]].filter(c=>g.every(i=>pools[i].includes(c)));for(const i of g)pools[i]=common}
 if(pools.some(p=>!p.length)||[...value('required')].some(c=>!pools.some(p=>p.includes(c))))return [];
 const placements=(fragment,word=false)=>{let starts=Array.from({length:n-fragment.length+1},(_,i)=>i);if(word){if(fragment.length<min||mode==='whole'&&fragment.length!==n)return [];if(mode==='whole'||mode==='start')starts=[0];if(mode==='end')starts=[n-fragment.length]}
 const found=[];for(const start of starts){let states=[{}];for(let off=0;off<fragment.length;off++){const c=fragment[off],choices=[c,...(word&&f.word_leet?Object.keys(leet).filter(d=>leet[d]===c):[])].filter(c=>pools[start+off].includes(c)),next=[];for(const state of states)for(const choice of choices){if(groups[start+off].some(i=>state[i]!==undefined&&state[i]!==choice))continue;const copy={...state};for(const i of groups[start+off])copy[i]=choice;next.push(copy)}states=next;if(!states.length)break}found.push(...states)}return found};
 let forced=value('contains')?placements(value('contains')):[{}];if(!forced.length)return [];
 if(f.english_only){const initial=forced;forced=[];let j=0;for(const word of words){if(word.length<=n)for(const p of placements(word,true))for(const a of initial)if(Object.keys(p).every(i=>a[i]===undefined||a[i]===p[i]))forced.push({...a,...p});if(++j%250===0){await new Promise(r=>setTimeout(r,0));if(stopped())return []}}if(!forced.length)return []}
 const banned=value('banned').split(',').map(x=>x.trim()).filter(Boolean);
 const matches=name=>(!f.english_only||wordMatch(name))&&name.includes(value('contains'))&&!banned.some(x=>name.includes(x))&&[...value('required')].every(c=>name.includes(c))&&(!f.unique||new Set(name).size===n)&&(!f.no_adjacent||[...name].every((c,i)=>i===0||c!==name[i-1]))&&[...name].every((c,i)=>groups[i].every(j=>c===name[j]))&&(f.shape!=='aabb'||new Set(name).size===n/2)&&(f.shape!=='abab'||new Set(name).size===2)&&[['vowels',c=>'aeiou'.includes(c)],['digits',c=>/[0-9]/.test(c)],['underscores',c=>c==='_']].every(([key,test])=>f[key]===-1||f[key]===undefined||[...name].filter(test).length===f[key]);
 const found=new Set(),pick=p=>p[Math.floor(Math.random()*p.length)];
 // Fully enumerate small spaces; larger spaces use bounded sampling.
 const space=independent.reduce((s,g)=>s*pools[g[0]].length,1),enumerate=space<=200000;
 const attempts=enumerate?space:Math.max(1000,f.limit*30);
 for(let a=0;a<attempts&&found.size<f.limit;a++){
  let chars=Array(n),fixed={};if(enumerate){let index=a;for(const g of independent){const pool=pools[g[0]],c=pool[index%pool.length];index=Math.floor(index/pool.length);for(const i of g)chars[i]=c}}else{chars=pools.map(pick);fixed=pick(forced);for(const i of Object.keys(fixed))chars[i]=fixed[i];const used=new Set(Object.keys(fixed).map(Number));for(const c of new Set(value('required'))){if(chars.includes(c))continue;const slots=pools.map((p,i)=>p.includes(c)&&!used.has(i)?i:-1).filter(i=>i!==-1);if(slots.length){const i=pick(slots);for(const j of groups[i]){chars[j]=c;used.add(j)}}}for(const g of independent)for(const i of g)chars[i]=chars[g[0]]}
  const name=chars.join('');if(matches(name))found.add(name);
  if(a%500===0){await new Promise(r=>setTimeout(r,0));if(stopped())return []}
 }
 return [...found];
}

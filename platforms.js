const reservedExtensions=/\.(?:git|atom|png|jpg|jpeg|gif|svg|ico|json|xml|html|css|js|txt|pdf|zip)$/i;
// Shared naming policy. Format validation never implies claimability.
export const PLATFORMS = {
 minecraft: {label:'Minecraft',scope:'Java Edition',min:3,max:16,limit:10000,rule:'3–16 Latin letters, numbers or underscores. Java names, not Xbox gamertags.',capability:'Public profile lookup can confirm Taken. Missing profiles may be locked, reserved or blocked; they remain Unknown.'},
 gitlab: {label:'GitLab',scope:'GitLab.com username',min:2,max:255,limit:2000,rule:'2–255 Latin letters, digits, underscores, hyphens or periods. Start with a letter or digit; no final period or reserved file extension.',capability:'Public signup namespace check with known reserved routes excluded. Ambiguous suffixes and possible Pages domains remain Unknown.'},
 lastfm: {label:'Last.fm',scope:'Account username',min:2,max:15,limit:2000,rule:'2–15 letters, numbers, underscores or hyphens; start with a letter.',capability:'Public signup username validator, using an anonymous CSRF session. No login or account creation.'},
 discord: {label:'Discord',scope:'Unique username, no #tag',min:2,max:32,limit:10000,rule:'2–32 lowercase Latin letters, numbers, underscores or periods. No consecutive periods.',capability:'Uses Discord’s public signup check. Available requires an explicit not-taken response; restrictions and failed requests are kept separate. Final claiming depends on Discord.'}
};
export const STATUSES=['Available','Taken','Restricted/Reserved','Invalid','Unknown'];
export function normalize(name){return name.trim().toLowerCase()}
export function validate(platform,name){
 if(platform==='minecraft')return /^[a-z0-9_]{3,16}$/.test(name)?null:PLATFORMS.minecraft.rule;
 if(platform==='discord')return /^[a-z0-9_.]{2,32}$/.test(name)&&!name.includes('..')?null:PLATFORMS.discord.rule;
 if(platform==='lastfm')return /^[a-z][a-z0-9_-]{1,14}$/.test(name)?null:PLATFORMS.lastfm.rule;
 if(platform==='gitlab')return name.length>=2&&name.length<=255&&/^[a-z0-9][a-z0-9_.-]*[a-z0-9_-]$/.test(name)&&!reservedExtensions.test(name)?null:PLATFORMS.gitlab.rule;
 throw Error('Unsupported platform');
}

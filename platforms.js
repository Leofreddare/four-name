// Shared naming policy. Format validation never implies claimability.
export const PLATFORMS = {
 minecraft: {label:'Minecraft',scope:'Java Edition',min:3,max:16,limit:10000,rule:'3–16 Latin letters, numbers or underscores. Java names, not Xbox gamertags.',capability:'Public profile lookup can confirm Taken. Missing profiles may be locked, reserved or blocked; they remain Unknown.'},
 tiktok: {label:'TikTok',scope:'Username, not nickname',min:2,max:24,limit:2000,rule:'Letters, numbers, underscores and periods; no final period. Lengths outside 2–24 require confirmation in TikTok.',capability:'Exact profile data can confirm Taken. Missing, private or blocked responses cannot establish availability.'},
 snapchat: {label:'Snapchat',scope:'Username, not display name',min:3,max:15,limit:2000,rule:'3–15 Latin letters, numbers, hyphen, underscore or period. Start with a letter; end with a letter or number. Phone numbers and policy violations are prohibited.',capability:'Exact public profile data can confirm Taken. Other accounts and reservations cannot be reliably verified publicly.'},
 discord: {label:'Discord',scope:'Unique username, no #tag',min:2,max:32,limit:10000,rule:'2–32 lowercase Latin letters, numbers, underscores or periods. No consecutive periods.',capability:'Unable to verify: no documented unauthenticated username availability API. Validate format here; confirm in Discord.'}
};
export const STATUSES=['Available','Taken','Restricted/Reserved','Invalid','Unknown'];
export function normalize(name){return name.trim().toLowerCase()}
export function validate(platform,name){
 if(platform==='minecraft')return /^[a-z0-9_]{3,16}$/.test(name)?null:PLATFORMS.minecraft.rule;
 if(platform==='discord')return /^[a-z0-9_.]{2,32}$/.test(name)&&!name.includes('..')?null:PLATFORMS.discord.rule;
 if(platform==='snapchat')return /^[a-z][a-z0-9_.-]{1,13}[a-z0-9]$/.test(name)?null:PLATFORMS.snapchat.rule;
 if(platform==='tiktok'){
  if(!/^[a-z0-9_.]+$/.test(name)||name.endsWith('.'))return PLATFORMS.tiktok.rule;
  // TikTok's official help documents characters, but not a reliable minimum.
  // Do not mislabel disputed length rules as authoritative Invalid results.
  return null;
 }
 throw Error('Unsupported platform');
}

// Optional integration probe: three positive profiles and one absent candidate.
// Does not test name claiming and does not request or accept credentials.
import {createChecker} from '../lookup.js';
const checker=createChecker();
for(const [platform,names] of [['discord',['nova']],['discord',['fncheck8x9p2']],['discord',['discordtest']],['minecraft',['notch','qzxv739']],['tiktok',['tiktok']],['snapchat',['teamsnapchat']]]){
 console.log(JSON.stringify(await checker.check(platform,names,new AbortController().signal),null,2));
}
const response=await fetch('https://api.minecraftservices.com/minecraft/profile/name/qzxv739/available',{signal:AbortSignal.timeout(10000)});
console.log('Unauthenticated Minecraft availability endpoint: HTTP '+response.status);
await response.body?.cancel();

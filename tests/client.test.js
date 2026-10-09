import {test} from 'node:test';import assert from 'node:assert/strict';import {generateCandidates} from '../public/generator.js';
const base={length:4,chars:'letters',limit:2000,first:'any',last:'any'};
test('generator defaults, filters, finite spaces and extended platform lengths',async()=>{
 const names=await generateCandidates(base);assert.equal(names.length,2000);assert.equal(new Set(names).size,2000);assert(names.every(n=>/^[a-z]{4}$/.test(n)));
 const exact=await generateCandidates({...base,pattern:'nova'});assert.deepEqual(exact,['nova']);assert.deepEqual(await generateCandidates({...base,prefix:'nova',suffix:'x'}),[]);
 const extended=await generateCandidates({...base,length:32,limit:100});assert.equal(extended.length,100);assert(extended.every(n=>n.length===32));
 const two=await generateCandidates({...base,length:2,limit:2000});assert.equal(two.length,676);
 const snap=await generateCandidates({...base,chars:'all',first:'letter',last:'letter'});assert(snap.every(n=>/^[a-z].*[a-z]$/.test(n)));
});
test('generator yields and handles cancellation or contradictory filters',async()=>{
 let checks=0;const names=await generateCandidates({...base,limit:10000},()=>++checks>=1);assert.deepEqual(names,[]);await assert.rejects(generateCandidates({...base,length:33}),/Invalid/);await assert.rejects(generateCandidates({...base,prefix:'a!'}),/letters/);assert.deepEqual(await generateCandidates({...base,allowed:'a',exclude:'a'}),[]);
});

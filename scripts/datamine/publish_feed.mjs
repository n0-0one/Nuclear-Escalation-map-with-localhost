// Runs only in the write-permission job after candidate validation and browser tests.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const repo='n0-0one/Nuclear-Escalation-map-with-localhost',branch='codex/windows-data-v1';
if(process.env.GITHUB_REPOSITORY!==repo||process.env.GITHUB_REF!=='refs/heads/main')throw new Error('Unexpected publication context');
const root=process.argv[2]||'.local/windows-feed',manifest=JSON.parse(readFileSync(`${root}/manifest.json`,'utf8'));
if(manifest.formatVersion!==1||!/^packs\/[a-f0-9]{64}\.json$/.test(manifest.pack)||manifest.pack!==`packs/${manifest.sha256}.json`)throw new Error('Invalid data manifest');
const payload=readFileSync(`${root}/${manifest.pack}`);
if(payload.length!==manifest.bytes||payload.length>32*1024*1024||createHash('sha256').update(payload).digest('hex')!==manifest.sha256)throw new Error('Data artifact failed integrity validation');
const token=process.env.GITHUB_TOKEN;if(!token)throw new Error('Missing workflow token');
async function api(path,method='GET',body){const response=await fetch(`https://api.github.com/repos/${repo}${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===404&&method==='GET')return null;if(!response.ok)throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);return response.status===204?null:response.json();}
const head=await api(`/git/ref/heads/${branch}`);
const old=head?await api(`/contents/manifest.json?ref=${encodeURIComponent(branch)}`):null;
if(old){const previous=JSON.parse(Buffer.from(old.content,'base64').toString());if(previous.sha256===manifest.sha256){console.log('Validated Windows data is already published.');process.exit(0);}}
manifest.publishedAt=Date.now();
const payloadBlob=await api('/git/blobs','POST',{content:payload.toString('base64'),encoding:'base64'});
const manifestBlob=await api('/git/blobs','POST',{content:JSON.stringify(manifest,null,2)+'\n',encoding:'utf-8'});
const current=head?await api(`/git/commits/${head.object.sha}`):null;
const tree=await api('/git/trees','POST',{...(current?{base_tree:current.tree.sha}:{}),tree:[{path:manifest.pack,mode:'100644',type:'blob',sha:payloadBlob.sha},{path:'manifest.json',mode:'100644',type:'blob',sha:manifestBlob.sha}]});
const commit=await api('/git/commits','POST',{message:`Publish validated Windows datamine ${manifest.datamineCommit.slice(0,12)}`,tree:tree.sha,parents:head?[head.object.sha]:[]});
if(head)await api(`/git/refs/heads/${branch}`,'PATCH',{sha:commit.sha,force:false});
else await api('/git/refs','POST',{ref:`refs/heads/${branch}`,sha:commit.sha});
console.log(`Published Windows data ${manifest.datamineCommit} (${payload.length} bytes) to ${branch}.`);

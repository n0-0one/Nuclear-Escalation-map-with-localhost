// Uses Git Credential Manager only after the user signs in. Credentials never touch disk or logs.
import {spawnSync} from 'node:child_process';
const repository='n0-0one/Nuclear-Escalation-map-with-localhost';
const credential=spawnSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'},windowsHide:true});
if(credential.status!==0){console.error('Git credentials unavailable; sign in to Git Credential Manager first.');process.exit(1);}
const token=credential.stdout.split('\n').find(s=>s.startsWith('password='))?.slice(9).trim();
if(!token)throw new Error('Git credential did not contain an authentication secret');
async function api(path,method='GET',body){const response=await fetch(`https://api.github.com/repos/${repository}${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null};}
if(process.argv.includes('--enable')){
  const status=await api('/pages');
  const result=status.status===404?await api('/pages','POST',{build_type:'workflow'}):await api('/pages','PUT',{build_type:'workflow'});
  console.log(JSON.stringify({action:'configure-pages',status:result.status,message:result.body?.message,url:result.body?.html_url}));
  if(result.status>=400)process.exit(1);
  const dispatch=await api('/actions/workflows/pages.yml/dispatches','POST',{ref:'main'});console.log(JSON.stringify({action:'dispatch',status:dispatch.status,message:dispatch.body?.message}));
}else{
  const pages=await api('/pages'),runs=await api('/actions/runs?per_page=5');
  console.log(JSON.stringify({pages:{status:pages.status,url:pages.body?.html_url,message:pages.body?.message},runs:runs.body?.workflow_runs?.map(r=>({id:r.id,name:r.name,status:r.status,conclusion:r.conclusion,url:r.html_url}))},null,2));
}

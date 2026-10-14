import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const build=process.argv[2]==='build',win=process.platform==='win32';
function run(file,args,cwd,shell=win){const result=spawnSync(file,args,{cwd,stdio:'inherit',shell});if(result.status!==0)process.exit(result.status||1);}
if(build)run(win?'npm.cmd':'npm',['run','build'],process.cwd());
run(process.execPath,[resolve('node_modules/@tauri-apps/cli/tauri.js'),build?'build':'dev'],resolve('apps/desktop'),false);

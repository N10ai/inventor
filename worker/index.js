import {extract} from './extract.js';
import {assets} from './assets.generated.js';
export default {async fetch(request,env){const path=new URL(request.url).pathname;if(path==='/api/extract')return extract(request,env);const file=assets[path==='/'?'/index.html':path];if(!file)return new Response('Not found',{status:404});const bytes=Uint8Array.from(atob(file.body),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':file.type,'Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache'}});}};

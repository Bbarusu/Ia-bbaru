import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const source=await readFile(new URL('../../extension/background.js',import.meta.url),'utf8');
function harness(){
  let handler,onNative,onDisconnect,posts=[];
  const event={addListener(){}};
  const port={onMessage:{addListener(fn){onNative=fn;}},onDisconnect:{addListener(fn){onDisconnect=fn;}},postMessage(v){posts.push(v);}};
  const browser={runtime:{id:'ours',getURL:()=> 'moz-extension://ours/',onMessage:{addListener(fn){handler=fn;}},onInstalled:event,connectNative:()=>port},
    action:{onClicked:event},contextMenus:{onClicked:event},storage:{local:{get:async()=>({})}}};
  vm.runInNewContext(source,{browser,crypto:{randomUUID},setTimeout,clearTimeout});
  return {send:(msg,sender={id:'ours',url:'moz-extension://ours/app/index.html'})=>handler(msg,sender),posts,
    respond:val=>onNative(val),disconnect:()=>onDisconnect()};
}
test('web pages and other extensions cannot access native bridge',async()=>{
  const h=harness();
  for(const sender of [{id:'ours',url:'https://evil.example'},{id:'other',url:'moz-extension://ours/app/index.html'}])
    assert.equal(await h.send({type:'bridge.request'},sender),undefined);
  assert.equal(h.posts.length,0);
});
test('unknown operations do not leave the extension',async()=>{
  const h=harness();const response=await h.send({type:'bridge.request',request:{protocol_version:'0',request_id:randomUUID(),operation:'shell.execute'}});
  assert.equal(response.ok,false);assert.equal(h.posts.length,0);
});
test('concurrent responses are correlated and a disconnect rejects pending requests',async()=>{
  const h=harness();const id=randomUUID();
  const promise=h.send({type:'bridge.request',request:{protocol_version:'0',request_id:id,operation:'projects.list',params:{}}});
  h.respond({request_id:'unrelated',ok:true});h.respond({request_id:id,ok:true,data:{items:[]}});
  assert.equal((await promise).request_id,id);
  const second=h.send({type:'bridge.request',request:{protocol_version:'0',request_id:randomUUID(),operation:'projects.list',params:{}}});
  h.disconnect();assert.equal((await second).error.code,'host_disconnected');
});

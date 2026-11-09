import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceContent, taskState, validateDraft } from '../src/logic.mjs';
test('capture preserves selected text and provenance',()=>{
  const hostile='<script>doSomething()</script>';
  assert.equal(sourceContent('Aula','https://example.com',hostile),`Aula\nOrigem: https://example.com\n\n${hostile}`);
  assert.equal(sourceContent('Nota','',hostile),hostile);
});
test('partial or failed results are never labelled as successful',()=>{
  for(const state of ['failed','incomplete','interrupted','unknown'])assert.notEqual(taskState(state),'Concluída');
  assert.equal(taskState('completed'),'Concluída');
});
test('planning requires context owner, a prompt and available selected agents',()=>{
  const valid={projectId:'p',text:'Explique',selectedModels:['a'],review:false};
  assert.equal(validateDraft(valid),null);
  for(const change of [{projectId:''},{text:' '},{text:'x'.repeat(8001)},{selectedModels:[]},{review:true}])assert.ok(validateDraft({...valid,...change}));
});

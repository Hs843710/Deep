import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync('pios/index.html','utf8');
const css=readFileSync('pios/command-navigation.css','utf8');
const script=readFileSync('pios/command-navigation.js','utf8');
const existing=readFileSync('pios/outcome-ui.js','utf8');
const names=['command','twin','world','decide','act','system'];
for(const name of names){
  assert.match(html,new RegExp('data-pios-go="'+name+'"'),name+' workspace missing');
  assert.match(css,new RegExp('data-pios-view="'+name+'"'),name+' workspace styles missing');
}
for(const id of ['authBtn','refreshBtn','settingsBtn','globeWrap','globe','goalTitle','moveTitle','connectionStatus','piosNavigation','workspaceTitle']){
  assert.ok(html.includes('id="'+id+'"'),'core UI lost: '+id);
}
assert.ok(existing.includes("id='actionLearning'")||existing.includes('id="actionLearning"'),'outcome controls must remain');
assert.ok(html.includes('command-navigation.js')&&html.includes('command-navigation.css'),'navigation assets must load');
assert.ok(css.includes('.capital-panel'),'capital firewall must be retained at home');
assert.ok(css.includes('.world-stage'),'Earth must remain a first-class workspace');

function classList(){
 const v=new Set();
 return {add(x){v.add(x)},remove(x){v.delete(x)},contains(x){return v.has(x)},
  toggle(x,forced){const set=forced===undefined?!v.has(x):forced;set?v.add(x):v.delete(x);return set}};
}
const clicked=[];
const ids={};
const element=(id)=>ids[id]??(ids[id]={id,classList:classList(),dataset:{},attributes:{},listeners:{},
 setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.listeners[k]=fn},
 click(){clicked.push(this.id);this.listeners.click?.()},scrollIntoView(){}});
const buttons=names.map(name=>{const b=element('button-'+name);b.dataset.piosGo=name;return b});
const stage=element('stage');
const docListeners={};
const document={
 readyState:'complete',body:{dataset:{}},getElementById:id=>ids[id]||null,
 querySelector(selector){if(selector==='.world-stage')return stage;if(selector==='.workspace-header')return element('header');return null},
 querySelectorAll(selector){return selector==='[data-pios-go]'?buttons:[]},
 addEventListener:(name,fn)=>{docListeners[name]=fn}
};
for(const id of ['piosNavigation','worldModeBtn','twinModeBtn','workspaceTitle','workspaceHint','piosModelButton','settingsBtn','authBtn'])element(id);
element('piosNavigation').querySelectorAll=()=>buttons;
const window={};
runInNewContext(script,{document,window});
assert.equal(document.body.dataset.piosView,'command');
assert.equal(element('button-command').attributes['aria-current'],'page');
assert.ok(stage.classList.contains('twin-mode'),'Earth + Twin is the default');
window.piosNavigate('world',{scroll:false});
assert.equal(document.body.dataset.piosView,'world');
assert.ok(stage.classList.contains('world-mode')&&!stage.classList.contains('twin-mode'));
window.piosNavigate('act',{scroll:false});
assert.equal(document.body.dataset.piosView,'act');
window.piosNavigate('command',{scroll:false});
assert.ok(stage.classList.contains('twin-mode')&&!stage.classList.contains('world-mode'),'home must restore Earth + Twin');
element('piosModelButton').click();
assert.equal(document.body.dataset.piosView,'twin');
assert.ok(clicked.includes('settingsBtn'),'model shortcut must invoke existing settings, not duplicate it');
element('settingsBtn').classList.add('hidden');
element('piosModelButton').click();
assert.ok(clicked.includes('authBtn'),'model shortcut must open Connect when signed out');
assert.ok(css.includes('.next-move>#strategyContext')&& !css.includes('.next-move>:not(#actionLearning)'),
  'Action workspace must retain the approval buttons on the strategy card');
docListeners.click({target:{closest:()=>element('worldModeBtn')}});
assert.equal(document.body.dataset.piosView,'world','globe switch must keep global navigation in sync');
console.log('PASS command-navigation: 6 views, Earth + Twin default, globe switch, Connect and core controls retained, model shortcut');

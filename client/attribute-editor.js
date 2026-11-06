(() => {
  const M=globalThis.AttributeDna,shared=globalThis.AttributeDnaEditor,$=id=>document.getElementById(id);
  const copy={title:'속성 제작기',templates:'속성 템플릿',templateName:'템플릿 이름',save:'저장',export:'내보내기',import:'불러오기',sequence:'DNA 서열',nestLevel:'둥지 레벨',remove:'조각 삭제',fit:'전체 보기',zoomIn:'확대',zoomOut:'축소'};
  const icons={"save":"M4 3h13l4 4v14H3V3h1m3 0v6h10V3M7 21v-8h10v8","export":"M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5","import":"M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5","remove":"M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6","fit":"M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M8 12h8m-4-4v8","plus":"M5 12h14M12 5v14","minus":"M5 12h14"};
  const storage='spawner.attribute.dna.v1',libraryStorage='spawner.attribute.dna.templates.v1';
  let library=[];
  function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icons[name]+'"/></svg>';}
  function button(id,glyph,label){$(id).innerHTML=icon(glyph);$(id).setAttribute('aria-label',copy[label]);$(id).title=copy[label];}
  function persist(design){try{localStorage.setItem(storage,JSON.stringify(design));localStorage.setItem(libraryStorage,JSON.stringify(library));}catch{}}
  function refresh(design){const {stats,base}=shared.dnaDesignStats(M,design.pieces);shared.renderDnaDesignStats($('stats'),{...stats,loadSpeed:undefined},base,false);$('sequence').textContent=design.pieces.map(piece=>M.lookup.get(piece.gene).code).join(' ');$('nest-level').value=String(design.level);persist(design);}
  const editor=shared.createDnaEditor($('editor'),M,refresh);
  $('editor').querySelector('.dna-catalog').prepend($('progression'));
  $('progression').hidden=false;
  function loadDesign(design){const value=M.validate(design);if(!value)return false;editor.context(value.level,0,false);if(!editor.load(value,false))return false;refresh(editor.getDesign());editor.fit();$('file-status').textContent='';$('file-status').hidden=true;return true;}
  function renderTemplates(){$('templates').replaceChildren();library.forEach((entry,index)=>{const row=document.createElement('div');row.className='template-entry';const load=document.createElement('button');load.textContent=entry.name;load.onclick=()=>{if(loadDesign(entry.design))$('template-name').value=entry.name;};const remove=document.createElement('button');remove.innerHTML=icon('remove');remove.setAttribute('aria-label',copy.remove);remove.onclick=()=>{library.splice(index,1);persist(editor.getDesign());renderTemplates();};row.append(load,remove);$('templates').append(row);});}
  document.title=copy.title;
  document.querySelectorAll('[data-copy]').forEach(element=>element.textContent=copy[element.dataset.copy]);
  for(const [id,glyph,label] of [['save-template','save','save'],['export','export','export'],['import','import','import'],['zoom-out','minus','zoomOut'],['fit','fit','fit'],['zoom-in','plus','zoomIn']])button(id,glyph,label);
  $('template-name').setAttribute('aria-label',copy.templateName);
  $('nest-level').setAttribute('aria-label',copy.nestLevel);
  $('nest-level').onchange=()=>{const value=Number($('nest-level').value);if(!Number.isInteger(value)||value<1||value>4)return;editor.context(value,0,false);refresh(editor.getDesign());editor.fit();};
  $('zoom-out').onclick=()=>{editor.zoom(1/1.2);$('editor').querySelector('.dna-editor').focus({preventScroll:true});};
  $('fit').onclick=()=>{editor.fit();$('editor').querySelector('.dna-editor').focus({preventScroll:true});};
  $('zoom-in').onclick=()=>{editor.zoom(1.2);$('editor').querySelector('.dna-editor').focus({preventScroll:true});};
  $('save-template').onclick=()=>{const name=$('template-name').value.trim();if(!name){$('template-name').focus();return;}const existing=library.findIndex(entry=>entry.name===name),entry={name,design:editor.getDesign()};if(existing<0)library.unshift(entry);else library[existing]=entry;library=library.slice(0,60);persist(editor.getDesign());editor.load(editor.getDesign(),false);renderTemplates();};
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify(editor.getDesign(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='Attribute-DNA.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);};
  $('import').onclick=()=>$('file').click();
  $('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>300000)throw new Error();if(!loadDesign(JSON.parse(await file.text())))throw new Error();}catch{$('file-status').textContent='파일을 읽을 수 없습니다';$('file-status').hidden=false;}$('file').value='';};
  let saved=null;
  try{saved=M.validate(JSON.parse(localStorage.getItem(storage)||'null'));const list=JSON.parse(localStorage.getItem(libraryStorage)||'[]');if(Array.isArray(list))library=list.map(entry=>({name:entry?.name,design:M.validate(entry?.design)})).filter(entry=>typeof entry.name==='string'&&entry.name.length<=32&&entry.design).slice(0,60);}catch{}
  loadDesign(saved||{version:3,pieces:[],budget:0,level:1});
  renderTemplates();
  globalThis.AttributeEditor=editor;
})();

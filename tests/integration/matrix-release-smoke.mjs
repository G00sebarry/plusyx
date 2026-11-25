import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

// Serve only built files, keep all authentication and DB traffic inside the test.
const root = path.resolve(process.argv[2] || 'dist');
const app = 'http://localhost:4186';
const owner = '00000000-0000-4000-8000-000000000001';
const user = { id: owner, aud: 'authenticated', email: 'matrix@example.invalid',
  role: 'authenticated', user_metadata: {}, app_metadata: {} };
let matrix;
const browser = await chromium.launch({channel:'msedge'});
try {
  async function openMatrix() {
    const ctx = await browser.newContext({reducedMotion:'reduce', serviceWorkers:'block'});
    await ctx.addInitScript(({user,app})=>{
      if (location.origin!==app) return;
      localStorage.setItem('sb-gkpmtysnionkfutnybkp-auth-token', JSON.stringify({
        access_token:'synthetic',refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,
        token_type:'bearer',user
      }));
    },{user,app});
    await ctx.route('**/*',async route=>{
      const req=route.request(), url=new URL(req.url());
      if(url.origin===app){
        const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
        const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
        try {return await route.fulfill({body:await readFile(path.join(root,file)),contentType:types[path.extname(file)]});}
        catch {return route.fulfill({status:404});}
      }
      if(url.hostname!=='gkpmtysnionkfutnybkp.supabase.co')return route.abort();
      let data=[];
      if(url.pathname==='/auth/v1/user')data=user;
      if(url.pathname==='/rest/v1/columns')data=[{id:'todo',title:'Test',position:0}];
      if(url.pathname==='/rest/v1/life_matrices'){
        if(req.method()==='GET')data=matrix?[matrix]:[];
        else {
          const changes=req.postDataJSON();
          if(req.method()==='POST')assert.equal(changes.owner_id,owner);
          if(req.method()==='PATCH')assert.equal(url.searchParams.get('revision'),'eq.'+matrix.revision);
          matrix={...matrix,...changes};
          data={revision:matrix.revision};
        }
      }
      return route.fulfill({json:data});
    });
    const page=await ctx.newPage();
    await page.goto(app);
    await page.getByRole('button',{name:'Матрица',exact:true}).click();
    const frame=page.frameLocator('iframe[title="Матрица 9×9"]');
    await frame.locator('#matrix [data-area="0"]').first().click();
    await frame.locator('.bloom [data-card="0"]').first().click();
    return {ctx,frame,page};
  }
  const first=await openMatrix();
  await first.frame.locator('.studioTitle').fill('Проверка выпуска');
  await first.page.getByRole('button',{name:'Доска',exact:true}).click();
  await expect.poll(()=>matrix?.snapshot.areas[0].cards[0].title).toBe('Проверка выпуска');
  await first.ctx.close();
  const second=await openMatrix();
  await expect(second.frame.locator('.studioTitle')).toHaveValue('Проверка выпуска');
  console.log('PASS: compiled app navigation, matrix assets, autosave and clean-session restore');
} finally {await browser.close();}

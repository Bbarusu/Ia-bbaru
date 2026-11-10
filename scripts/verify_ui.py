"""UI checks in real Firefox/Gecko, real backend+bridge, simulated WebExtension APIs.

Run after npm run build; requires optional `playwright` Python package and Firefox
browser installed by Playwright. It never signs into or calls an AI provider.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import tempfile
import threading

from fastapi.testclient import TestClient
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from backend.main import create_app
from native_host.bridge import Bridge


def main():
    artifacts=ROOT/'artifacts';artifacts.mkdir(exist_ok=True)
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *args): pass
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT/'frontend/dist')))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    url=f'http://127.0.0.1:{server.server_port}'
    token='ui-tests-only-no-real-credential-0123456789'
    with tempfile.TemporaryDirectory() as folder, TestClient(create_app(Path(folder)/'ui.db',token),
            headers={'Authorization':f'Bearer {token}'}) as client, sync_playwright() as pw:
        bridge=Bridge(client)
        browser=pw.firefox.launch(headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1080})
        errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
        page.expose_function('testNativeBridge', bridge.handle)
        page.add_init_script("""(() => {
          const listeners=[];
          window.browser={runtime:{sendMessage:async msg=>{
            if(msg.type==='bridge.request')return window.testNativeBridge(msg.request);
            if(msg.type==='capture.read')return JSON.parse(localStorage.getItem('testCapture')||'null');
            if(msg.type==='capture.clear'){
              const cur=JSON.parse(localStorage.getItem('testCapture')||'null');
              if(!msg.id || (cur && cur.id===msg.id))localStorage.removeItem('testCapture');
              return {ok:true};
            }
            if(msg.type==='capture.selection')return {ok:false,error:{message:'Selecione um trecho no Firefox.'}};
          }},storage:{local:{get:async key=>({[key]:localStorage.getItem(key)}),set:async values=>{
            for(const [key,val] of Object.entries(values))localStorage.setItem(key,val);
          },remove:async key=>localStorage.removeItem(key)},onChanged:{addListener:fn=>listeners.push(fn),removeListener:()=>{}}}};
          window.testCapture=cap=>{
            localStorage.setItem('testCapture',JSON.stringify(cap));
            listeners.forEach(fn=>fn({pendingCapture:{newValue:cap}}));
          };
        })();""")
        page.goto(url)
        expect(page.get_by_text('Backend local ativo',exact=True)).to_be_visible()
        page.get_by_role('button',name='Novo projeto',exact=True).first.click()
        page.get_by_label('Nome do projeto').fill('Pesquisa da faculdade')
        page.get_by_role('dialog').get_by_role('button',name='Criar projeto',exact=True).click()
        expect(page.locator('#project')).to_have_value(client.get('/v1/projects').json()['items'][0]['id'])
        expect(page.locator('ul.project-list > li > button[aria-current="true"]')).to_have_text('Pesquisa da faculdade')
        page.get_by_role('button',name='Adicionar texto',exact=True).click()
        page.get_by_label('Título',exact=True).fill('Anotações sobre agentes')
        hostile='Agentes usam contexto. <script>window.stolen=true</script>'
        page.get_by_label('Conteúdo',exact=True).fill(hostile)
        page.get_by_role('button',name='Salvar no projeto',exact=True).click()
        expect(page.get_by_role('heading',name='Anotações sobre agentes')).to_be_visible()
        assert page.evaluate('window.stolen') is None
        page.locator('#instruction').fill('Compare as ideias deste material.')
        page.reload();expect(page.locator('#instruction')).to_have_value('Compare as ideias deste material.')
        expect(page.get_by_role('button',name='Criar plano',exact=True)).to_be_disabled()
        expect(page.get_by_text('Nenhuma IA conectada.',exact=False)).to_be_visible()
        # Path A: Capture A opens, user edits it, Capture B arrives and stays queued until user finishes A.
        page.evaluate("window.testCapture({id:'capture-a',title:'Uma referência',url:'https://example.org/aula',text:'Trecho escolhido pelo usuário.'})")
        expect(page.get_by_role('dialog')).to_be_visible()
        page.get_by_label('Título',exact=True).fill('Uma referência editada')
        page.evaluate("window.testCapture({id:'capture-b',title:'Segunda referência',url:'https://example.org/aula-2',text:'Segundo trecho capturado.'})")
        expect(page.get_by_label('Título',exact=True)).to_have_value('Uma referência editada')
        expect(page.get_by_text('Uma nova captura está aguardando. Conclua o material atual.')).to_be_visible()
        project=client.get('/v1/projects').json()['items'][0]
        assert len(client.get(f"/v1/projects/{project['id']}/sources").json()['items'])==1
        page.get_by_role('button',name='Salvar no projeto',exact=True).click()
        expect(page.get_by_role('heading',name='Uma referência editada')).to_be_visible()
        assert page.evaluate("JSON.parse(localStorage.getItem('testCapture')||'null')?.id") == 'capture-b'
        page.get_by_role('button',name='Revisar nova captura',exact=True).click()
        expect(page.get_by_label('Título',exact=True)).to_have_value('Segunda referência')
        page.get_by_role('button',name='Salvar no projeto',exact=True).click()
        expect(page.get_by_role('heading',name='Segunda referência')).to_be_visible()
        assert page.evaluate("localStorage.getItem('testCapture')") is None
        # Path B: Manual draft is open, Capture C arrives -> user explicitly confirms replacement inside the dialog.
        page.get_by_role('button',name='Adicionar texto',exact=True).click()
        page.get_by_label('Título',exact=True).fill('Rascunho temporário')
        page.get_by_label('Conteúdo',exact=True).fill('Texto que será substituído após confirmação.')
        page.evaluate("window.testCapture({id:'capture-c',title:'Terceira referência',url:'https://example.org/aula-3',text:'Terceiro trecho confirmado.'})")
        expect(page.get_by_label('Título',exact=True)).to_have_value('Rascunho temporário')
        page.get_by_role('button',name='Substituir pela captura em espera',exact=True).click()
        expect(page.get_by_label('Título',exact=True)).to_have_value('Terceira referência')
        page.get_by_role('button',name='Descartar trecho',exact=True).click()
        records=client.get(f"/v1/projects/{project['id']}/sources").json()['items']
        assert len(records)==3 and 'https://example.org/aula' in records[1]['content'] and 'https://example.org/aula-2' in records[2]['content']
        page.screenshot(path=str(artifacts/'workspace-firefox.png'),full_page=True)
        page.set_viewport_size({'width':360,'height':900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
        expect(page.get_by_role('button',name='Biblioteca',exact=True)).to_be_visible()
        page.get_by_role('button',name='Biblioteca',exact=True).click()
        page.get_by_role('textbox',name='Buscar materiais').fill('sem-correspondencia')
        expect(page.get_by_text('Nenhum material encontrado.',exact=True)).to_be_visible()
        page.get_by_role('textbox',name='Buscar materiais').fill('')
        page.get_by_role('button',name='Área de trabalho',exact=True).click()
        page.screenshot(path=str(artifacts/'sidebar-firefox.png'),full_page=True)
        page.get_by_role('button',name='Conexões',exact=True).click()
        expect(page.get_by_text('Nenhum serviço de IA disponível.',exact=False)).to_be_visible()
        assert not errors,errors
        # Plain browser mode must not silently switch to demo or invent accounts.
        plain=browser.new_page(viewport={'width':360,'height':900});plain.goto(url)
        expect(plain.get_by_text('Modo desconectado',exact=True)).to_be_visible()
        expect(plain.get_by_role('button',name='Criar plano',exact=True)).to_be_disabled()
        assert not plain.get_by_text('Demonstração visual',exact=False).count()
        # Demo mode is explicit and labelled; no real gateway ever called.
        demo=browser.new_page(viewport={'width':1440,'height':1080});demo.goto(url+'/?demo=1')
        expect(demo.get_by_text('Demonstração visual',exact=False)).to_be_visible()
        demo.get_by_role('button',name='Agente de exemplo',exact=False).click()
        demo.locator('#instruction').fill('Pedido demonstrativo')
        demo.screenshot(path=str(artifacts/'demo-firefox.png'),full_page=True)
        demo.get_by_role('button',name='Criar plano',exact=True).click()
        expect(demo.get_by_role('dialog')).to_be_visible()
        expect(demo.get_by_text('Plano salvo. A execução durável não está disponível nesta conexão.')).to_be_visible()
        browser.close()
    server.shutdown()
    print('Firefox UI checks passed: real backend/library/capture, draft persistence, unavailable gateway, 360px layout, labelled demo plan.')


if __name__=='__main__': main()

import io
import json
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.main import create_app
from native_host.bridge import Bridge, MAX_BYTES, serve
from native_host.install import prepare
from native_host.__main__ import load_config


class SmallReads(io.BytesIO):
    def read(self, size=-1):
        return super().read(min(size, 2))


class NativeHostTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.token = 'test-local-bridge-token-not-real-0123456789'
        self.client = TestClient(create_app(self.root/'test.db', self.token),
                                 headers={'Authorization':f'Bearer {self.token}'})
        self.client.__enter__()
        self.bridge = Bridge(self.client)

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def call(self, operation, **params):
        return self.bridge.handle({'protocol_version':'0','request_id':str(uuid4()),
                                   'operation':operation,'params':params})

    def test_full_project_and_source_flow_persists_selected_text(self):
        project = self.call('projects.create', title='Faculdade')['data']
        source = self.call('sources.create', project_id=project['id'], title='Aula',
                           content='Texto selecionado <script>não executar</script>')['data']
        page = self.call('sources.list', project_id=project['id'])['data']
        self.assertNotIn('content', page['items'][0])
        self.assertEqual(page['items'][0]['id'], source['id'])
        full = self.call('sources.get', project_id=project['id'], source_id=source['id'])['data']
        self.assertEqual(full['content'], source['content'])
        other = self.call('projects.create', title='Outro')['data']
        self.assertEqual(self.call('sources.get', project_id=other['id'], source_id=source['id'])['error']['code'], 'http_404')

    def test_missing_gateway_does_not_prevent_library(self):
        self.assertTrue(self.call('projects.create', title='Meu projeto')['ok'])
        self.assertEqual(self.call('models.list')['error']['code'],'http_503')
        self.assertFalse(self.call('bridge.info')['data']['task_execution'])

    def test_unknown_operations_paths_and_extra_fields_never_reach_backend(self):
        self.assertEqual(self.call('tasks.execute', task_id=str(uuid4()))['error']['code'],'unsupported_operation')
        self.assertEqual(self.call('sources.list', project_id='../../secrets')['error']['code'],'invalid_request')
        self.assertEqual(self.call('projects.list', url='https://elsewhere.example')['error']['code'],'invalid_request')
        self.assertEqual(self.call('projects.create', title='x', token='secret')['error']['code'],'invalid_request')

    def test_malformed_envelopes_are_sanitized(self):
        for raw in [None, [], {'request_id':'bad','params':{'token':'never echo'}}]:
            result = self.bridge.handle(raw)
            self.assertFalse(result['ok'])
            self.assertNotIn('never echo',json.dumps(result))

    def test_fragmented_frames_and_multiple_messages(self):
        messages = [{'protocol_version':'0','request_id':str(uuid4()),'operation':'bridge.info','params':{}} for _ in range(2)]
        wire = b''.join(struct.pack('=I',len(b))+b for b in [json.dumps(m).encode() for m in messages])
        out=io.BytesIO();serve(self.bridge,SmallReads(wire),out);out.seek(0)
        for expected in messages:
            size=struct.unpack('=I',out.read(4))[0]
            result=json.loads(out.read(size))
            self.assertEqual(result['request_id'],expected['request_id'])
            self.assertTrue(result['ok'])
        self.assertEqual(out.read(),b'')

    def test_invalid_and_truncated_frames_fail_without_partial_output(self):
        for wire in [b'\x01',struct.pack('=I',MAX_BYTES+1),struct.pack('=I',5)+b'{}',struct.pack('=I',1)+b'!']:
            out=io.BytesIO()
            with self.assertRaises(ValueError):serve(self.bridge,io.BytesIO(wire),out)
            self.assertEqual(out.getvalue(),b'')

    def test_backend_pagination_is_complete_and_stable(self):
        for i in range(33):self.call('projects.create',title=f'Projeto {i}')
        first=self.call('projects.list')['data']
        second=self.call('projects.list',offset=first['next_offset'])['data']
        self.assertEqual(len(first['items']),30);self.assertEqual(len(second['items']),3)
        self.assertEqual(len({p['id'] for p in first['items']+second['items']}),33)
        self.assertIsNone(second['next_offset'])

    def test_installer_preserves_token_and_only_authorizes_our_extension(self):
        config,manifest=prepare(self.root/'local')
        first=load_config(config)
        prepare(self.root/'local')
        self.assertEqual(load_config(config)['token'],first['token'])
        self.assertEqual(json.loads(manifest.read_text())['allowed_extensions'],['ia-bbaru@bbarusu.local'])
        config.write_text(json.dumps({**first,'backend_url':'https://example.com'}))
        with self.assertRaises(ValueError):load_config(config)

    def test_native_process_exchanges_real_framed_bytes_without_token_in_response(self):
        config,_=prepare(self.root/'process')
        message=json.dumps({'protocol_version':'0','request_id':str(uuid4()),'operation':'bridge.info','params':{}}).encode()
        proc=subprocess.run([sys.executable,'-m','native_host','--config',str(config)],
                            input=struct.pack('=I',len(message))+message,capture_output=True,timeout=10)
        self.assertEqual(proc.returncode,0,proc.stderr)
        size=struct.unpack('=I',proc.stdout[:4])[0]
        response=json.loads(proc.stdout[4:4+size])
        self.assertTrue(response['ok'])
        self.assertNotIn(load_config(config)['token'],proc.stdout.decode(errors='replace'))


if __name__=='__main__':unittest.main()

"""CLI stream assembly stays internal; synthetic envelopes only."""
import copy
import json
import unittest
import subprocess
import sys
from pathlib import Path
from integrations.stream_output import assemble, decode_output
from integrations.models import served_pattern
from integrations.failures import category_from, signature
from fixtures.fake_claude import stream_events
from test_gateway import GatewayTestCase, request_body


class StreamGatewayTests(GatewayTestCase):
    def test_stream_lifecycle_is_sanitized_and_never_generated_twice(self):
        cases = {"trailing_metadata": None, "synthetic_notice": None,
                 "trailing_assistant": "provider_invalid_output", "usage_limit": "provider_quota_exceeded",
                 **{mode: "provider_model_mismatch" for mode in (
                    "model_refusal_fallback", "model_consent_fallback", "model_refusal_no_fallback", "trailing_fallback")}}
        for i, (mode, code) in enumerate(cases.items(), 1):
            with self.subTest(mode=mode):
                self.set_mode(FAKE_CLAUDE_MODE=mode)
                body = request_body(request_id=f"lifecycle-{i}:0", protocol_version="1.2", allow_unenforced_output_limit=True)
                response = self.client.post("/v1.2/generate", json=body)
                if code:
                    self.assertEqual(response.json()["error"]["code"], code)
                else:
                    self.assertEqual(response.status_code, 200, response.text)
                    self.assertEqual(response.json()["output"], "Resposta do dublê de teste")
                self.assertNotIn("conteudo-sensivel", response.text)
                self.assertEqual(self.client.post("/v1.2/generate", json=body).json(), response.json())
                self.assertEqual(self.runner.generations, i)

    def test_multiblock_answer_is_whole_and_replayed_once(self):
        self.set_mode(FAKE_CLAUDE_MODE='multi_block')
        body = request_body(protocol_version='1.2', allow_unenforced_output_limit=True)
        first = self.client.post('/v1.2/generate', json=body)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()['output'], 'Primeira parte (fonte Aula).')
        self.assertEqual(first.json()['finish_reason'], 'stop')
        self.assertEqual(self.client.post('/v1.2/generate', json=body).json(), first.json())
        self.assertEqual(self.runner.generations, 1)

    def test_disagreement_is_invalid_not_success(self):
        self.set_mode(FAKE_CLAUDE_MODE='block_mismatch')
        body = request_body(protocol_version='1.2', allow_unenforced_output_limit=True)
        response = self.client.post('/v1.2/generate', json=body)
        self.assertEqual(response.json()['error']['code'], 'provider_invalid_output')
        self.assertEqual(self.client.post('/v1.2/generate', json=body).json(), response.json())
        self.assertEqual(self.runner.generations, 1)


class StreamAssemblyTests(unittest.TestCase):
    def test_metadata_after_result_and_synthetic_not_answer(self):
        result = {'type': 'result', 'result': 'real answer'}
        events = stream_events(result)
        synthetic = {'type': 'assistant', 'message': {'model': '<synthetic>',
            'content': [{'type': 'text', 'text': 'PRIVATE NOTICE'}]}}
        events.insert(1, synthetic)
        trailing = [{'type': 'system', 'subtype': 'turn_duration'},
                    {'type': 'rate_limit_event'}, {'type': 'keep_alive'}]
        parsed, before = decode_output('\r\n'.join(json.dumps(e) for e in events + trailing))
        self.assertEqual(assemble(before, parsed, served_pattern('sonnet')), 'real answer')
        with self.assertRaises(ValueError):
            assemble([e for e in before if e.get('type') != 'assistant'] + [synthetic], parsed, served_pattern('sonnet'))
        for after in (synthetic, {'type': 'user'}, {'type': 'prompt_suggestion'}, result):
            with self.assertRaises(ValueError):
                decode_output('\n'.join(json.dumps(e) for e in events + [after]))

    def test_every_fallback_is_refused_including_after_result(self):
        result = {'type': 'result', 'result': 'answer'}
        for subtype in ('model_fallback', 'model_refusal_fallback', 'model_consent_fallback', 'model_refusal_no_fallback'):
            fallback = {'type': 'system', 'subtype': subtype}
            with self.subTest(subtype=subtype), self.assertRaises(LookupError):
                assemble(stream_events(result)[:-1] + [fallback], result, served_pattern('sonnet'))
            with self.assertRaises(LookupError):
                decode_output('\n'.join(json.dumps(e) for e in stream_events(result) + [fallback]))

    def test_windows_prompt_is_bounded_ascii_and_without_cmd_metacharacters(self):
        from integrations.prompt import SYSTEM_PROMPT, CLI_ARGUMENT_PROMPT
        for text in (SYSTEM_PROMPT, CLI_ARGUMENT_PROMPT):
            self.assertTrue(text.isascii())
            self.assertLess(len(text), 4000)
            self.assertFalse(set('%^&|<>"!()\r\n') & set(text))

    def test_fake_cli_requires_verbose(self):
        result = subprocess.run([sys.executable, str(Path(__file__).parent / 'fixtures/fake_claude.py'),
            '--print', '--output-format', 'stream-json'], input='', capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertIn('requires --verbose', result.stderr)

    def test_last_response_duplicate_events_tools_and_fallback(self):
        result = {'type': 'result', 'result': 'last'}
        events = [e for e in stream_events(result) if e.get("subtype") == "init" or e.get("type") == "assistant"]
        earlier = copy.deepcopy(events[1]); earlier['uuid'] = 'earlier'; earlier['message']['id'] = 'earlier'
        earlier['message']['content'][0]['text'] = 'old'
        pattern = served_pattern('sonnet')
        self.assertEqual(assemble([events[0], earlier, events[1], events[1]], result, pattern), 'last')
        for bad in (
            [{'type': 'system', 'subtype': 'init', 'model': 'claude-sonnet-5-5', 'tools': ['Bash']}, events[1]],
            events + [{'type': 'system', 'subtype': 'model_fallback'}],
            events + [earlier, events[1]],
        ):
            with self.assertRaises((ValueError, LookupError)):
                assemble(bad, result, pattern)
        with self.assertRaises(ValueError):
            decode_output(json.dumps(result) + '\n' + json.dumps(result))

    def test_typed_errors_precede_text_and_unknown_types_use_text(self):
        for code, category in (('usage_limit_reached', 'quota'), ('model_requires_usage_credits', 'usage_credits'),
                ('long_context_credits_required', 'usage_credits'), ('no_allowed_fallback', 'model_unavailable'),
                ('model_substitution_disabled', 'model_unavailable'), ('max_output_tokens', 'output_limit_reached')):
            self.assertEqual(category_from({'api_error': code, 'result': 'PRIVATE unknown'}), category)
        for text in ("You've hit your weekly limit", "You've reached your Sonnet limit", "Usage is paused for your organization"):
            self.assertEqual(category_from({'api_error': 'future_type', 'result': text}), 'quota')
        row = signature('result_error', model='sonnet', data={'api_error_status': 429, 'api_error': 'usage_limit_reached'})
        self.assertEqual((row['api_status'], row['category']), (429, 'quota'))
        self.assertIsNone(signature('result_error', model='sonnet', data={'api_error_status': 'PRIVATE'})['api_status'])

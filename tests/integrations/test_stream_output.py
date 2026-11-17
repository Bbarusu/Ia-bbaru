"""CLI stream assembly stays internal; synthetic envelopes only."""
import copy
import json
import unittest
from integrations.stream_output import assemble, decode_output
from integrations.models import served_pattern
from integrations.failures import category_from, signature
from fixtures.fake_claude import stream_events
from test_gateway import GatewayTestCase, request_body


class StreamGatewayTests(GatewayTestCase):
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
    def test_last_response_duplicate_events_tools_and_fallback(self):
        result = {'type': 'result', 'result': 'last'}
        events = stream_events(result)[:-1]
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

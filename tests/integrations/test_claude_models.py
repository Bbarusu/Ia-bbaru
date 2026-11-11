"""Requested alias versus served model, and no silent fallback.

Everything runs against fixtures/fake_claude.py (a test double). Its modelUsage
keys imitate what Claude Code 2.1.322 printed; nothing here calls a real model.
"""
import unittest

from integrations import errors
from integrations.adapters.claude_code import served_model
from integrations.config import ClaudeCodeSettings
from integrations.models import is_checkable, served_pattern
from test_gateway import GatewayTestCase, request_body


def v11(**overrides):
    body = request_body(**overrides)
    body.update(protocol_version="1.1", allow_unenforced_output_limit=True)
    return body


class ServedModelRules(unittest.TestCase):
    def test_alias_accepts_any_version_of_its_family_only(self):
        self.assertTrue(served_pattern("fable").fullmatch("claude-fable-5-2"))
        self.assertTrue(served_pattern("fable").fullmatch("claude-fable-5-1"))  # 2.1.307 built-in default
        self.assertTrue(served_pattern("sonnet[1m]").fullmatch("claude-sonnet-5-5[1m]"))
        for wrong in ("claude-opus-5-5", "claude-mythos-5", "claude-fable", "fable"):
            self.assertIsNone(served_pattern("fable").fullmatch(wrong), wrong)

    def test_full_name_is_exact_apart_from_date_and_context_suffix(self):
        pattern = served_pattern("claude-opus-5")
        self.assertTrue(pattern.fullmatch("claude-opus-5"))
        self.assertTrue(pattern.fullmatch("claude-opus-5-20260101"))
        self.assertIsNone(pattern.fullmatch("claude-opus-5-5"))

    def test_only_checkable_names_can_be_configured(self):
        for good in ("sonnet", "haiku", "opus", "fable", "opus[1m]", "claude-fable-5-2"):
            self.assertTrue(is_checkable(good), good)
            ClaudeCodeSettings(models=[good]).validate()
        for bad in ("best", "opusplan", "default", "mythos", "claude-", "gpt-5", "haiku[1m]"):
            self.assertFalse(is_checkable(bad), bad)
            with self.assertRaises(RuntimeError):
                ClaudeCodeSettings(models=[bad]).validate()

    def test_family_profile_follows_long_context_and_full_names(self):
        settings = ClaudeCodeSettings(models=["opus[1m]", "claude-haiku-5-5", "claude-x-1"])
        self.assertEqual(settings.task_kinds_for("opus[1m]"), ["analysis"])
        self.assertEqual(settings.task_kinds_for("claude-haiku-5-5"), ["general", "writing"])
        self.assertEqual(settings.task_kinds_for("claude-x-1"), settings.task_kinds)

    def test_served_model_evidence_rules(self):
        entry = {"outputTokens": 5}
        self.assertEqual(served_model("sonnet", {"claude-sonnet-5-5": entry}), "claude-sonnet-5-5")
        cases = {
            "provider_invalid_output": [None, {}, []],
            "provider_model_mismatch": [
                {"claude-haiku-5-5": entry},                               # fallback answered
                {"claude-sonnet-5-5": entry, "claude-haiku-5-5": entry},   # partly another model
                {"claude-sonnet-5-5": entry, "claude-haiku-5-5": {}},      # unknown output count
            ],
        }
        for code, usages in cases.items():
            for usage in usages:
                with self.subTest(usage=usage), self.assertRaises(errors.GatewayError) as caught:
                    served_model("sonnet", usage)
                self.assertEqual(caught.exception.code, code)
        idle = {"claude-haiku-5-5": {"outputTokens": 0}, "claude-sonnet-5-5": entry}
        self.assertEqual(served_model("sonnet", idle), "claude-sonnet-5-5")


class NoSilentFallbackOverHttp(GatewayTestCase):
    models = ["sonnet", "fable", "claude-opus-5"]

    def post(self, request_id, **overrides):
        return self.client.post("/v1.1/generate", json=v11(request_id=request_id, **overrides))

    def test_child_cannot_substitute_or_redirect_models(self):
        self.set_mode(ANTHROPIC_DEFAULT_SONNET_MODEL="claude-haiku-5-5",
                      CLAUDE_CODE_MODEL_CATALOG_URL="https://example.invalid/catalog")
        self.assertEqual(self.post("t:0").status_code, 200)
        env = self.recorded()["env"]
        self.assertEqual(env["CLAUDE_CODE_NO_MODEL_FALLBACK"], "1")
        self.assertIsNone(env["ANTHROPIC_DEFAULT_SONNET_MODEL"])
        self.assertIsNone(env["CLAUDE_CODE_MODEL_CATALOG_URL"])
        self.assertNotIn("--fallback-model", self.recorded()["argv"])

    def test_diagnostic_separates_configuration_from_access(self):
        from integrations.diagnostics import report
        models = report(self.settings.claude_code)["claude_code"]["models"]
        self.assertEqual([m["kind"] for m in models], ["alias", "alias", "full_name"])
        self.assertTrue(all(m["access"] == "not_verified_without_generation"
                            and m["resolved_version"] is None for m in models))
        self.assertEqual(self.runner.generations, 0)

    def test_alias_served_by_its_family_is_accepted(self):
        response = self.post("t:1", model_id="claude-code:fable")
        self.assertEqual(response.status_code, 200, response.text)
        # Contract 1.1 has no served-model field; the version is not exposed.
        self.assertNotIn("claude-fable-5-2", response.text)

    def test_fallback_or_mixed_output_is_final_and_never_rerun(self):
        for index, mode in enumerate(("fallback", "mixed")):
            with self.subTest(mode=mode):
                self.set_mode(FAKE_CLAUDE_MODE=mode)
                before = self.runner.generations
                for _ in range(2):  # the repeat is replayed, not re-run
                    response = self.post(f"fb:{index}")
                    self.assertEqual(response.status_code, 502)
                    self.assertEqual(response.json()["error"]["code"], "provider_model_mismatch")
                self.assertEqual(self.runner.generations, before + 1)

    def test_idle_entry_of_another_model_does_not_fail_the_run(self):
        self.set_mode(FAKE_CLAUDE_MODE="idle_other_model")
        self.assertEqual(self.post("idle:0").status_code, 200)

    def test_pinned_full_name_rejects_a_newer_version(self):
        self.set_mode(FAKE_CLAUDE_SERVED="claude-opus-5-5")
        response = self.post("pin:0", model_id="claude-code:claude-opus-5")
        self.assertEqual(response.json()["error"]["code"], "provider_model_mismatch")

    def test_missing_model_evidence_is_not_accepted(self):
        self.set_mode(FAKE_CLAUDE_MODE="no_model_usage")
        self.assertEqual(self.post("nm:0").json()["error"]["code"], "provider_invalid_output")

    def test_credits_and_access_refusals_are_unavailable_not_quota(self):
        for index, mode in enumerate(("credits", "model_access")):
            with self.subTest(mode=mode):
                self.set_mode(FAKE_CLAUDE_MODE=mode)
                response = self.post(f"cr:{index}", model_id="claude-code:fable")
                self.assertEqual(response.status_code, 503)
                self.assertEqual(response.json()["error"]["code"], "provider_unavailable")


if __name__ == "__main__":
    unittest.main()

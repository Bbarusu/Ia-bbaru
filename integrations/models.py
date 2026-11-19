"""Claude model names the gateway accepts, and how a served model is checked.

Evidence (official package @anthropic-ai/claude-code, read without an account):
- 2.1.307 and 2.1.322 accept the aliases sonnet, opus, haiku and fable, and the
  long-context forms sonnet[1m], opus[1m] and fable[1m] (no haiku[1m]).
- An alias is resolved inside the CLI from a model registry, the account/provider
  and ANTHROPIC_DEFAULT_<FAMILY>_MODEL. The resolved version is not fixed: the
  built-in fallback for "fable" is Fable 5.1 in 2.1.307 and Fable 5.2 in 2.1.322.
- The served model appears only after a run, as the keys of the result's
  `modelUsage`. There is no command that resolves an alias or checks access to
  one model without a generation.

So the gateway never claims a version for an alias. It accepts only names whose
family it can check afterwards: the four aliases (any version of that family is
the alias working as documented) or a full `claude-...` name (that exact model,
optionally with a date suffix).
"""
import re

ALIAS_FAMILIES = ("sonnet", "haiku", "opus", "fable")
LONG_CONTEXT = "[1m]"
LONG_CONTEXT_ALIASES = ("sonnet", "opus", "fable")


def _base(model: str) -> str:
    return model[: -len(LONG_CONTEXT)] if model.lower().endswith(LONG_CONTEXT) else model


def is_alias(model: str) -> bool:
    return _base(model) in ALIAS_FAMILIES


def family(model: str) -> str | None:
    """sonnet/haiku/opus/fable for an alias or a full name of that family."""
    base = _base(model).lower()
    if base in ALIAS_FAMILIES:
        return base
    for name in ALIAS_FAMILIES:
        if base.startswith(f"claude-{name}-"):
            return name
    return None


def describe(model: str) -> dict:
    """What the configuration alone says about a model (no CLI, no account)."""
    return {
        "name": model,
        "kind": "alias" if is_alias(model) else "full_name",
        "family": family(model),
        # The version an alias resolves to and the account's right to use the
        # model are only known after a generation (modelUsage).
        "resolved_version": None,
        "access": "not_verified_without_generation",
    }


def is_checkable(model: str) -> bool:
    """True for names whose served model can be checked against `modelUsage`.

    Rejected on purpose: "best", "opusplan" (mixes opus and sonnet), "default"
    and other names whose family the CLI decides.
    """
    base = _base(model)
    if base in ALIAS_FAMILIES:
        return base == model or base in LONG_CONTEXT_ALIASES
    return base.startswith("claude-") and len(base) > len("claude-")


def served_pattern(model: str) -> re.Pattern:
    """Model IDs that count as `model` having been served."""
    base = _base(model)
    suffix = r"(\[1m\])?"
    if base in ALIAS_FAMILIES:
        return re.compile(rf"claude-{base}-\d[0-9a-z.-]*{suffix}", re.IGNORECASE)
    # Exact name: "claude-opus-5" must not accept "claude-opus-5-5".
    return re.compile(rf"{re.escape(base)}(-\d{{8}})?{suffix}", re.IGNORECASE)

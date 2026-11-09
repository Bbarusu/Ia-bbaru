"""One durable queue consumer per database. Unconfirmed calls are never replayed."""
import os
import threading
import time
from datetime import datetime, timezone

from .capabilities import preflight_error
from .contracts import GenerateRequest
from .contracts_v1_1 import GenerateRequestV11
from .gateway import GatewayUnavailable
from .gateway_errors import WAIT_CODES, PRESTART_CODES, UNCERTAIN_CODES


class WorkerLock:
    def __init__(self, path):
        self.path = str(path) + ".worker.lock"
        self.file = None

    def acquire(self):
        self.file = open(self.path, "a+b")
        if os.name == "nt":
            import msvcrt
            self.file.seek(0, 2)
            if not self.file.tell():
                self.file.write(b"0"); self.file.flush()
            self.file.seek(0)
            try:
                msvcrt.locking(self.file.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                self.file.close(); self.file = None
                raise RuntimeError("A durable worker already owns this database") from None
        else:
            import fcntl
            try:
                fcntl.flock(self.file, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                self.file.close(); self.file = None
                raise RuntimeError("A durable worker already owns this database") from None

    def release(self):
        if self.file:
            self.file.close(); self.file = None


class DurableWorker:
    def __init__(self, store, gateway, retry_delay=2):
        self.store, self.gateway = store, gateway
        self.retry_delay = retry_delay
        self.lock = WorkerLock(store.path)
        self.stop_event = threading.Event()
        self.wake = threading.Event()
        self.thread = None

    def start(self):
        self.lock.acquire()
        try:
            self.store.recover()
            self.thread = threading.Thread(target=self.run, name="ia-bbaru-worker", daemon=True)
            self.thread.start()
        except BaseException:
            self.lock.release(); raise

    def stop(self):
        self.stop_event.set(); self.wake.set()
        # Normal shutdown waits for the current call (HTTP timeout is 120 s).
        # Forced termination leaves in_flight on disk, recovered as uncertain.
        if self.thread:
            self.thread.join()
        self.lock.release()

    def run(self):
        while not self.stop_event.is_set():
            task = self.store.claim_job(time.time())
            if task is None:
                self.wake.wait(.25); self.wake.clear(); continue
            try:
                self.process(task)
            except Exception:
                # Do not log provider text, request bodies, URLs or secrets.
                # Read the committed cursor: a result may exist only in memory
                # if saving it failed after the provider answered.
                task = self.store.task(task["id"])
                if task["status"] != "running":
                    continue
                step = task["execution"]["steps"][len(task["results"])]
                uncertain = step["state"] == "in_flight"
                step.update(state="uncertain" if uncertain else "failed", error_code="worker_internal_error")
                task.update(status="uncertain" if uncertain else "failed", error="worker_internal_error")
                self.store.save_task(task)

    def fail(self, task, step, code, phase, status=None):
        step.update(error_code=code, http_status=status, phase=phase)
        if phase == "preflight" or code in PRESTART_CODES:
            state = "blocked"
        elif code in WAIT_CODES:
            state = "waiting"
            step["next_attempt_at"] = time.time() + min(30, self.retry_delay * 2 ** min(step["attempts"] - 1, 4))
        elif code in UNCERTAIN_CODES:
            state = "uncertain"
        else:
            state = "failed"
        step["state"] = state
        task.update(status=state, error=code)
        self.store.save_task(task)

    def process(self, task):
        index = len(task["results"])
        step = task["execution"]["steps"][index]
        plan = task["plan"][index]
        # Retry only an explicitly retryable response; replay exactly the persisted payload.
        replay = step.get("error_code") in WAIT_CODES and step.get("request") is not None
        if not replay:
            try:
                catalog = self.gateway.catalog()
                # Catalogue reasons are free text: only recognized pre-start
                # reasons may become resumable codes or appear in task errors.
                remaining = {s["model_id"] for s in task["plan"][index:]}
                for model in catalog.models:
                    reason = getattr(model, "unavailable_reason", None)
                    code = f"provider_{reason}" if isinstance(reason, str) else ""
                    if model.id in remaining and not model.available and code in PRESTART_CODES:
                        self.fail(task, step, code, "preflight"); return
                error = preflight_error(task, catalog, task["plan"][index:])
            except GatewayUnavailable as exc:
                self.fail(task, step, exc.code, "preflight", exc.http_status); return
            if error:
                step.update(state="failed", error_code=error, phase="preflight")
                task.update(status="failed", error=error); self.store.save_task(task); return
            previous = task["results"][-1]["output"] if task["results"] else None
            chars = len(task["instruction"]) + sum(len(s["title"]) + len(s["content"]) for s in task["context"]) + len(previous or "")
            if chars > plan["context_char_limit"]:
                step.update(state="failed", error_code="review_context_too_large")
                task.update(status="failed", error="review_context_too_large"); self.store.save_task(task); return
            fields = dict(request_id=step["request_id"], model_id=plan["model_id"], role=plan["role"],
                          instruction=task["instruction"], context=task["context"], previous_output=previous,
                          max_output_tokens=plan["max_output_tokens"])
            if task.get("gateway_protocol_version", "1") == "1.1":
                request = GenerateRequestV11(**fields, protocol_version="1.1",
                    allow_unenforced_output_limit=task.get("allow_unenforced_output_limit", False))
            else:
                request = GenerateRequest(**fields)
            step["request"] = request.model_dump()
        else:
            schema = GenerateRequestV11 if task["gateway_protocol_version"] == "1.1" else GenerateRequest
            request = schema.model_validate(step["request"])
        if self.stop_event.is_set():
            task["status"] = "queued"; self.store.save_task(task); return
        step.update(state="in_flight", attempts=step["attempts"] + 1, error_code=None, http_status=None, phase="generate")
        task["error"] = None
        self.store.save_task(task)  # Write-ahead intent, before any provider side effect.
        try:
            result = self.gateway.generate(request)
        except GatewayUnavailable as exc:
            self.fail(task, step, exc.code, "generate", exc.http_status); return
        task["results"].append({"role": plan["role"], **result.model_dump()})
        task["output"] = result.output
        step.update(state="completed", finish_reason=result.finish_reason, error_code=None, http_status=200)
        # Result, cursor and final/next status commit together.
        if result.finish_reason in {"unknown", "length"}:
            task.update(status="incomplete", error="completion_unconfirmed" if result.finish_reason == "unknown" else "output_token_limit_reached")
            step.update(state="incomplete", error_code=task["error"])
        elif index + 1 == len(task["plan"]):
            task.update(status="completed", error=None, completed_at=datetime.now(timezone.utc).isoformat())
        else:
            task.update(status="queued", error=None)
        self.store.save_task(task)

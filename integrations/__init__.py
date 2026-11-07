"""Ia-bbaru provider gateway (integrations front, maintained by Claude).

Separate local service that implements docs/openapi-gateway.json (contract v1)
on 127.0.0.1:8010. The backend in backend/ stays the owner of projects, sources,
tasks and history; this package only talks to official provider clients.
"""

__version__ = "0.1.0"

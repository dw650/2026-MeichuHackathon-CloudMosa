from pydantic import BaseModel


class DebugHeadersOut(BaseModel):
    x_forwarded_for: str | None
    x_client_forwarded_for: str | None
    forwarded: str | None
    client_host: str | None

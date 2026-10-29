import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.trustedhost import TrustedHostMiddleware

from backend.database import initialize
from backend.routers import liquidaciones, registros

ROOT = Path(__file__).resolve().parent.parent


def create_app(database_path: Path | None = None) -> FastAPI:
    path = database_path or Path(
        os.environ.get("SIMULATOR_DATABASE", ROOT / "data/simulador.sqlite3")
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        initialize(path)
        yield

    application = FastAPI(title="Reto 05 · Simulador de salario", lifespan=lifespan)
    application.state.database_path = path
    application.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"]
    )
    application.include_router(registros.router)
    application.include_router(liquidaciones.router)
    application.include_router(registros.router, prefix="/api", include_in_schema=False)
    application.include_router(liquidaciones.router, prefix="/api", include_in_schema=False)

    @application.exception_handler(ValueError)
    async def invalid_input(_: Request, exc: ValueError):
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    # El backend sirve el frontend compilado para abrir toda la app en una sola URL.
    frontend = ROOT / "frontend/dist"
    if frontend.is_dir():
        application.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")

    return application


app = create_app()

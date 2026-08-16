# Backend

FastAPI + SQLAlchemy service

## Prerequisites
- Docker + Docker Compose (recommended)

## Quick start (Docker)
```bash
cd backend
docker-compose up --build
```
API: http://localhost:8000
Docs: http://localhost:8000/docs


## Environment
- Uses PostgreSQL (configured in docker-compose.yml)
- BPMN generation uses the external generator service from `bpmn-generator-docker-master`
	- Start the generator container first (default host port `8098`)
	- Configure `BPMN_GENERATOR_URL` for the backend (`http://host.docker.internal:8098` in Docker, `http://localhost:8098` when running backend locally)
	- Optional: configure `BPMN_GENERATOR_TIMEOUT` (seconds, default `60`)

## Folder structure (backend/)
- app/main.py: FastAPI app, middleware, router wiring
- app/routes*.py: Route handlers (auth, processes, interview/session flow)
- app/models/: SQLAlchemy models (process, user, interview, protocol)
- app/schemas/: Pydantic request/response models
- app/db/: Session/engine setup, base model
- app/services/auth/, interview/, knowledge/, process/, protocol/: Service packages
- app/services/*/*.txt: Service-local LLM instruction files
- requirements.txt: Python dependencies

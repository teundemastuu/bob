# BoB (Builder of BPMN)

Prototype accompanying the paper *A Human-in-the-Loop LLM-Based Framework for
the Iterative Elicitation of Process Knowledge*.

BoB is a web application in which a process analyst generates and approves
interview protocols, an LLM interviews domain experts, and the gathered
knowledge is analyzed for inconsistencies and knowledge gaps before being
consolidated into a process description from which a BPMN model is generated.

- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL
- **Frontend:** React, Vite, bpmn-js
- **LLM:** OpenAI API (`gpt-5-mini-2025-08-07` in the reported case study)

## Prerequisites

- Docker and Docker Compose
- An OpenAI API key
- The BPMN layout service (see below)

## BPMN layout service

Model generation posts the generated model JSON to an external layout service
that returns BPMN XML. This is the service from BPMN-Chatbot++ (Safan & Köpke,
2025) and is **not** included in this repository. Obtain it from the authors,
then start it before generating models:

```bash
docker load -i bpmn-generator-v1.tar
docker run -d --name bpmn-service -p 8098:8098 bpmn-generator:v1
```

Point `BPMN_GENERATOR_URL` at it (default `http://host.docker.internal:8098`).

## Running

```bash
cd backend
cp .env.example .env   # then fill in the values
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

The compose file builds both the backend and the frontend. To run the frontend
separately during development:

```bash
cd frontend
npm install
npm run dev
```

## Repository layout

```
backend/app/
  routes/                    Auth, processes, interviews, protocols, knowledge, BPMN
  models/  schemas/          SQLAlchemy models and Pydantic schemas
  services/protocol/         Protocol generation (P1) and its instruction variants
  services/interview/        Interview engine (P2) and session summarisation
  services/knowledge/        Inconsistency and knowledge gap detection (P3)
  services/bpmn_chatbot/     Consolidation (P4) and model generation (P5)
  services/llm_client.py     Shared OpenAI wrapper
frontend/src/
  pages/  components/  context/  hooks/
```

## Notes

- The BPMN generation prompt, the model JSON schema and the layout service are
  adapted from BPMN-Chatbot++ (Safan & Köpke, 2025).

## License

MIT, see [LICENSE](LICENSE).

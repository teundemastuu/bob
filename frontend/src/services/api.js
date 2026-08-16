// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
// Use the current page host so mobile devices access the same backend host
const API_BASE = (typeof window !== 'undefined' && window.location && window.location.hostname)
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : 'http://localhost:8000'
import storage from '../utils/storage'

async function handleResponse(res) { // Every response goes through here
  if (!res.ok) {
    if (res.status === 401) { // Unauthorized
      storage.clearToken()
      storage.clearUser()
    }
    const text = await res.text().catch(() => '')
    const error = new Error(text || res.statusText || 'Request failed')
    error.status = res.status
    throw error
  }
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

// ===== AUTH =====
export async function register(email, password, role) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role })
  })
  return handleResponse(res)
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password })
  })
  return handleResponse(res)
}

export async function getExperts(token) {
  const res = await fetch(`${API_BASE}/auth/experts`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

// ===== PROCESSES =====
export async function getProcesses(token) {
  const res = await fetch(`${API_BASE}/processes`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function createProcess(token, name, description, expertAssignments) {
  const res = await fetch(`${API_BASE}/processes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      name,
      description,
      expert_assignments: expertAssignments
    })
  })
  return handleResponse(res)
}

export async function updateProcess(token, processId, name, description) {
  const body = { name, description }
  const res = await fetch(`${API_BASE}/processes/${processId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body)
  })
  return handleResponse(res)
}

export async function deleteProcess(token, processId) {
  const res = await fetch(`${API_BASE}/processes/${processId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function saveOpenAIKey(token, key) {
  const res = await fetch(`${API_BASE}/auth/openai-key`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ openai_api_key: key })
  })
  return handleResponse(res)
}

export async function getOpenAIKeyStatus(token) {
  const res = await fetch(`${API_BASE}/auth/openai-key`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function deleteOpenAIKey(token) {
  const res = await fetch(`${API_BASE}/auth/openai-key`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

// ===== SESSIONS =====
export async function createProtocolSession(token, processId, expertId, expertEmail, roundNumber, allowLlmFollowupIfNoScenario = false) {
  const payload = {
    case_id: processId,
    expert_email: expertEmail,
    expert_id: expertId,
    round_number: roundNumber,
    allow_llm_followup_if_no_scenario: !!allowLlmFollowupIfNoScenario,
  }
  const res = await fetch(`${API_BASE}/sessions/protocol-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  return handleResponse(res)
}

export async function submitProtocolGenerationEvaluation(token, payload) {
  const res = await fetch(`${API_BASE}/protocols/generation-evaluation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  return handleResponse(res)
}

export async function submitProtocolFeedbackEvaluation(token, payload) {
  const res = await fetch(`${API_BASE}/protocols/feedback-evaluation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  return handleResponse(res)
}

export async function submitInterviewCompletionEvaluation(token, payload) {
  const res = await fetch(`${API_BASE}/sessions/completion-evaluation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  return handleResponse(res)
}

export async function activateSession(token, sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/activate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  })
  return handleResponse(res)
}

export async function getNextQuestion(token, sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/next`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  return handleResponse(res)
}

export async function submitAnswer(token, sessionId, payload) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  return handleResponse(res)
}

export async function pauseSession(token, sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/pause`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function resumeSession(token, sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/activate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function getMySessions(token) {
  const res = await fetch(`${API_BASE}/sessions/my-sessions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function getProcessSessions(token, processId) {
  if (!processId || processId === 'undefined') {
    console.error('[API] Invalid processId:', processId)
    throw new Error('Invalid processId: ' + processId)
  }
  const res = await fetch(`${API_BASE}/processes/${processId}/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

// ===== KNOWLEDGE INCONSISTENCIES =====
export async function detectKnowledgeInconsistencies(token, processId) {
  const res = await fetch(`${API_BASE}/knowledge/inconsistencies/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ process_id: processId })
  })
  return handleResponse(res)
}

export async function getKnowledgeInconsistencies(token, processId, options = {}) {
  const params = new URLSearchParams({ process_id: processId })
  if (options.showResolved) params.set('show_resolved', 'true')
  if (options.showIgnored) params.set('show_ignored', 'true')
  const res = await fetch(`${API_BASE}/knowledge/inconsistencies?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function resolveKnowledgeInconsistency(token, payload) {
  const res = await fetch(`${API_BASE}/knowledge/inconsistencies/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  return handleResponse(res)
}

export async function ignoreKnowledgeInconsistency(token, processId, inconsistencyId) {
  const res = await fetch(`${API_BASE}/knowledge/inconsistencies/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ process_id: processId, inconsistency_id: inconsistencyId })
  })
  return handleResponse(res)
}

export async function unignoreKnowledgeInconsistency(token, processId, inconsistencyId) {
  const res = await fetch(`${API_BASE}/knowledge/inconsistencies/unignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ process_id: processId, inconsistency_id: inconsistencyId })
  })
  return handleResponse(res)
}

// ===== KNOWLEDGE GAPS =====
export async function detectKnowledgeGaps(token, processId) {
  const res = await fetch(`${API_BASE}/knowledge/gaps/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ process_id: processId })
  })
  return handleResponse(res)
}

export async function getKnowledgeGaps(token, processId, options = {}) {
  const params = new URLSearchParams({ process_id: processId })
  if (options.showResolved) params.set('show_resolved', 'true')
  if (options.showIgnored) params.set('show_ignored', 'true')
  const res = await fetch(`${API_BASE}/knowledge/gaps?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function resolveKnowledgeGap(token, payload) {
  const res = await fetch(`${API_BASE}/knowledge/gaps/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  return handleResponse(res)
}

export async function ignoreKnowledgeGap(token, processId, gapId) {
  const res = await fetch(`${API_BASE}/knowledge/gaps/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ process_id: processId, gap_id: gapId })
  })
  return handleResponse(res)
}

export async function unignoreKnowledgeGap(token, processId, gapId) {
  const res = await fetch(`${API_BASE}/knowledge/gaps/unignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ process_id: processId, gap_id: gapId })
  })
  return handleResponse(res)
}

// ===== PROTOCOLS =====
// Fetch a protocol draft. If none exists, the backend will generate and create one.
export async function getProtocolDraft(token, processId, expertId, roundNumber, category, length, followupCount, additionalInfo, selectedInconsistencyIds = [], selectedGapIds = [], selectedBpmnThreadId = null) {
  const params = new URLSearchParams({
    process_id: processId,
    expert_id: expertId,
    round_number: roundNumber
  })
  if (category) params.set('category', category)
  if (length) params.set('length', length)
  if (followupCount !== undefined && followupCount !== null) params.set('followup_count', String(followupCount))
  if (additionalInfo) params.set('additional_info', additionalInfo)
  ;(selectedInconsistencyIds || []).forEach((id) => {
    if (id) params.append('selected_inconsistency_ids', String(id))
  })
  ;(selectedGapIds || []).forEach((id) => {
    if (id) params.append('selected_gap_ids', String(id))
  })
  if (selectedBpmnThreadId) params.set('selected_bpmn_thread_id', String(selectedBpmnThreadId))
  const res = await fetch(`${API_BASE}/protocols/draft?${params.toString()}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  return handleResponse(res)
}

// Fetch a protocol draft only if it already exists. Returns 404 if none exists.
export async function getExistingProtocolDraft(token, processId, expertId, roundNumber) {
  const params = new URLSearchParams({
    process_id: processId,
    expert_id: expertId,
    round_number: roundNumber,
    only_existing: 'true'
  })
  const res = await fetch(`${API_BASE}/protocols/draft?${params.toString()}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  })
  return handleResponse(res)
}

export async function saveProtocolDraft(token, payload) {
  const res = await fetch(`${API_BASE}/protocols/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  return handleResponse(res)
}

export async function deleteProtocolDraft(token, processId, expertId, roundNumber) {
  const res = await fetch(`${API_BASE}/protocols/draft?process_id=${processId}&expert_id=${expertId}&round_number=${roundNumber}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  })
  return handleResponse(res)
}

export async function applyProtocolFeedback(token, payload) {
  const res = await fetch(`${API_BASE}/protocols/draft/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  return handleResponse(res)
}

// ===== BPMN MODELS (one per process) =====
export async function getProcessModel(token, processId) {
  const res = await fetch(`${API_BASE}/processes/${processId}/models`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function createOrUpdateProcessModel(token, processId, modelData) {
  const res = await fetch(`${API_BASE}/processes/${processId}/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(modelData)
  })
  return handleResponse(res)
}

export async function deleteProcessModel(token, processId) {
  const res = await fetch(`${API_BASE}/processes/${processId}/models`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

// ===== BPMN GENERATION =====
export async function getBpmnDescription(token, processId, selectedSessionIds = []) {
  const res = await fetch(`${API_BASE}/bpmn/description`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ processId, selectedSessionIds })
  })
  return handleResponse(res)
}

export async function getBpmnSessionOptions(token, processId) {
  const res = await fetch(`${API_BASE}/bpmn/session-options?process_id=${processId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function getLatestBpmnDiagram(token, processId) {
  const res = await fetch(`${API_BASE}/bpmn/latest?process_id=${processId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function getBpmnHistory(token, processId) {
  const res = await fetch(`${API_BASE}/bpmn/history?process_id=${processId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function clearBpmnHistory(token, processId) {
  const res = await fetch(`${API_BASE}/bpmn/history?process_id=${processId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function getBpmnKnowledgeOptions(token, processId, threadId) {
  const res = await fetch(`${API_BASE}/bpmn/knowledge-options?process_id=${processId}&thread_id=${threadId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return handleResponse(res)
}

export async function createBpmnDiagram(token, inputString, processId, selectedSessionIds = []) {
  const res = await fetch(`${API_BASE}/bpmn/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ inputString, processId, selectedSessionIds })
  })
  return handleResponse(res)
}

export async function updateBpmnDiagram(token, id, inputString, processId, selectedSessionIds = []) {
  const res = await fetch(`${API_BASE}/bpmn/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ id, inputString, processId, selectedSessionIds })
  })
  return handleResponse(res)
}

// LLM debug API methods removed

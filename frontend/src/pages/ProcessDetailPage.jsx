// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAnalyst } from '../context/AnalystContext'
import { ProcessTabBar } from '../components/analyst/ProcessDetail'
import ManageInterviewsTab from '../components/analyst/ManageInterviewsTab'
import { StatusMessage } from '../components/general/StatusMessage'
import { KnowledgeTab } from '../components/analyst/KnowledgeTab'
import { ModelManagementTab } from '../components/analyst/ModelManagementTab'
import { useState } from 'react'
import ProtocolModal from '../components/analyst/ProtocolModal'
import ProcessEditModal from '../components/analyst/EditProcessModal'
import ProtocolGenerationEvaluationModal from '../components/analyst/ProtocolGenerationEvaluationModal'
import ProtocolFeedbackEvaluationModal from '../components/analyst/ProtocolFeedbackEvaluationModal'
import { useProcessSessions } from '../hooks/useProcessSessions'
import { useProtocolFlow } from '../hooks/useProtocolFlow'
import * as api from '../services/api'

export default function ProcessDetailPage() {
  const { processId } = useParams()
  const navigate = useNavigate()
  
  const { user, token, status, showStatus } = useAuth()
  const {
    processes,
    selectedProcess,
    setSelectedProcess
  } = useAnalyst()

  const isAnalyst = user?.role === 'analyst'

  const [activeTab, setActiveTab] = useState('interviews')
  const [selectedSession, setSelectedSession] = useState(null)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedBpmnThreadId, setSelectedBpmnThreadId] = useState(null)
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false)
  const [evaluationTarget, setEvaluationTarget] = useState(null)
  const [evaluationSaving, setEvaluationSaving] = useState(false)
  const [feedbackEvaluationModalOpen, setFeedbackEvaluationModalOpen] = useState(false)
  const [feedbackEvaluationTarget, setFeedbackEvaluationTarget] = useState(null)
  const [feedbackEvaluationSaving, setFeedbackEvaluationSaving] = useState(false)
  const hasShownKeyWarning = useRef(false)

  const { sessions, sessionsByExpert, refresh: refreshSessions, loading: sessionsLoading } = useProcessSessions({
    token,
    processId: selectedProcess?.id,
    enabled: isAnalyst,
    showStatus,
    refreshKey: sessionsRefreshKey,
  })

  useEffect(() => {
    setSelectedSession(null)
    setSelectedBpmnThreadId(null)
  }, [processId])

  const {
    protocolModalOpen,
    protocolData,
    protocolLoading,
    protocolFeedback,
    protocolTarget,
    protocolFeedbackSending,
    protocolCategory,
    protocolLength,
    protocolFollowupCount,
    protocolAdditionalInfo,
    protocolUnresolvedInconsistencies,
    selectedInconsistencyIds,
    protocolUnresolvedKnowledgeGaps,
    selectedGapIds,
    allowDynamicFollowup,
    generationSuccessTick,
    feedbackSuccessTick,
    setProtocolFeedback,
    setProtocolCategory,
    setProtocolLength,
    setProtocolFollowupCount,
    setProtocolAdditionalInfo,
    setSelectedInconsistencyIds,
    setSelectedGapIds,
    setAllowDynamicFollowup,
    openProtocolModal,
    generateDraft,
    discardDraftForRegenerate,
    cancelProtocolModal,
    proceedCreateProtocol,
    submitProtocolFeedback,
    saveDraftEdits
  } = useProtocolFlow({
    token,
    processId: selectedProcess?.id,
    selectedBpmnThreadId,
    showStatus,
    onCreated: () => {
      setSessionsRefreshKey((prev) => prev + 1)
    }
  })

  // Guard: only analysts should access process details
  useEffect(() => {
    if (user && !isAnalyst) {
      navigate('/processes')
    }
  }, [user, isAnalyst, navigate])

  // Load process by ID from URL
  useEffect(() => {
    if (selectedProcess && selectedProcess.id === processId) {
      return
    }
    
    const process = processes.find(p => p.id === processId)
    if (process) {
      setSelectedProcess(process)
    }
  }, [processId, processes, selectedProcess, setSelectedProcess])

  // Load sessions for this process
  useEffect(() => {
    if (!selectedProcess || !selectedProcess.id || !isAnalyst) return
    refreshSessions()
  }, [selectedProcess, isAnalyst, activeTab, refreshSessions])

  const checkOpenAIKeyStatus = async () => {
    if (!isAnalyst || !token) return
    try {
      const res = await api.getOpenAIKeyStatus(token)
      if (res?.has_key) {
        showStatus('', 'info')
        hasShownKeyWarning.current = false
      } else if (!hasShownKeyWarning.current) {
        showStatus('Please add your OpenAI API key in Profile to enable protocol generation.', 'info')
        hasShownKeyWarning.current = true
      }
    } catch (e) {
      // Non-blocking: skip warning on errors
    }
  }

  useEffect(() => {
    checkOpenAIKeyStatus()
  }, [isAnalyst, token])


  const handleBack = () => {
    setSelectedProcess(null)
    navigate('/processes')
  }

  const handleEditModalSave = async () => {
    // Refresh the process from the list after update
    const updated = processes.find(p => p.id === processId)
    if (updated) {
      setSelectedProcess(updated)
    }
    setEditModalOpen(false)
    showStatus('Process updated successfully', 'success')
  }

  // Open modal, allow generating/updating draft, then publish+create session on proceed
  const handleOpenProtocolModal = (expertId, expertEmail) => {
    if (!selectedProcess) {
      showStatus('Select a process first', 'error')
      return
    }

    const expertSessions = sessionsByExpert[expertId] || {}
    const completedCount = expertSessions.completed?.length || 0
    const roundNumber = completedCount + 1
    openProtocolModal({ expertId, expertEmail, roundNumber })
  }

  const handleSubmitGenerationEvaluation = async (ratings) => {
    if (!token || !evaluationTarget) return false
    try {
      setEvaluationSaving(true)
      await api.submitProtocolGenerationEvaluation(token, {
        process_id: evaluationTarget.processId,
        expert_id: evaluationTarget.expertId,
        round_number: evaluationTarget.roundNumber,
        role_relevance: ratings.role_relevance,
        follow_up_quality: ratings.follow_up_quality,
        building: ratings.building,
        ready_for_use: ratings.ready_for_use,
        evaluation_motivation: ratings.evaluation_motivation || '',
      })
      showStatus('Protocol evaluation saved', 'success')
      setEvaluationModalOpen(false)
      setEvaluationTarget(null)
      return true
    } catch (e) {
      showStatus(`Error saving protocol evaluation: ${e.message}`, 'error')
      return false
    } finally {
      setEvaluationSaving(false)
    }
  }

  const handleCloseGenerationEvaluation = () => {
    setEvaluationModalOpen(false)
    setEvaluationTarget(null)
  }

  const handleSubmitFeedbackEvaluation = async (ratings) => {
    if (!token || !feedbackEvaluationTarget) return false
    try {
      setFeedbackEvaluationSaving(true)
      await api.submitProtocolFeedbackEvaluation(token, {
        process_id: feedbackEvaluationTarget.processId,
        expert_id: feedbackEvaluationTarget.expertId,
        round_number: feedbackEvaluationTarget.roundNumber,
        feedback_incorporated_adequately: ratings.feedback_incorporated_adequately,
        evaluation_motivation: ratings.evaluation_motivation || '',
      })
      showStatus('Feedback evaluation saved', 'success')
      setFeedbackEvaluationModalOpen(false)
      setFeedbackEvaluationTarget(null)
      return true
    } catch (e) {
      showStatus(`Error saving feedback evaluation: ${e.message}`, 'error')
      return false
    } finally {
      setFeedbackEvaluationSaving(false)
    }
  }

  const handleCloseFeedbackEvaluation = () => {
    setFeedbackEvaluationModalOpen(false)
    setFeedbackEvaluationTarget(null)
  }

  useEffect(() => {
    if (!generationSuccessTick || !protocolTarget || !selectedProcess?.id) return
    setEvaluationTarget({
      processId: selectedProcess.id,
      expertId: protocolTarget.expertId,
      expertEmail: protocolTarget.expertEmail,
      roundNumber: protocolTarget.roundNumber,
    })
    setEvaluationModalOpen(true)
  }, [generationSuccessTick, protocolTarget, selectedProcess])

  useEffect(() => {
    if (!feedbackSuccessTick || !protocolTarget || !selectedProcess?.id) return
    setFeedbackEvaluationTarget({
      processId: selectedProcess.id,
      expertId: protocolTarget.expertId,
      expertEmail: protocolTarget.expertEmail,
      roundNumber: protocolTarget.roundNumber,
    })
    setFeedbackEvaluationModalOpen(true)
  }, [feedbackSuccessTick, protocolTarget, selectedProcess])

  if (!selectedProcess || selectedProcess.id !== processId) {
    return <div style={{ padding: '20px' }}>Loading process...</div>
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <button onClick={handleBack} style={{ marginRight: '10px' }}>← Back to Processes</button>
          <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{selectedProcess.name}</span>
        </div>
        <div>
          {isAnalyst && (
            <button
              onClick={() => setEditModalOpen(true)}
              style={{
                marginRight: '10px',
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Edit process information
            </button>
          )}
          <span>{user?.username} ({user?.role})</span>
        </div>
      </div>

      <StatusMessage message={status.message} type={status.type} />

      {isAnalyst && (
        <ProcessTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      )}
      
      {isAnalyst && activeTab === 'interviews' && (
        <ManageInterviewsTab
          processData={selectedProcess}
          sessionsByExpert={sessionsByExpert}
          selectedProcess={selectedProcess.id}
          onCreateProtocol={handleOpenProtocolModal}
          loading={sessionsLoading}
        />
      )}

      {isAnalyst && activeTab === 'knowledge' && (
        <KnowledgeTab
          sessions={sessions}
          selectedSession={selectedSession}
          onSelectSession={setSelectedSession}
          onBackToList={() => setSelectedSession(null)}
          token={token}
          processId={selectedProcess.id}
          onStatusChange={showStatus}
        />
      )}

      {isAnalyst && activeTab === 'model' && (
        <ModelManagementTab
          processId={selectedProcess.id}
          token={token}
          onStatusChange={showStatus}
          onActiveThreadChange={setSelectedBpmnThreadId}
        />
      )}

      <ProtocolModal
        open={protocolModalOpen}
        protocol={protocolData}
        feedback={protocolFeedback}
        onFeedbackChange={setProtocolFeedback}
        category={protocolCategory}
        onCategoryChange={setProtocolCategory}
        length={protocolLength}
        onLengthChange={setProtocolLength}
        followupCount={protocolFollowupCount}
        onFollowupCountChange={setProtocolFollowupCount}
        additionalInfo={protocolAdditionalInfo}
        onAdditionalInfoChange={setProtocolAdditionalInfo}
        unresolvedInconsistencies={protocolUnresolvedInconsistencies}
        selectedInconsistencyIds={selectedInconsistencyIds}
        onSelectedInconsistencyIdsChange={setSelectedInconsistencyIds}
        unresolvedKnowledgeGaps={protocolUnresolvedKnowledgeGaps}
        selectedGapIds={selectedGapIds}
        onSelectedGapIdsChange={setSelectedGapIds}
        allowDynamicFollowup={allowDynamicFollowup}
        onAllowDynamicFollowupChange={setAllowDynamicFollowup}
        onSubmitFeedback={submitProtocolFeedback}
        onGenerateAgain={discardDraftForRegenerate}
        onGenerate={generateDraft}
        onSaveDraft={saveDraftEdits}
        feedbackSending={protocolFeedbackSending}
        onProceed={proceedCreateProtocol}
        onCancel={cancelProtocolModal}
        loading={protocolLoading}
        roundNumber={protocolTarget?.roundNumber}
        expertEmail={protocolTarget?.expertEmail}
      />

      <ProcessEditModal
        isOpen={editModalOpen}
        process={selectedProcess}
        token={token}
        onClose={() => setEditModalOpen(false)}
        onSave={handleEditModalSave}
      />

      <ProtocolGenerationEvaluationModal
        open={evaluationModalOpen}
        target={evaluationTarget}
        loading={evaluationSaving}
        onSubmit={handleSubmitGenerationEvaluation}
        onClose={handleCloseGenerationEvaluation}
      />

      <ProtocolFeedbackEvaluationModal
        open={feedbackEvaluationModalOpen}
        target={feedbackEvaluationTarget}
        loading={feedbackEvaluationSaving}
        onSubmit={handleSubmitFeedbackEvaluation}
        onClose={handleCloseFeedbackEvaluation}
      />
    </div>
  )
}

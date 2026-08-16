// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useState } from 'react'
import * as api from '../services/api'

export function useProtocolFlow({ token, processId, selectedBpmnThreadId, showStatus, onCreated, onGenerated }) {
  const [protocolModalOpen, setProtocolModalOpen] = useState(false)
  const [protocolDraft, setProtocolDraft] = useState(null)
  const [protocolData, setProtocolData] = useState(null)
  const [protocolLoading, setProtocolLoading] = useState(false)
  const [protocolFeedback, setProtocolFeedback] = useState('')
  const [protocolTarget, setProtocolTarget] = useState(null) // {expertId, expertEmail, roundNumber}
  const [protocolFeedbackSending, setProtocolFeedbackSending] = useState(false)
  const [protocolCategory, setProtocolCategory] = useState('discovery')
  const [protocolLength, setProtocolLength] = useState('medium')
  const [protocolFollowupCount, setProtocolFollowupCount] = useState(3)
  const [protocolAdditionalInfo, setProtocolAdditionalInfo] = useState('')
  const [protocolUnresolvedInconsistencies, setProtocolUnresolvedInconsistencies] = useState([])
  const [selectedInconsistencyIds, setSelectedInconsistencyIds] = useState([])
  const [protocolUnresolvedKnowledgeGaps, setProtocolUnresolvedKnowledgeGaps] = useState([])
  const [selectedGapIds, setSelectedGapIds] = useState([])
  const [allowDynamicFollowup, setAllowDynamicFollowup] = useState(false)
  const [generationSuccessTick, setGenerationSuccessTick] = useState(0)
  const [feedbackSuccessTick, setFeedbackSuccessTick] = useState(0)

  const readAllowDynamicFollowup = (content) => {
    if (!content || typeof content !== 'object') return false
    return !!content?.settings?.allow_llm_followup_if_no_scenario
  }

  const handleProtocolCategoryChange = (nextCategory) => {
    setProtocolCategory(nextCategory)
    if (nextCategory === 'discovery') {
      setSelectedInconsistencyIds([])
    } else if (nextCategory === 'validation') {
      setSelectedGapIds([])
    }
  }

  const openProtocolModal = ({ expertId, expertEmail, roundNumber }) => {
    setProtocolTarget({ expertId, expertEmail, roundNumber })
    setProtocolDraft(null)
    setProtocolData(null)
    setProtocolCategory('discovery')
    setProtocolLength('medium')
    setProtocolFollowupCount(3)
    setProtocolAdditionalInfo('')
    setSelectedInconsistencyIds([])
    setSelectedGapIds([])
    setProtocolModalOpen(true)
    loadExistingDraft({ expertId, roundNumber })
    loadUnresolvedInconsistencies()
    loadUnresolvedKnowledgeGaps()
  }

  const loadUnresolvedInconsistencies = async () => {
    if (!processId || !token) return
    try {
      const res = await api.getKnowledgeInconsistencies(token, processId)
      setProtocolUnresolvedInconsistencies(res?.items || [])
    } catch (e) {
      console.error('[ProcessDetailPage] Error loading unresolved inconsistencies:', e)
      setProtocolUnresolvedInconsistencies([])
    }
  }

  const loadUnresolvedKnowledgeGaps = async () => {
    if (!processId || !token) return
    try {
      const res = await api.getKnowledgeGaps(token, processId)
      setProtocolUnresolvedKnowledgeGaps(res?.items || [])
    } catch (e) {
      console.error('[ProcessDetailPage] Error loading unresolved knowledge gaps:', e)
      setProtocolUnresolvedKnowledgeGaps([])
    }
  }

  const loadExistingDraft = async ({ expertId, roundNumber }) => {
    if (!processId || !token) return
    try {
      setProtocolLoading(true)
      const res = await api.getExistingProtocolDraft(
        token,
        processId,
        expertId,
        roundNumber
      )
      setProtocolDraft(res)
      setProtocolData(res.content)
      setAllowDynamicFollowup(readAllowDynamicFollowup(res.content))
    } catch (e) {
      if (e?.status !== 404) {
        console.error('[ProcessDetailPage] Error loading protocol draft:', e)
      }
      setProtocolDraft(null)
      setProtocolData(null)
      setAllowDynamicFollowup(false)
    } finally {
      setProtocolLoading(false)
    }
  }

  const generateDraft = async () => {
    if (!protocolTarget || !processId) return null
    const { expertId, expertEmail, roundNumber } = protocolTarget

    try {
      setProtocolLoading(true)
      const res = await api.getProtocolDraft(
        token,
        processId,
        expertId,
        roundNumber,
        protocolCategory,
        protocolLength,
        protocolFollowupCount,
        protocolAdditionalInfo,
        protocolCategory === 'validation' ? selectedInconsistencyIds : [],
        protocolCategory === 'discovery' ? selectedGapIds : [],
        selectedBpmnThreadId,
      )
      setProtocolDraft(res)
      setProtocolData(res.content)
      setAllowDynamicFollowup(readAllowDynamicFollowup(res.content))
      setGenerationSuccessTick((prev) => prev + 1)
      showStatus?.('Protocol generated', 'success')
      onGenerated?.({
        processId,
        expertId,
        expertEmail,
        roundNumber,
      })
      return {
        processId,
        expertId,
        expertEmail,
        roundNumber,
      }
    } catch (e) {
      console.error('[ProcessDetailPage] Error generating protocol draft:', e)
      showStatus?.(`Error generating protocol: ${e.message}`, 'error')
      return null
    } finally {
      setProtocolLoading(false)
    }
  }

  const discardDraftForRegenerate = async () => {
    if (!protocolTarget || !processId || !protocolDraft) return
    const { expertId, roundNumber } = protocolTarget
    try {
      setProtocolLoading(true)
      await api.deleteProtocolDraft(token, processId, expertId, roundNumber)
      setProtocolDraft(null)
      setProtocolData(null)
      setAllowDynamicFollowup(false)
      showStatus?.('Draft discarded', 'info')
    } catch (e) {
      showStatus?.(`Error discarding draft: ${e.message}`, 'error')
    } finally {
      setProtocolLoading(false)
    }
  }

  const cancelProtocolModal = async () => {
    if (protocolTarget && processId && protocolDraft) {
      try {
        await api.deleteProtocolDraft(token, processId, protocolTarget.expertId, protocolTarget.roundNumber)
        showStatus?.('Draft discarded', 'info')
      } catch (e) {
        showStatus?.(`Error discarding draft: ${e.message}`, 'error')
      }
    }
    setProtocolModalOpen(false)
    setProtocolFeedback('')
    setProtocolDraft(null)
    setProtocolData(null)
    setProtocolCategory('discovery')
    setProtocolLength('medium')
    setProtocolFollowupCount(3)
    setProtocolAdditionalInfo('')
    setProtocolUnresolvedInconsistencies([])
    setSelectedInconsistencyIds([])
    setProtocolUnresolvedKnowledgeGaps([])
    setSelectedGapIds([])
    setAllowDynamicFollowup(false)
  }

  const proceedCreateProtocol = async () => {
    if (!protocolTarget || !processId) return
    const { expertId, expertEmail, roundNumber } = protocolTarget

    const confirmed = window.confirm('Are you sure you want to create this protocol?')
    if (!confirmed) return

    try {
      setProtocolLoading(true)

      if (!protocolDraft) {
        throw new Error('Protocol draft is not loaded')
      }

      const createdSession = await api.createProtocolSession(
        token,
        processId,
        expertId,
        expertEmail,
        roundNumber,
        allowDynamicFollowup,
      )

      showStatus?.(`Protocol created for ${expertEmail} (Round ${roundNumber})`, 'success')
      setProtocolModalOpen(false)
      setProtocolFeedback('')
      setProtocolDraft(null)
      setProtocolData(null)
      onCreated?.({
        processId,
        expertId,
        expertEmail,
        roundNumber,
        sessionId: createdSession?.session_id || null,
      })
    } catch (e) {
      showStatus?.(`Error creating protocol: ${e.message}`, 'error')
    } finally {
      setProtocolLoading(false)
    }
  }

  const submitProtocolFeedback = async () => {
    if (!protocolFeedback.trim()) {
      showStatus?.('Add some feedback before sending', 'error')
      return
    }
    if (!protocolTarget || !processId || !protocolDraft) {
      showStatus?.('Protocol draft is not loaded', 'error')
      return
    }
    try {
      setProtocolFeedbackSending(true)
      const payload = {
        process_id: processId,
        expert_id: protocolTarget.expertId,
        round_number: protocolTarget.roundNumber,
        feedback: protocolFeedback.trim(),
        category: protocolCategory,
        length: protocolLength,
        followup_count: protocolFollowupCount,
        additional_info: protocolAdditionalInfo
      }
      const res = await api.applyProtocolFeedback(token, payload)
      setProtocolDraft(res)
      setProtocolData(res.content)
      setProtocolFeedback('')
      setFeedbackSuccessTick((prev) => prev + 1)
      showStatus?.('Feedback applied. Draft updated.', 'success')
      return true
    } catch (e) {
      showStatus?.(`Error sending feedback: ${e.message}`, 'error')
      return false
    } finally {
      setProtocolFeedbackSending(false)
    }
  }

  const saveDraftEdits = async (content) => {
    if (!protocolTarget || !processId || !protocolDraft) {
      showStatus?.('Protocol draft is not loaded', 'error')
      return
    }
    try {
      setProtocolLoading(true)
      const payload = {
        process_id: processId,
        expert_id: protocolTarget.expertId,
        round_number: protocolTarget.roundNumber,
        content: content || protocolData
      }
      const res = await api.saveProtocolDraft(token, payload)
      setProtocolDraft(res)
      setProtocolData(res.content)
      showStatus?.('Draft updated', 'success')
    } catch (e) {
      showStatus?.(`Error saving draft: ${e.message}`, 'error')
    } finally {
      setProtocolLoading(false)
    }
  }

  return {
    protocolModalOpen,
    protocolDraft,
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
    setProtocolCategory: handleProtocolCategoryChange,
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
  }
}

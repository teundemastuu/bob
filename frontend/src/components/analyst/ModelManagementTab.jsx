// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import React, { useEffect, useRef, useState } from 'react'
import BpmnCanvas from './BpmnCanvas'
import * as api from '../../services/api'

export function ModelManagementTab({ processId, token, onStatusChange = null, onActiveThreadChange = null }) {
  const canvasRef = useRef(null)
  const [currentXml, setCurrentXml] = useState(null)
  const [savedModels, setSavedModels] = useState([])
  const [selectedModelId, setSelectedModelId] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [modelName, setModelName] = useState('')
  const [modelDescription, setModelDescription] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [bpmnThreadId, setBpmnThreadId] = useState(null)
  const [modelHistory, setModelHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateModalMode, setGenerateModalMode] = useState('generate')
  const [knowledgeOptions, setKnowledgeOptions] = useState([])
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState([])
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false)
  const [generationOptions, setGenerationOptions] = useState([])
  const [selectedGenerationIds, setSelectedGenerationIds] = useState([])
  const [isLoadingGenerationOptions, setIsLoadingGenerationOptions] = useState(false)
  const chatEndRef = useRef(null)

  const hasGeneratedModel = Boolean(bpmnThreadId && currentXml)

  // Load saved models on mount
  useEffect(() => {
    if (!processId || !token) return

    setCurrentXml(null)
    setBpmnThreadId(null)
    setSavedModels([])
    setModelHistory([])
    setHistoryIndex(-1)

    ;(async () => {
      try {
        const historyRes = await api.getBpmnHistory(token, processId)
        const items = historyRes?.items || []
        if (items.length > 0) {
          const lastIdx = items.length - 1
          setModelHistory(items)
          setHistoryIndex(lastIdx)
          setCurrentXml(items[lastIdx].response)
          setBpmnThreadId(items[lastIdx].id)
          return
        }

        const latest = await api.getLatestBpmnDiagram(token, processId)
        if (latest?.response && latest?.id) {
          setModelHistory([latest])
          setHistoryIndex(0)
          setCurrentXml(latest.response)
          setBpmnThreadId(latest.id)
        }
      } catch (e) {
        if (e?.status !== 404) {
          showStatusMsg(`Error loading latest generated model: ${e.message}`, 'error')
        }
      }
    })()
  }, [processId, token])

  /**
   * Load list of saved BPMN models for this process
   */
  const loadSavedModels = async () => {
    setSavedModels([])
  }

  /**
   * Load a specific model into the canvas
   */
  const handleLoadModel = async (modelId) => {
    try {
      setIsLoading(true)
      const model = await api.getProcessModel(token, processId)
      if (model && model.bpmn_xml) {
        setCurrentXml(model.bpmn_xml)
        setSelectedModelId(modelId)
        showStatusMsg(`Loaded model: ${model.name}`, 'success')
      }
    } catch (e) {
      showStatusMsg(`Error loading model: ${e.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Save current diagram
   */
  const handleSave = async () => {
    if (!canvasRef.current?.modeler) {
      showStatusMsg('Canvas not ready', 'error')
      return
    }

    try {
      setIsSaving(true)
      const { xml } = await canvasRef.current.modeler.saveXML({ format: true })
      
      const payload = {
        name: modelName.trim() || `Model_${new Date().toLocaleString()}`,
        description: modelDescription.trim(),
        bpmn_xml: xml,
        process_id: processId
      }

      let response
      if (selectedModelId) {
        // Update existing model (there's only one per process)
        response = await api.createOrUpdateProcessModel(token, processId, payload)
      } else {
        // Create new model
        response = await api.createOrUpdateProcessModel(token, processId, payload)
        setSelectedModelId(response.id)
      }

      setCurrentXml(xml)
      setShowSaveModal(false)
      setModelName('')
      setModelDescription('')
      await loadSavedModels()
      showStatusMsg('Model saved successfully', 'success')
    } catch (e) {
      showStatusMsg(`Error saving model: ${e.message}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Export current diagram as SVG
   */
  const handleExportSvg = async () => {
    if (!canvasRef.current?.modeler) {
      showStatusMsg('Canvas not ready', 'error')
      return
    }

    try {
      const { svg } = await canvasRef.current.modeler.saveSVG()
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `model_${selectedModelId || 'new'}.svg`
      link.click()
      URL.revokeObjectURL(url)
      showStatusMsg('Diagram exported as SVG', 'success')
    } catch (e) {
      showStatusMsg(`Error exporting SVG: ${e.message}`, 'error')
    }
  }

  /**
   * Export current diagram as XML
   */
  const handleExportXml = async () => {
    if (!canvasRef.current?.modeler) {
      showStatusMsg('Canvas not ready', 'error')
      return
    }

    try {
      const { xml } = await canvasRef.current.modeler.saveXML({ format: true })
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `model_${selectedModelId || 'new'}.bpmn`
      link.click()
      URL.revokeObjectURL(url)
      showStatusMsg('Diagram exported as BPMN XML', 'success')
    } catch (e) {
      showStatusMsg(`Error exporting XML: ${e.message}`, 'error')
    }
  }

  /**
   * Delete a saved model
   */
  const handleDeleteModel = async (modelId) => {
    if (!confirm('Are you sure you want to delete this model?')) return

    try {
      await api.deleteProcessModel(token, processId, modelId)
      if (selectedModelId === modelId) {
        setSelectedModelId(null)
        setCurrentXml(null)
        setBpmnThreadId(null)
      }
      await loadSavedModels()
      showStatusMsg('Model deleted successfully', 'success')
    } catch (e) {
      showStatusMsg(`Error deleting model: ${e.message}`, 'error')
    }
  }

  /**
   * Clear canvas for new diagram
   */
  const handleNewDiagram = () => {
    if (confirm('Create a new empty diagram? (current unsaved changes will be lost)')) {
      setCurrentXml(null)
      setSelectedModelId(null)
      setBpmnThreadId(null)
      setModelName('')
      setModelDescription('')
      if (canvasRef.current?.modeler) {
        canvasRef.current.clear()
      }
      showStatusMsg('New diagram created', 'success')
    }
  }

  const showStatusMsg = (message, type) => {
    if (onStatusChange) {
      onStatusChange(message, type)
    }
  }

  const handleImported = (event) => {
    if (event.type === 'error') {
      showStatusMsg(`Error importing diagram: ${event.error?.message}`, 'error')
    }
  }

  const handleHistoryBack = async () => {
    if (historyIndex <= 0) return
    const nextIndex = historyIndex - 1
    const target = modelHistory[nextIndex]
    if (!target) return

    await canvasRef.current?.importXML(target.response)
    setCurrentXml(target.response)
    setBpmnThreadId(target.id)
    setHistoryIndex(nextIndex)
  }

  const handleHistoryForward = async () => {
    if (historyIndex >= modelHistory.length - 1) return
    const nextIndex = historyIndex + 1
    const target = modelHistory[nextIndex]
    if (!target) return

    await canvasRef.current?.importXML(target.response)
    setCurrentXml(target.response)
    setBpmnThreadId(target.id)
    setHistoryIndex(nextIndex)
  }

  const handleGenerateModel = async (selectedSessionIds = []) => {
    if (!processId || !token) {
      showStatusMsg('Missing process or authentication', 'error')
      return
    }

    try {
      setIsGenerating(true)
      if (!hasGeneratedModel) {
        const userMsg = { text: 'Generate Model', sender: 'user', timestamp: new Date() }
        setChatMessages(prev => [...prev, userMsg])

        const descriptionRes = await api.getBpmnDescription(token, processId, selectedSessionIds)
        const description = descriptionRes?.description || ''
        if (!description.trim()) {
          throw new Error('No process description available')
        }
        const descriptionMsg = {
          text: `Generated process description:\n\n${description}`,
          sender: 'ai',
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, descriptionMsg])

        const result = await api.createBpmnDiagram(token, description, processId, selectedSessionIds)
        const xml = result?.response
        const threadId = result?.id
        if (!xml || !threadId) {
          throw new Error('No BPMN XML or thread id returned')
        }
        await canvasRef.current?.importXML(xml)
        setCurrentXml(xml)
        setBpmnThreadId(threadId)
        setModelHistory(prev => {
          const next = [...prev, { id: threadId, response: xml }]
          setHistoryIndex(next.length - 1)
          return next
        })
        const aiMsg = { text: 'Generated a BPMN draft from interview data.', sender: 'ai', timestamp: new Date() }
        setChatMessages(prev => [...prev, aiMsg])
        showStatusMsg('Model generated successfully', 'success')
        return
      }
    } catch (e) {
      const aiMsg = { text: `${hasGeneratedModel ? 'Update' : 'Generation'} failed: ${e.message}`, sender: 'ai', timestamp: new Date() }
      setChatMessages(prev => [...prev, aiMsg])
      showStatusMsg(`Error ${hasGeneratedModel ? 'updating' : 'generating'} model: ${e.message}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const openGenerateModal = async (mode = 'generate') => {
    if (!processId || !token) return
    setGenerateModalMode(mode)
    setShowGenerateModal(true)
    setIsLoadingGenerationOptions(true)
    try {
      const res = await api.getBpmnSessionOptions(token, processId)
      const items = res?.items || []
      setGenerationOptions(items)
      setSelectedGenerationIds(items.map(item => item.id))
    } catch (e) {
      setGenerationOptions([])
      setSelectedGenerationIds([])
      showStatusMsg(`Error loading interview options: ${e.message}`, 'error')
    } finally {
      setIsLoadingGenerationOptions(false)
    }
  }

  const handleApplyGenerate = async () => {
    if (generateModalMode === 'regenerate') {
      const confirmed = confirm(
        'Regenerate model from scratch? This will delete all generated model history for this process.'
      )
      if (!confirmed) return
    }
    setShowGenerateModal(false)
    if (generateModalMode === 'regenerate') {
      await handleRegenerateModel(selectedGenerationIds)
      return
    }
    await handleGenerateModel(selectedGenerationIds)
  }

  const openUpdateModal = async () => {
    if (!hasGeneratedModel || !processId || !bpmnThreadId) return

    setShowUpdateModal(true)
    setIsLoadingKnowledge(true)
    try {
      const res = await api.getBpmnKnowledgeOptions(token, processId, bpmnThreadId)
      const items = res?.items || []
      setKnowledgeOptions(items)
      const defaults = items.map(item => item.id)
      setSelectedKnowledgeIds(defaults)
    } catch (e) {
      setKnowledgeOptions([])
      setSelectedKnowledgeIds([])
      showStatusMsg(`Error loading interview options: ${e.message}`, 'error')
    } finally {
      setIsLoadingKnowledge(false)
    }
  }

  const handleApplyUpdate = async () => {
    if (selectedKnowledgeIds.length > 4) {
      showStatusMsg('Select up to 4 interviews for model update.', 'error')
      return
    }

    const feedback = chatInput.trim() || 'Update the BPMN model using the selected interview knowledge and keep existing valid structure.'

    try {
      setIsGenerating(true)
      const userMsg = { text: feedback, sender: 'user', timestamp: new Date() }
      setChatMessages(prev => [...prev, userMsg])
      setChatInput('')

      const result = await api.updateBpmnDiagram(
        token,
        bpmnThreadId,
        feedback,
        processId,
        selectedKnowledgeIds,
      )
      const generatedDescription = result?.feedbackDescription
      const xml = result?.response
      if (!xml) {
        throw new Error('No BPMN XML returned')
      }
      if (generatedDescription && result?.autoGeneratedFeedback) {
        const generatedMsg = {
          text: `Generated feedback description:\n\n${generatedDescription}`,
          sender: 'ai',
          timestamp: new Date(),
        }
        setChatMessages(prev => [...prev, generatedMsg])
      }
      await canvasRef.current?.importXML(xml)
      setCurrentXml(xml)
      const nextThreadId = result?.id || bpmnThreadId
      setBpmnThreadId(nextThreadId)
      setModelHistory(prev => {
        const branchBase = historyIndex >= 0 ? historyIndex : (prev.length - 1)
        const truncated = prev.slice(0, branchBase + 1)
        const next = [...truncated, { id: nextThreadId, response: xml }]
        setHistoryIndex(next.length - 1)
        return next
      })
      const aiMsg = { text: 'Updated BPMN model based on your feedback.', sender: 'ai', timestamp: new Date() }
      setChatMessages(prev => [...prev, aiMsg])
      setShowUpdateModal(false)
      showStatusMsg('Model updated successfully', 'success')
    } catch (e) {
      const aiMsg = { text: `Update failed: ${e.message}`, sender: 'ai', timestamp: new Date() }
      setChatMessages(prev => [...prev, aiMsg])
      showStatusMsg(`Error updating model: ${e.message}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDirectChatUpdate = async () => {
    const feedback = chatInput.trim()
    if (!feedback || !hasGeneratedModel) return

    try {
      setIsGenerating(true)
      const userMsg = { text: feedback, sender: 'user', timestamp: new Date() }
      setChatMessages(prev => [...prev, userMsg])
      setChatInput('')

      const result = await api.updateBpmnDiagram(
        token,
        bpmnThreadId,
        feedback,
        processId,
        [],
      )
      const xml = result?.response
      if (!xml) {
        throw new Error('No BPMN XML returned')
      }
      await canvasRef.current?.importXML(xml)
      setCurrentXml(xml)
      const nextThreadId = result?.id || bpmnThreadId
      setBpmnThreadId(nextThreadId)
      setModelHistory(prev => {
        const branchBase = historyIndex >= 0 ? historyIndex : (prev.length - 1)
        const truncated = prev.slice(0, branchBase + 1)
        const next = [...truncated, { id: nextThreadId, response: xml }]
        setHistoryIndex(next.length - 1)
        return next
      })
      const aiMsg = { text: 'Updated BPMN model based on your direct feedback.', sender: 'ai', timestamp: new Date() }
      setChatMessages(prev => [...prev, aiMsg])
      showStatusMsg('Model updated successfully', 'success')
    } catch (e) {
      const aiMsg = { text: `Update failed: ${e.message}`, sender: 'ai', timestamp: new Date() }
      setChatMessages(prev => [...prev, aiMsg])
      showStatusMsg(`Error updating model: ${e.message}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerateModel = async (selectedSessionIds = []) => {
    if (!processId || !token || !hasGeneratedModel) return

    try {
      setIsGenerating(true)
      await api.clearBpmnHistory(token, processId)
      setModelHistory([])
      setHistoryIndex(-1)
      setCurrentXml(null)
      setBpmnThreadId(null)
      setChatInput('')

      const userMsg = { text: 'Regenerate Model', sender: 'user', timestamp: new Date() }
      setChatMessages(prev => [...prev, userMsg])

      const descriptionRes = await api.getBpmnDescription(token, processId, selectedSessionIds)
      const description = descriptionRes?.description || ''
      if (!description.trim()) {
        throw new Error('No process description available')
      }

      const descriptionMsg = {
        text: `Generated process description:\n\n${description}`,
        sender: 'ai',
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, descriptionMsg])

      const result = await api.createBpmnDiagram(token, description, processId, selectedSessionIds)
      const xml = result?.response
      const threadId = result?.id
      if (!xml || !threadId) {
        throw new Error('No BPMN XML or thread id returned')
      }

      await canvasRef.current?.importXML(xml)
      setCurrentXml(xml)
      setBpmnThreadId(threadId)
      setModelHistory([{ id: threadId, response: xml }])
      setHistoryIndex(0)

      const aiMsg = {
        text: 'Model history cleared and a new model has been generated from scratch.',
        sender: 'ai',
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, aiMsg])
      showStatusMsg('Model regenerated from scratch', 'success')
    } catch (e) {
      const aiMsg = { text: `Regeneration failed: ${e.message}`, sender: 'ai', timestamp: new Date() }
      setChatMessages(prev => [...prev, aiMsg])
      showStatusMsg(`Error regenerating model: ${e.message}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const openRegenerateModal = async () => {
    if (!processId || !token || !hasGeneratedModel) return
    await openGenerateModal('regenerate')
  }

  const handleSendMessage = () => {
    if (!hasGeneratedModel || !chatInput.trim()) return
    handleDirectChatUpdate()
  }

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (onActiveThreadChange) {
      onActiveThreadChange(bpmnThreadId || null)
    }
  }, [bpmnThreadId, onActiveThreadChange])


  return (
    <div style={{ display: 'flex', gap: '0px', height: 'calc(100vh - 250px)' }}>
      {/* Sidebar - Buttons and Chat */}
      <div
        style={{
          width: '350px',
          borderRight: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#fafafa'
        }}
      >
        {/* Action Buttons */}
        <div style={{ padding: '15px 12px', display: 'flex', flexDirection: 'row', gap: '8px' }}>
          <button
            onClick={() => {
              if (hasGeneratedModel) {
                openUpdateModal()
              } else {
                openGenerateModal()
              }
            }}
            style={{
              flex: 1,
              padding: '10px 8px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.target.style.backgroundColor = '#1565c0'}
            onMouseOut={e => e.target.style.backgroundColor = '#1976d2'}
            disabled={isGenerating || isLoading}
          >
            {isGenerating ? (hasGeneratedModel ? 'Updating...' : 'Generating...') : (hasGeneratedModel ? 'Update' : 'Generate')}
          </button>
          {hasGeneratedModel && (
            <button
              onClick={openRegenerateModal}
              style={{
                flex: 1,
                padding: '10px 8px',
                backgroundColor: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                transition: 'background 0.2s'
              }}
              onMouseOver={e => e.target.style.backgroundColor = '#c62828'}
              onMouseOut={e => e.target.style.backgroundColor = '#d32f2f'}
              disabled={isGenerating || isLoading}
            >
              Regenerate
            </button>
          )}
          <button
            onClick={handleHistoryBack}
            style={{
              width: '44px',
              padding: '10px 8px',
              backgroundColor: '#5c6bc0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'background 0.2s',
              opacity: historyIndex <= 0 ? 0.5 : 1
            }}
            onMouseOver={e => e.target.style.backgroundColor = '#4f5db0'}
            onMouseOut={e => e.target.style.backgroundColor = '#5c6bc0'}
            disabled={isGenerating || historyIndex <= 0}
          >
              ←
          </button>
          <button
            onClick={handleHistoryForward}
            style={{
              width: '44px',
              padding: '10px 8px',
              backgroundColor: '#5c6bc0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '500',
              transition: 'background 0.2s',
              opacity: historyIndex >= modelHistory.length - 1 ? 0.5 : 1
            }}
            onMouseOver={e => e.target.style.backgroundColor = '#4f5db0'}
            onMouseOut={e => e.target.style.backgroundColor = '#5c6bc0'}
            disabled={isGenerating || historyIndex >= modelHistory.length - 1}
          >
              →
          </button>
        </div>

        {/* Chat Interface */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid #e0e0e0',
            overflow: 'hidden'
          }}
        >
          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '15px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {chatMessages.length === 0 ? (
              <div style={{ color: '#999', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                Start a conversation...
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: msg.sender === 'user' ? '#1976d2' : '#e0e0e0',
                      color: msg.sender === 'user' ? 'white' : '#333',
                      fontSize: '13px',
                      wordWrap: 'break-word'
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: '10px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              gap: '6px'
            }}
          >
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={hasGeneratedModel ? 'Type feedback for model update...' : 'Generate model first to provide feedback...'}
              rows={1}
              disabled={!hasGeneratedModel || isGenerating}
              style={{
                flex: 1,
                padding: '8px 10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
                boxSizing: 'border-box',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                minHeight: '36px',
                maxHeight: '100px',
                overflowY: 'auto',
                opacity: !hasGeneratedModel ? 0.6 : 1,
                backgroundColor: !hasGeneratedModel ? '#f5f5f5' : 'white'
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!hasGeneratedModel || isGenerating || !chatInput.trim()}
              style={{
                padding: '8px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500',
                width: '40px',
                flexShrink: 0,
                opacity: (!hasGeneratedModel || isGenerating || !chatInput.trim()) ? 0.6 : 1
              }}
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Canvas */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <BpmnCanvas
            ref={canvasRef}
            xml={currentXml}
            onImported={handleImported}
            readOnly={true}
          />
          {isGenerating && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.55)',
                color: '#1f1f1f',
                fontSize: '16px',
                fontWeight: 600,
                zIndex: 20
              }}
            >
              {hasGeneratedModel ? 'Drum roll...' : 'Now is the time for a coffee... You look good today by the way!'}
            </div>
          )}
          {!currentXml && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.92)',
                color: '#666',
                fontSize: '15px',
                fontWeight: 500,
                pointerEvents: 'none'
              }}
            >
              Generate to show model
            </div>
          )}
        </div>
      </div>

      {showUpdateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              width: 'min(760px, 92vw)',
              maxHeight: '85vh',
              overflowY: 'auto',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}
          >
            <h3 style={{ margin: '0 0 12px 0' }}>Create a feedback description based on...</h3>

            <div style={{ marginBottom: '10px', fontWeight: 600 }}>
              Select new or changed interviews not yet used in the current model:
            </div>

            <div style={{ marginBottom: '10px', color: '#555', fontSize: '13px' }}>
              You can select up to 4 interviews. 
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: '6px', padding: '10px', maxHeight: '260px', overflowY: 'auto' }}>
              {isLoadingKnowledge ? (
                <div style={{ color: '#666' }}>Loading interview options...</div>
              ) : knowledgeOptions.length === 0 ? (
                <div style={{ color: '#666' }}>No new or changed completed interviews available.</div>
              ) : (
                knowledgeOptions
                  .map(item => (
                    <label key={item.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        checked={selectedKnowledgeIds.includes(item.id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked
                          if (isChecked && selectedKnowledgeIds.length >= 4 && !selectedKnowledgeIds.includes(item.id)) {
                            showStatusMsg('You can select up to 4 interviews for update.', 'error')
                            return
                          }
                          setSelectedKnowledgeIds(prev => (
                            isChecked
                              ? [...prev, item.id]
                              : prev.filter(id => id !== item.id)
                          ))
                        }}
                      />
                      <span style={{ fontSize: '13px', color: '#333' }}>
                        {item.expertEmail || 'Unknown expert'} • {item.qaCount} Q&A • {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown date'} • {item.changeType}
                      </span>
                    </label>
                  ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={() => setShowUpdateModal(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  color: '#333',
                  cursor: 'pointer'
                }}
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyUpdate}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  cursor: 'pointer'
                }}
                disabled={isGenerating}
              >
                Apply Update
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenerateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              width: 'min(760px, 92vw)',
              maxHeight: '85vh',
              overflowY: 'auto',
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}
          >
            <h3 style={{ margin: '0 0 12px 0' }}>{generateModalMode === 'regenerate' ? 'Regenerate model based on interviews' : 'Generate model based on interviews'}</h3>
            <div style={{ marginBottom: '10px', color: '#555', fontSize: '13px' }}>
              Select interviews to include. The backend automatically decides raw vs summary for selected interviews.
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: '6px', padding: '10px', maxHeight: '260px', overflowY: 'auto' }}>
              {isLoadingGenerationOptions ? (
                <div style={{ color: '#666' }}>Loading interview options...</div>
              ) : generationOptions.length === 0 ? (
                <div style={{ color: '#666' }}>No completed interviews available.</div>
              ) : (
                generationOptions.map(item => (
                  <label key={item.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={selectedGenerationIds.includes(item.id)}
                      onChange={(e) => {
                        setSelectedGenerationIds(prev => (
                          e.target.checked
                            ? [...prev, item.id]
                            : prev.filter(id => id !== item.id)
                        ))
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#333' }}>
                      {item.expertEmail || 'Unknown expert'} • {item.qaCount} Q&A • {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown date'}
                      {item.hasSummary ? ' • summary available' : ''}
                    </span>
                  </label>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={() => setShowGenerateModal(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  color: '#333',
                  cursor: 'pointer'
                }}
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyGenerate}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#1976d2',
                  color: 'white',
                  cursor: 'pointer'
                }}
                disabled={isGenerating}
              >
                {generateModalMode === 'regenerate' ? 'Regenerate' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

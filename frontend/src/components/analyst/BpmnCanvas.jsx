// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import { getDi } from 'bpmn-js/lib/draw/BpmnRenderUtil'

const BpmnCanvas = forwardRef(({ xml = null, onImported = null, readOnly = false }, ref) => {
  const containerRef = useRef(null)
  const modelerRef = useRef(null)
  const [importError, setImportError] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isReady, setIsReady] = useState(false)

  // Initialize bpmn-js modeler or viewer
  useEffect(() => {
    if (!containerRef.current) return

    // Create modeler instance with disabled modules for read-only mode
    const instance = new BpmnModeler({
      container: containerRef.current,
      keyboard: readOnly ? undefined : { bindTo: document },
      additionalModules: readOnly ? [
        {
          bendpoints: ['value', null],
          connectionSegmentMove: ['value', null]
        }
      ] : []
    })

    modelerRef.current = instance
    setIsReady(true)

    // Disable element editing/moving if read-only, but keep canvas navigation
    if (readOnly) {
      instance.on('import.done', () => {
        try {
          const eventBus = instance.get('eventBus')
          
          // Block all dragging interactions on elements
          const isPanRoot = (element) => {
            if (!element || !element.id) {
              return false
            }
            const type = element.type
            const id = element.id
            return id.includes('Process_') || id.includes('Collaboration_') || id.includes('Participant_') ||
                   type === 'bpmn:Process' || type === 'bpmn:Collaboration' || type === 'bpmn:Participant'
          }

          const blockIfNotRoot = (event) => {
            if (!isPanRoot(event.element)) {
              return false
            }
          }

          eventBus.on('element.mousedown', 10000, blockIfNotRoot)
          eventBus.on('element.click', 10000, blockIfNotRoot)
          eventBus.on('element.dblclick', 10000, blockIfNotRoot)
          eventBus.on('element.contextmenu', 10000, blockIfNotRoot)
          
          // Block all shape/connection modifications
          eventBus.on('commandStack.shape.create.preExecute', 10000, () => false)
          eventBus.on('commandStack.shape.move.preExecute', 10000, () => false)
          eventBus.on('commandStack.shape.delete.preExecute', 10000, () => false)
          eventBus.on('commandStack.shape.resize.preExecute', 10000, () => false)
          eventBus.on('commandStack.connection.create.preExecute', 10000, () => false)
          eventBus.on('commandStack.connection.move.preExecute', 10000, () => false)
          eventBus.on('commandStack.connection.delete.preExecute', 10000, () => false)
          eventBus.on('commandStack.connection.reconnect.preExecute', 10000, () => false)
          eventBus.on('commandStack.connection.updateWaypoints.preExecute', 10000, () => false)
          eventBus.on('commandStack.element.updateProperties.preExecute', 10000, () => false)
          
          // Disable context pad and palette
          const contextPad = instance.get('contextPad')
          const palette = instance.get('palette')
          contextPad.close()
          palette.close()
          
        } catch (e) {
          console.error('Read-only setup failed:', e)
        }
      })
    }

    // Handle import completion
    instance.on('import.done', ({ error, warnings }) => {
      if (!error) {
        // Fit viewport after import
        const canvas = instance.get('canvas')
        canvas.zoom('fit-viewport')
        setIsLoaded(true)
        if (onImported) {
          onImported({ type: 'success', error: null, warnings })
        }
      } else {
        setImportError(error)
        if (onImported) {
          onImported({ type: 'error', error, warnings: [] })
        }
      }
    })

    // Load initial XML if provided
    if (xml) {
      instance.importXML(xml)
    }

    // Cleanup
    return () => {
      instance.destroy()
    }
  }, [readOnly])

  useEffect(() => {
    if (!isReady || !modelerRef.current || !xml) return
    modelerRef.current.importXML(xml).catch((err) => {
      setImportError(err)
      console.error('Error importing XML from prop change:', err)
    })
  }, [xml, isReady])

  /**
   * Create an empty BPMN diagram
   */
  const createEmptyDiagram = (instance) => {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                   id="Definitions_1" 
                   targetNamespace="http://bpmn.io/schema/bpmn"
                   exporter="bpmn-js"
                   exporterVersion="17.0.1">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="192" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

    instance.importXML(emptyXml)
  }

  /**
   * Import XML into the modeler
   */
  const importXML = async (xmlString) => {
    if (!modelerRef.current || !isReady) {
      console.warn('Modeler not ready yet')
      return
    }

    try {
      await modelerRef.current.importXML(xmlString)
      const canvas = modelerRef.current.get('canvas')
      canvas.zoom('fit-viewport')
      setImportError(null)
    } catch (err) {
      setImportError(err)
      console.error('Error importing XML:', err)
    }
  }

  /**
   * Get current diagram XML
   */
  const getXml = async () => {
    if (!modelerRef.current) return null

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true })
      return xml
    } catch (err) {
      console.error('Error saving XML:', err)
      return null
    }
  }

  /**
   * Get current diagram as SVG
   */
  const getSvg = async () => {
    if (!modelerRef.current) return null

    try {
      const { svg } = await modelerRef.current.saveSVG()
      return svg
    } catch (err) {
      console.error('Error saving SVG:', err)
      return null
    }
  }

  /**
   * Export diagram as PNG
   */
  const exportImage = async (format = 'png') => {
    if (!modelerRef.current) return

    try {
      const { svg } = await modelerRef.current.saveSVG()
      
      // Create canvas from SVG
      const canvas = document.createElement('canvas')
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      
      const img = new Image()
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        
        const link = document.createElement('a')
        link.href = canvas.toDataURL(`image/${format}`)
        link.download = `diagram.${format}`
        link.click()
        
        URL.revokeObjectURL(url)
      }
      img.src = url
    } catch (err) {
      console.error('Error exporting image:', err)
    }
  }

  /**
   * Clear diagram
   */
  const clear = () => {
    if (!modelerRef.current) return
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                   id="Definitions_1" 
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="BPMNShape_StartEvent_1" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="192" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
    modelerRef.current.importXML(emptyXml)
  }

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    getXml,
    getSvg,
    exportImage,
    clear,
    importXML,
    isReady,
    modeler: modelerRef.current
  }))

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        overflow: 'hidden'
      }}
    >
      {importError && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            padding: '10px 15px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            maxWidth: '300px',
            zIndex: 10
          }}
        >
          Error loading diagram: {importError.message}
        </div>
      )}
    </div>
  )
})

export default BpmnCanvas

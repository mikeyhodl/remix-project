// eslint-disable-next-line no-use-before-define
import React, { useEffect, useLayoutEffect, useState } from 'react'
import Draggable from 'react-draggable'
import './dragbar.css'

interface IRemixDragBarUi {
  refObject: React.MutableRefObject<any>
  setHideStatus: (hide: boolean) => void
  hidden: boolean
  minHeight?: number
  onResize: (height: number) => void
}

const DragBar = (props: IRemixDragBarUi) => {
  const handleSize = 6
  const halfHandleSize = handleSize / 2
  const [dragState, setDragState] = useState<boolean>(false)
  const [dragBarPosY, setDragBarPosY] = useState<number>(0)
  const nodeRef = React.useRef(null) // fix for strictmode

  const getContainerElement = () => nodeRef.current ? (nodeRef.current as HTMLDivElement).offsetParent as HTMLElement | null : null

  const syncDragbarPosition = () => {
    const terminalElement = props.refObject.current as HTMLElement | null
    const containerElement = getContainerElement()
    if (!terminalElement || !containerElement || terminalElement.offsetParent === null) return

    const terminalRect = terminalElement.getBoundingClientRect()
    const containerRect = containerElement.getBoundingClientRect()
    const topEdge = terminalRect.top - containerRect.top

    setDragBarPosY(topEdge - halfHandleSize)
  }

  const scheduleSync = () => {
    requestAnimationFrame(() => {
      syncDragbarPosition()
    })
  }

  function stopDrag(_e: MouseEvent, data: { y: number }) {
    const terminalElement = props.refObject.current as HTMLElement | null
    const containerElement = getContainerElement()
    if (!terminalElement || !containerElement) {
      setDragState(false)
      return
    }

    const edgeY = data.y + halfHandleSize
    const nextHeight = Math.max(containerElement.getBoundingClientRect().height - edgeY, props.minHeight || 70)

    terminalElement.style.height = `${nextHeight}px`
    props.onResize(nextHeight)
    setDragState(false)
    props.setHideStatus(false)
    scheduleSync()
  }

  useLayoutEffect(() => {
    syncDragbarPosition()
  }, [props.hidden])

  useEffect(() => {
    const terminalElement = props.refObject.current as HTMLElement | null
    const containerElement = getContainerElement()
    if (!terminalElement || !containerElement) return

    scheduleSync()
    window.addEventListener('resize', scheduleSync)

    const resizeObserver = new ResizeObserver(() => scheduleSync())
    resizeObserver.observe(terminalElement)
    resizeObserver.observe(containerElement)
    Array.from(containerElement.children).forEach((child) => {
      if (child !== nodeRef.current) resizeObserver.observe(child as Element)
    })

    const observer = new MutationObserver(() => scheduleSync())
    observer.observe(terminalElement, {
      attributes: true,
      attributeFilter: ['class', 'style']
    })

    return () => {
      window.removeEventListener('resize', scheduleSync)
      resizeObserver.disconnect()
      observer.disconnect()
    }
  }, [])

  function startDrag() {
    syncDragbarPosition()
    setDragState(true)
  }

  return (
    <>
      <div className={`overlay ${dragState ? '' : 'd-none'}`} data-id="dragbar-overlay" id="dragbar-overlay"></div>
      <Draggable nodeRef={nodeRef} position={{ x: 0, y: dragBarPosY }} onStart={startDrag} onStop={stopDrag} axis="y">
        <div ref={nodeRef} className={`dragbar_terminal ${dragState ? 'ondrag' : ''}`} data-id="dragbar-draggable" id="dragbar-draggable"></div>
      </Draggable>
    </>
  )
}

export default DragBar

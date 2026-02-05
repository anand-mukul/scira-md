<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const isOpen = ref(false)
const zoomLevel = ref(1)
const currentDiagram = ref<HTMLElement | null>(null)
const modalContent = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const position = ref({ x: 0, y: 0 })

const openModal = (svg: HTMLElement) => {
  currentDiagram.value = svg.cloneNode(true) as HTMLElement
  isOpen.value = true
  zoomLevel.value = 1
  position.value = { x: 0, y: 0 }
  document.body.style.overflow = 'hidden'
}

const closeModal = () => {
  isOpen.value = false
  currentDiagram.value = null
  document.body.style.overflow = ''
}

const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value + 0.25, 5)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value - 0.25, 0.25)
}

const resetZoom = () => {
  zoomLevel.value = 1
  position.value = { x: 0, y: 0 }
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  dragStart.value = { x: e.clientX - position.value.x, y: e.clientY - position.value.y }
}

const onDrag = (e: MouseEvent) => {
  if (isDragging.value) {
    position.value = {
      x: e.clientX - dragStart.value.x,
      y: e.clientY - dragStart.value.y
    }
  }
}

const stopDrag = () => {
  isDragging.value = false
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    closeModal()
  }
}

const attachClickHandlers = () => {
  nextTick(() => {
    const mermaidDiagrams = document.querySelectorAll('.mermaid-diagram svg, .mermaid svg')
    mermaidDiagrams.forEach((svg) => {
      if (!svg.classList.contains('zoom-enabled')) {
        svg.classList.add('zoom-enabled')
        svg.addEventListener('click', () => openModal(svg as HTMLElement))
      }
    })
  })
}

let observer: MutationObserver | null = null

onMounted(() => {
  // Initial attachment
  attachClickHandlers()

  // Watch for dynamically added mermaid diagrams
  observer = new MutationObserver(() => {
    attachClickHandlers()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })

  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="mermaid-zoom-overlay"
        @click.self="closeModal"
        @wheel="handleWheel"
        @mousedown="startDrag"
        @mousemove="onDrag"
        @mouseup="stopDrag"
        @mouseleave="stopDrag"
      >
        <div class="mermaid-zoom-controls">
          <button @click.stop="zoomOut" title="Zoom Out" aria-label="Zoom out">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
          <button @click.stop="zoomIn" title="Zoom In" aria-label="Zoom in">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
          </button>
          <button @click.stop="resetZoom" title="Reset Zoom" aria-label="Reset zoom">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          <button @click.stop="closeModal" title="Close (Esc)" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div
          ref="modalContent"
          class="mermaid-zoom-content"
          :style="{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }"
        >
          <div v-if="currentDiagram" v-html="currentDiagram.outerHTML"></div>
        </div>
        <div class="mermaid-zoom-hint">
          Click and drag to pan • Scroll to zoom • Press Esc to close
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mermaid-zoom-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: grab;
}

.mermaid-zoom-controls {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  align-items: center;
  background: var(--vp-c-bg-soft, #f6f6f7);
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 10000;
}

.mermaid-zoom-controls button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: var(--vp-c-bg, #ffffff);
  border-radius: 6px;
  cursor: pointer;
  color: var(--vp-c-text-1, #213547);
  transition: all 0.2s ease;
}

.mermaid-zoom-controls button:hover {
  background: var(--vp-c-brand-1, #3451b2);
  color: white;
}

.zoom-level {
  min-width: 50px;
  text-align: center;
  font-weight: 600;
  font-size: 14px;
  color: var(--vp-c-text-1, #213547);
}

.mermaid-zoom-content {
  transition: transform 0.1s ease-out;
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.mermaid-zoom-content :deep(svg) {
  max-width: none !important;
  max-height: none !important;
}

.mermaid-zoom-hint {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  z-index: 10000;
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .mermaid-zoom-content,
.modal-leave-active .mermaid-zoom-content {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from .mermaid-zoom-content,
.modal-leave-to .mermaid-zoom-content {
  transform: scale(0.95);
  opacity: 0;
}
</style>

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'

export default function GaussianViewer({ modelPath }) {
  const containerRef = useRef(null)
  const rafRef       = useRef(null)
  const viewerRef    = useRef(null)
  const [phase, setPhase] = useState('loading') // 'loading' | 'fitting' | 'ready' | 'error'

  useEffect(() => {
    const container = containerRef.current
    if (!container || !modelPath) return

    let disposed = false
    setPhase('loading')

    const w = container.offsetWidth  || 160
    const h = container.offsetHeight || 250

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000)
    camera.position.set(0, 0, 8)

    const viewer = new GaussianSplats3D.Viewer({
      renderer,
      camera,
      selfDrivenMode:         false,
      useBuiltInControls:     false,
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort:     false,
    })
    viewerRef.current = viewer

    viewer.addSplatScene(modelPath, {
      splatAlphaRemovalThreshold: 5,
      showLoadingUI: false,
      rotation: [1, 0, 0, 0],
    }).then(() => {
      if (disposed) return
      setPhase('fitting')

      const center = new THREE.Vector3()
      let radius = 8
      let angle  = 0

      // Keep rendering while we wait for splatTree (so the user sees motion)
      const animate = () => {
        if (disposed) return
        rafRef.current = requestAnimationFrame(animate)
        angle += 0.004
        camera.position.x = center.x + Math.sin(angle) * radius
        camera.position.y = center.y
        camera.position.z = center.z + Math.cos(angle) * radius
        camera.lookAt(center)
        viewer.update()
        viewer.render()
      }
      animate()

      // Poll until splatTree is built (async Web Worker), then fit camera and reveal
      const tryFitCamera = () => {
        if (disposed) return
        const splatMesh = viewer.getSplatMesh()
        const subTree   = splatMesh?.splatTree?.subTrees?.[0]
        if (subTree?.sceneMin && subTree?.sceneMax) {
          const mn = subTree.sceneMin
          const mx = subTree.sceneMax
          center.set((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, (mn.z + mx.z) / 2)
          const sizeX = mx.x - mn.x
          const sizeY = mx.y - mn.y

          const fovHalfRad = (40 / 2) * (Math.PI / 180)
          const aspect     = w / h
          const hFovHalf   = Math.atan(Math.tan(fovHalfRad) * aspect)
          const rFromH     = (sizeY * 0.5) / Math.tan(fovHalfRad)
          const rFromW     = (sizeX * 0.5) / Math.tan(hFovHalf)
          radius = Math.max(rFromH, rFromW) * 1.15

          if (!disposed) setPhase('ready')
        } else {
          setTimeout(tryFitCamera, 500)
        }
      }
      tryFitCamera()
    }).catch(err => {
      if (!disposed) setPhase('error')
    })

    return () => {
      disposed = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try { viewer.dispose() } catch (_) {}
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [modelPath])

  return (
    <div className="gaussian-wrap">
      {/* Canvas hidden until camera is fitted — prevents the "tiny model" flash */}
      <div
        ref={containerRef}
        className={`gaussian-canvas${phase === 'ready' ? ' gaussian-canvas--ready' : ''}`}
      />
      {(phase === 'loading' || phase === 'fitting') && (
        <div className="gaussian-loading">
          <span className="gaussian-loading__dot" />
          <span className="gaussian-loading__dot" />
          <span className="gaussian-loading__dot" />
          <span className="gaussian-loading__text">
            {phase === 'loading' ? 'LOADING MODEL' : 'PREPARING'}
          </span>
        </div>
      )}
      {phase === 'error' && (
        <div className="gaussian-error">MODEL LOAD ERROR</div>
      )}
    </div>
  )
}

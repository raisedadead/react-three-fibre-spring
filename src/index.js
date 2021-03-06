import ReactDOM from 'react-dom'
import * as THREE from 'three/src/Three'
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
// A THREE.js React renderer, see: https://github.com/drcmda/react-three-fiber
import { apply as applyThree, Canvas, useRender, useThree } from 'react-three-fiber'
// A React animation lib, see: https://github.com/react-spring/react-spring
import { apply as applySpring, useSpring, animated as anim, interpolate } from 'react-spring/three'
import data from './data'
import './styles.css'

// Import and register postprocessing classes as three-native-elements
import { EffectComposer } from './postprocessing/EffectComposer'
import { RenderPass } from './postprocessing/RenderPass'
import { GlitchPass } from './postprocessing/GlitchPass'
applySpring({ EffectComposer, RenderPass, GlitchPass })
applyThree({ EffectComposer, RenderPass, GlitchPass })

/** This component loads an image and projects it onto a plane */
function Image({ url, opacity, scale, ...props }) {
  const texture = useMemo(() => new THREE.TextureLoader().load(url), [url])
  const [hovered, setHover] = useState(false)
  const hover = useCallback(() => setHover(true), [])
  const unhover = useCallback(() => setHover(false), [])
  const { factor } = useSpring({ factor: hovered ? 1.25 : 1 })
  return (
    <anim.mesh {...props} onHover={hover} onUnhover={unhover} scale={factor.interpolate(f => [scale * f, scale * f, 1])}>
      <planeBufferGeometry name="geometry" args={[3.8, 3.8]} />
      <anim.meshLambertMaterial name="material" transparent opacity={opacity}>
        <primitive name="map" object={texture} />
      </anim.meshLambertMaterial>
    </anim.mesh>
  )
}

/** This component renders text via canvas and projects it as a sprite */
function Text({ children, position, opacity, color = 'white', fontSize = 410 }) {
  const { size, viewport } = useThree()
  const { width: viewportWidth, height: viewportHeight } = viewport()
  const scale = viewportWidth > viewportHeight ? viewportWidth : viewportHeight
  const canvas = useMemo(
    () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 2048
      const context = canvas.getContext('2d')
      context.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, avenir next, avenir, helvetica neue, helvetica, ubuntu, roboto, noto, segoe ui, arial, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = color
      context.fillText(children, 1024, 1024 - 410 / 2)
      return canvas
    },
    [children, size.width, size.height]
  )
  return (
    <anim.sprite scale={[scale, scale, 1]} position={position}>
      <anim.spriteMaterial name="material" transparent opacity={opacity}>
        <canvasTexture name="map" image={canvas} premultiplyAlpha onUpdate={s => (s.needsUpdate = true)} />
      </anim.spriteMaterial>
    </anim.sprite>
  )
}

/** This component creates a fullscreen colored plane */
function Background({ color }) {
  const { viewport } = useThree()
  const { width, height } = viewport()
  return (
    <mesh scale={[width, height, 1]}>
      <planeGeometry name="geometry" args={[1, 1]} />
      <anim.meshBasicMaterial name="material" color={color} depthTest={false} />
    </mesh>
  )
}

/** This component rotates a bunch of stars */
function Stars({ position }) {
  let group = useRef()
  let theta = 0
  useRender(() => {
    const r = 5 * Math.sin(THREE.Math.degToRad((theta += 0.01)))
    const s = Math.cos(THREE.Math.degToRad(theta * 2))
    group.current.rotation.set(r, r, r)
    group.current.scale.set(s, s, s)
  })
  const [geo, mat, vertices, coords] = useMemo(() => {
    const geo = new THREE.SphereBufferGeometry(1, 10, 10)
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('peachpuff') })
    const coords = new Array(1000).fill().map(i => [Math.random() * 800 - 400, Math.random() * 800 - 400, Math.random() * 800 - 400])
    return [geo, mat, vertices, coords]
  }, [])
  return (
    <anim.group ref={group} position={position}>
      {coords.map(([p1, p2, p3], i) => (
        <mesh key={i} geometry={geo} material={mat} position={[p1, p2, p3]} />
      ))}
    </anim.group>
  )
}

/** This component creates a glitch effect */
function Effects({ factor }) {
  const { gl, scene, camera, size } = useThree()
  const composer = useRef()
  useEffect(() => void composer.current.obj.setSize(size.width, size.height), [size.width, size.height])
  // This takes over as the main render-loop (when 2nd arg is set to true)
  useRender(() => composer.current.obj.render(), true)
  return (
    <effectComposer ref={composer} args={[gl]}>
      <renderPass name="passes" args={[scene, camera]} />
      <anim.glitchPass name="passes" renderToScreen factor={factor} />
    </effectComposer>
  )
}

/** This component maintains the scene */
function Scene({ top, mouse }) {
  const { size } = useThree()
  const scrollMax = size.height * 4.5
  return (
    <>
      <anim.spotLight intensity={1.2} color="white" position={mouse.interpolate((x, y) => [x / 100, -y / 100, 6.5])} />
      <Effects factor={top.interpolate([0, 150], [1, 0])} />
      <Background
        color={top.interpolate([0, scrollMax * 0.25, scrollMax * 0.5, scrollMax], ['#27282F', '#247BA0', '#70C1B3', '#e8f3f1'])}
      />
      <Stars position={top.interpolate(top => [0, -1 + top / 20, 0])} />
      {data.map(([url, x, y, factor, z, scale], index) => (
        <Image
          key={index}
          url={url}
          scale={scale}
          opacity={top.interpolate([0, 500], [0, 1])}
          position={interpolate([top, mouse], (top, mouse) => [
            (-mouse[0] * factor) / 50000 + x,
            (mouse[1] * factor) / 50000 + y * 1.15 + ((top * factor) / scrollMax) * 2,
            z + top / 2000
          ])}
        />
      ))}
      <Text opacity={top.interpolate([0, 200], [1, 0])} position={top.interpolate(top => [0, -1 + top / 200, 0])}>
        lorem
      </Text>
      <Text position={top.interpolate(top => [0, -19 + ((top * 10) / scrollMax) * 2, 0])} color="black" fontSize={150}>
        Ipsum
      </Text>
    </>
  )
}

/** Main component, controls two animated springs, one for scroll, the other for mouse movement */
export default function Main() {
  // This tiny spring right here controlls all(!) the animations
  const [{ top, mouse }, set] = useSpring(() => ({ top: 0, mouse: [0, 0] }))
  const onMouseMove = useCallback(
    ({ clientX: x, clientY: y }) => set({ mouse: [x - window.innerWidth / 2, y - window.innerHeight / 2] }),
    []
  )
  const onScroll = useCallback(e => set({ top: e.target.scrollTop }), [])
  return (
    <>
      <div className="scroll-container" onScroll={onScroll} onMouseMove={onMouseMove} />
      <Canvas className="canvas">
        <Scene top={top} mouse={mouse} />
      </Canvas>
    </>
  )
}

ReactDOM.render(<Main />, document.getElementById('root'))

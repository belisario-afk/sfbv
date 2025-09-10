import React, { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import ThreeBackdrop from '../FX/ThreeBackdrop.jsx'

function VoteRing({ percent=50, colorA='#7dd3fc', colorB='#a78bfa' }) {
  const dash = useMemo(() => [percent/100, 1 - (percent/100)], [percent])
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]}>
        <torusGeometry args={[6.5, 0.08, 2, 256]} />
        <meshBasicMaterial color={colorA} transparent opacity={0.4}/>
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]}>
        <torusGeometry args={[7.0, 0.09, 2, 256]} />
        <meshBasicMaterial color={colorB} transparent opacity={0.35}/>
      </mesh>
    </group>
  )
}

function Pulses({ percent }) {
  const count = 180
  const positions = useMemo(() => {
    return new Array(count).fill(0).map((_,i) => {
      const a = (i / count) * Math.PI * 2
      const r = 5.4 + (i%5)*0.03
      return [Math.cos(a)*r, 0.02*(i%3), Math.sin(a)*r]
    })
  }, [])
  return (
    <instancedMesh args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[0.02, 6, 6]} />
      <meshBasicMaterial color={'#67e8f9'} />
      {positions.map((p,i)=>(
        <group key={i} position={p} />
      ))}
    </instancedMesh>
  )
}

export default function NeoArena({ percentA, percentB, stage }) {
  return (
    <Canvas camera={{ position: [0, 8, 12], fov: 45 }}>
      <color attach="background" args={['#0b0f1a']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4,6,4]} intensity={0.6}/>
      <Suspense fallback={null}>
        <ThreeBackdrop />
      </Suspense>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.5,0]}>
        <circleGeometry args={[8, 64]} />
        <meshBasicMaterial color={'#0f172a'} />
      </mesh>
      <VoteRing percent={percentA} />
      <Pulses percent={percentA}/>
      <OrbitControls enablePan={false} enableZoom={false} />
      <Stars radius={80} depth={40} count={5000} factor={4} fade />
    </Canvas>
  )
}
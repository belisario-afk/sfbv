import React, { useMemo } from 'react'
import { useThree } from '@react-three/fiber'

export default function ThreeBackdrop() {
  const { viewport } = useThree()
  const w = viewport.width
  const h = viewport.height
  const rings = useMemo(() => new Array(8).fill(0).map((_,i)=>({
    r: 2 + i*0.6, o: 0.15 + i*0.05
  })), [])
  return (
    <group>
      {rings.map((r,i)=>(
        <mesh rotation={[-Math.PI/2,0,0]} key={i} position={[0, -0.49 + i*0.001, 0]}>
          <ringGeometry args={[r.r, r.r+0.05, 64]} />
          <meshBasicMaterial color={i%2? '#1e293b':'#0f172a'} transparent opacity={r.o}/>
        </mesh>
      ))}
    </group>
  )
}
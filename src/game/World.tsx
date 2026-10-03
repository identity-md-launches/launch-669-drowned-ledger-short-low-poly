import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { strangeFish } from "./data";
import { puzzleRegistry } from "../puzzles/registry";

export type WorldProps = {
  position: { x: number; z: number; heading: number };
  phase: number;
  dread: number;
  allWords: boolean;
  selectedSpot: string | null;
  onSelectSpot: (id: string) => void;
  onSelectSite: (id: string) => void;
  onSelectNPC: (id: string) => void;
  paused: boolean;
  reducedMotion: boolean;
};

const C = {
  water: "#243f3d",
  timber: "#6b6650",
  timberDark: "#353e33",
  rock: "#57645a",
  land: "#495349",
  wall: "#889080",
  roof: "#3b4942",
  gold: "#d2b875",
  glow: "#edca78",
  pine: "#283f35",
};
const spots = strangeFish.map((fish, index) => ({
  id: fish.id,
  x: fish.x,
  z: fish.z,
  title: fish.spot,
  number: ["I", "II", "III", "IV", "V"][index],
}));

function Box({
  at,
  size,
  color,
  rotation = [0, 0, 0],
  glow = false,
}: {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
  rotation?: [number, number, number];
  glow?: boolean;
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.95}
        emissive={glow ? color : "#000000"}
        emissiveIntensity={glow ? 1.2 : 0}
      />
    </mesh>
  );
}
function Rock({
  at,
  scale = [1, 1, 1],
  rotation = 0,
}: {
  at: [number, number, number];
  scale?: [number, number, number];
  rotation?: number;
}) {
  return (
    <mesh
      position={at}
      scale={scale}
      rotation={[0.12, rotation, 0.1]}
      castShadow
      receiveShadow
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={C.rock} flatShading roughness={1} />
    </mesh>
  );
}
function Pine({ x, z, height = 7 }: { x: number; z: number; height?: number }) {
  return (
    <group position={[x, 1, z]}>
      <Box
        at={[0, height * 0.22, 0]}
        size={[0.3, height * 0.6, 0.3]}
        color="#46483a"
      />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, height * (0.36 + i * 0.19), 0]} castShadow>
          <coneGeometry
            args={[height * (0.29 - i * 0.061), height * 0.46, 5]}
          />
          <meshStandardMaterial
            color={i === 2 ? "#3b5141" : C.pine}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}
function CodeLabel({
  text,
  at,
  width = 2.7,
  height = 0.58,
  rotation = [0, 0, 0],
  color = "#e6d9b5",
  background = "#39453a",
}: {
  text: string;
  at: [number, number, number];
  width?: number;
  height?: number;
  rotation?: [number, number, number];
  color?: string;
  background?: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.font = "600 46px Georgia";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 66, 460);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color, background]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={at} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}
function Lantern({
  x,
  z,
  y = 3.1,
  post = true,
}: {
  x: number;
  z: number;
  y?: number;
  post?: boolean;
}) {
  return (
    <group position={[x, 0, z]}>
      {post && (
        <>
          <Box at={[0, y / 2, 0]} size={[0.13, y, 0.13]} color="#464b39" />
          <Box at={[0.36, y, 0]} size={[0.8, 0.11, 0.13]} color="#464b39" />
        </>
      )}
      <Box
        at={[post ? 0.64 : 0, y - 0.32, 0]}
        size={[0.33, 0.55, 0.33]}
        color={C.glow}
        glow
      />
      <Box
        at={[post ? 0.64 : 0, y + 0.01, 0]}
        size={[0.46, 0.12, 0.46]}
        color="#434834"
      />
      <pointLight
        position={[post ? 0.64 : 0, y - 0.35, 0]}
        color="#ffd683"
        intensity={12}
        distance={8}
        decay={2}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[post ? 0.64 : 0, 0.08, 0]}
      >
        <circleGeometry args={[2.4, 20]} />
        <meshBasicMaterial
          color="#d8c780"
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
function Building({
  x,
  z,
  width = 6,
  depth = 5,
  height = 4.5,
  name,
  roof = C.roof,
  angle = 0,
}: {
  x: number;
  z: number;
  width?: number;
  depth?: number;
  height?: number;
  name?: string;
  roof?: string;
  angle?: number;
}) {
  const roofGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 - 0.4, 0);
    shape.lineTo(0, 2.9);
    shape.lineTo(width / 2 + 0.4, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: depth + 0.65,
      bevelEnabled: false,
    });
    g.translate(0, 0, -depth / 2 - 0.325);
    return g;
  }, [width, depth]);
  useEffect(() => () => roofGeometry.dispose(), [roofGeometry]);
  return (
    <group position={[x, 1.1, z]} rotation={[0, angle, 0]}>
      <Box
        at={[0, height / 2, 0]}
        size={[width, height, depth]}
        color={C.wall}
      />
      <mesh position={[0, height, 0]} geometry={roofGeometry} castShadow>
        <meshStandardMaterial color={roof} flatShading roughness={1} />
      </mesh>
      <Box
        at={[0, height + 2.92, 0]}
        size={[0.17, 0.14, depth + 0.8]}
        color="#687165"
      />
      {Array.from({ length: Math.ceil(height / 0.36) }, (_, i) => (
        <Box
          key={i}
          at={[0, 0.22 + i * 0.36, depth / 2 + 0.02]}
          size={[width, 0.035, 0.035]}
          color="#737c6d"
        />
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            at={[side * width * 0.29, 2.4, depth / 2 + 0.04]}
            size={[1.13, 1.36, 0.12]}
            color="#35443b"
          />
          <Box
            at={[side * width * 0.29, 2.4, depth / 2 + 0.11]}
            size={[0.89, 1.15, 0.07]}
            color={C.glow}
            glow
          />
          <Box
            at={[side * width * 0.29, 2.4, depth / 2 + 0.16]}
            size={[0.075, 1.2, 0.08]}
            color="#58604b"
          />
          <Box
            at={[side * width * 0.29, 2.4, depth / 2 + 0.16]}
            size={[1, 0.075, 0.08]}
            color="#58604b"
          />
        </group>
      ))}
      <Box
        at={[0, 1.2, depth / 2 + 0.055]}
        size={[1.25, 2.4, 0.12]}
        color="#3b493d"
      />
      <Box
        at={[0.39, 1.15, depth / 2 + 0.14]}
        size={[0.08, 0.08, 0.08]}
        color={C.gold}
      />
      <Box
        at={[-width * 0.29, height + 2.1, -depth * 0.26]}
        size={[0.68, 3, 0.8]}
        color="#676f5e"
      />
      {name && (
        <CodeLabel
          text={name}
          at={[0, height - 0.5, depth / 2 + 0.09]}
          width={Math.min(width - 0.7, 4.5)}
          height={0.6}
        />
      )}
      <Box
        at={[0, 0.03, depth / 2 + 0.38]}
        size={[width + 0.2, 0.23, 1.1]}
        color="#626854"
      />
    </group>
  );
}
function Pier({
  x,
  z,
  length = 15,
  width = 3,
  rotate = false,
}: {
  x: number;
  z: number;
  length?: number;
  width?: number;
  rotate?: boolean;
}) {
  return (
    <group position={[x, 0.77, z]} rotation={[0, rotate ? Math.PI / 2 : 0, 0]}>
      <Box
        at={[0, -0.13, 0]}
        size={[length, 0.24, width]}
        color={C.timberDark}
      />
      {Array.from({ length: Math.floor(length / 0.47) }, (_, i) => (
        <Box
          key={i}
          at={[-length / 2 + 0.27 + i * 0.47, 0.04, 0]}
          size={[0.42, 0.12, width]}
          color={i % 4 === 0 ? "#82785d" : C.timber}
        />
      ))}
      {Array.from({ length: Math.floor(length / 2.8) }, (_, i) =>
        [-1, 1].map((side) => (
          <group
            key={`${i}-${side}`}
            position={[
              -length / 2 + 0.5 + i * 2.8,
              -0.2,
              side * (width / 2 - 0.15),
            ]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.15, 0.19, 2.3, 6]} />
              <meshStandardMaterial color="#454c3c" flatShading />
            </mesh>
            <Box at={[0, 0.95, 0]} size={[0.34, 0.12, 0.34]} color="#85816a" />
          </group>
        )),
      )}
    </group>
  );
}
function Barrel({ x, z, y = 1.35 }: { x: number; z: number; y?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.42, 0.37, 1.05, 8]} />
        <meshStandardMaterial color="#79735b" flatShading />
      </mesh>
      {[-0.3, 0.3].map((n) => (
        <mesh key={n} position={[0, n, 0]}>
          <cylinderGeometry args={[0.435, 0.435, 0.085, 8]} />
          <meshStandardMaterial color="#3f4d42" />
        </mesh>
      ))}
    </group>
  );
}
function Pepe({
  x,
  z,
  scale = 1,
  angle = 0.35,
}: {
  x: number;
  z: number;
  scale?: number;
  angle?: number;
}) {
  return (
    <group position={[x, 0.9, z]} scale={scale} rotation={[0, angle, 0]}>
      <Box at={[-0.23, 0.18, 0.09]} size={[0.36, 0.4, 0.55]} color="#323f36" />
      <Box at={[0.23, 0.18, 0.09]} size={[0.36, 0.4, 0.55]} color="#323f36" />
      <mesh position={[0, 0.83, 0]} castShadow>
        <coneGeometry args={[0.66, 1.3, 7]} />
        <meshStandardMaterial color="#c5a446" flatShading />
      </mesh>
      <Box at={[0, 0.88, 0.39]} size={[0.7, 0.8, 0.09]} color="#536349" />
      <CodeLabel
        text="IMD"
        at={[0, 0.99, 0.453]}
        width={0.51}
        height={0.22}
        color="#e7dcb7"
        background="#536349"
      />
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.56, 0.96, 0.04]}
          rotation={[0, 0, side * 0.3]}
          castShadow
        >
          <cylinderGeometry args={[0.18, 0.17, 0.85, 6]} />
          <meshStandardMaterial color="#c5a446" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 1.74, 0.09]} scale={[0.76, 0.54, 0.5]} castShadow>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#74924d" flatShading />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.31, 1.99, 0.36]}>
          <mesh scale={[0.34, 0.3, 0.2]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#d9d8ae" />
          </mesh>
          <mesh
            position={[side * 0.014, -0.056, 0.179]}
            scale={[0.092, 0.108, 0.05]}
          >
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#222e22" />
          </mesh>
          <mesh position={[0, 0.11, 0.07]} scale={[0.357, 0.15, 0.19]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color="#6c8848" flatShading />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.52, 0.5]} scale={[0.57, 0.145, 0.17]}>
        <sphereGeometry args={[1, 14, 8]} />
        <meshStandardMaterial color="#8c5542" />
      </mesh>
      <mesh position={[0, 1.55, 0.651]} scale={[0.45, 0.026, 0.02]}>
        <sphereGeometry args={[1, 12, 6]} />
        <meshStandardMaterial color="#493c2f" />
      </mesh>
      <mesh position={[0, 2.16, -0.05]} rotation={[-0.16, 0, 0]}>
        <coneGeometry args={[0.74, 0.38, 10]} />
        <meshStandardMaterial color="#c5a446" flatShading />
      </mesh>
    </group>
  );
}
function Marker({
  at,
  kind,
  title,
  children,
  onClick,
  selected = false,
}: {
  at: [number, number, number];
  kind: string;
  title: string;
  children: ReactNode;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <Html
      position={at}
      center
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "auto" }}
    >
      <button
        type="button"
        className={`world-marker world-marker--${kind}${selected ? " is-selected" : ""}`}
        aria-label={title}
        title={title}
        onClick={onClick}
      >
        <span aria-hidden="true">{children}</span>
        <span className="world-marker-label">{title}</span>
      </button>
    </Html>
  );
}
function VillageScene({ onSelectNPC }: Pick<WorldProps, "onSelectNPC">) {
  const npcs = [
    { id: "brannock", title: "Brannock · dock master", x: -14, z: 4 },
    { id: "gulla", title: "Mother Gulla · net mender", x: -22, z: -8 },
    { id: "wexley", title: "Wexley · the gutter", x: -20, z: -17 },
    { id: "tadwick", title: "Tadwick · tooth collector", x: -19, z: 10 },
    { id: "morrow", title: "Old Morrow · drowned priest", x: -24, z: 13 },
  ];
  return (
    <group>
      <mesh position={[-31, -0.9, -4]} scale={[15, 1.8, 25]} receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={C.land} flatShading />
      </mesh>
      {Array.from({ length: 25 }, (_, i) => {
        const a = i * 0.254;
        return (
          <Rock
            key={i}
            at={[-28 + Math.cos(a) * 12, -0.1, -4 + Math.sin(a) * 23]}
            scale={[1.5 + (i % 3) * 0.4, 1.1 + (i % 4) * 0.3, 2]}
            rotation={a}
          />
        );
      })}
      <Pier x={-15.5} z={4} length={19} width={3.4} />
      <Pier x={-9} z={8.7} length={12.2} width={2.5} rotate />
      <Pier x={-21.3} z={-1.4} length={27} width={3.2} rotate />
      <Pier x={-20} z={16.8} length={13} width={3.4} />
      <Building
        x={-28}
        z={-15.5}
        width={8.1}
        depth={6}
        height={4}
        name="THE PROCESSING SHED"
        roof="#4b5750"
      />
      <Building
        x={-29}
        z={-3}
        width={7}
        depth={5.7}
        height={5.2}
        name="THE LOW TIDE"
        roof="#4e5546"
      />
      <Building
        x={-27.5}
        z={8.4}
        width={5.3}
        depth={5}
        height={3.5}
        name="CUSTOMS"
        roof="#5d685a"
      />
      <Building
        x={-34.5}
        z={-25}
        width={4.5}
        depth={4.4}
        height={5.7}
        roof="#526055"
        angle={0.2}
      />
      <Building
        x={-20}
        z={-23}
        width={4.1}
        depth={4}
        height={3.7}
        name="WEIGH HOUSE"
        roof="#555f50"
      />
      <Box at={[-20.5, 2.1, -3]} size={[2.6, 2.5, 0.2]} color="#4e5946" />
      <Box at={[-21.6, 1.4, -3]} size={[0.16, 2.8, 0.2]} color="#777962" />
      <Box at={[-19.4, 1.4, -3]} size={[0.16, 2.8, 0.2]} color="#777962" />
      {[-0.7, 0, 0.7].map((n, i) => (
        <Box
          key={n}
          at={[-20.5 + n, 2.2 + (i % 2) * 0.3, -2.88]}
          size={[0.5, 0.7, 0.03]}
          color="#c3c0a1"
          rotation={[0, 0, n * 0.1]}
        />
      ))}
      <group position={[-17, 0.95, 17]}>
        <Box at={[0, 1.1, 0]} size={[3.5, 2.2, 3]} color="#a19b77" />
        {[-1.4, -0.7, 0, 0.7, 1.4].map((n, i) => (
          <Box
            key={n}
            at={[n, 1.1, 1.51]}
            size={[0.34, 2.2, 0.03]}
            color={i % 2 ? "#4a685b" : "#747e67"}
          />
        ))}
        <mesh position={[0, 3.2, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[3.05, 2, 4]} />
          <meshStandardMaterial color="#929477" flatShading />
        </mesh>
        <Box at={[0, 4.6, 0]} size={[0.07, 1, 0.07]} color="#999580" />
        <CodeLabel
          text="FORTUNES"
          at={[0, 2, 1.56]}
          width={2.8}
          height={0.45}
        />
      </group>
      {[-34, -37, -40, -43].map((x, i) => (
        <Pine key={x} x={x} z={8 - i * 8} height={8 + (i % 2) * 3} />
      ))}
      <Pine x={-27} z={-28} height={9} />
      <Pine x={-37} z={17} height={8} />
      <Pine x={-32} z={18} height={6} />
      {[
        [-12, 4],
        [-21, 2],
        [-21, -12],
        [-18, 16],
        [-28, 12],
        [-17.8, -21],
      ].map(([x, z]) => (
        <Lantern key={`${x}-${z}`} x={x} z={z} />
      ))}
      {[
        [-23, -16],
        [-24, -17.2],
        [-23.5, -2],
        [-17, 3.6],
        [-26, 12],
        [-25.1, 12.5],
        [-19, -21],
      ].map(([x, z]) => (
        <Barrel key={`${x}-${z}`} x={x} z={z} />
      ))}
      <Box at={[-24.3, 1.35, 5]} size={[1.2, 1, 1.1]} color="#827c5f" />
      <Box at={[-25.3, 1.23, 4.9]} size={[0.8, 0.76, 0.9]} color="#6e7157" />
      <Box at={[-23, 2.5, -20]} size={[0.1, 3, 0.1]} color="#7b7c66" />
      <Box at={[-28, 2.5, -20]} size={[0.1, 3, 0.1]} color="#7b7c66" />
      <Box at={[-25.5, 3.85, -20]} size={[5, 0.035, 0.035]} color="#b0ac86" />
      {[-1.7, -0.6, 0.6, 1.7].map((n, i) => (
        <Box
          key={n}
          at={[-25.5 + n, 3.2, -20]}
          size={[0.65, 1.3, 0.04]}
          color={i % 2 ? "#777e67" : "#b1aa7d"}
          rotation={[0, 0, n * 0.07]}
        />
      ))}
      {npcs.map((npc) => (
        <group key={npc.id}>
          <Pepe x={npc.x} z={npc.z} scale={npc.id === "tadwick" ? 0.7 : 1} />
          <Marker
            at={[npc.x, 4, npc.z]}
            kind="npc"
            title={npc.title}
            onClick={() => onSelectNPC(npc.id)}
          >
            ···
          </Marker>
        </group>
      ))}
    </group>
  );
}
const Village = memo(VillageScene);

function Water({
  paused,
  reducedMotion,
  phase,
}: Pick<WorldProps, "paused" | "reducedMotion" | "phase">) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ time: { value: 0 }, night: { value: 0 } }),
    [],
  );
  useFrame((_, delta) => {
    if (material.current) {
      if (!paused && !reducedMotion)
        material.current.uniforms.time.value += delta;
      material.current.uniforms.night.value = phase >= 0.55 ? 1 : 0;
    }
  });
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.05, 0]}
      receiveShadow
    >
      <planeGeometry args={[600, 600]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={`varying vec3 vWorld; void main(){ vec4 world = modelMatrix * vec4(position,1.); vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }`}
        fragmentShader={`precision highp float; varying vec3 vWorld; uniform float time; uniform float night; void main(){ vec2 p=vWorld.xz; float w = sin(p.x*.24 + p.y*.35 + time*.17)*.5+.5; float small=sin(p.x*.85-p.y*1.3 + time*.3)*sin(p.y*1.7+p.x*.3+time*.15); vec3 base=mix(vec3(.155,.235,.218),vec3(.20,.30,.275),w*.55); base += small*.008; float stripe=pow(max(0.,sin(p.y*2.3 + sin(p.x*.4)*2. + time*.35)),24.); float light=exp(-pow((p.x-6.+p.y*.20)/15.,2.)); base+=vec3(.43,.47,.33)*stripe*light*.06; base*=1.-night*.10; float distant=smoothstep(40.,160.,length(p)); base=mix(base,vec3(.16,.225,.207),distant); gl_FragColor=vec4(base,1.); }`}
      />
    </mesh>
  );
}
function Ripples({
  x,
  z,
  selected = false,
  animate,
}: {
  x: number;
  z: number;
  selected?: boolean;
  animate: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current && animate) {
      const s = 1 + Math.sin(clock.elapsedTime * 0.65 + x) * 0.07;
      group.current.scale.set(s, 1, s);
      group.current.rotation.y = Math.sin(clock.elapsedTime * 0.1) * 0.1;
    }
  });
  return (
    <group ref={group} position={[x, 0.055, z]}>
      {[1.1, 1.65, 2.2, 2.8].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} scale={[1.35, 0.75, 1]}>
          <ringGeometry
            args={[r, r + 0.025 + i * 0.006, 40, 1, 0.4 * i, 4.9]}
          />
          <meshBasicMaterial
            color={selected ? "#d6c586" : "#9da990"}
            transparent
            opacity={(selected ? 0.55 : 0.32) - i * 0.045}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      <mesh
        position={[0.5, -0.035, 0.1]}
        rotation={[0, 0.7, 0]}
        scale={[0.7, 0.08, 0.22]}
      >
        <sphereGeometry args={[1, 7, 5]} />
        <meshBasicMaterial color="#1b302c" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
function Boat({
  position,
  paused,
  reducedMotion,
}: Pick<WorldProps, "position" | "paused" | "reducedMotion">) {
  const bob = useRef<THREE.Group>(null);
  const hull = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.85, -1.65);
    shape.lineTo(-1.1, 0.8);
    shape.quadraticCurveTo(-0.8, 1.8, 0, 2.5);
    shape.quadraticCurveTo(0.8, 1.8, 1.1, 0.8);
    shape.lineTo(0.85, -1.65);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.65,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.14,
      bevelSegments: 1,
      curveSegments: 3,
    });
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.65, 0);
    return g;
  }, []);
  useEffect(() => () => hull.dispose(), [hull]);
  useFrame(({ clock }) => {
    if (bob.current && !paused && !reducedMotion) {
      bob.current.position.y = 0.28 + Math.sin(clock.elapsedTime * 1.4) * 0.045;
      bob.current.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.018;
    }
  });
  return (
    <group
      position={[position.x, 0, position.z]}
      rotation={[0, Math.PI - position.heading, 0]}
    >
      <group ref={bob} position={[0, 0.28, 0]}>
        <mesh geometry={hull} castShadow receiveShadow>
          <meshStandardMaterial color="#b8ad88" flatShading roughness={0.8} />
        </mesh>
        <Box at={[0, 0.58, 0.25]} size={[1.65, 0.08, 2.85]} color="#4e5948" />
        {[-1.15, -0.7, -0.25, 0.2, 0.65, 1.1].map((n) => (
          <Box
            key={n}
            at={[0, 0.64, n]}
            size={[1.5, 0.04, 0.37]}
            color="#8d8667"
          />
        ))}
        <Box at={[0, 1.07, -0.68]} size={[1.42, 0.96, 1.3]} color="#c8b981" />
        <Box at={[0, 1.65, -0.68]} size={[1.75, 0.17, 1.65]} color="#647061" />
        <Box at={[0, 1.24, 0.005]} size={[1.14, 0.39, 0.03]} color="#354b42" />
        <Box
          at={[0.725, 1.24, -0.67]}
          size={[0.03, 0.4, 0.8]}
          color="#41594b"
        />
        <Box
          at={[-0.725, 1.24, -0.67]}
          size={[0.03, 0.4, 0.8]}
          color="#41594b"
        />
        <Box at={[0, 2.6, -0.96]} size={[0.07, 2, 0.07]} color="#a2a186" />
        <Box
          at={[0.35, 3.3, -0.95]}
          size={[0.74, 0.43, 0.025]}
          color="#aaae8b"
        />
        <Box
          at={[0.36, 1.8, -0.66]}
          size={[0.28, 0.18, 0.28]}
          color={C.glow}
          glow
        />
        <pointLight
          position={[0.3, 1.9, -0.6]}
          color="#ffcb73"
          intensity={7}
          distance={5}
        />
        <Box at={[0, 0.43, 1.98]} size={[0.17, 0.17, 0.46]} color="#665f43" />
        <mesh position={[-0.57, 0.92, 0.85]} rotation={[0.35, 0, -0.4]}>
          <cylinderGeometry args={[0.025, 0.04, 2.8, 5]} />
          <meshStandardMaterial color="#d1c4a0" />
        </mesh>
        <mesh position={[0.95, 0.6, -0.75]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.23, 0.08, 5, 10]} />
          <meshStandardMaterial color="#353e32" />
        </mesh>
        <CodeLabel
          text="MARROW"
          at={[0, 0.82, -1.675]}
          width={1.15}
          height={0.27}
          rotation={[0, Math.PI, 0]}
          color="#d6d1ae"
          background="#57604d"
        />
      </group>
      <Ripples x={0} z={0} animate={!paused && !reducedMotion} />
    </group>
  );
}
function Scenery({ props }: { props: WorldProps }) {
  const night = props.phase >= 0.55;
  const animate = !props.paused && !props.reducedMotion;
  return (
    <>
      <Water
        phase={props.phase}
        paused={props.paused}
        reducedMotion={props.reducedMotion}
      />
      <Village onSelectNPC={props.onSelectNPC} />
      <group position={[14, -0.3, -29]}>
        <Rock at={[0, -0.1, 0]} scale={[7, 2, 4]} />
        <Rock at={[-4, 0.4, 1]} scale={[2.8, 2.6, 2.5]} />
        <Rock at={[3, 0.1, -1]} scale={[4, 2.3, 3]} />
        <Pine x={-2} z={0} height={6.3} />
        <Pine x={1} z={-1} height={8} />
        <Pine x={3} z={0} height={4.8} />
      </group>
      <group position={[34, -0.5, 21]}>
        <Rock at={[0, -0.1, 0]} scale={[6, 3, 4]} />
        <Rock at={[-4, -0.1, -1]} scale={[2.2, 2.5, 2.4]} />
        <Pine x={0} z={0} height={8} />
        <Pine x={2.6} z={0} height={6.1} />
        <Pine x={-2.3} z={-1} height={5.3} />
      </group>
      <group position={[39, -0.3, -25]}>
        <Rock at={[0, 0, 0]} scale={[8, 4, 7]} />
        <Pine x={0} z={0} height={9} />
        <Pine x={-3} z={0} height={6.8} />
        <Pine x={3} z={-1} height={7.6} />
      </group>
      <Rock at={[-2, 0.25, -25]} scale={[2.2, 1.3, 2]} />
      <Rock at={[1, 0.1, -26]} scale={[1.8, 1.3, 2]} />
      <Rock at={[-3, 0.4, -23]} scale={[1.2, 1.6, 1.3]} />
      <group position={[-6, 0, -31]}>
        <Rock at={[0, -0.1, 0]} scale={[3.2, 2.3, 3]} />
        <mesh position={[0, 5, 0]} castShadow>
          <cylinderGeometry args={[1, 1.4, 7, 8]} />
          <meshStandardMaterial color="#929983" flatShading />
        </mesh>
        <Box at={[0, 8.4, 0]} size={[2.05, 1.2, 2.05]} color="#cab976" glow />
        <mesh position={[0, 9.4, 0]}>
          <coneGeometry args={[1.7, 1.3, 8]} />
          <meshStandardMaterial color="#485a4a" />
        </mesh>
      </group>
      {spots.map((spot) => (
        <group key={spot.id}>
          <Ripples
            x={spot.x}
            z={spot.z}
            selected={props.selectedSpot === spot.id}
            animate={animate}
          />
          <Marker
            at={[spot.x, 0.8, spot.z]}
            kind="fish"
            title={spot.title}
            selected={props.selectedSpot === spot.id}
            onClick={() => props.onSelectSpot(spot.id)}
          >
            {spot.number}
          </Marker>
        </group>
      ))}
      <group position={[13, 0, 22]}>
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(a) * 4.4, 0, Math.sin(a) * 4.4]}>
              <Box at={[0, 0.66, 0]} size={[0.22, 1.9, 0.22]} color="#6e6a4b" />
              <Box
                at={[0, 1.8, 0]}
                size={[0.5, 0.55, 0.04]}
                color="#9a8f59"
                rotation={[0, a, 0]}
              />
            </group>
          );
        })}
      </group>
      {puzzleRegistry.map((site) => (
        <Marker
          key={site.id}
          at={[site.site.x, site.site.y, site.site.z]}
          kind="site"
          title={site.site.name}
          onClick={() => props.onSelectSite(site.id)}
        >
          ◇
        </Marker>
      ))}
      {props.allWords && night && (
        <group position={[22, 0, -25]}>
          <Rock at={[0, -0.3, 0]} scale={[5, 2.2, 4]} />
          {[-2, 2].map((x) => (
            <Box
              key={x}
              at={[x, 3, 0]}
              size={[1, 5, 1.2]}
              color="#8c9884"
              rotation={[0, 0, x * 0.035]}
            />
          ))}
          <Box at={[0, 5.3, 0]} size={[5.2, 1.1, 1.3]} color="#8c9884" />
          <Box at={[0, 1.6, 0]} size={[2, 1, 1.2]} color="#877648" />
          <pointLight
            position={[0, 3, 0.8]}
            color="#dbdfa5"
            intensity={35}
            distance={14}
          />
          <Marker
            at={[0, 6.8, 0]}
            kind="shrine"
            title="The drowned shrine"
            onClick={() => props.onSelectSite("shrine")}
          >
            ✧
          </Marker>
        </group>
      )}
      {night && props.dread > 18 && (
        <group>
          {[0, 1, 2].map((i) => (
            <mesh
              key={i}
              position={[
                props.position.x + 5 + i * 2.3,
                0.015,
                props.position.z - 5 + i * 3,
              ]}
              rotation={[0, -0.5 + i, 0]}
              scale={[0.8, 0.05, 2.5]}
            >
              <sphereGeometry args={[1, 8, 5]} />
              <meshBasicMaterial color="#172c29" transparent opacity={0.42} />
            </mesh>
          ))}
          {props.dread > 45 && (
            <>
              <Lantern
                x={props.position.x + 12}
                z={props.position.z - 12}
                post={false}
                y={0.8}
              />
              <Lantern
                x={props.position.x - 9}
                z={props.position.z - 17}
                post={false}
                y={0.8}
              />
            </>
          )}
        </group>
      )}
      <Boat
        position={props.position}
        paused={props.paused}
        reducedMotion={props.reducedMotion}
      />
    </>
  );
}
function CameraRig({
  position,
  reducedMotion,
  paused,
}: Pick<WorldProps, "position" | "reducedMotion" | "paused">) {
  const { camera, gl, size, invalidate } = useThree();
  const drag = useRef({ active: false, x: 0, yaw: 0, zoom: 1 });
  const target = useRef(new THREE.Vector3(-5, 0, -1));
  const desired = useRef(new THREE.Vector3());
  useEffect(() => {
    const element = gl.domElement;
    const down = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 2) {
        drag.current.active = true;
        drag.current.x = e.clientX;
      }
    };
    const move = (e: PointerEvent) => {
      if (drag.current.active) {
        drag.current.yaw -= (e.clientX - drag.current.x) * 0.004;
        drag.current.yaw = Math.max(-0.6, Math.min(0.6, drag.current.yaw));
        drag.current.x = e.clientX;
        invalidate();
      }
    };
    const up = () => {
      drag.current.active = false;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      drag.current.zoom = Math.max(
        0.68,
        Math.min(1.6, drag.current.zoom - e.deltaY * 0.0005),
      );
      invalidate();
    };
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    element.addEventListener("wheel", wheel, { passive: false });
    return () => {
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      element.removeEventListener("wheel", wheel);
    };
  }, [gl, invalidate]);
  useFrame((_, delta) => {
    desired.current.set(
      -5 + (position.x + 5) * 0.45,
      0,
      -1 + (position.z - 8) * 0.4,
    );
    target.current.lerp(
      desired.current,
      reducedMotion || paused ? 1 : 1 - Math.exp(-delta * 2),
    );
    const angle = 0.68 + drag.current.yaw;
    camera.position.set(
      target.current.x + Math.sin(angle) * 62,
      48,
      target.current.z + Math.cos(angle) * 62,
    );
    camera.lookAt(target.current);
    if (camera instanceof THREE.OrthographicCamera) {
      const zoom =
        Math.max(7.1, Math.min(17.5, size.width / 83)) * drag.current.zoom;
      if (Math.abs(camera.zoom - zoom) > 0.001) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
      }
    }
  });
  return null;
}
function AtmosphericLight({
  phase,
  dread,
}: Pick<WorldProps, "phase" | "dread">) {
  const { scene } = useThree();
  const night = phase >= 0.55;
  useEffect(() => {
    scene.fog = new THREE.FogExp2(
      night ? "#273c35" : "#536356",
      0.008 + dread * 0.00004,
    );
    scene.background = new THREE.Color(night ? "#273c35" : "#536356");
  }, [night, dread, scene]);
  return (
    <>
      <ambientLight intensity={night ? 0.65 : 0.85} color="#aab6a0" />
      <hemisphereLight args={["#d2d5ae", "#263d32", night ? 1.1 : 1.6]} />
      <directionalLight
        position={[12, 35, 4]}
        intensity={night ? 1.25 : 2.1}
        color="#f0ddac"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={0.5}
        shadow-camera-far={130}
        shadow-bias={-0.0008}
      />
    </>
  );
}
function World(props: WorldProps) {
  return (
    <Canvas
      orthographic
      shadows
      frameloop={props.paused ? "demand" : "always"}
      dpr={[1, 1]}
      camera={{ position: [36, 48, 48], zoom: 15, near: 0.1, far: 300 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      style={{ touchAction: "none" }}
      aria-label="Marrow Bay. A lantern-lit fishing village and a small boat on a foggy sea. Use the chart for accessible locations."
    >
      <AtmosphericLight phase={props.phase} dread={props.dread} />
      <CameraRig
        position={props.position}
        reducedMotion={props.reducedMotion}
        paused={props.paused}
      />
      <Scenery props={props} />
    </Canvas>
  );
}

export default memo(World);

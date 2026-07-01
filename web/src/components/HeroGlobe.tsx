/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Three.js hero — a slowly rotating point-cloud globe (markets across a global tournament) laced
 * with a connection network. It breathes (scales gently) and ~10% of the links flicker in
 * red / green / amber to feel alive. Pure decoration; cleans itself up on unmount.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroGlobe() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = ref.current;
    if (!mount) return;
    let width = mount.clientWidth || 600;
    let height = mount.clientHeight || 500;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 3.4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.x = 0.42;
    scene.add(group);

    const R = 1.25;

    // Globe points via a Fibonacci sphere.
    const N = 1700;
    const positions = new Float32Array(N * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      positions[i * 3] = Math.cos(theta) * r * R;
      positions[i * 3 + 1] = y * R;
      positions[i * 3 + 2] = Math.sin(theta) * r * R;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x00ff66, size: 0.02, transparent: true, opacity: 0.9 });
    const points = new THREE.Points(geo, mat);
    group.add(points);

    // Connection network — link a random subset of points to their nearest neighbour.
    const SOURCES = 380;
    const idx: number[] = [];
    for (let i = 0; i < N; i++) idx.push(i);
    for (let i = idx.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const sources = idx.slice(0, SOURCES);
    const linePos: number[] = [];
    for (const i of sources) {
      const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2];
      let best = -1, bestD = Infinity;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const dx = positions[j * 3] - ax, dy = positions[j * 3 + 1] - ay, dz = positions[j * 3 + 2] - az;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best >= 0) linePos.push(ax, ay, az, positions[best * 3], positions[best * 3 + 1], positions[best * 3 + 2]);
    }
    const segCount = linePos.length / 6;
    const lineColors = new Float32Array(segCount * 6);
    const base = [0.04, 0.42, 0.26]; // calm dim green for the 90%
    for (let k = 0; k < segCount * 2; k++) {
      lineColors[k * 3] = base[0]; lineColors[k * 3 + 1] = base[1]; lineColors[k * 3 + 2] = base[2];
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(linePos), 3));
    const lineColorAttr = new THREE.BufferAttribute(lineColors, 3);
    lineGeo.setAttribute("color", lineColorAttr);
    const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);

    // ~20% of the connections flicker between red / green / amber, each with a bright pulsing
    // dot at its node so the colour reads clearly (thin lines alone are near-invisible).
    const PALETTE = [
      [1.0, 0.22, 0.22], // red
      [0.15, 1.0, 0.45], // green
      [1.0, 0.66, 0.10], // amber
    ];
    const active: { seg: number; phase: number; freq: number }[] = [];
    const activeTarget = Math.max(1, Math.round(segCount * 0.2));
    const used = new Set<number>();
    while (active.length < activeTarget) {
      const s = (Math.random() * segCount) | 0;
      if (used.has(s)) continue;
      used.add(s);
      active.push({ seg: s, phase: Math.random() * Math.PI * 2, freq: 1.4 + Math.random() * 3.2 });
    }

    // A glowing dot sits at each active connection's node and pulses with it.
    const nodePos = new Float32Array(active.length * 3);
    const nodeColors = new Float32Array(active.length * 3);
    for (let a = 0; a < active.length; a++) {
      const off = active[a].seg * 6;
      nodePos[a * 3] = linePos[off];
      nodePos[a * 3 + 1] = linePos[off + 1];
      nodePos[a * 3 + 2] = linePos[off + 2];
    }
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos, 3));
    const nodeColorAttr = new THREE.BufferAttribute(nodeColors, 3);
    nodeGeo.setAttribute("color", nodeColorAttr);
    const nodeMat = new THREE.PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const nodes = new THREE.Points(nodeGeo, nodeMat);
    group.add(nodes);

    // Faint wireframe shell + dark core for depth.
    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.99, 36, 24),
      new THREE.MeshBasicMaterial({ color: 0x0c5a34, wireframe: true, transparent: true, opacity: 0.28 }),
    );
    group.add(wire);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.82, 36, 24),
      new THREE.MeshBasicMaterial({ color: 0x050608 }),
    );
    group.add(core);

    // A couple of orbiting "signal" sparks (orange).
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff9900 }));
    const spark2 = spark.clone();
    scene.add(spark, spark2);

    let raf = 0;
    let t = 0;
    const animate = () => {
      t += 0.01;
      group.rotation.y += 0.0016;
      // Breathing — grows and shrinks slightly so the globe feels alive.
      group.scale.setScalar(1 + Math.sin(t * 0.9) * 0.035);
      // Flicker the active connections + their dots through the red/green/amber palette,
      // each pulsing at its own random rate for a lively, twinkling network.
      for (let a = 0; a < active.length; a++) {
        const act = active[a];
        const col = PALETTE[Math.floor(t * 0.5 + act.phase) % PALETTE.length];
        const s = Math.sin(t * act.freq + act.phase);
        const bright = 0.2 + 0.8 * Math.pow(Math.max(0, s), 1.5); // sharp, random-feeling twinkle
        const off = act.seg * 6;
        for (let v = 0; v < 2; v++) {
          lineColors[off + v * 3] = col[0] * bright;
          lineColors[off + v * 3 + 1] = col[1] * bright;
          lineColors[off + v * 3 + 2] = col[2] * bright;
        }
        nodeColors[a * 3] = col[0] * bright;
        nodeColors[a * 3 + 1] = col[1] * bright;
        nodeColors[a * 3 + 2] = col[2] * bright;
      }
      lineColorAttr.needsUpdate = true;
      nodeColorAttr.needsUpdate = true;
      spark.position.set(Math.cos(t) * 1.9, Math.sin(t * 0.7) * 0.6, Math.sin(t) * 1.9);
      spark2.position.set(Math.cos(t * 1.3 + 2) * 1.7, Math.sin(t * 0.9 + 1) * 0.9, Math.sin(t * 1.3 + 2) * 1.7);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      width = mount.clientWidth || width;
      height = mount.clientHeight || height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      geo.dispose();
      mat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} className="absolute inset-0" aria-hidden="true" />;
}

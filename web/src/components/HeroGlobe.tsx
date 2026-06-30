/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Three.js hero — a slowly rotating point-cloud globe (markets across a global tournament),
 * with a faint wireframe and a dark core. Pure decoration; cleans itself up on unmount.
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
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff9900 }),
    );
    const spark2 = spark.clone();
    scene.add(spark, spark2);

    let raf = 0;
    let t = 0;
    const animate = () => {
      t += 0.01;
      group.rotation.y += 0.0016;
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
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} className="absolute inset-0" aria-hidden="true" />;
}

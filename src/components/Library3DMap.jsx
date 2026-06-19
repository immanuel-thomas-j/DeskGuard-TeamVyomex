import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const PCOL = {
  free: 0x00cc44,
  occupied: 0xff1133,
  prompted: 0xff1133,
  away: 0xff6600,
  abandoned: 0x9900ff
};

export const Library3DMap = ({ desks, myDesk, onDeskClick }) => {
  const containerRef = useRef(null);
  
  const desksRef = useRef(desks);
  const myDeskRef = useRef(myDesk);
  const deskVisualsRef = useRef({});
  const onDeskClickRef = useRef(onDeskClick);

  useEffect(() => {
    onDeskClickRef.current = onDeskClick;
  }, [onDeskClick]);

  useEffect(() => {
    desksRef.current = desks;
  }, [desks]);

  useEffect(() => {
    myDeskRef.current = myDesk;
  }, [myDesk]);

  // Sync state changes to 3D mesh colors
  useEffect(() => {
    desks.forEach(d => {
      const v = deskVisualsRef.current[d.id];
      if (v) {
        const mappedState = d.state === 'prompted' ? 'occupied' : d.state;
        const color = PCOL[mappedState] || PCOL.free;
        v.puck.material.emissive.setHex(color);
        v.light.color.setHex(color);
        v.ring.material.color.setHex(color);
      }
    });
  }, [desks]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080d1a);
    scene.fog = new THREE.Fog(0x080d1a, 65, 120);

    const camera = new THREE.PerspectiveCamera(44, container.clientWidth / container.clientHeight, 0.5, 200);
    camera.position.set(0, 55, 68);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 12;
    controls.maxDistance = 95;
    controls.target.set(0, 0, 0);

    const targetControlPos = new THREE.Vector3(0, 0, 0);
    let isAutoPanning = false;

    controls.addEventListener('start', () => {
      isAutoPanning = false;
    });

    // --- LIGHTS ---
    scene.add(new THREE.AmbientLight(0xfff3dc, 0.88));
    
    const sun = new THREE.DirectionalLight(0xfff8ee, 1.45);
    sun.position.set(8, 60, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.bias = -0.0015;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);

    const fillLight = new THREE.DirectionalLight(0xaabbff, 0.60);
    fillLight.position.set(-30, 20, 25);
    scene.add(fillLight);

    // --- MATERIALS ---
    const M = {
      floor: new THREE.MeshStandardMaterial({ color: 0xbc9470, roughness: 0.5, metalness: 0.1 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x243447, roughness: 0.85 }),
      ceil: new THREE.MeshStandardMaterial({ color: 0x141b26, roughness: 1 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x5c3f2b, roughness: 0.4 }),
      desk: new THREE.MeshStandardMaterial({ color: 0xdbb475, roughness: 0.45, metalness: 0.05 }),
      dbase: new THREE.MeshStandardMaterial({ color: 0x503b29, roughness: 0.6 }),
      chair: new THREE.MeshStandardMaterial({ color: 0x8e6e4f, roughness: 0.5 }),
      cush: new THREE.MeshStandardMaterial({ color: 0x342e54, roughness: 0.8 }),
      shelf: new THREE.MeshStandardMaterial({ color: 0x704732, roughness: 0.65 }),
    };

    const bookPalette = [0x8b1a1a, 0x1a4e8b, 0x1a6b2a, 0x8b7a10, 0x5c1a8b, 0x8b4010, 0x206b6b];
    const RW = 80, RD = 70, RH = 14;

    // Helper to create box meshes
    function box(w, h, d, mat, x, y, z, ry = 0, shadow = true) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      if (shadow) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
      scene.add(mesh);
      return mesh;
    }

    // Floor Base
    box(RW, 0.3, RD, M.floor, 0, -0.15, 0);

    // Wood Planks on floor
    const plankMats = [
      new THREE.MeshStandardMaterial({ color: 0x7a5228, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: 0x8c6035, roughness: 0.75 }),
      new THREE.MeshStandardMaterial({ color: 0x6e4820, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0x9a6b3a, roughness: 0.7 })
    ];
    const PLANK_W = 4.0;
    const PLANK_GAP = 0.06;
    for (let i = -RW / 2; i < RW / 2; i += PLANK_W + PLANK_GAP) {
      const mat = plankMats[Math.floor(Math.abs(i / PLANK_W)) % plankMats.length];
      const plank = new THREE.Mesh(new THREE.BoxGeometry(PLANK_W, 0.02, RD), mat);
      plank.position.set(i + PLANK_W / 2, 0.01, 0);
      plank.receiveShadow = true;
      scene.add(plank);
    }

    // Floor Grout Lines
    const lm = new THREE.LineBasicMaterial({ color: 0x3a2010, transparent: true, opacity: 0.35 });
    for (let i = -RW / 2; i <= RW / 2; i += 4) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, 0.022, -RD / 2), new THREE.Vector3(i, 0.022, RD / 2)]);
      scene.add(new THREE.Line(g, lm));
    }
    for (let j = -RD / 2; j <= RD / 2; j += 4) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-RW / 2, 0.022, j), new THREE.Vector3(RW / 2, 0.022, j)]);
      scene.add(new THREE.Line(g, lm));
    }

    // Ceiling & Walls
    const ceilMesh = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), M.ceil);
    ceilMesh.rotation.x = Math.PI / 2;
    ceilMesh.position.y = RH;
    scene.add(ceilMesh);

    box(RW, RH, 0.4, M.wall, 0, RH / 2, -RD / 2);
    box(RW, RH, 0.4, M.wall, 0, RH / 2, RD / 2);
    box(RD, RH, 0.4, M.wall, -RW / 2, RH / 2, 0, Math.PI / 2);
    box(RD, RH, 0.4, M.wall, RW / 2, RH / 2, 0, Math.PI / 2);

    // Baseboards
    const baseboards = [
      { w: RW, x: 0, z: -RD / 2 + 0.15, r: 0 },
      { w: RW, x: 0, z: RD / 2 - 0.15, r: 0 },
      { w: RD, x: -RW / 2 + 0.15, z: 0, r: Math.PI / 2 },
      { w: RD, x: RW / 2 - 0.15, z: 0, r: Math.PI / 2 }
    ];
    baseboards.forEach(b => {
      box(b.w, 0.35, 0.15, M.trim, b.x, 0.18, b.z, b.r, false);
      box(b.w, 0.45, 0.28, M.trim, b.x, RH - 0.22, b.z, b.r, false);
    });

    // Columns
    [[-27, -25], [27, -25], [-27, 25], [27, 25]].forEach(([x, z]) => {
      box(1.8, RH, 1.8, new THREE.MeshStandardMaterial({ color: 0x1e2d42, roughness: 0.8 }), x, RH / 2, z);
      box(2.2, 0.3, 2.2, M.trim, x, RH - 0.15, z);
      box(2.2, 0.3, 2.2, M.trim, x, 0.15, z);
    });

    // Shelves Function
    function makeShelf(cx, cz, ry) {
      const g = new THREE.Group();
      const carc = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 1.4), M.shelf);
      carc.position.set(0, 4.5, 0);
      carc.castShadow = true;
      g.add(carc);

      const back = new THREE.Mesh(new THREE.BoxGeometry(11.6, 8.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x3a2010 }));
      back.position.set(0, 4.5, 0);
      g.add(back);

      for (let s = 0; s < 5; s++) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.18, 1.2), M.shelf);
        sh.position.set(0, 1.1 + s * 1.65, 0);
        g.add(sh);
        let bx = -5.3;
        while (bx < 5.3) {
          const bw = 0.15 + Math.random() * 0.25;
          const bh = 0.85 + Math.random() * 0.55;
          const bd = 0.6 + Math.random() * 0.3;
          if (bx + bw > 5.3) break;

          const bm = new THREE.MeshStandardMaterial({
            color: bookPalette[Math.floor(Math.random() * bookPalette.length)],
            roughness: 0.8
          });
          const bk = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bm);
          if (Math.random() > 0.85) bk.rotation.z = (Math.random() - 0.5) * 0.25;

          bk.position.set(bx + bw / 2, 1.2 + s * 1.65 + bh / 2, Math.random() * 0.1);
          g.add(bk);
          bx += bw + 0.02;
        }
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.28, 1.6), M.shelf);
      top.position.set(0, 9.15, 0);
      g.add(top);

      g.position.set(cx, 0, cz);
      g.rotation.y = ry;
      g.traverse(c => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      scene.add(g);
    }

    // Spawn Shelves
    [-20, -6, 8, 22].forEach(z => {
      makeShelf(-34, z, Math.PI / 2);
      makeShelf(34, z, -Math.PI / 2);
    });
    [-16, 0, 16].forEach(x => makeShelf(x, -33, 0));

    // Chairs Function
    function makeChair(x, z, ry) {
      const g = new THREE.Group();
      [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), M.chair);
        leg.position.set(lx, 0.9, lz);
        g.add(leg);
      });
      const sF = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), M.chair);
      sF.rotation.z = Math.PI / 2;
      sF.position.set(0, 0.55, -0.5);
      g.add(sF);
      const sB = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), M.chair);
      sB.rotation.z = Math.PI / 2;
      sB.position.set(0, 0.55, 0.5);
      g.add(sB);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 1.15), M.chair);
      seat.position.set(0, 1.85, 0);
      g.add(seat);
      const cush = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.0), M.cush);
      cush.position.set(0, 1.95, 0);
      g.add(cush);
      [-0.48, 0.48].forEach(ox => {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.95, 6), M.chair);
        u.position.set(ox, 2.43, 0.52);
        g.add(u);
      });
      const rt = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.09, 0.1), M.chair);
      rt.position.set(0, 2.88, 0.52);
      g.add(rt);
      const rm = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.07, 0.09), M.chair);
      rm.position.set(0, 2.56, 0.52);
      g.add(rm);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.07), M.chair);
      sp.position.set(0, 2.6, 0.52);
      g.add(sp);
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      g.traverse(c => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      scene.add(g);
    }

    // Desks Setup
    const hitboxes = [];
    let deskCounter = 1;

    function makeTable(cx, cz) {
      const TW = 11, TD = 6;
      const top = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.2, TD), M.desk);
      top.position.set(cx, 3.8, cz);
      top.castShadow = true;
      top.receiveShadow = true;
      scene.add(top);

      const INSET = 0.3;
      const APRON_H = 0.38;
      const APRON_THICK = 0.2;
      const apFB = () => new THREE.Mesh(new THREE.BoxGeometry(TW - 2 * INSET, APRON_H, APRON_THICK), M.dbase);
      
      const af = apFB();
      af.position.set(cx, 3.51, cz - (TD / 2) + INSET);
      scene.add(af);
      
      const ab = apFB();
      ab.position.set(cx, 3.51, cz + (TD / 2) - INSET);
      scene.add(ab);

      const alr = () => new THREE.Mesh(new THREE.BoxGeometry(APRON_THICK, APRON_H, TD - 2 * INSET - 2 * APRON_THICK), M.dbase);
      
      const al = alr();
      al.position.set(cx - (TW / 2) + INSET, 3.51, cz);
      scene.add(al);
      
      const ar = alr();
      ar.position.set(cx + (TW / 2) - INSET, 3.51, cz);
      scene.add(ar);

      const legW = 0.22;
      [
        [cx - (TW / 2) + INSET, cz - (TD / 2) + INSET],
        [cx + (TW / 2) - INSET, cz - (TD / 2) + INSET],
        [cx - (TW / 2) + INSET, cz + (TD / 2) + INSET],
        [cx + (TW / 2) - INSET, cz + (TD / 2) + INSET]
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(legW, 3.6, legW), M.dbase);
        leg.position.set(lx, 1.8, lz);
        leg.castShadow = true;
        scene.add(leg);
      });

      const seats = [
        { sx: cx - 2.5, sz: cz - 5.2, ry: Math.PI, pz: cz - TD / 2 + 0.2 },
        { sx: cx + 2.5, sz: cz - 5.2, ry: Math.PI, pz: cz - TD / 2 + 0.2 },
        { sx: cx - 2.5, sz: cz + 5.2, ry: 0, pz: cz + TD / 2 - 0.2 },
        { sx: cx + 2.5, sz: cz + 5.2, ry: 0, pz: cz + TD / 2 - 0.2 },
      ];

      seats.forEach(({ sx, sz, ry, pz }) => {
        const id = deskCounter++;
        makeChair(sx, sz, ry);

        // Fetch current initial state of desk
        const initialDesk = desksRef.current.find(d => d.id === id);
        const stateStr = initialDesk ? initialDesk.state : 'free';
        const mappedState = stateStr === 'prompted' ? 'occupied' : stateStr;
        const color = PCOL[mappedState] || PCOL.free;

        const puck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.26, 0.06, 14),
          new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: color,
            emissiveIntensity: 1.2,
            roughness: 0.3
          })
        );
        puck.position.set(sx, 4.08, pz);
        scene.add(puck);

        const ringMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.37, 18), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(sx, 4.02, pz);
        scene.add(ring);

        const pl = new THREE.PointLight(color, 1.2, 5.5);
        pl.position.set(sx, 4.4, pz);
        scene.add(pl);

        // Save references to update states in-place dynamically
        deskVisualsRef.current[id] = { puck, ring, light: pl };

        // Raycasting hitboxes
        const hb = new THREE.Mesh(new THREE.BoxGeometry(4.5, 5, 4.5), new THREE.MeshBasicMaterial({ visible: false }));
        hb.position.set(sx, 2, sz);
        hb.userData = { id };
        scene.add(hb);
        hitboxes.push(hb);
      });
    }

    // Spawn 6 Tables
    [[-22, -14], [0, -14], [22, -14], [-22, 14], [0, 14], [22, 14]].forEach(([x, z]) => makeTable(x, z));

    // Spawn Plants
    function makePlant(x, z) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.33, 0.78, 10), new THREE.MeshStandardMaterial({ color: 0x7a3c18, roughness: 0.8 }));
      pot.position.set(x, 0.39, z);
      pot.castShadow = true;
      scene.add(pot);
      
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 2.4, 7), new THREE.MeshStandardMaterial({ color: 0x4a2e10 }));
      trunk.position.set(x, 2, z);
      scene.add(trunk);
      
      const fm = new THREE.MeshStandardMaterial({ color: 0x1a5c24, roughness: 0.9 });
      [
        [0, 1.1, 0], [0.35, 0.75, 0.28], [-0.35, 0.8, -0.28], [0.28, 0.85, -0.35], [-0.28, 0.78, 0.38]
      ].forEach(([ox, oy, oz]) => {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.48 + Math.random() * 0.25, 6, 6), fm);
        f.position.set(x + ox, oy + 1.2, z + oz);
        f.castShadow = true;
        scene.add(f);
      });
    }
    [[-36, 31], [36, 31], [-36, -31], [36, -31]].forEach(([x, z]) => makePlant(x, z));

    // Receptionist Counter
    box(10, 4, 2.5, M.dbase, 0, 2, 29);
    box(10.2, 0.18, 2.7, M.desk, 0, 4.09, 29);
    box(0.08, 0.75, 0.45, M.chair, -2, 4.47, 28.45);
    
    const scrn = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.28, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x081428, emissive: 0x1a3866, emissiveIntensity: 0.6 })
    );
    scrn.position.set(-2, 5.2, 28.4);
    scene.add(scrn);

    // Exit Sign
    box(
      1.5, 0.5, 0.1,
      new THREE.MeshStandardMaterial({ color: 0x00aa44, emissive: 0x00aa44, emissiveIntensity: 0.7 }),
      0, RH - 1.5, RD / 2 - 0.3
    );

    // --- RAYCASTER / CLICK INTERACTION ---
    const rc = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e) => {
      if (Math.abs(e.clientX - pointerDownPos.x) > 8 || Math.abs(e.clientY - pointerDownPos.y) > 8) return;
      
      // Do not raycast if clicking overlay UI elements
      if (
        e.target.closest('#ui') || 
        e.target.closest('.modal-overlay') || 
        e.target.closest('.modal-overlay-translucent') || 
        e.target.closest('#toast')
      ) {
        return;
      }

      // Calculate container bounds
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      mouse.x = (clientX / rect.width) * 2 - 1;
      mouse.y = -(clientY / rect.height) * 2 + 1;

      rc.setFromCamera(mouse, camera);
      const hits = rc.intersectObjects(hitboxes);

      if (hits.length) {
        const id = hits[0].object.userData.id;
        if (onDeskClickRef.current) onDeskClickRef.current(id);
        targetControlPos.set(hits[0].object.position.x, 0, hits[0].object.position.z);
        isAutoPanning = true;
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    // --- ANIMATION LOOP ---
    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (isAutoPanning) {
        controls.target.lerp(targetControlPos, 0.06);
        if (controls.target.distanceTo(targetControlPos) < 0.1) {
          isAutoPanning = false;
        }
      }

      controls.update();

      const t = performance.now() * 0.001;
      Object.values(deskVisualsRef.current).forEach(v => {
        v.puck.material.emissiveIntensity = 1.0 + Math.sin(t * 2.5 + v.puck.position.x) * 0.5;
        v.ring.material.opacity = 0.3 + Math.sin(t * 2 + v.puck.position.z) * 0.14;
      });

      renderer.render(scene, camera);
    };

    animate();

    // --- RESIZE HANDLER ---
    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // --- TEARDOWN ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      
      if (controls) controls.dispose();
      if (renderer) {
        renderer.forceContextLoss();
        renderer.dispose();
        if (renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
      
      // Clean up geometries and materials in scene
      scene.traverse(object => {
        if (!object.isMesh) return;
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, []);

  return <div ref={containerRef} id="canvas-container" />;
};

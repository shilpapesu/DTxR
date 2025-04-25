import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Import Papa Parse as a regular script
import './js/papaparse.js';
// Use the global Papa object

let scene, camera, renderer, controls;
let acParticles, windowParticles;
let acVelocities, windowVelocities; // Add velocity arrays
let simulationData = [];
let currentDataIndex = 0;
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 5000; // 5 seconds in milliseconds
let acUnit, windowMesh; // Add these variables to store references to the meshes
let windowCenter, windowSize; // Add these as global variables

// Initialize the scene
function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x808080);

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 3, 5);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Load the room model
    const loader = new GLTFLoader();
    loader.load('room_ac_model.glb', (gltf) => {
        scene.add(gltf.scene);
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Store references to AC unit and window
                if (child.name.startsWith('AC_')) {
                    acUnit = child;
                }
                if (child.name === 'Window') {
                    windowMesh = child;
                }
                if (child.name === 'Room') {
                    // Make room walls transparent
                    child.material.side = THREE.DoubleSide;
                    child.material.transparent = true;
                    child.material.opacity = 0.2;
                    child.material.depthWrite = false; // Ensures proper transparency
                }
            }
        });
        initParticleSystems();
    });

    // Load simulation data
    loadSimulationData();

    // Handle window resizing
    window.addEventListener('resize', onWindowResize, false);
}

function initParticleSystems() {
    if (!acUnit || !windowMesh) {
        console.error('AC unit or window mesh not found in the model');
        return;
    }

    // Get AC unit's world position and dimensions
    const acBox = new THREE.Box3().setFromObject(acUnit);
    const acCenter = new THREE.Vector3();
    acBox.getCenter(acCenter);
    const acSize = new THREE.Vector3();
    acBox.getSize(acSize);

    // Get room boundaries
    const roomBox = new THREE.Box3().setFromObject(scene.getObjectByName('Room'));
    const roomMin = roomBox.min;
    const roomMax = roomBox.max;

    // AC particles
    const acGeometry = new THREE.BufferGeometry();
    const acParticleCount = 2000;
    const acPositions = new Float32Array(acParticleCount * 3);
    acVelocities = new Float32Array(acParticleCount * 3);

    for (let i = 0; i < acParticleCount; i++) {
        const i3 = i * 3;
        // Initialize positions at the AC unit
        acPositions[i3] = acCenter.x + (Math.random() - 0.5) * acSize.x * 0.8;
        acPositions[i3 + 1] = acBox.min.y;
        acPositions[i3 + 2] = acCenter.z + (Math.random() - 0.5) * acSize.z * 0.8;

        // Initialize velocities with random directions
        acVelocities[i3] = (Math.random() - 0.5) * 0.02;
        acVelocities[i3 + 1] = -Math.random() * 0.04;
        acVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    acGeometry.setAttribute('position', new THREE.BufferAttribute(acPositions, 3));
    const acMaterial = new THREE.PointsMaterial({
        color: 0x00ffff,
        size: 0.03,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
    });

    acParticles = new THREE.Points(acGeometry, acMaterial);
    scene.add(acParticles);

    // Window particles
    const windowGeometry = new THREE.BufferGeometry();
    const windowParticleCount = 3000;
    const windowPositions = new Float32Array(windowParticleCount * 3);
    windowVelocities = new Float32Array(windowParticleCount * 3);

    // Get precise window dimensions
    let windowBox = new THREE.Box3().setFromObject(windowMesh);
    let windowCenter = new THREE.Vector3();
    let windowSize = new THREE.Vector3();
    windowBox.getCenter(windowCenter);
    windowBox.getSize(windowSize);

    const scatterRadius = 0.4;
    const baseSpeed = 0.015;
    const roomDepth = 0.5; // Reduced depth to keep particles closer to window

    for (let i = 0; i < windowParticleCount; i++) {
        const i3 = i * 3;
        const isInflow = i < windowParticleCount / 2;

        // Create scattered positions around the window
        const theta = Math.random() * Math.PI * 2;
        const scatter = Math.random() * scatterRadius;
        const depth = Math.random() * roomDepth;

        // Initialize positions with scatter and depth
        windowPositions[i3] = isInflow ? 
            windowBox.min.x - depth :
            windowBox.min.x + depth;
        windowPositions[i3 + 1] = windowBox.min.y + Math.random() * windowSize.y;
        windowPositions[i3 + 2] = windowBox.min.z + Math.random() * windowSize.z;

        // Add scatter to positions
        windowPositions[i3 + 1] += Math.sin(theta) * scatter;
        windowPositions[i3 + 2] += Math.cos(theta) * scatter;

        // Initialize velocities with more variation and stronger directional movement
        const randomAngle = Math.random() * Math.PI * 2;
        const verticalBias = (Math.random() - 0.5) * 0.01;
        const directionStrength = 0.7;

        windowVelocities[i3] = isInflow ? 
            baseSpeed * (directionStrength + Math.random() * 0.3) :
            -baseSpeed * (directionStrength + Math.random() * 0.3);
        windowVelocities[i + 1] = verticalBias + Math.sin(randomAngle) * baseSpeed * 0.4;
        windowVelocities[i + 2] = Math.cos(randomAngle) * baseSpeed * 0.4;
    }

    windowGeometry.setAttribute('position', new THREE.BufferAttribute(windowPositions, 3));
    const windowMaterial = new THREE.PointsMaterial({
        color: 0x88ff88,
        size: 0.02,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
    });

    windowParticles = new THREE.Points(windowGeometry, windowMaterial);
    scene.add(windowParticles);
}

function loadSimulationData() {
    fetch('ac_input_dynamic_balanced.csv')
        .then(response => response.text())
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                complete: (results) => {
                    simulationData = results.data;
                    updateSimulationDisplay(simulationData[0]);
                }
            });
        });
}

function updateParticles() {
    if (!acParticles || !windowParticles || !acUnit || !windowMesh) return;

    const currentTime = Date.now();
    if (currentTime - lastUpdateTime > UPDATE_INTERVAL) {
        const data = simulationData[currentDataIndex];
        updateSimulationDisplay(data);
        currentDataIndex = (currentDataIndex + 1) % simulationData.length;
        lastUpdateTime = currentTime;
    }

    const acBox = new THREE.Box3().setFromObject(acUnit);
    const windowBox = new THREE.Box3().setFromObject(windowMesh);
    const roomBox = new THREE.Box3().setFromObject(scene.getObjectByName('Room'));
    
    // Create new Vector3 instances for window center and size
    windowCenter = new THREE.Vector3();
    windowSize = new THREE.Vector3();
    windowBox.getCenter(windowCenter);
    windowBox.getSize(windowSize);

    // Update AC particles
    const acPositions = acParticles.geometry.attributes.position.array;
    
    for (let i = 0; i < acPositions.length; i += 3) {
        if (simulationData[currentDataIndex]['AC State'] === '1') {
            // Apply velocity
            acPositions[i] += acVelocities[i];
            acPositions[i + 1] += acVelocities[i + 1];
            acPositions[i + 2] += acVelocities[i + 2];

            // Add some turbulence
            acVelocities[i] += (Math.random() - 0.5) * 0.002;
            acVelocities[i + 1] += (Math.random() - 0.5) * 0.002;
            acVelocities[i + 2] += (Math.random() - 0.5) * 0.002;

            // Check room boundaries and reset if needed
            if (acPositions[i] < roomBox.min.x || acPositions[i] > roomBox.max.x ||
                acPositions[i + 1] < roomBox.min.y || acPositions[i + 1] > roomBox.max.y ||
                acPositions[i + 2] < roomBox.min.z || acPositions[i + 2] > roomBox.max.z) {
                
                // Reset position to AC unit
                acPositions[i] = acBox.min.x + Math.random() * (acBox.max.x - acBox.min.x);
                acPositions[i + 1] = acBox.min.y;
                acPositions[i + 2] = acBox.min.z + Math.random() * (acBox.max.z - acBox.min.z);
                
                // Reset velocity
                acVelocities[i] = (Math.random() - 0.5) * 0.02;
                acVelocities[i + 1] = -Math.random() * 0.04;
                acVelocities[i + 2] = (Math.random() - 0.5) * 0.02;
            }
        }
    }
    acParticles.geometry.attributes.position.needsUpdate = true;

    // Update window particles
    const windowPositions = windowParticles.geometry.attributes.position.array;
    const windowParticleCount = windowPositions.length / 3;
    const airflowSpeed = (parseFloat(simulationData[currentDataIndex]['Airflow Speed (m/s)']) || 0) * 0.5;

    for (let i = 0; i < windowPositions.length; i += 3) {
        if (simulationData[currentDataIndex]['Window State'] === '1') {
            const isInflow = i < windowParticleCount * 1.5;
            
            // Apply velocity with reduced speed and more scatter
            windowPositions[i] += windowVelocities[i] * airflowSpeed;
            windowPositions[i + 1] += windowVelocities[i + 1] * airflowSpeed;
            windowPositions[i + 2] += windowVelocities[i + 2] * airflowSpeed;

            // Add subtle turbulence
            const turbulence = 0.0003;
            windowVelocities[i] += (Math.random() - 0.5) * turbulence;
            windowVelocities[i + 1] += (Math.random() - 0.5) * turbulence;
            windowVelocities[i + 2] += (Math.random() - 0.5) * turbulence;

            // Check room boundaries and reset if needed
            if (windowPositions[i] < roomBox.min.x || windowPositions[i] > roomBox.max.x ||
                windowPositions[i + 1] < roomBox.min.y || windowPositions[i + 1] > roomBox.max.y ||
                windowPositions[i + 2] < roomBox.min.z || windowPositions[i + 2] > roomBox.max.z) {
                
                // Reset with scatter and depth
                const theta = Math.random() * Math.PI * 2;
                const scatter = Math.random() * 0.4;
                const depth = Math.random() * 0.5;

                windowPositions[i] = isInflow ? 
                    windowBox.min.x - depth :
                    windowBox.min.x + depth;
                windowPositions[i + 1] = windowBox.min.y + Math.random() * windowSize.y + Math.sin(theta) * scatter;
                windowPositions[i + 2] = windowBox.min.z + Math.random() * windowSize.z + Math.cos(theta) * scatter;

                // Reset velocity
                const baseSpeed = 0.015;
                const randomAngle = Math.random() * Math.PI * 2;
                const verticalBias = (Math.random() - 0.5) * 0.01;
                const directionStrength = 0.7;

                windowVelocities[i] = isInflow ? 
                    baseSpeed * (directionStrength + Math.random() * 0.3) :
                    -baseSpeed * (directionStrength + Math.random() * 0.3);
                windowVelocities[i + 1] = verticalBias + Math.sin(randomAngle) * baseSpeed * 0.4;
                windowVelocities[i + 2] = Math.cos(randomAngle) * baseSpeed * 0.4;
            }
        }
    }
    windowParticles.geometry.attributes.position.needsUpdate = true;
}

function updateSimulationDisplay(data) {
    document.getElementById('time').textContent = data.Time;
    document.getElementById('ac-state').textContent = data['AC State'] === '1' ? 'ON' : 'OFF';
    document.getElementById('window-state').textContent = data['Window State'] === '1' ? 'OPEN' : 'CLOSED';
    document.getElementById('temperature').textContent = 
        data['AC Temperature (°C)'] ? 
        `${data['AC Temperature (°C)']}°C` : 
        `${data['room temperature']}°C`;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateParticles();
    renderer.render(scene, camera);
}

init();
animate(); 



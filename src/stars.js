"use strict";

// Holds all cubes/jellyfish
const cubes = [];
const jellies = [];
let rot = 0;

// Kick off program
const init = () => {


  // Initialize Three.js canvas and renderer, add to DOM
  const canvas = document.querySelector('#stars');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);

  // Create camera and add to scene
  let camZoom = 1000;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.set(0, 0.5, 0.5);
  camera.position.z = 5;
  scene.add(camera);

  // Set up orbit camera controls
  const controls = new THREE.OrbitControls(camera, renderer.domElement)
  controls.listenToKeyEvents(window); // optional

  // Create light and add to scene
  const light = new THREE.PointLight(0xfffff, 1, 500);
  light.position.set(10, 0, 25);
  scene.add(light)

  // Listen for window resize and update renderer accordingly
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });


  //create stars
  let spheres = [];
  for (let i = 1; i < 1200; i++) {
    let geometry = new THREE.SphereGeometry(0.02 * randomArbitrary(0.5, 1), 6, 6);
    let material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, randomArbitrary(190, 220) / 255, Math.round(Math.random()))
    });

    let sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    spheres.push(sphere);
    sphere.position.setFromSpherical(new THREE.Spherical(5 + 5 * Math.random(), 2 * Math.PI * Math.random(), 2 * Math.PI * Math.random()))

  }

  // Render scene
  renderer.render(scene, camera);

  // Begin animation
  animate(renderer, scene, camera);
};

// Loops through to animate
const animate = (renderer, scene, camera) => {
  requestAnimationFrame(() => animate(renderer, scene, camera));

    rot = 0.0002;
    camera.rotation.x += Math.sin(rot);
    camera.rotation.y += Math.sin(rot);

  // Rerender scene
  renderer.render(scene, camera)
};

function randomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

// Calls init function once DOM finishes loading
window.onload = () => {
  init();
};
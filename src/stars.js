"use strict";

// Holds all stars
const stars = [];

// Kick off program
const init = () => {
  console.log('This stars script running...');

  // Initialize Three.js canvas and renderer, add to DOM
  const canvas = document.querySelector('#stars');
  const renderer = new THREE.WebGLRenderer({canvas,alpha: true});
  const scene = new THREE.Scene();
  renderer.setClearColor('#ffffff', 0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Creeate lights and add to scene
  const light = new THREE.PointLight(0xfffff, 1, 500);
  light.position.set(10, 0, 25);
  scene.add(light);

  //sets camera
  let camZoom = 130;
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth  / window.innerHeight, 0.1, 20000);
  camera.position.set(0, 0, camZoom);
  scene.add(camera);

  // Listen for window resize and update renderer accordingly
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // Specify stars shape
  const geometry = new THREE.CircleGeometry(0.5, 6);
  const material = new THREE.MeshMatcapMaterial({
    color: 0xffffff
  });
  // const circle = new THREE.Mesh(geometry, material);
  // scene.add(circle);

  for (let x = 0; x < 3000; x++) {
    const circle = new THREE.Mesh(geometry, material);

    circle.position.x = Math.random() * window.innerWidth - 130;
    circle.position.y = Math.random() * 160 - 90;

    circle.scale.x = Math.random() + 0.3 - 0.1;
    circle.scale.y = Math.random() + 0.3 - 0.1;

    scene.add(circle);
    stars.push(circle);
  }

  // Render scene
  renderer.render(scene, camera);

  // Begin animation
  animate(renderer, scene, camera);
};

const animate = (renderer, scene, camera) => {
  requestAnimationFrame(() => animate(renderer, scene, camera));
  renderer.render(scene, camera)
}


// Calls init function once DOM finishes loading
window.onload = () => {
  init();
};
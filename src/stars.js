"use strict";

// Holds all stars
const stars = [];

// Kick off program
const init = () => {
  console.log('This stars script running...');

  // Initialize Three.js canvas and renderer, add to DOM
  const canvas = document.querySelector('#stars');
  const renderer = new THREE.WebGLRenderer({
    canvas
  });
  renderer.setClearColor('#0d0b0e');
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Creeate lights and add to scene
  const light = new THREE.PointLight(0xfffff, 1, 500);
  light.position.set(10, 0, 25);
  scene.add(light)

  // Listen for window resize and update renderer accordingly
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // Specify stars shape
  const geometry = new THREE.CircleGeometry(5, 32);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffff00
  });
  const circle = new THREE.Mesh(geometry, material);
  scene.add(circle);

  // for (let x = 0; x < 1000; x++) {
  //   const stars = new THREE.Mesh(geometry, material);

  //   stars.position.x = Math.random() * 75 - 50;
  //   stars.position.y = Math.random() * 75 - 50;

  //   stars.rotation.x = Math.random() * 2 * Math.PI;
  //   stars.rotation.y = Math.random() * 2 * Math.PI;

  //   stars.scale.x = Math.random() + 0.2;
  //   stars.scale.y = Math.random() + 0.2;

  //   stars.userData.velocity = new THREE.Vector3();
  //   stars.userData.velocity.x = Math.random() * 0.4 - 0.2;
  //   stars.userData.velocity.y = Math.random() * 0.4 - 0.2;
  //   stars.userData.velocity.z = Math.random() * 0.4 - 0.2;

  //   scene.add(stars);
  //   cubes.push(stars);
  // }


  // Render scene
  renderer.render(scene, camera);

  // Begin animation
  animate(renderer, scene, camera);
};

// Loops through to animate
function animate(renderer, scene, camera) {
  requestAnimationFrame(() => animate(renderer, scene, camera));
  renderer.render(scene, camera)
}

// Calls init function once DOM finishes loading
window.onload = () => {
  init();
};
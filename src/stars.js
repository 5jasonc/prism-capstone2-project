"use strict";

// Holds all cubes/jellyfish
const cubes = [];
const jellies = [];
let rot = 0;
let jellyGeometry;
let parent, mesh, subMesh, sphere;

const outerMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 1,
  depthWrite: false
});

outerMaterial.side = THREE.DoubleSide;
const innerMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 1,
  depthWrite: false
})
innerMaterial.side = THREE.DoubleSide;

// Kick off program
const init = () => {
  // Initialize Three.js canvas and renderer, add to DOM
  const canvas = document.querySelector('#stars');
  const aboutCanvas = document.querySelector('#particles');
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


  //Load in the make a wish window
  //  document.querySelector('#addJellyButton').addEventListener('click', () => {
  //   console.log('test');
  //   const x = document.querySelector("#myDIV");
  //   if (x.style.display === "") x.style.display = "inline";
  //   else x.style.display = "";
  //   });

  //create stars
  let spheres = [];
  for (let i = 1; i < 1200; i++) {
    let geometry = new THREE.SphereGeometry(0.02 * randomArbitrary(0.5, 1), 6, 6);
    let material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, randomArbitrary(190, 220) / 255, Math.round(Math.random()))
    });

    sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);
    spheres.push(sphere);
    sphere.position.setFromSpherical(new THREE.Spherical(5 + 5 * Math.random(), 2 * Math.PI * Math.random(), 2 * Math.PI * Math.random()))
  }

  //Camera viewport size only screen size of the shooting stars

  //Shotting stars functions
  let dx, dy;

  //Make shotting star select bubble size large so its easy to click onto

  //Make the clickable element center to camera viewport

  //Make the jellyfish as a star
  parent = new THREE.Object3D();
  scene.add(parent);

  //adds jellyfish to the stars
  addJelly()
  subMesh.scale.set(0.99, 0.9, 0.98);

  // Render scene
  renderer.render(scene, camera);

  // Begin animation
  animate(renderer, scene, camera);
};

//Jellyfish circle
function addJelly() {

  let jellyFace = 3;
  let jellySize = 0.1;

  jellyGeometry = new THREE.SphereGeometry(jellySize, 15, 15, 0, 6.283, 0, jellyFace);
  addGeometry(jellyGeometry);

}

function addGeometry(geometry) {

  mesh = new THREE.Mesh(geometry, outerMaterial);
  subMesh = new THREE.Mesh(geometry, innerMaterial);

  mesh.depthWrite = false;
  subMesh.depthWrite = false;
  parent.add(mesh);
  parent.add(subMesh);

}

// Loops through to animate
const animate = (renderer, scene, camera) => {
  requestAnimationFrame(() => animate(renderer, scene, camera));

  rot = 0.00003;
  camera.rotation.x += Math.sin(rot);
  camera.rotation.y += Math.sin(rot);

  //Animate the jellyfish movoment

  /*When click on shooting star change var of 
   * jellyGeometry = new THREE.SphereGeometry(jellySize, 15, 15, 0, 6.283, 0, jellyFace);
   * Set jellyFace to 1.7 to give it a half dome look
   * Need to resize to 1 for jelly size to blow up the jellyfish
   * Then when we do actions of things we can set loc of y of jellyfish to move depends on GUI is doing.
   */


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
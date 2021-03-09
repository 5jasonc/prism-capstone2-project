"use strict";

// Holds all stars
const stars = [];

// Kick off program
const init = () => {
  console.log('This stars script running...');

  // Initialize Three.js canvas and renderer, add to DOM
  const canvas = document.querySelector('#stars');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    canvas, antialias: true,
    alpha: true
  });
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
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
  camera.position.set(0, 0, camZoom);
  scene.add(camera);

  // Listen for window resize and update renderer accordingly
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  //Stars creations
  // // Specify stars shape
  // const geometry = new THREE.CircleGeometry(0.5, 6);
  // const material = new THREE.MeshMatcapMaterial({
  //   color: 0xffffff
  // });
  // // const circle = new THREE.Mesh(geometry, material);
  // // scene.add(circle);

  // for (let x = 0; x < 3000; x++) {
  //   const circle = new THREE.Mesh(geometry, material);

  //   circle.position.x = Math.random() * window.innerWidth - 130;
  //   circle.position.y = Math.random() * 160 - 90;

  //   circle.scale.x = Math.random() + 0.3 - 0.1;
  //   circle.scale.y = Math.random() + 0.3 - 0.1;

  //   scene.add(circle);
  //   stars.push(circle);
  // }


//Working on creating the jelly fish head shapes
//load texture
let loader = null;
let loader2 = null;
let loader3 = null;
let loader4 = null;

let texture1 = null;
let texture2 = null;
let texture3 = null;
let texture4 = null;


loader = new THREE.TextureLoader();
loader2 = new THREE.TextureLoader();
loader3 = new THREE.TextureLoader();
loader4 = new THREE.TextureLoader();

texture1 = loader.load('Pattern1.png');
texture2 = loader2.load('Pattern2.png');
texture3 = loader3.load('Pattern3.png');
texture4 = loader4.load('Pattern4.png');

const CircleGeometry = new THREE.CircleGeometry( 33, 300 );
const circleMaterial = new THREE.MeshBasicMaterial( {
  color: 0x000000,
  transparent: true,
  opacity: 0.2
  } );
const circleA = new THREE.Mesh( CircleGeometry, circleMaterial );
const Boxgeometry = new THREE.BoxGeometry( 24, 24, 1 );
const edges = new THREE.EdgesGeometry( CircleGeometry );
const line = new THREE.LineSegments( edges, new THREE.LineBasicMaterial( { color: 0xF13982, linewidth: 0.1 } ) );
scene.add( line );

const materialA = new THREE.MeshBasicMaterial( {
  map: texture1,
  transparent: true,
});

const materialB = new THREE.MeshBasicMaterial( {
  map: texture2,
  transparent: true,
});


const materialC = new THREE.MeshBasicMaterial( {
  map: texture3,
  transparent: true,
});

const materialD = new THREE.MeshBasicMaterial( {
  map: texture4,
  transparent: true,
});


const cubeA = new THREE.Mesh( Boxgeometry, materialB );
cubeA.position.set( 12, 12, 0 );

const cubeB = new THREE.Mesh( Boxgeometry, materialA );
cubeB.position.set( -12, 12, 0 );


const cubeC = new THREE.Mesh( Boxgeometry, materialD);
cubeC.position.set( 12, -12, 0 );

const cubeD = new THREE.Mesh( Boxgeometry, materialC);
cubeD.position.set( -12, -12, 0 );

//create a group and add the two cubes
//These cubes can now be rotated / scaled etc as a group
const group = new THREE.Group();
group.add(circleA);
group.add( cubeA );
group.add( cubeB );
group.add( cubeC );
group.add( cubeD );

scene.add( group );
  // const circle = new THREE.Mesh(geometry, material);
  // scene.add(circle);

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
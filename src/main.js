"use strict";

// Function should kick off program
const init = () => {
  console.log('Main script running...');

  // Load config to connect to firebase
  const firebaseConfig = {
		apiKey: "AIzaSyC7YDYaXNuS0Q3sTxJDi66vGGl5maDwMNQ",
		authDomain: "prism-capstone2-project.firebaseapp.com",
		databaseURL: "https://prism-capstone2-project-default-rtdb.firebaseio.com/",
		storageBucket: "prism-capstone2-project.appspot.com",
	};
	
  // Initialize app and connect to database
	firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
};

// Adds 20 wishes to the DB. Don't run this function unless needed
// Must pass a database reference
const seedDB = (database) => {
  // Create dummy wish data
  const wishData = {};
  for(let i = 0; i < 20; i++) {
    const wish = {
      wish: `I wish for ${i} dollars.`
    };
    wishData[`wish${i}`] = wish;
  }

  // Add dummy wish data to database
  const updates = {};
  updates['/wishes/'] = wishData;
  database.ref().update(updates);
};

// Calls init function once DOM finishes loading
window.onload = () => { 
  init(); 
};

/*++++++++++Three.js++++++++++*/
//Connected the canvas to the #app html canvas Jason set up on
const canvas = document.querySelector('#app');
//Renders the 3.js on to the canvas
const renderer = new THREE.WebGLRenderer({canvas});
//Appends to html
document.body.appendChild( renderer.domElement );

//Setting up the scene for the 3D to be in 
const fov = 75;
const aspect = 2;  // the canvas default
const near = 0.1;
const far = 5;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 2;

//Setting the 3D stuff 
const scene = new THREE.Scene();

{
  const color = 0xFFFFFF;
  const intensity = 1;
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(-1, 2, 4);
  scene.add(light);
}

//Creating box shape
const boxWidth = 1;
const boxHeight = 1;
const boxDepth = 1;
const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);

function makeInstance(geometry, color, x) {
  const material = new THREE.MeshPhongMaterial({color});

  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  cube.position.x = x;

  return cube;
}

//Creates different cubes
const cubes = [
  makeInstance(geometry, 0x44aa88,  0),
  makeInstance(geometry, 0x8844aa, -2),
  makeInstance(geometry, 0xaa8844,  2),
];


function resizeRendererToDisplaySize(renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) {
    renderer.setSize(width, height, false);
  }
  return needResize;
}

//Important function This helps update refresh frame rate and keeping canvas width responsive
function render(time) {
  time *= 0.001;

  if (resizeRendererToDisplaySize(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  cubes.forEach((cube, ndx) => {
    const speed = 1 + ndx * .1;
    const rot = time * speed;
    cube.rotation.x = rot;
    cube.rotation.y = rot;
  });

  //Renders the things out to html canvas
  renderer.render(scene, camera);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
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
  seedDB(database);
};

// Adds 20 wishes to the DB. Don't run this function unless needed
// Must pass a database reference
const seedDB = (database) => {
  // Create dummy wish data
  const wishData = {};
  for (let i = 0; i < 20; i++) {
    const wish = {
      wish: `I wish for ${i} dollars.`
    };
    wishData[`wish${i}`] = wish;
  }

  // Add dummy wish data to database
  const updates = {};
  updates['/wishes/'] = wishData;
  //console.log(updates);


  //print out all wishes
  for (let i = 0; i < 20; i++) {
    console.log(updates['/wishes/'][`wish${i}`]);
    document.getElementById("demo").innerHTML = document.getElementById("demo").innerHTML + JSON.stringify(updates['/wishes/'][`wish${i}`]);
  }


  database.ref().update(updates);
};


// Calls init function once DOM finishes loading
window.onload = () => {
  init();
};


/*++++++++++Three.js++++++++++*/
//Use dom slider to change the camera zoom 
let camZoom = 50;
//create pull the dom element from html to here
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(60, window.innerWidth  / window.innerHeight, 0.1, 20000);
camera.position.set(0, 0, camZoom);
scene.add(camera);

//Connected the canvas to the #app html canvas Jason set up on
const canvas = document.querySelector('#app');
const renderer = new THREE.WebGLRenderer({
  canvas
});

renderer.setClearColor('#0d0b0e');
renderer.setSize(window.innerWidth, window.innerHeight);

//Appends to html
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

//creating the jelly fish shape
var geometry = new THREE.BoxGeometry(5, 10, 5);
var material = new THREE.MeshNormalMaterial();

var cube;
//Assign what ever amount of size of list of the wishes to the cube array
var cubes = [];
//create many cubes
/*https://www.youtube.com/watch?v=lshPMbN5ws8*/
for (var x = 0; x < 1000; x++) {
  cube = new THREE.Mesh(geometry, material);

  cube.position.x = Math.random() * 75 - 50;
  cube.position.y = Math.random() * 75 - 50;
  cube.position.z = 0;

  cube.rotation.x = Math.random() * 2 * Math.PI;
  cube.rotation.y = Math.random() * 2 * Math.PI;
  cube.rotation.z = Math.random() * 2 * Math.PI;

  cube.scale.x = Math.random() + 0.5;
  cube.scale.y = Math.random() + 0.5;
  cube.scale.z = Math.random() + 0.5;

  cube.userData.velocity = new THREE.Vector3();
  cube.userData.velocity.x = Math.random() * 0.4 - 0.2;
  cube.userData.velocity.y = Math.random() * 0.4 - 0.2;
  cube.userData.velocity.z = Math.random() * 0.4 - 0.2;
  scene.add(cube);
  cubes.push(cube);
}

//Setting up the lights
var light = new THREE.PointLight(0xfffff, 1, 500);
light.position.set(10, 0, 25);
scene.add(light)

//render it out
renderer.render(scene, camera);

var render = function () {
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);

  //Make cubes move around
  for (var i = 0; i < cubes.length; i++) {
    var cube = cubes[i];
    cube.position.add(cube.userData.velocity);
    if (cube.position.x < -100 || cube.position.x > 100) {
      cube.position.x = THREE.Math.clamp(cube.position.x, -100, 100);
      cube.userData.velocity.x = -cube.userData.velocity.x;
    }
    if (cube.position.y < -100 || cube.position.y > 100) {
      cube.position.y = THREE.Math.clamp(cube.position.y, -100, 100);
      cube.userData.velocity.y = -cube.userData.velocity.y;
    }
    if (cube.position.z < -100 || cube.position.z > 100) {
      cube.position.z = THREE.Math.clamp(cube.position.z, -100, 100);
      cube.userData.velocity.z = -cube.userData.velocity.z;
    }
    cube.rotation.x += 0.01;
  }

  renderer.render(scene,camera)
}
animate();

/*Change scene viewpoint*/
// Try to use the trackball js code
// controls = new THREE.TrackballControls(camera)
// controls.position.addEventListener('change', render)
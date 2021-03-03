"use strict";

// Holds all cubes/jellyfish
const cubes = [];

// Kick off program
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

  // Initialize Three.js canvas and renderer, add to DOM
  const canvas = document.querySelector('#app');
  const renderer = new THREE.WebGLRenderer({canvas});
  renderer.setClearColor('#0d0b0e');
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Create camera and add to scene
  let camZoom = 130;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth  / window.innerHeight, 0.1, 20000);
  camera.position.set(0, 0, camZoom);
  scene.add(camera);

  document.querySelector('#myCamRange').addEventListener('input', e => {
    camZoom = e.target.value;
    camera.position.set(0, 0, camZoom);
  });

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

  // Specify jellyfish shape
  const geometry = new THREE.BoxGeometry(5, 10, 5);
  const material = new THREE.MeshNormalMaterial();

  for (let x = 0; x < 500; x++) {
    const cube = new THREE.Mesh(geometry, material);

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

  // Render scene
  renderer.render(scene, camera);

  // Begin animation
  animate(renderer, scene, camera);
};


// Loops through to animate
function animate(renderer, scene, camera) {
  requestAnimationFrame(() => animate(renderer, scene, camera));

  // Make cubes move around
  for (let i = 0; i < cubes.length; i++) {
    const cube = cubes[i];
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

  renderer.render(scene, camera)
}

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

  // Add dummy wish data updates
  const updates = {};
  updates['/wishes/'] = wishData;

  //print out all wishes
  for (let i = 0; i < 20; i++) {
    console.log(updates['/wishes/'][`wish${i}`]);
    // document.getElementById("demo").innerHTML = document.getElementById("demo").innerHTML + JSON.stringify(updates['/wishes/'][`wish${i}`]);
  }

  // Update DB
  database.ref().update(updates);
};


// Calls init function once DOM finishes loading
window.onload = () => {
  init();
};

/*Change scene viewpoint*/
// Try to use the trackball js code
// controls = new THREE.TrackballControls(camera)
// controls.position.addEventListener('change', render)
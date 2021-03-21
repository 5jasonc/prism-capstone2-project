"use strict";

import * as THREE from '../build/three.module.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';

// Holds all cubes/jellyfish
const cubes = [];
const jellies = [];

// Tracks whether camera is following jelly or not
let isCameraFollowingJelly = false;
let currentJellyTarget = null;

let camZoom = 1000;
let controls = null;

// Kick off program
const init = () => {
  // Load config to connect to firebase
  const firebaseConfig = {
    apiKey: "AIzaSyC7YDYaXNuS0Q3sTxJDi66vGGl5maDwMNQ",
    authDomain: "prism-capstone2-project.firebaseapp.com",
    databaseURL: "https://prism-capstone2-project-default-rtdb.firebaseio.com/",
    storageBucket: "prism-capstone2-project.appspot.com",
  };

  // Initialize app and connect to database
  firebase.initializeApp(firebaseConfig);
  const dbRef = firebase.database().ref('/wishes/');
  // seedDB(database);

  // Initialize Three.js canvas and renderer, add to DOM
  const canvas = document.querySelector('#app');
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true}); // antialias T or F?
  renderer.setPixelRatio(window.devicePixelRatio); // keep this?
  renderer.setSize(window.innerWidth, window.innerHeight);
  // renderer.setClearColor(0x000000, 0); // need this?
  // renderer.toneMapping = THREE.ReinhardToneMapping; // keep this?
  document.body.appendChild(renderer.domElement);

  // Start texture loader
  const loader = new THREE.TextureLoader();

  // Create camera and add to scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth  / window.innerHeight, 0.1, 20000);
  camera.position.set(500, 500, camZoom);
  scene.add(camera);

  // Set up orbit camera controls
  controls = new OrbitControls(camera, renderer.domElement);
	controls.listenToKeyEvents(window);

  // Listen for add search button is clicked, to bring up search wish popup
  document.querySelector('#searchButton').addEventListener('click', () => {
    const x = document.querySelector("#searchJelly");
    if(x.style.display === "") x.style.display = "block";
    else x.style.display = "none";
  });

  // Listens for cancel button to hide search wish popup
  document.querySelector('#cancelbtn').addEventListener('click', () => {
    const x = document.querySelector("#searchJelly");
    if(x.style.display === "block") x.style.display = "none";
  });

  // Listen for make wish button being clicked, generate a new jellyfish with current wish input
  document.querySelector('#makeWishButton').addEventListener('click', () => {
    dbRef.push({
      wish: document.querySelector('#wishInput').value
    });
    document.querySelector('#addJellyButton').click();
    jellyClicked(jellies[jellies.length - 1].jellyParent);
  });

  // Create light and add to scene
  // Which light source should we use?
  // const light = new THREE.PointLight(0xfffff, 1, 500); // point light
  // light.position.set(10, 0, 25);
  // scene.add(light)

  const light = new THREE.PointLight(0xffffff, 1); // point light attached to camera
	camera.add(light);

  // scene.add( new THREE.AmbientLight( 0x404040 ) ); // ambient light

  // const light = new THREE.DirectionalLight( 0xffffff ); // directional light
	// light.position.set( 0, 0, 1 );
	// scene.add( light );

  // Listen for window resize and update renderer accordingly
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // Listen to click events on jellyfish
  document.querySelector('#app').addEventListener('pointerdown', (e) => onDocumentMouseDown(e, renderer, camera, scene), false);

  // Specify cube shape and material
  // const geometry = new THREE.BoxGeometry(5, 10, 5);
  // const material = new THREE.MeshNormalMaterial();

  // Add 500 cubes to scene
  // for (let x = 0; x < 500; x++) {
  //   const cube = new THREE.Mesh(geometry, material);

  //   cube.position.x = Math.random() * 75 - 50;
  //   cube.position.y = Math.random() * 75 - 50;
  //   cube.position.z = 0;

  //   cube.rotation.x = Math.random() * 2 * Math.PI;
  //   cube.rotation.y = Math.random() * 2 * Math.PI;
  //   cube.rotation.z = Math.random() * 2 * Math.PI;

  //   cube.scale.x = Math.random() + 0.5;
  //   cube.scale.y = Math.random() + 0.5;
  //   cube.scale.z = Math.random() + 0.5;

  //   cube.userData.velocity = new THREE.Vector3();
  //   cube.userData.velocity.x = Math.random() * 0.4 - 0.2;
  //   cube.userData.velocity.y = Math.random() * 0.4 - 0.2;
  //   cube.userData.velocity.z = Math.random() * 0.4 - 0.2;
  
  //   scene.add(cube);
  //   cubes.push(cube);
  // }

  // Add 56 random jellies to the screen
  // for(let i = 0; i < 50; i++) {
  //   generateJelly(`Jelly-${randomNum(-1000, 1000)}`, scene);
  // }

  // Set number of wishes to number of jellies
  // document.querySelector("#numWishes").innerHTML = jellies.length;

  // Load wishes from database and generate jellies
  loadWishes(dbRef, scene, loader);

  // Add bloom effects
  const renderScene = new RenderPass(scene, camera);

	const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
	bloomPass.threshold = 0;
	bloomPass.strength = 1.5;
	bloomPass.radius = 0.5;

	const composer = new EffectComposer(renderer);
	composer.addPass(renderScene);
	composer.addPass(bloomPass);

  // Begin animation
  const clock = new THREE.Clock();
  animate(composer, scene, camera, clock);
};

// Loops through to animate
const animate = (renderer, scene, camera, clock) => {
  const delta = clock.getDelta();

  requestAnimationFrame(() => animate(renderer, scene, camera, clock));

  // Make cubes move around
  // for (let i = 0; i < cubes.length; i++) {
  //   const cube = cubes[i];
  //   cube.position.add(cube.userData.velocity);
  //   if (cube.position.x < -100 || cube.position.x > 100) {
  //     cube.position.x = THREE.Math.clamp(cube.position.x, -100, 100);
  //     cube.userData.velocity.x = -cube.userData.velocity.x;
  //   }
  //   if (cube.position.y < -100 || cube.position.y > 100) {
  //     cube.position.y = THREE.Math.clamp(cube.position.y, -100, 100);
  //     cube.userData.velocity.y = -cube.userData.velocity.y;
  //   }
  //   if (cube.position.z < -100 || cube.position.z > 100) {
  //     cube.position.z = THREE.Math.clamp(cube.position.z, -100, 100);
  //     cube.userData.velocity.z = -cube.userData.velocity.z;
  //   }
  //   cube.rotation.x += 0.01;
  // }

  // Make jellies move around, make them turn around if they hit walls
  for(let i = 0; i < jellies.length; i++) {
    const jelly = jellies[i].jellyParent;
    jelly.translateY(jellies[i].aStep * 2 + 0.3);
    if(jelly.position.x < -1300 || jelly.position.x > 1300) {
      jelly.position.x = THREE.Math.clamp(jelly.position.x, -1300, 1300);
      jelly.rotateX(Math.PI);
    }
    if(jelly.position.y < -1300 || jelly.position.y > 1300) {
      jelly.position.y = THREE.Math.clamp(jelly.position.y, -1300, 1300);
      jelly.rotateY(Math.PI);
    }
    if(jelly.position.z < -1300 || jelly.position.z > 1300) {
      jelly.position.z = THREE.Math.clamp(jelly.position.z, -1300, 1300);
      jelly.rotateZ(Math.PI);
    }
  }

  // Make jellies pulsate
  for(let j = 0; j < jellies.length; j++) {
    const position = jellies[j].jellyMesh.geometry.attributes.position;
    const vector = new THREE.Vector3();

    for(let i = 0; i < position.count; i++){
        vector.fromBufferAttribute(position, i);
        vector.applyMatrix4(jellies[j].jellyMesh.matrix);
        let size = 12;
        let magnitude = 7;
        let dist = new THREE.Vector3(vector.x, vector.y, vector.z).sub(new THREE.Vector3(0, 1000, 0));

        vector.normalize();
        vector.multiplyScalar(40 + Math.sin(dist.length() / -size + jellies[j].a) * magnitude);
        position.setXYZ(i, vector.x, vector.y, vector.z);

    }
    position.needsUpdate = true;
    jellies[j].jellyMesh.geometry.verticesNeedUpdate = true;
    jellies[j].jellyMesh.geometry.normalsNeedUpdate = true;
    jellies[j].jellyMesh.geometry.computeVertexNormals();
    jellies[j].jellyMesh.geometry.computeFaceNormals();
    jellies[j].a += jellies[j].aStep;
  }

  // If camera is focused on jelly, move camera
  if(isCameraFollowingJelly) {
    controls.target = currentJellyTarget.position;
    controls.update();
  }
  
  // Rerender scene
  renderer.render(delta);
  // renderer.render(scene, camera)
};

// When screen is clicked detect if jellyfish is clicked, call jellyClicked if true
const onDocumentMouseDown = (e, renderer, camera, scene) => {
  e.preventDefault();

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
  mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);

  if(intersects.length > 0) {
    if(currentJellyTarget != intersects[0].object.parent) {
      jellyClicked(intersects[0].object.parent);
    }
  } else {
    // isCameraFollowingJelly = false;
  }
};

// Switches camera controls to follow a jellyfish on click
const jellyClicked = (jelly) => {
  currentJellyTarget = jelly;
  isCameraFollowingJelly = true;
  controls.target = currentJellyTarget.position;
  controls.dIn(0.3);
  controls.update();
};

// Generates a jellyfish based on the specified string (wish)
const generateJelly = (string, scene, loader) => {
  // generate unique hash for string, map to specific jelly properties
  const jellyCode = hashFunc(string);
  const jellyWidthSegments = Math.round(mapNumToRange(jellyCode[0], 1, 9, 5, 11));
  const jellyHeightSegments = Math.round(mapNumToRange(jellyCode[1], 0, 9, 3, 8));
  const jellyColor = Math.floor(mapNumToRange(jellyCode.substring(2, 4), 0, 99, 0.1, 0.9) * 16777215).toString(16);
  const jellyAnimSpeed = mapNumToRange(jellyCode[4], 0, 9, 0.01, 0.09);

  // define jelly geometry and material/texture
  const jellyGeometery = new THREE.SphereGeometry(15, jellyWidthSegments, jellyHeightSegments, 0, 6.283, 0, 1.7);

  const texture = loader.load("../uv-lines.png");
  texture.center.set = (0.5, 0.5);
  
  const outerMaterial = new THREE.MeshMatcapMaterial({
    color: `#${jellyColor}`,// 0xe256cd,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const innerMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    map: texture,
    side: THREE.DoubleSide
  });

  // create jelly mesh for outer layer and inner layer
  const jellyMesh = new THREE.Mesh(jellyGeometery, outerMaterial);
  jellyMesh.depthWrite = false;
  const jellySubMesh = new THREE.Mesh(jellyGeometery, innerMaterial);
  jellySubMesh.depthWrite = false;
  jellySubMesh.scale.set(0.98,0.65,0.98);

  // Create parent to hold jelly so we can change position without changing local coordinates
  const parent = new THREE.Object3D();
  parent.position.set(randomNum(-200, 200), randomNum(-200, 200), randomNum(-200, 200));
  parent.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);

  // add jelly meshes to parent and parent to scene
  parent.add(jellyMesh);
  parent.add(jellySubMesh);
	scene.add(parent);

  // add jellies to list to track and aniamte
  jellies.push({
    jellyMesh,
    jellySubMesh,
    jellyParent: parent,
    aStep: jellyAnimSpeed,
    a: 0
  });
};

// Get random num between min and max
const randomNum = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

// Maps input number within specified range to specified output with specified range
const mapNumToRange = (input, minInput, maxInput, minOutput, maxOutput) => {
  return (input - minInput) * (maxOutput - minOutput) / (maxInput - minInput) + minOutput;
};

// Simple hash function
const hashFunc = (s) => {
  for(var i = 0, h = 0xdeadbeef; i < s.length; i++)
      h = Math.imul(h ^ s.charCodeAt(i), 2654435761);
  return ((h ^ h >>> 16) >>> 0).toString();
};

// Adds 20 wishes to the DB. Don't run this function unless needed
// Must pass a database reference
// const seedDB = (database) => {
//   // Create dummy wish data
//   const wishData = {};
//   for (let i = 0; i < 20; i++) {
//     const wish = {
//       wish: `I wish for ${i} dollars.`
//     };
//     wishData[`wish${i}`] = wish;
//   }

//   // Add dummy wish data updates
//   const updates = {};
//   updates['/wishes/'] = wishData;

//   //print out all wishes
//   for (let i = 0; i < 20; i++) {
//     console.log(updates['/wishes/'][`wish${i}`]);
//     // document.getElementById("demo").innerHTML = document.getElementById("demo").innerHTML + JSON.stringify(updates['/wishes/'][`wish${i}`]);
//   }

//   // Update DB
//   database.ref().update(updates);
// };

// Loads and returns all wishes in database
const loadWishes = (dbRef, scene, loader) => {
  dbRef.on('child_added', (data) => {
    generateJelly(data.val().wish, scene, loader);
    document.querySelector("#numWishes").innerHTML = jellies.length;
  });
};

// Calls init function once DOM finishes loading
window.onload = () => {
  init();
};
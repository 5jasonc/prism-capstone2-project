"use strict";

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
  const database = firebase.database();
  seedDB(database);

  // Initialize Three.js canvas and renderer, add to DOM
  const canvas = document.querySelector('#app');
  const renderer = new THREE.WebGLRenderer({canvas});
  renderer.setClearColor('#0d0b0e');
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Create camera and add to scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth  / window.innerHeight, 0.1, 20000);
  camera.position.set(500, 500, camZoom);
  scene.add(camera);

  // Set up orbit camera controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
	controls.listenToKeyEvents( window ); // optional

  // Listen for change in zoom slider
  // document.querySelector('#myCamRange').addEventListener('input', e => {
  //   camZoom = e.target.value;
  //   camera.position.set(0, 0, camZoom);
  // });

  // Listen for make wish button being clicked, generate a new jellyfish with current wish input
  document.querySelector('#makeWishButton').addEventListener('click', () => {
    generateJelly(document.querySelector('#wishInput').value, scene);
  });

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

  // Add 5 random jellies to the screen
  for(let i = 0; i < 5; i++) {
    generateJelly(`Jelly-${randomNum(-1000, 1000)}`, scene);
  }
  
  // Render scene
  renderer.render(scene, camera);

  // Begin animation
  animate(renderer, scene, camera);
};

// Loops through to animate
const animate = (renderer, scene, camera) => {
  requestAnimationFrame(() => animate(renderer, scene, camera));

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
    if(jelly.position.x < -300 || jelly.position.x > 300) {
      jelly.position.x = THREE.Math.clamp(jelly.position.x, -300, 300);
      jelly.rotateX(Math.PI);
    }
    if(jelly.position.y < -300 || jelly.position.y > 300) {
      jelly.position.y = THREE.Math.clamp(jelly.position.y, -300, 300);
      jelly.rotateY(Math.PI);
    }
    if(jelly.position.z < -300 || jelly.position.z > 300) {
      jelly.position.z = THREE.Math.clamp(jelly.position.z, -300, 300);
      jelly.rotateZ(Math.PI);
    }
  }

  // Make jellies pulsate
  for(let j = 0; j < jellies.length; j++) {
    const position = jellies[j].jelly.geometry.attributes.position;
    const vector = new THREE.Vector3();

    for(let i = 0; i < position.count; i++){
        vector.fromBufferAttribute(position, i);
        vector.applyMatrix4(jellies[j].jelly.matrix);
        let size = 12;
        let magnitude = 7;
        let dist = new THREE.Vector3(vector.x, vector.y, vector.z).sub(new THREE.Vector3(0, 1000, 0));

        vector.normalize();
        vector.multiplyScalar(40 + Math.sin(dist.length() / -size + jellies[j].a) * magnitude);
        position.setXYZ(i, vector.x, vector.y, vector.z);

    }
    position.needsUpdate = true;
    jellies[j].jelly.geometry.verticesNeedUpdate = true;
    jellies[j].jelly.geometry.normalsNeedUpdate = true;
    jellies[j].jelly.geometry.computeVertexNormals();
    jellies[j].jelly.geometry.computeFaceNormals();
    jellies[j].a += jellies[j].aStep;
  }

  // If camera is focused on jelly, move camera
  if(isCameraFollowingJelly) {
    // This one works but I couldn't reset the camera after to original view for some reason, and you can't use orbit controls
    // camera.position.set(currentJellyTarget.position.x, currentJellyTarget.position.y, currentJellyTarget.position.z - 100);
    // camera.lookAt(currentJellyTarget.position);

    // if(camZoom >= 500) camZoom--;
    // if(camera.position.x != currentJellyTarget.position.x)
    // camera.position.set(0, 0, camZoom);
    // camera.lookAt(currentJellyTarget.position);
    controls.target = currentJellyTarget.position;
    controls.update();
    // camera.position.set(currentJellyTarget.position.x, currentJellyTarget.position.y, currentJellyTarget.position.z - 100);
  } else {
    // if(camZoom < 1000) camZoom++;
    // camera.position.set(0, 0, camZoom);
  }
  
  // Rerender scene
  renderer.render(scene, camera)
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
      /* for(const intersect of intersects) */ jellyClicked(intersects[0].object.parent, camera);
    }
  } else {
    // isCameraFollowingJelly = false;
  }
};

// Switches camera controls to follow a jellyfish on click
const jellyClicked = (jelly, camera) => {
  currentJellyTarget = jelly;
  isCameraFollowingJelly = true;
  // camera.position.set(jelly.position.x, jelly.position.y, jelly.position.z - 100);
  // camera.lookAt(jelly);
  controls.target = currentJellyTarget.position;
  controls.dIn(0.3);
  controls.update();
  // camZoom = 500;
  // camera.position.set(0, 0, camZoom);
  // camera.lookAt(jelly.position);
  // camera.position.set(jelly.position.x, jelly.position.y - 5, jelly.position.z);
  // camera.lookAt(jelly);
  // camera.rotateX(Math.PI / 2);
};

// Generates a jellyfish based on the specified string (wish)
const generateJelly = (string, scene) => {
  // generate unique hash for string, map to specific jelly properties
  const jellyCode = hashFunc(string);
  const jellyWidthSegments = Math.round(mapNumToRange(jellyCode[0], 1, 9, 5, 11));
  const jellyHeightSegments = Math.round(mapNumToRange(jellyCode[1], 0, 9, 3, 8));
  const jellyColor = Math.floor(mapNumToRange(jellyCode.substring(2, 4), 0, 99, 0.1, 0.9) * 16777215).toString(16);
  const jellyAnimSpeed = mapNumToRange(jellyCode[4], 0, 9, 0.01, 0.09);

  // create jelly shape and material
  const jellyGeometery = new THREE.SphereGeometry(10, jellyWidthSegments, jellyHeightSegments, 0, 6.3, 0, 1.7);
  const jellyMaterial = new THREE.MeshBasicMaterial({
    color: `#${jellyColor}`,
    wireframe: true
  });

  // add jelly object to parent so we can move jelly without changing local coordinates and therefore messing up animation of jellies
  const jelly = new THREE.Mesh(jellyGeometery, jellyMaterial);
  const parent = new THREE.Object3D();
  parent.position.set(randomNum(-200, 200), randomNum(-200, 200), randomNum(-200, 200));
  parent.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);

  // add jellies to scene
  parent.add(jelly);
	scene.add(parent);

  // add jellies to list to track and aniamte
  jellies.push({
    jelly,
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
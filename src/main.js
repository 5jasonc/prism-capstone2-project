"use strict";

import * as THREE from '../build/three.module.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { FilmPass } from './jsm/postprocessing/FilmPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';

const vertexShader = ` 
			varying vec3 vPosition;

      void main() {
        vPosition = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float ps = 1.-distance(vPosition, vec3(0.));
        gl_PointSize = 10.*ps;
        gl_Position = projectionMatrix * mvPosition;
      }
`;

const fragmentShader = `
			uniform vec3 color;
      varying vec3 vPosition;

      void main() {
        vec2 uv = gl_PointCoord.xy;
        float dist = smoothstep(1.-distance(vec2(.5), uv), 0., .5);
        float alph = 1.-distance(vPosition, vec3(0.));
        float finalph = dist*alph*4.;
        if (finalph < .2) discard;
        vec3 color = vec3(1,1,1);
        gl_FragColor = vec4(color, finalph);
      }
`;

//Defines Tweening parameters + helpers
const { autoPlay, Easing, onTick, Tween } = TWEEN;

// Holds all jellies and particles in scene
const jellies = [];
let particles;

// Tracks whether camera is following jelly or not
let isCameraFollowingJelly = false;
let currentJellyTarget = null;

let camZoom = 1000;
let controls = null;
let cameraTween;

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
  controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
  controls.dampingFactor = 0.05;
	controls.listenToKeyEvents(window);

  // Listen for add search button is clicked, to bring up search wish popup
  document.querySelector('#searchButton').addEventListener('click', () => {
    const x = document.querySelector("#searchJelly");
    if(x.style.display !== "block") x.style.display = "block";
    else x.style.display = "none";
  });

  // Listens for cancel button to hide search wish popup
  document.querySelector('#cancelbtn').addEventListener('click', () => {
    const x = document.querySelector("#searchJelly");
    if(x.style.display === "block") x.style.display = "none";
  });

  // Listens for add jelly button clicked, opens make a wish menu
  document.querySelector('#addJellyButton').addEventListener('click', () => {
    const x = document.querySelector("#myDIV");
    if(x.style.display !== "inline") x.style.display = "inline";
    else x.style.display = "none";
  });

  // Listen for make wish button being clicked, generate a new jellyfish with current wish input
  document.querySelector('#makeWishButton').addEventListener('click', () => {
    const wish = document.querySelector('#wishInput').value;
    if(wish.trim() !== "") {
      dbRef.push({
        wish: document.querySelector('#wishInput').value,
        approved: null,
        userID: getUserID()
      });
      jellyClicked(jellies[jellies.length - 1].jellyParent);
    }
    document.querySelector('#addJellyButton').click();
  });

  // Listen for changes in search term
  document.querySelector('#searchtxt').addEventListener('input', (e) => {
    const wishResult = document.querySelector('#wishSearchResult');
    const wishBannerResults = document.querySelector('#wishBannerSearchResult');
    const searchtxt = e.target.value;
    document.getElementById("searchTxt").innerHTML = searchtxt;
    const jellyResults = jellies.filter(jelly => jelly.wish.includes(searchtxt));
    wishResult.innerHTML = jellyResults.length;
    wishBannerResults.innerHTML = jellyResults.length;
    //temp be 25 wishes but I want it to size of itself so it doesn't pop up. Only amount of search is true display flex.
    // if(jellyResults.length == 25){
    //   document.getElementById("bannerBar").style.display = "none";
    // }
    // else{
      document.getElementById("bannerBar").style.display = "flex";
    // }
  });

  // Hides the text box showing a jellies wish
  const hideWishText = () => {
    isCameraFollowingJelly = false;
    const wishText = document.querySelector('#wishText');
    const wishBox = document.querySelector('#wishtxtbox');
    wishText.style.display = 'none';
    wishBox.style.display = 'none';
  };

  // Triggers jellyfish search
  const startSearch = (searchtxt) => {
    // const jellyResults = jellies.filter(jelly => jelly.wish.includes(searchtxt));
    // if(jellyResults.length < 0) return;
    const jelliesToRemove = jellies.filter(jelly => !jelly.wish.includes(searchtxt));
    const jelliesToAdd = jellies.filter(jelly => jelly.wish.includes(searchtxt));

    controls.target = new THREE.Vector3(0, 0, 0);
    controls.update();

    jelliesToRemove.forEach((jelly) => scene.remove(jelly.jellyParent));
    jelliesToAdd.forEach((jelly) => {
      if(!scene.children.includes(jelly.jellyParent)) scene.add(jelly.jellyParent);
    });

    // set camera back to original position and focus
    camera.position.set(500, 500, camZoom);
    controls.target = new THREE.Vector3(0, 0, 0);
    controls.update();
    hideWishText();

    const x = document.querySelector("#searchJelly");
    if(x.style.display === "block") x.style.display = "none";
  };
  
  // Listen for search button click
  document.querySelector('#startSearchButton').addEventListener('click', () => startSearch(document.querySelector('#searchtxt').value));

  // Hide search banner and get rid of search filter when back button clicked
  document.querySelector('#backbutton').addEventListener('click', () => {
    document.getElementById("bannerBar").style.display = "none";
    startSearch("");
  });

  // Listen for right click event and stop following jelly
  document.querySelector('#app').addEventListener('contextmenu', hideWishText);

  // Add light to scene
  const light = new THREE.PointLight(0xffffff, 1); // point light attached to camera
	camera.add(light);

  // Add particles to scene
  createParticleSystem(scene);

  // Listen for window resize and update renderer accordingly
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // Listen to click events on jellyfish
  document.querySelector('#app').addEventListener('pointerdown', (e) => onDocumentMouseDown(e, renderer, camera, scene), false);

  // Load wishes from database and generate jellies
  loadWishes(dbRef, scene, loader);

  // Add bloom, film grain effects
  const renderScene = new RenderPass(scene, camera);

	const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
	bloomPass.threshold = 0;
	bloomPass.strength = 1.5;
	bloomPass.radius = 0.5;

  const filmPass = new FilmPass(
		0.15,   // noise intensity
		0.025,  // scanline intensity
		0,    // scanline count
		false,  // grayscale
	);
	filmPass.renderToScreen = true;

	const composer = new EffectComposer(renderer);
	composer.addPass(renderScene);
	composer.addPass(bloomPass);
  composer.addPass(filmPass);

  // Begin animation
  const clock = new THREE.Clock();
  animate(composer, scene, camera, clock);
};

// Loops through to animate
const animate = (renderer, scene, camera, clock) => {
  const delta = clock.getDelta();

  requestAnimationFrame(() => animate(renderer, scene, camera, clock));


  // Make jellies move around, make them turn around if they hit walls
  for(let i = 0; i < jellies.length; i++) {
    const jelly = jellies[i].jellyParent;

    // testing out random movement
    jelly.rotateX((Math.PI / 1000) * Math.random());
    jelly.rotateZ((Math.PI / 1000) * Math.random());

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
    // controls.target = new THREE.Vector3(currentJellyTarget.position.x, currentJellyTarget.position.y, currentJellyTarget.position.z);
    
    //Update Camera Tween

    

  }

  TWEEN.update();
  controls.update();
  
  // Rerender scene
  renderer.render(delta);
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
    jellyClicked(intersects[0].object.parent);
  }
};

// Switches camera controls to follow a jellyfish on click and display wish
const jellyClicked = (jelly) => {
  //makes the wish box appear with all item of wish text
  const wishBox = document.querySelector('#wishtxtbox');
  const wishText = document.querySelector('#wishText');
  wishText.innerHTML = jelly.userData.wish;
  wishText.style.display = 'block';
  wishBox.style.display = 'block';

  // controls.target = new THREE.Vector3(jelly.position.x, jelly.position.y, jelly.position.z);

  // Tweens between the old camera position, and one surrounding the clicked jelly
  var orbitTarget = new THREE.Vector3(jelly.position.x, jelly.position.y, jelly.position.z);

  cameraTween = new TWEEN.Tween(controls)
  .to({'target': orbitTarget}, 2000)
  .easing(Easing.Circular.InOut)
  .start();

  if(currentJellyTarget != jelly) {
    // Dolly zoom into jelly and update controls
    controls.dIn(0.3);
    controls.update();
  }

  currentJellyTarget = jelly;
  isCameraFollowingJelly = true;

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

  const texture = loader.load("uv-lines.png");
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
  jellySubMesh.scale.set(0.98, 0.65, 0.98);

  // Create parent to hold jelly so we can change position without changing local coordinates
  const parent = new THREE.Object3D();
  parent.position.set(randomNum(-200, 200), randomNum(-200, 200), randomNum(-200, 200));
  parent.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
  parent.userData.wish = string;

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
    a: 0,
    wish: string
  });
};

const createParticleSystem = (scene) => {
	const geometry = new THREE.BufferGeometry();

	const N = 1000;
	// const vertices = new Float32Array(
	//   [...Array(N)].map((_) => Math.random()*2-1)
	// );
	const vertices = new Float32Array(N);
	let c = 0;
	while (c < N) {
	  // const u = Math.random() * 2 - 1,
	  //   a = Math.random() * 2 * 3.14,
	  //   x = Math.sqrt(1 - u * u) * Math.cos(a),
	  //   y = Math.sqrt(1 - u * u) * Math.sin(a),
	  //   z = u
	  const theta = Math.random() * 2 * Math.PI,
		phi = Math.acos(2 * Math.random() - 1),
		r = Math.pow(Math.random(), 1 / 3),
		x = r * Math.sin(phi) * Math.cos(theta),
		y = r * Math.sin(phi) * Math.sin(theta),
		z = r * Math.cos(phi);
	
	  vertices[c] = x;
	  vertices[c + 1] = y;
	  vertices[c + 2] = z;
	  c += 3;
	}
	geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
	
	const shaderMaterial = new THREE.ShaderMaterial({
	  uniforms: {},
	  vertexShader: vertexShader,
	  fragmentShader: fragmentShader,
	  transparent: true,
	  depthWrite: false
	  //https://threejs.org/docs/#api/en/constants/CustomBlendingEquations
	});
	
	particles = new THREE.Points(geometry, shaderMaterial);
	particles.scale.set(500, 500, 500);
	scene.add(particles);
	particles.rotation.z = -0.5;
};

// Get random num between min and max
const randomNum = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

// Gets stored userID, or if none exists, generates new one, stores in local storage, and returns new ID
const getUserID = () => {
  let userID = localStorage.getItem('prism-wishful-user');
  if(!userID) {
    userID = `user-${Date.now()}-${Math.floor(Math.random() * 999)}`;
    localStorage.setItem('prism-wishful-user', userID);
  }
  return userID;
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

// Loads all wishes in database and generates jellies for them if they are approved or owned by user
const loadWishes = (dbRef, scene, loader) => {
  const userID = getUserID();
  dbRef.on('child_added', (data) => {
    const wishObj = data.val();
    if((wishObj.approved == undefined && wishObj.userID !== userID) || wishObj.approved == false) return;
    generateJelly(wishObj.wish, scene, loader);
    document.querySelector("#numWishes").innerHTML = jellies.length;
  });
};

// Calls init function once DOM finishes loading
window.onload = () => {
  init();
};
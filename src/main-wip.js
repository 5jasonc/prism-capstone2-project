'use strict';

// ES6 MODULE IMPORTS
import * as THREE from '../build/three.module.js';
import * as TWEEN from '../build/tween.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { FilmPass } from './jsm/postprocessing/FilmPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { Water } from './jsm/objects/Water.js';
import { Sky } from './jsm/objects/Sky.js';

import {
    vertexShader, fragmentShader, firebaseConfig,
    changeStyleSource, updateWishSearchText, toggleSearchUI, hideSearchUI, toggleTempWishUI, hideWishText,
    showGalleryPage, hideGalleryPage, showWelcomePage, hideWelcomePage, showMakeWishPage, hidewMakeWishPage,
    getUserID, hashFunc, mapNumToRange, randomNum, shiftRight
} from './utils.js';

// VARIABLES TO TRACK OBJECTS IN SCENE
const jellies = [];
let dbRef;
let camera, scene, loader, renderer, controls;
let water;
let particles;
let bloomPass, filmPass;

// VARIABLES TO TRACK STATE AND DATA FOR SCENE
let currentScene;
let isCameraFollowingJelly = false;
let currentJellyTarget = null;
let isCameraAnimating = false;
let camZoom = 1000;

// LOADS THREE.JS SCENE AND SHARED RESOURCES BETWEEN PAGES
const init = () => {
    document.querySelector('#welcomescreen').style.display = 'none'; // start by hiding welcome page

    // Connect to FireBase
    firebase.initializeApp(firebaseConfig);
    dbRef = firebase.database().ref('/wishes/');

    // Load three.js scene and resources
    const canvas = document.querySelector('#app');
    loader = new THREE.TextureLoader();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth  / window.innerHeight, 0.1, 20000);
    const light = new THREE.PointLight(0xffffff, 1);
    camera.position.set(500, 500, camZoom);
    camera.add(light);
    renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true}); // antialias T or F, which looks better?
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    // renderer.setClearColor(0x000000, 0); // not sure if we will need this
    // renderer.toneMapping = THREE.ReinhardToneMapping; // look better with this?
    renderer.NoToneMapping = THREE.ACESFilmicToneMapping;
    const renderScene = new RenderPass(scene, camera);
	bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    filmPass = new FilmPass(0.15, 0.025, 0, false);
    bloomPass.threshold = 0;
	bloomPass.strength = 1.5;
	bloomPass.radius = 0.5;
    filmPass.renderToScreen = true;
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
	composer.addPass(bloomPass);
    composer.addPass(filmPass);

    // Set up orbit camera controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
	controls.listenToKeyEvents(window);
      
    // Listen for events
    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });
    document.querySelector('#searchButton').addEventListener('click', toggleSearchUI);
    document.querySelector('#cancelbtn').addEventListener('click', hideSearchUI);
    document.querySelector('#addJellyButton').addEventListener('click', toggleTempWishUI);
    document.querySelector('#makeWishButton').addEventListener('click', () => makeWish());
    document.querySelector('#searchtxt').addEventListener('input', (e) => updateWishSearchText(e, jellies));
    document.querySelector('#startSearchButton').addEventListener('click', () => startSearch(document.querySelector('#searchtxt').value));
    document.querySelector('#backbutton').addEventListener('click', () => {
        document.getElementById('bannerBar').style.display = 'none';
        startSearch('');
    });
    canvas.addEventListener('contextmenu', () => {
        isCameraFollowingJelly = false;
        hideWishText();
    });
    canvas.addEventListener('pointerdown', (e) => sceneClicked(e), false);

    // Listen for page transitions on each link to page with three scene
    document.querySelector('#welcomePageLink').addEventListener('click', () => switchScene('welcomePage', currentScene === 'galleryPage' ? 'up' : 'down'));
    document.querySelector('#welcomePageLogoLink').addEventListener('click', () => switchScene('welcomePage', currentScene === 'galleryPage' ? 'up' : 'down'));
    document.querySelector('#galleryPageLink').addEventListener('click', () => switchScene('galleryPage', 'down'));

    // Add canvas to page and objects to scene
    document.body.appendChild(renderer.domElement);
    scene.add(camera);
    
    // Start by loading galleryPage, as those are elements not hidden at top of init
    loadGalleryPage();

    // Create particle system
    createParticleSystem(scene);

    // Begin animation
    const clock = new THREE.Clock();
    animate(composer, clock);
};

// Loops through to animate
const animate = (renderer, clock) => {
    const delta = clock.getDelta();
    requestAnimationFrame(() => animate(renderer, clock));
  
    // Make jellies move around, make them turn around if they hit walls
    for(let i = 0; i < jellies.length; i++) {
        if(isCameraAnimating && jellies[i].jellyParent === currentJellyTarget) continue;
        const jelly = jellies[i].jellyParent;
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
  
    // Make jellies pulsate through geometry transforms
    for(let j = 0; j < jellies.length; j++) {
        const currentJelly = jellies[j];
        const position = currentJelly.jellyMesh.geometry.attributes.position;
        const vector = new THREE.Vector3();
        //loops through points within jelly
        for(let pointIndex = 0; pointIndex < position.count; pointIndex++){
            vector.fromBufferAttribute(position, pointIndex);
            vector.applyMatrix4(currentJelly.jellyMesh.matrix);
            let size = 12;
            let magnitude = 7;
            let dist = new THREE.Vector3(vector.x, vector.y, vector.z).sub(new THREE.Vector3(0, 1000, 0));
            vector.normalize();
            vector.multiplyScalar(40 + Math.sin(dist.length() / -size + currentJelly.a) * magnitude);
            position.setXYZ(pointIndex, vector.x, vector.y, vector.z);
        }
        //update jellyfish mesh
        position.needsUpdate = true;

        for ( let lineIndex = 0; lineIndex < currentJelly.jellyWidthSegments+1; lineIndex ++ ){
            const temppoints = [];
            const positions = currentJelly.lines[lineIndex].geometry.attributes.position.array;
    
            for(let jIndex=currentJelly.jellyWidthSegments; jIndex<(currentJelly.jellyWidthSegments*currentJelly.jellyHeightSegments); jIndex+=(currentJelly.jellyWidthSegments+1)){    
                var vec = new THREE.Vector3();
                vec.fromBufferAttribute(position, lineIndex+jIndex)
                temppoints.push(vec);
            }
    
            for(let k=0; k<temppoints.length; k++){
    
                let point = temppoints[k];
    
                shiftRight(positions, point.z);
                shiftRight(positions, point.y);
                shiftRight(positions, point.x);
            }
            currentJelly.lines[lineIndex].geometry.attributes.position.needsUpdate = true; // required after the first render

        }

        currentJelly.jellyMesh.geometry.verticesNeedUpdate = true;
        currentJelly.jellyMesh.geometry.normalsNeedUpdate = true;
        currentJelly.jellyMesh.geometry.computeVertexNormals();
        currentJelly.jellyMesh.geometry.computeFaceNormals();
        currentJelly.a += currentJelly.aStep;

        currentJelly.jellyMesh.geometry.scale(1.15, 1.15, 1.15);
    }
  
    // If camera is focused on jelly, move camera
    if(isCameraFollowingJelly && currentScene === 'galleryPage') {
        controls.target = new THREE.Vector3(currentJellyTarget.position.x, currentJellyTarget.position.y, currentJellyTarget.position.z);
    }

    // Animate ocean in welcome scene
    if(currentScene === 'welcomePage') water.material.uniforms['time'].value += 1.0 / 60.0;
    
    // Update tween and orbit controls each frame
    TWEEN.update();
    if(!isCameraAnimating && controls.enabled) controls.update();
    
    // Re-render scene
    renderer.render(delta);
};

// Loads scene with given string, currently supported scenes are welcome page and gallery page, moves camera with transition w/ given direction
const switchScene = (newScene, cameraDirection = 'up') => {
    hideWishText();
    document.querySelector('#checked').checked = false;
    if(newScene === currentScene) return;   // cancel if trying to switch to already current scene

    controls.enabled = false;
    isCameraAnimating = true;

    let newPos;
    switch(newScene) {
        case 'galleryPage':
            newPos = new THREE.Vector3(500, 500, camZoom);  // galleryPage start point
            break;
        case 'welcomePage':
            newPos = new THREE.Vector3(0, 10, 10); // welcomePage start point
            break;
        case 'makeWishPage':
            newPos = new THREE.Vector3(0, 0.5, 5); // makeWishPage start point
            break;
    }

    let cameraMovement;
    if(cameraDirection === 'up') {
        cameraMovement = 3000;
    } else {
        cameraMovement = -3000;
    }

    const unloadScene = () => {
        switch(currentScene) {
            case 'galleryPage':
                hideGalleryPage();
                unloadGalleryPage();
                break;
            case 'welcomePage':
                hideWelcomePage();
                unloadWelcomePage();
                break;
            case 'makeWishPage':
                hidewMakeWishPage();
                unloadMakeWishPage();
                break;
        }
    };

    const loadScene = () => {
        switch(newScene) {
            case 'galleryPage':
                loadGalleryPage();
                showGalleryPage();
                break;
            case 'welcomePage':
                loadWelcomePage();
                // showWelcomePage(); <-- IF THIS IS NOT COMMENTED OUT WELCOME PAGE CSS ELEMENTS BLOCK THREEJS CANVAS
                break;
            case 'makeWishPage':
                loadMakeWishPage();
                showMakeWishPage();
                break;
        }
    };

    const setControlsTarget = () => {
        switch(newScene) {
            case 'galleryPage':
            case 'makeWishPage':
                controls.target.set(0, 0, 0);
                break;
            case 'welcomePage':
                controls.target.set(0, 10, 0);
                break;
        }
        controls.update();
    };

    // Plays camera animation to go direction required offscreen
    // Then moves camera below or above default camera pos in new scene and moves to default pos based on direction
    new TWEEN.Tween(camera)
        .to({'position': new THREE.Vector3(camera.position.x, camera.position.y + cameraMovement, camera.position.z)}, 1000)
        .easing(TWEEN.Easing.Circular.InOut)
        .onUpdate(() => camera.updateProjectionMatrix())
        .onComplete(() => {
            unloadScene();
            camera.position.set(newPos.x, newPos.y, newPos.z);
            setControlsTarget();
            camera.position.set(camera.position.x, camera.position.y - cameraMovement, camera.position.z);
            loadScene();
            new TWEEN.Tween(camera)
                .to({'position': newPos}, 1000)
                .easing(TWEEN.Easing.Circular.InOut)
                .onUpdate(() => camera.updateProjectionMatrix())
                .onComplete(() => isCameraAnimating = false)
                .start();
        })
        .start();
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

// Generates a jellyfish based on the specified string (wish)
const generateJelly = (string) => {
    const jellyCode = hashFunc(string);
    const jellyWidthSegments = Math.round(mapNumToRange(jellyCode[0], 1, 9, 5, 11));
    const jellyHeightSegments = Math.round(mapNumToRange(jellyCode[1], 0, 9, 3, 8));
    const jellyColor = Math.floor(mapNumToRange(jellyCode.substring(2, 4), 0, 99, 0.1, 0.9) * 16777215).toString(16);
    const jellyAnimSpeed = mapNumToRange(jellyCode[4], 0, 9, 0.01, 0.09);
    const jellyGeometery = new THREE.SphereGeometry(15, jellyWidthSegments, jellyHeightSegments, 0, 6.283, 0, 1.7);
    
    const outerMaterial = new THREE.MeshMatcapMaterial({
        color: `#${jellyColor}`,
        transparent: true,
        opacity: 0.45,
        depthWrite: false
    })
    outerMaterial.side = THREE.DoubleSide;

    const lineMat = new THREE.LineBasicMaterial({color:0xffffff, transparent: true, opacity: 0.25})

    const jellyMesh = new THREE.Mesh(jellyGeometery, outerMaterial);
    const vertex = jellyMesh.geometry.attributes.position;
    const lines = [];

    for ( let i = 0; i < jellyWidthSegments+1; i ++ ){

        const temppoints = [];

        let MAX_POINTS = jellyHeightSegments+1;
        const linegeo = new THREE.BufferGeometry();
        const positions = new Float32Array( MAX_POINTS * 3 ); // 3 vertices per point
        linegeo.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

        for(let j=jellyWidthSegments; j<(jellyWidthSegments*jellyHeightSegments); j+=(jellyWidthSegments+1)){
            var vec = new THREE.Vector3();
            vec.fromBufferAttribute(vertex, i+j)
            temppoints.push(vec);
        }

        for(let k=0; k<temppoints.length; k++){
            let point = temppoints[k];
            shiftRight(positions, point.z);
            shiftRight(positions, point.y);
            shiftRight(positions, point.x);
        }
        const lineMat = new THREE.LineBasicMaterial({color:0xffffff, transparent: true, opacity: 0.25})
        lines.push( new THREE.Line( linegeo, lineMat));
    }

    const parent = new THREE.Object3D();
    parent.position.set(randomNum(-200, 200), randomNum(-200, 200), randomNum(-200, 200));
    parent.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
    parent.userData.wish = string;
  
    parent.add(jellyMesh);
    for(let i=0; i<lines.length; i++){
		jellyMesh.add(lines[i]);
        lines[i].geometry.attributes.position.needsUpdate = true;
	}
    scene.add(parent);

    jellies.push({jellyMesh, lines, jellyParent: parent, aStep: jellyAnimSpeed, a: 0, wish: string, jellyWidthSegments: jellyWidthSegments, jellyHeightSegments: jellyHeightSegments});
};

// When screen is clicked detect if jellyfish is clicked, call jellyClicked if true
const sceneClicked = (e) => {
    e.preventDefault();
    if(currentScene !== 'galleryPage') return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;
  
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
  
    if(intersects.length > 0) jellyClicked(intersects[0].object.parent);
};

// When jelly is clicked, move camera to new jelly, zoom in, and start following it
const jellyClicked = (jelly) => {
    if(currentJellyTarget === jelly) return;
    currentJellyTarget = jelly;
    isCameraAnimating = true;

    const wishBox = document.querySelector('#wishtxtbox');
    const wishText = document.querySelector('#wishText');
    wishText.innerHTML = jelly.userData.wish;
    wishText.style.display = 'block';
    wishBox.style.display = 'block';
    const orbitTarget = new THREE.Vector3(jelly.position.x, jelly.position.y, jelly.position.z);
  
    new TWEEN.Tween(controls)
        .to({'target': orbitTarget}, 1000)
        .easing(TWEEN.Easing.Circular.InOut)
        .onUpdate(() => controls.update())
        .onComplete(() => {
            isCameraAnimating = false;
            isCameraFollowingJelly = true
            // Experimenting with zoom transition next
            // new TWEEN.Tween(camera)
            //     .to({'fov': 10}, 1000)
            //     .easing(TWEEN.Easing.Circular.InOut)
            //     .onUpdate(() => camera.updateProjectionMatrix())
            //     .start();
        })
        .start();
};

// Loads all wishes in database and generates jellies for them if they are approved or owned by user
const loadWishes = () => {
    const userID = getUserID();
    dbRef.on('child_added', (data) => {
        const wishObj = data.val();
        if((wishObj.approved === undefined && wishObj.userID !== userID) || wishObj.approved === false) return;
        generateJelly(wishObj.wish);
        document.querySelector('#numWishes').innerHTML = jellies.length;
    });
};

// Checks wish is valid, if it is then adds wish to database and follows new jelly
const makeWish = () => {
    const wish = document.querySelector('#wishInput').value;
    if(wish.trim() === '') {
        document.querySelector('#errorText').innerHTML = `Wish can't be empty!`;
        return;
    }

    $.ajax({
        url: `https://www.purgomalum.com/service/containsprofanity?text=${wish.trim()}`
    }).then((isWishBad) => {
        if(isWishBad === 'true') {
            document.querySelector('#errorText').innerHTML = 'Wish is not valid! Watch your language!';
            return;
        }
        document.querySelector('#errorText').innerHTML = '';
        dbRef.push({wish: document.querySelector('#wishInput').value, approved: null, userID: getUserID()});
        jellyClicked(jellies[jellies.length - 1].jellyParent, controls, camera);
        document.querySelector('#addJellyButton').click();
    });
};

// Triggers jellyfish search
const startSearch = (searchtxt) => {
    const jelliesToRemove = jellies.filter(jelly => !jelly.wish.includes(searchtxt));
    const jelliesToAdd = jellies.filter(jelly => jelly.wish.includes(searchtxt));
    jelliesToRemove.forEach((jelly) => scene.remove(jelly.jellyParent));
    jelliesToAdd.forEach((jelly) => {
        if(!scene.children.includes(jelly.jellyParent)) scene.add(jelly.jellyParent);
    });

    camera.position.set(500, 500, camZoom);
    controls.target = new THREE.Vector3(0, 0, 0);
    controls.update();

    isCameraFollowingJelly = false;
    hideWishText();
    hideSearchUI();
};

// Loads all elements in three js scene for gallery page
const loadGalleryPage = () => {
    bloomPass.threshold = 0;
    controls.enabled = true;
    isCameraFollowingJelly = false;
    currentJellyTarget = null;
    loadWishes();
    currentScene = 'galleryPage';
    $('.settings').css('width', '364px');
    $('.search').fadeIn();
};

// Unload all elements in gallery page
const unloadGalleryPage = () => {
    $('.gaugeMeter').fadeIn();
    clearScene();
    jellies.splice(0, jellies.length);
};

// Loads all elements in three js scene for welcome page
const loadWelcomePage = () => {
    $('.gaugeMeter').fadeIn();
    $('.settings').css('width', '164px');

    bloomPass.threshold = 9;

    const light = new THREE.DirectionalLight(0xffffff);
	light.position.set(0, 0, 10.10);
	scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff));

    const sun = new THREE.Vector3();
    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    water = new Water(waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: loader.load('waternormals.jpeg', function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x5499d1,
            distortionScale: 6,
            fog: scene.fog !== undefined
        }
	);

    water.rotation.x = -Math.PI / 2;
	scene.add(water);

    const sky = new Sky();
	sky.scale.setScalar(10000);
	scene.add(sky);

	const skyUniforms = sky.material.uniforms;
	skyUniforms['turbidity'].value = 20;
	skyUniforms['rayleigh'].value = 0.036;
	skyUniforms['mieCoefficient'].value = 0;
	skyUniforms['mieDirectionalG'].value = 1;

	const parameters = {inclination: 0.4857, azimuth: 0.252, exposure: 0.1389};
    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    const updateSun = () => {
        const theta = Math.PI * (parameters.inclination - 0.5);
        const phi = 2 * Math.PI * (parameters.azimuth - 0.5);

        sun.x = Math.cos(phi);
        sun.y = Math.sin(phi) * Math.sin(theta);
        sun.z = Math.sin(phi) * Math.cos(theta);

        sky.material.uniforms['sunPosition'].value.copy(sun);
        water.material.uniforms['sunDirection'].value.copy(sun).normalize();

        scene.environment = pmremGenerator.fromScene(sky).texture;
	};

    updateSun();
    currentScene = 'welcomePage';
    $('.gaugeMeter').fadeOut();
};

const unloadWelcomePage = () => {
    clearScene();
};

// Load all objects in three js scene for make wish page
const loadMakeWishPage = () => {
    $('.settings').css('width', '164px');
    for(let i = 1; i < 1200; i++) {
        const geometry = new THREE.SphereGeometry(0.02 * randomNum(0.5, 1), 6, 6);
        const material = new THREE.MeshBasicMaterial({
          opacity: true,
          color: new THREE.Color(1, randomNum(190, 220) / 255, Math.round(Math.random()))
        });
    
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.setFromSpherical(new THREE.Spherical(5 + 5 * Math.random(), 2 * Math.PI * Math.random(), 2 * Math.PI * Math.random()));
        scene.add(sphere);      
    }
    currentScene = 'makeWishPage';
};

const unloadMakeWishPage = () => {
    clearScene();
};

// Remove all objects in three js scene
const clearScene = () => {
    for(let i = scene.children.length - 1; i >= 0; i--) {
        const obj = scene.children[i];
        if(obj.type === 'PerspectiveCamera') continue;
        scene.remove(obj);
    }
};

window.onload = init;
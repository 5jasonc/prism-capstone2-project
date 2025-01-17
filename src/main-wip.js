'use strict';

// ES6 MODULE IMPORTS
import * as THREE from '../build/three.module.js';
import * as TWEEN from '../build/tween.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { Water } from './jsm/objects/Water.js';
import { Sky } from './jsm/objects/Sky.js';

import {
    vertexShader, fragmentShader, bgVertexShader, bgFragmentShader, firebaseConfig,
    changeStyleSource, updateSearchText, updateSearchBanner, toggleSearchUI, hideSearchUI, toggleTempWishUI, hideWishText,
    showGalleryPage, hideGalleryPage, showWelcomePage, hideWelcomePage, showMakeWishPage, hidewMakeWishPage,
    getUserID, hashFunc, mapNumToRange, hideWishCursor, randomNum, shiftRight, animateValue, detectMob, showWishEntry, genWishID, isWishOnlyValidChars
} from './utils.js';

// VARIABLES TO TRACK OBJECTS IN SCENE
const jellies = [];
const movers = []; // will hold shooting stars
let dbRef;
let camera, scene, loader, renderer, controls;
let water;
let plane, intersects, a;
var MASS_FACTOR = .01; // for display of size
let intervalID;
let particles;
let bloomPass;

// VARIABLES TO TRACK STATE AND DATA FOR SCENE
let currentScene;
let clicking = false;
let isCameraFollowingJelly = false;
let currentJellyTarget = null;
let isCameraAnimating = false;
let isStarSelected = false;
let transitionTargetWishID = null;
let camZoom = null;
let totalWishes = 0;
let jellyRange = null;
let shareModeOn = false;

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
    scene.fog = new THREE.Fog(0x040742, 0, 1500);
    camera = new THREE.PerspectiveCamera(60, window.innerWidth  / window.innerHeight, 0.1, 20000);
    const light = new THREE.PointLight(0xffffff, 1);
    camera.add(light);
    renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true}); // antialias T or F, which looks better?
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    const renderScene = new RenderPass(scene, camera);
    renderScene.renderToScreen = false;
	bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.5;
	bloomPass.strength = 1;
	bloomPass.radius = 0.5;
    bloomPass.renderToScreen = true;
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
	composer.addPass(bloomPass);

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
    document.querySelector('#makeWishButton').addEventListener('click', () => makeWish());
    document.querySelector('#searchtxt').addEventListener('input', (e) => updateSearchText(e.target.value, jellies));
    document.querySelector('#startSearchButton').addEventListener('click', () => {
        updateSearchBanner(document.querySelector('#searchtxt').value, jellies);
        startSearch(document.querySelector('#searchtxt').value);
    });
    document.querySelector('#backbutton').addEventListener('click', () => {
        document.getElementById('bannerBar').style.display = 'none';
        startSearch('');
    });
    document.querySelector('#farView').addEventListener('click', () => {
        isCameraFollowingJelly = false;
        //currentJellyTarget = null;
        isCameraAnimating = true;
        new TWEEN.Tween(controls)
        .to({'target': new THREE.Vector3(0, 0, 0)}, 1000)
        .easing(TWEEN.Easing.Circular.InOut)
        .onUpdate(() => controls.update())
        .onComplete(() => {
            isCameraAnimating = false;
            controls.maxDistance =  jellyRange * 1.75;
        })
        .start();
        hideWishText();
    });
    document.querySelector('#shareJellyBtn').addEventListener('click', () => {
        const wish = jellies.find(j => j.jellyParent === currentJellyTarget).wish;
        const encodedWish = $.param({wish});
        console.log(encodedWish);
        document.querySelector('#shareLink').setAttribute('href', `jelly.html?${encodedWish}`);
        shareModeOn = true;
    });
    document.querySelector('#Exit').addEventListener('click', () => shareModeOn = false);
    canvas.addEventListener('pointerdown', (e) => sceneClicked(e), false);

    // Listen for page transitions on each link to page with three scene
    document.querySelector('#welcomePageLink').addEventListener('click', () => switchScene('welcomePage', currentScene === 'galleryPage' ? 'up' : 'down'));
    document.querySelector('#galleryPageLink').addEventListener('click', () => switchScene('galleryPage', 'down'));
    document.querySelector('#welcomePageLogoLink').addEventListener('click', () => switchScene('welcomePage', currentScene === 'galleryPage' ? 'up' : 'down'));
    document.querySelector('#wishfultxtsvg').addEventListener('click', () => switchScene('makeWishPage', 'up'));
    document.querySelector('#addJellyButton').addEventListener('click', () => switchScene('makeWishPage', 'up'));
    

    // Add canvas to page and objects to scene
    document.body.appendChild(renderer.domElement);
    
    // Start by loading galleryPage, as those are elements not hidden at top of init
    dbRef.once('value', (data) => {
        for(const wish in data.val()) {
            if(data.val()[wish].approved) totalWishes++;
        }
        jellyRange = Math.cbrt(totalWishes) * 150;
        camZoom = jellyRange * 2 + 50;
        camera.position.set(500, 500, camZoom);
        controls.maxDistance = jellyRange * 1.75;
        scene.add(camera);
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        if(urlParams.get('scene')) {
            if(urlParams.get('scene') === 'galleryPage') loadGalleryPage();
            else {
                hideGalleryPage();
                switchScene(urlParams.get('scene'), 'up');
            }
        }
        else {
            hideGalleryPage();
            switchScene('welcomePage', 'up');
        }
    });

    // Begin animation
    const clock = new THREE.Clock();
    animate(composer, clock);
};

// Loops through to animate
const animate = (renderer, clock) => {
    const delta = clock.getDelta();
    requestAnimationFrame(() => animate(renderer, clock));
  
    // Make jellies move around, make them turn around if they hit walls or target jelly
    for(let i = 0; i < jellies.length; i++) {
        const jelly = jellies[i].jellyParent;
        // let moveJelly = true;

        if((isCameraAnimating && jelly === currentJellyTarget) || !!jelly.isJellyTurning) continue;

        if (jelly.position.x < -jellyRange || jelly.position.x > jellyRange ||
            jelly.position.y < -jellyRange || jelly.position.y > jellyRange ||
            jelly.position.z < -jellyRange || jelly.position.z > jellyRange
        ) {
            jelly.position.x = THREE.Math.clamp(jelly.position.x, -jellyRange, jellyRange);
            jelly.position.y = THREE.Math.clamp(jelly.position.y, -jellyRange, jellyRange);
            jelly.position.z = THREE.Math.clamp(jelly.position.z, -jellyRange, jellyRange);

            jelly.isJellyTurning = true;
            if(jelly.rotation.x < 0.5 || jelly.rotation.z < 0.5) {
                new TWEEN.Tween(jelly.rotation)
                    .to({'x': jelly.rotation.x + (Math.random() * Math.PI / 4), 'y': jelly.rotation.y + (Math.random() * Math.PI / 4), 'z': jelly.rotation.z + (Math.random() * Math.PI / 4)}, 1000)
                    .easing(TWEEN.Easing.Circular.InOut)
                    .onComplete(() => {
                        if(!jellies[i]) return;
                        jelly.translateY(jellies[i].aStep * 2 + 0.3);
                        jelly.isJellyTurning = false;
                    })
                    .start();
            }
            else if(jelly.rotation.x > jelly.rotation.z) {
                new TWEEN.Tween(jelly.rotation)
                    .to({'x': -jelly.rotation.x / 2}, 1000)
                    .easing(TWEEN.Easing.Circular.InOut)
                    .onComplete(() => {
                        if(!jellies[i]) return;
                        jelly.translateY(jellies[i].aStep * 2 + 0.3);
                        jelly.isJellyTurning = false;
                    })
                    .start();
            } else {
                new TWEEN.Tween(jelly.rotation)
                    .to({'z': -jelly.rotation.z / 2}, 1000)
                    .easing(TWEEN.Easing.Circular.InOut)
                    .onComplete(() => {
                        if(!jellies[i]) return;
                        jelly.translateY(jellies[i].aStep * 2 + 0.3);
                        jelly.isJellyTurning = false;
                    })
                    .start();
            }
            continue;
        }
        else {
            // EXPERIMENTING WITH FLOCKING BEHAVIORS
            let approachingJelly = false;
            // for(const j of jellies) {
            //     // if(jelly.position.distanceTo(j.jellyParent.position) < 20) {
            //     //     approachingJelly = true;
            //     //     j.jellyParent.rotateY(-Math.PI / 500);
            //     //     j.jellyParent.rotateX(-Math.PI / 500);
            //     //     j.jellyParent.rotateZ(-Math.PI / 500);
            //     // }
            // }
            // if(approachingJelly) {
            //     jelly.rotateY(Math.PI / 500);
            //     jelly.rotateX(Math.PI / 500);
            //     jelly.rotateZ(Math.PI / 500);
            // } else {
                // How jelly moves when not close to another jelly
                jelly.rotateX((Math.PI / 1000) * Math.random());
                jelly.rotateZ((Math.PI / 1000) * Math.random());
            // }
        }
        if(shareModeOn === false) jelly.translateY(jellies[i].aStep * 2 + 0.3);
        // OLD COLLISION DETECTION MIGHT STILL USE
        // else if (
        //     isCameraFollowingJelly &&
        //     ((jelly.position.x + 30 > currentJellyTarget.position.x - 30 && jelly.position.x + 30 < currentJellyTarget.position.x + 30) ||
        //     (jelly.position.x - 30 < currentJellyTarget.position.x + 30 && jelly.position.x - 30 > currentJellyTarget.position.x - 30)) &&
        //     ((jelly.position.y + 30 > currentJellyTarget.position.y - 30 && jelly.position.y + 30 < currentJellyTarget.position.y + 30) ||
        //     (jelly.position.y - 30 < currentJellyTarget.position.y + 30 && jelly.position.y - 30 > currentJellyTarget.position.y - 30)) &&
        //     ((jelly.position.z + 30 > currentJellyTarget.position.z - 30 && jelly.position.z + 30 < currentJellyTarget.position.z + 30) ||
        //     (jelly.position.z - 30 < currentJellyTarget.position.z + 30 && jelly.position.z - 30 > currentJellyTarget.position.z - 30))
        // ) {
        // EXPERIMENTING WITH NOT ALLOWING JELLIES TO TOUCH TARGET
        // if(isCameraFollowingJelly && currentJellyTarget !== jelly && jelly.position.distanceTo(currentJellyTarget.position) < 30 ) continue;
    }
  
    // Make jellies pulsate through geometry transforms
    for(let j = 0; j < jellies.length; j++) {
        
        const currentJelly = jellies[j];
        const position = currentJelly.jellyMesh.geometry.attributes.position;
        const vector = new THREE.Vector3();
        //loops through points within jelly

        // Change opacity if selected or if share mode is activated
        if(shareModeOn && isCameraFollowingJelly) {
            currentJelly.jellyMesh.material.opacity = 0;
            currentJelly.lines.forEach(line => line.material.opacity = 0);
        } else if(isCameraFollowingJelly) {
            currentJelly.jellyMesh.material.opacity = 0.15;
            currentJelly.lines.forEach(line => line.material.opacity = 0.15);
        } else {
            currentJelly.jellyMesh.material.opacity = 0.45;
            currentJelly.lines.forEach(line => line.material.opacity = 0.45);
        }
        if(currentJellyTarget !== null) {
            currentJellyTarget.children[0].material.opacity = 0.45;
            if(currentJelly.jellyParent === currentJellyTarget) currentJelly.lines.forEach((line) => line.material.opacity = 0.45);
        }

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
            let positions = currentJelly.lines[lineIndex].geometry.attributes.position.array;
            //positions = new Float32Array(currentJelly.jellyHeightSegments+1 *3 );
    
            for(let jIndex=currentJelly.jellyWidthSegments+1; jIndex<(currentJelly.jellyWidthSegments*currentJelly.jellyHeightSegments); jIndex+=(currentJelly.jellyWidthSegments+1)){    
                var vec = new THREE.Vector3();
                vec.fromBufferAttribute(position, lineIndex+jIndex)
                temppoints.push(vec);
            }
    
            for(let k=0; k<currentJelly.jellyHeightSegments+1; k++){
                let point = temppoints[k];
                if(temppoints[k] !== undefined) {
                    shiftRight(positions, point.z);
                    shiftRight(positions, point.y);
                    shiftRight(positions, point.x);
                    // positions[k] = point.x;
                    // positions[k + 1] = point.y;
                    // positions[k + 2] = point.z;
                }    
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
    
    // Calculate and animate shooting stars in wish scene
    if(currentScene === 'makeWishPage') attractStar();

    // Update tween and orbit controls each frame
    TWEEN.update();
    if(!isCameraAnimating && controls.enabled) controls.update();
    
    // Re-render scene
    renderer.render(delta);
};

// Loads scene with given string, currently supported scenes are welcome page and gallery page, moves camera with transition w/ given direction
const switchScene = (newScene, cameraDirection) => {
    //currentJellyTarget = null;
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
                showWelcomePage();
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
            //document.getElementById("numbMeter").innerHTML = Math.abs(camera.position.y);
            new TWEEN.Tween(camera)
                .to({'position': newPos}, 1000)
                .easing(TWEEN.Easing.Circular.InOut)
                .onUpdate(() => camera.updateProjectionMatrix())
                .onComplete(() => {
                    isCameraAnimating = false;
                    if(currentScene === 'galleryPage' && transitionTargetWishID !== null) {
                        jellyClicked(jellies.find(j => j.wishID === transitionTargetWishID).jellyParent);
                        transitionTargetWishID = null;
                    }
                })
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
	});
	
	particles = new THREE.Points(geometry, shaderMaterial);
	particles.scale.set(jellyRange * 2 + 500, jellyRange * 2 + 500, jellyRange * 2 + 500);
	scene.add(particles);
	particles.rotation.z = -0.5;
};

function generateBGStars() {
	const geometry = new THREE.BufferGeometry();

	const N = 2000;
	const vertices = new Float32Array(N);
	let c = 0;
	while (c < N) {
	  const theta = Math.random() * 2 * Math.PI,
		phi = Math.acos(2 * Math.random() - 1),
		r = Math.pow(Math.random(), 1 / 3),
		x = r * Math.sin(phi) * Math.cos(theta),
		y = r * Math.sin(phi) * Math.sin(theta),
		// z = r * Math.cos(phi);
		z = 0;
	
	  vertices[c] = x;
	  vertices[c + 1] = y;
	  vertices[c + 2] = z;
	  c += 3;
	}
	geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
	
	const shaderMaterial = new THREE.ShaderMaterial({
	  uniforms: {},
	  vertexShader: bgVertexShader,
	  fragmentShader: bgFragmentShader,
	  transparent: true,
	  depthWrite: true
	});
	
	let particles = new THREE.Points(geometry, shaderMaterial);
	particles.scale.set(1200,1200,1200)
	scene.add(particles);
	particles.rotation.z=-0.5
	particles.position.z = -500
}

// Generates a jellyfish based on the specified string (wish)
const generateJelly = (wishObj) => {
    if(!wishObj.wish) return;
    const jellyCode = hashFunc(wishObj.wish);
    const jellyWidthSegments = Math.round(mapNumToRange(jellyCode[1], 0, 9, 5, 12));
    const jellyHeightSegments = Math.round(mapNumToRange(jellyCode[2], 0, 9, 5, 12));
    const colorArray = ['#490085', '#ad538b', '#ff005d', '#2206c4', '#DE41F2', '#765b8c', '#0e47ab'];
    // const jellyColor = Math.floor(mapNumToRange(jellyCode.substring(2, 4), 0, 99, 0.1, 0.9) * 16777215).toString(16);
    const jellyColor = colorArray[Math.round(mapNumToRange(jellyCode[3], 0, 9, 0, colorArray.length - 1))];
    const jellyAnimSpeed = mapNumToRange(jellyCode[4], 0, 9, 0.01, 0.09);
    const jellyGeometery = new THREE.SphereGeometry(15, jellyWidthSegments, jellyHeightSegments, 0, 6.283, 0, 1.7);
    
    const outerMaterial = new THREE.MeshBasicMaterial({
        color: jellyColor,
        // color: `#${jellyColor}`,
        transparent: true,
        opacity: 0.45,
        depthWrite: false
    })
    outerMaterial.side = THREE.DoubleSide;

    const lineMat = new THREE.LineBasicMaterial({color:0xffffff, transparent: true, opacity: 0.25})

    const jellyMesh = new THREE.Mesh(jellyGeometery, outerMaterial);
    const vertex = jellyMesh.geometry.attributes.position;
    const lines = [];

    for(let i = 0; i < jellyWidthSegments + 1; i++) {
        const temppoints = [];
        let MAX_POINTS = jellyHeightSegments+1;
        const linegeo = new THREE.BufferGeometry();
        const positions = new Float32Array( MAX_POINTS * 3 ); // 3 vertices per point
        linegeo.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

        for(let j=jellyWidthSegments + 1; j < (jellyWidthSegments*jellyHeightSegments); j+=(jellyWidthSegments+1)){
            var vec = new THREE.Vector3();
            vec.fromBufferAttribute(vertex, i+j)
            temppoints.push(vec);
        }

        for(let k=0; k<temppoints.length-1; k++){
            let point = temppoints[k];
            shiftRight(positions, point.z);
            shiftRight(positions, point.y);
            shiftRight(positions, point.x);
        }
        const lineMat = new THREE.LineBasicMaterial({color:0xffffff, transparent: true, opacity: 0.25})
        lines.push( new THREE.Line( linegeo, lineMat));
    }

    const parent = new THREE.Object3D();
    const jellyStartRange = jellyRange - 100;
    parent.position.set(randomNum(-jellyStartRange, jellyStartRange), randomNum(-jellyStartRange, jellyStartRange), randomNum(-jellyStartRange, jellyStartRange));
    parent.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
    parent.userData.wish = wishObj.wish;
  
    parent.add(jellyMesh);
    for(let i=0; i<lines.length; i++){
		jellyMesh.add(lines[i]);
        lines[i].geometry.attributes.position.needsUpdate = true;
	}
    scene.add(parent);

    jellies.push({jellyMesh, lines, jellyParent: parent, aStep: jellyAnimSpeed, a: 0, wish: wishObj.wish, wishID: wishObj.wishID, jellyWidthSegments: jellyWidthSegments, jellyHeightSegments: jellyHeightSegments});
};

// When screen is clicked detect if jellyfish is clicked, call jellyClicked if true
const sceneClicked = (e) => {
    e.preventDefault();
    if(currentScene !== 'galleryPage' || shareModeOn) return;
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
            isCameraFollowingJelly = true;
            new TWEEN.Tween(camera)
                .to({'position': new THREE.Vector3(orbitTarget.x + 100, orbitTarget.y + 100, orbitTarget.z+100)}, 1000)
                .easing(TWEEN.Easing.Circular.InOut)
                .onUpdate(() => camera.updateProjectionMatrix())
                .onComplete(() => controls.maxDistance = 500)
                .start();
        })
        .start();
};

//Formats the num values to k after 999 jelly fish are made
function kFormatter(num) {
    return Math.abs(num) > 999 ? Math.sign(num)*((Math.abs(num)/1000).toFixed(1)) + 'k' : Math.sign(num)*Math.abs(num)
}

// Loads all wishes in database and generates jellies for them if they are approved or owned by user
const loadWishes = () => {
    const userID = getUserID();
    dbRef.on('child_added', (data) => {
        if(currentScene !== 'galleryPage') return;
        const wishObj = data.val();
        if(transitionTargetWishID !== wishObj.wishID) {
            if((wishObj.approved === undefined && wishObj.userID !== userID) || wishObj.approved === false) return;
        } 
        generateJelly(wishObj);

        document.querySelector('#numWishes').innerHTML = kFormatter(jellies.length); 
    });
};

// Checks wish is valid, if it is then adds wish to database and follows new jelly
const makeWish = () => {
    const wish = document.querySelector('#wishInput').value;
    if(wish.trim() === '') {
        document.querySelector('#errorText').innerHTML = `Wish can't be empty!`;
        return;
    }
    console.log(isWishOnlyValidChars(wish));
    if(!isWishOnlyValidChars(wish)) {
        document.querySelector('#errorText').innerHTML = `Wish can only contain letters or numbers!`;
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
        const wishID = genWishID();
        transitionTargetWishID = wishID;
        dbRef.push({wishID, wish: wish.trim(), approved: null, userID: getUserID()});
        switchScene('galleryPage', 'down');
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
    //currentJellyTarget = null;
    hideWishText();
    hideSearchUI();
};

// Loads all elements in three js scene for gallery page
const loadGalleryPage = () => {
    currentScene = 'galleryPage';
    bloomPass.threshold = 0;
    controls.enabled = true;
    isCameraFollowingJelly = false;
    currentJellyTarget = null;
    loadWishes();
    createParticleSystem(scene);
    $('.settings').css('width', '364px');
    $('.search').fadeIn();
    //changes bg color when load gallery page
    $("#app").css("background", "#040740");
};

// Unload all elements in gallery page
const unloadGalleryPage = () => {
    clearScene();
    jellies.splice(0, jellies.length);
};

// Loads all elements in three js scene for welcome page
const loadWelcomePage = () => {
    $('.settings').css('width', '164px');
    //changes bg color when load welcome page
    bloomPass.threshold = 9;
    $("#app").css("background", "#01031c");

    const light = new THREE.DirectionalLight(0x02053A);
	light.position.set(0, 0, 10.10);
	scene.add(light);
    scene.add(new THREE.AmbientLight(0x02053A));

    //const sun = new THREE.Vector3();
    const waterGeometry = new THREE.PlaneGeometry(12000, 10000);
    water = new Water(waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: loader.load('waternormals.jpeg', function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: new THREE.Vector3(),
            sunColor: 0x02053A,
            waterColor: 0x02053A,
            distortionScale: 6
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

	// const parameters = {inclination: 0.4857, azimuth: 0.252, exposure: 0.1389};
    // const pmremGenerator = new THREE.PMREMGenerator(renderer);

    // const updateSun = () => {
    //     const theta = Math.PI * (parameters.inclination - 0.5);
    //     const phi = 2 * Math.PI * (parameters.azimuth - 0.5);

    //     sun.x = Math.cos(phi);
    //     sun.y = Math.sin(phi) * Math.sin(theta);
    //     sun.z = Math.sin(phi) * Math.cos(theta);

    //     sky.material.uniforms['sunPosition'].value.copy(sun);
    //     water.material.uniforms['sunDirection'].value.copy(sun).normalize();

    //     scene.environment = pmremGenerator.fromScene(sky).texture;
	// };

    // updateSun();

    generateBGStars();
    currentScene = 'welcomePage';
    //$('.gaugeMeter').fadeOut();
};

const unloadWelcomePage = () => {
    $('#welcomescreen').fadeOut();
    clearScene();
};

// The Nature of Code
// Daniel Shiffman
// http://natureofcode.com
/* MOVER CLASS */
function Mover(m,vel,loc,isa) {
    this.location = loc,
    this.velocity = vel,
    this.acceleration = new THREE.Vector3(0.0,0.0,0.0),
    this.mass = m,
    this.c = 0xffffff,
    this.alive = true;
    this.geometry = new THREE.SphereGeometry(1.0,5,5);

    this.lineGeometry = new THREE.BufferGeometry();
    this.vertices = new Float32Array( 10 * 3);     // PATH OF MOVEMENT
    this.colors = new Float32Array( 10 * 3);
    for(let i = 0; i<10; i++){
        this.vertices[i] = this.location.x;
        this.vertices[i+1] = this.location.y;
        this.vertices[i+2] = this.location.z;
    }

    this.lineGeometry.setAttribute('position', new THREE.BufferAttribute( this.vertices, 3));
    this.lineGeometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.lineGeometry.setDrawRange(0, 10);

    this.lineMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, vertexColors: true })
    this.basicMaterial =  new THREE.MeshBasicMaterial({
        color: 0xffffff
    });

    //this.selectionLight = new THREE.PointLight(this.color,.1);
    //this.selectionLight.position.copy(this.location);
    this.mesh = new THREE.Mesh(this.geometry,this.basicMaterial);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;

    this.line = new THREE.Line(this.lineGeometry, this.lineMaterial);
    this.position = this.location;
    this.mesh.position.set(this.location);

    this.index = movers.length;
    this.selected = false;

    if(isa === false){ // If the star is not generated by the user cursor
        scene.add(this.mesh);
        scene.add(this.line);
    } 
    //scene.add(this.selectionLight);
    this.applyForce = function(force) {
        if (!this.mass) this.mass = 1.0;
        var f = force.divideScalar(this.mass);
        this.acceleration.add(f);
    };
    this.update = function() {

        if(this.alive) {
        this.velocity.add(this.acceleration);
        this.location.add(this.velocity);
        this.acceleration.multiplyScalar(0);
        }

        //this.selectionLight.position.copy(this.location);
        this.mesh.position.copy(this.location);
        //if (this.vertices.length > 10000) this.vertices.splice(0,1);
        if(this.location.x !== 0 && this.location.y !== 0){
        const linePos = this.line.geometry.attributes.position.array;

        shiftRight(linePos, this.location.z);
        shiftRight(linePos, this.location.y);
        shiftRight(linePos, this.location.x);

        const lineCol = this.line.geometry.attributes.color.array;

            this.colors = [];
            this.lineColor = new THREE.Color();
            for(let i=0; i<10; i++){
                this.lineColor.setHSL( 0, 0, (1 - (i/10)));
                lineCol[ i ] = this.lineColor.r
                lineCol[ i +1 ] = this.lineColor.g
                lineCol[ i +2 ] = this.lineColor.b
            }
        }
            

        this.line.geometry.attributes.position.needsUpdate = true; // required after the first render
        this.line.geometry.attributes.color.needsUpdate = true;
        
        //this.vertices.push(this.location.clone());
        //this.lineGeometry.verticesNeedUpdate = true;

    };
    this.eat = function(m) { // m => other Mover object
        var newMass = this.mass + m.mass;

        var newLocation = new THREE.Vector3(
            (this.location.x * this.mass + m.location.x * m.mass)/newMass,
            (this.location.y * this.mass + m.location.y * m.mass)/newMass,
            (this.location.z * this.mass + m.location.z * m.mass)/newMass);
        var newVelocity = new THREE.Vector3(
            (this.velocity.x *this.mass + m.velocity.x * m.mass) / newMass,
            (this.velocity.y *this.mass + m.velocity.y * m.mass) / newMass,
            (this.velocity.z *this.mass + m.velocity.z * m.mass) / newMass);

        this.location=newLocation;
        this.velocity=newVelocity;
        this.mass = newMass;

        //if (m.selected) this.selected = true;
        //this.color.lerpHSL(m.color, m.mass /  (m.mass + this.mass));
      
        m.kill();
    };
    this.kill = function () {
        this.alive=false;
        //this.selectionLight.intensity = 0;
        scene.remove(this.mesh);
    };
    this.attract = function(m) {   // m => other Mover object
        var force = new THREE.Vector3().subVectors(this.location,m.location);         // Calculate direction of force
        var d = force.lengthSq();
        if (d<0) d*=-1;
        force = force.normalize();
        var strength = - (10 * this.mass * m.mass) / (d);      // Calculate gravitional force magnitude
        force = force.multiplyScalar(strength);                             // Get force vector --> magnitude * direction
        
        this.applyForce(force);
    };
    this.display = function() {
        if (this.alive) {
            var scale = Math.pow((this.mass*MASS_FACTOR/(4*Math.PI)), 1/3);
            this.mesh.scale.x = scale;
            this.mesh.scale.y = scale;
            this.mesh.scale.z = scale;

        } else {
            //this.selectionLight.intensity = 0;
        }

    };
}

const createShootingStar = () => {
	let speed = -1*(1+Math.random()*5);
	movers.push(new Mover(1, new THREE.Vector3(speed, speed, 0), new THREE.Vector3(500+Math.random()*800, 500+Math.random()*800, -500), false));
    //console.log(movers[0].mesh.position);
}

const attractStar = () => {
    var movers_alive_count = 0;
    //total_mass = 0;
    var maximum_mass = 0.00;
			//loop through all shooting stars
            for (var i = movers.length-1; i >= 0; i--) {
                var m = movers[i];
				// update so they continue on their path
				m.update();
                //m.showTrails();
                if(a) a.kill();

				// if(m.location.y <= 0){
				// 	// console.log(m.location.y);
				// 	m.kill();
				// } 

                if (m.alive) {
                    // for (var j =  movers.length-1; j >= 0; j--) {
                    //     var a = movers[j];
					if(clicking){
							// movers.push(new Mover(40, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 100, -500)));
							// console.log(intersects.x, intersects.y)
						a = new Mover(250, new THREE.Vector3(0, 0, 0), new THREE.Vector3(intersects.x, intersects.y, -500), true);

                        if (movers[i].alive) {
                            var distance = m.location.distanceTo(a.location);

                            var radiusM = Math.pow((m.mass / MASS_FACTOR/MASS_FACTOR / 4* Math.PI), 1/3)/3;
                            var radiusA = Math.pow((a.mass / MASS_FACTOR/MASS_FACTOR / 4* Math.PI), 1/3)/6;

                            if (distance < radiusM + radiusA) {
                                if(isStarSelected) return;
                                updateCaughtStar(m.position);
                                a.eat(m);
                            }
                            else
                            {
								// console.log('attract');
                               m.attract(a);
                            }
                        }
                    }
                }
            }
}

const updateCaughtStar = (starPos) => {
    isStarSelected = true;
    $('#starTxt').fadeOut();
    bloomPass.threshold = 2;
    const parent = new THREE.Object3D();
    parent.position.set(starPos.x, starPos.y, starPos.z);
    let mesh, subMesh;
    const jellyProps = {
        jellySize: 1,
        jellyThetaLength: Math.PI,
        outerMeshOpacity: 1
    };
    

    const addJelly = () => {
        const starGeometry = new THREE.SphereGeometry(jellyProps.jellySize, 15, 15, 0, 6.283, 0, jellyProps.jellyThetaLength);
        addGeometry(starGeometry);
    };
    
    const addGeometry = (geometry) => {
        const outerMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: jellyProps.outerMeshOpacity, depthWrite: false, side: THREE.DoubleSide});
        const innerMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: false, opacity: 1, depthWrite: false, side: THREE.DoubleSide});
        parent.remove(mesh);
        parent.remove(subMesh);
        mesh = new THREE.Mesh(geometry, outerMaterial);
        subMesh = new THREE.Mesh(geometry, innerMaterial);
        // mesh.depthWrite = false;
        // subMesh.depthWrite = false;
        subMesh.scale.set(0.9, 0.5, 0.9);
        parent.add(mesh);
        parent.add(subMesh);
    };
    
    addJelly();
    scene.add(parent);

    const jellyOpacityTransition = new TWEEN.Tween(jellyProps)
        .to({'outerMeshOpacity': 0.5}, 3000)
        .easing(TWEEN.Easing.Circular.InOut)
        .onUpdate(() => addJelly())
        .onComplete(() => showWishEntry());

    const jellyThetaTransition = new TWEEN.Tween(jellyProps)
        .to({'jellyThetaLength': Math.PI / 2}, 3000)
        .easing(TWEEN.Easing.Circular.InOut)
        .onUpdate(() => addJelly())
        .onComplete(() => jellyOpacityTransition.start());

    const jellyPosTransition = new TWEEN.Tween(parent.position)
        .to({'y': parent.position.y + 150}, 1000)
        .easing(TWEEN.Easing.Circular.InOut)
        .onComplete(() => jellyThetaTransition.start());

    const jellySizeTransition = new TWEEN.Tween(jellyProps)
        .to({'jellySize': 100}, 5000)
        .easing(TWEEN.Easing.Circular.InOut)
        .onUpdate(() => addJelly())
        .onComplete(() => jellyPosTransition.start());

    new TWEEN.Tween(controls)
        .to({'target': new THREE.Vector3(starPos.x, starPos.y, starPos.z)}, 1500)
        .easing(TWEEN.Easing.Circular.InOut)
        .onUpdate(() => controls.update())
        .onComplete(() => jellySizeTransition.start())
    //     .onComplete(() => {
    //         unloadScene();
    //         camera.position.set(newPos.x, newPos.y, newPos.z);
    //         setControlsTarget();
    //         camera.position.set(camera.position.x, camera.position.y - cameraMovement, camera.position.z);
    //         loadScene();
    //         //document.getElementById("numbMeter").innerHTML = Math.abs(camera.position.y);
    //         new TWEEN.Tween(camera)
    //             .to({'position': newPos}, 1000)
    //             .easing(TWEEN.Easing.Circular.InOut)
    //             .onUpdate(() => camera.updateProjectionMatrix())
    //             .onComplete(() => isCameraAnimating = false)
    //             .start();
    // })
        .start();
};

// Load all objects in three js scene for make wish page
const loadMakeWishPage = () => {
    isStarSelected = false;
    $('.settings').css('width', '164px');
    // for(let i = 1; i < 1200; i++) {
    //     const geometry = new THREE.SphereGeometry(0.02 * randomNum(0.5, 1), 6, 6);
    //     const material = new THREE.MeshBasicMaterial({
    //       opacity: true,
    //       color: new THREE.Color(1, randomNum(190, 220) / 255, Math.round(Math.random()))
    //     });
    
    //     const sphere = new THREE.Mesh(geometry, material);
    //     sphere.position.setFromSpherical(new THREE.Spherical(5 + 5 * Math.random(), 2 * Math.PI * Math.random(), 2 * Math.PI * Math.random()));
    //     scene.add(sphere);      
    // }

    generateBGStars();
    intervalID = window.setInterval(createShootingStar, 3500);
    makeWishCursor();
	
    // helper plane for raycasting
	plane = new THREE.Plane( new THREE.Vector3(0, 0, 1), 500);
    //$('.starview').show();
    // if(detectMob === false) animateValue('.gaugeMeter', 0, 100, 1)
    currentScene = 'makeWishPage';
};

const unloadMakeWishPage = () => {
    clearInterval(intervalID);
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

// Cursor tracking
const makeWishCursor = () => {
    $('#cursor').show();
    var cursor = document.getElementById('cursor');
    if(detectMob() === true){
        $('#cursor').addClass("zoom");
        window.addEventListener('touchStart', function(e){
            $('#cursor').show();
            var x = e.targetTouches[0].pageX;
            var y = e.targetTouches[0].pageY;
            //console.log('start', x, y);
            cursor.style.left = x + 'px';
            cursor.style.top = y + 'px';
            clicking = true;
        });
        window.addEventListener('touchend', function(e){
            clicking = false;
            $('#cursor').hide();
        });
        window.addEventListener('touchmove', function(e){
            $('#cursor').show();
            clicking = true;
            // if(e.touches.length > 1){
            // e.preventDefault();
            // e.stopImmediatePropagation();
            // }
            var x = e.targetTouches[0].pageX;
            var y = e.targetTouches[0].pageY;
            cursor.style.left = x + 'px';
            cursor.style.top = y + 'px';
            //console.log('move', x, y)
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            mouse.x = (x/ renderer.domElement.clientWidth) * 2 - 1;
            mouse.y = -(y / renderer.domElement.clientHeight) * 2 + 1;
            //console.log(mouse.x, mouse.y)
            raycaster.setFromCamera(mouse, camera);
            intersects = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, intersects);
            // console.log(intersects);
        });

    }
    else{
    $('#cursor').show();
    window.addEventListener('mousemove' , function(e){
        e.preventDefault();
        var x = e.clientX;
        var y = e.clientY;
        cursor.style.left = x + 'px';
        cursor.style.top = y + 'px';
        //console.log('mousemove', x, y);
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
        mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;
        //console.log(mouse.x, mouse.y)
        raycaster.setFromCamera(mouse, camera);
        intersects = new THREE.Vector3();
		raycaster.ray.intersectPlane(plane, intersects);
        // console.log(intersects);
    });
    $('body')
    .mousedown(function(e){
        //console.log('down')
        $('#cursor').addClass('zoom');
        clicking = true;
    })
    .mouseup(function(){
        //console.log('up');
        $('#cursor').removeClass('zoom');
        clicking = false;
    });
    }
}

// Seeds DB with a new wish for every line in the wishes.txt file. DONT CALL UNLESS NEEDED
const seedDB = () => {
    $.get('wishes.txt', (txt) => {
        const lines = txt.split("\n");
        for(const line of lines) {
            dbRef.push({wishID: genWishID(), wish: line, approved: true, userID: getUserID()});
        }
    }); 
};

window.onload = init;
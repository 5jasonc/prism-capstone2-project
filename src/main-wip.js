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
    showGalleryPage, hideGalleryPage, showWelcomePage, hideWelcomePage,
    getUserID, hashFunc, mapNumToRange, randomNum
} from './utils.js';

// VARIABLES TO TRACK OBJECTS IN SCENE
const jellies = [];
let dbRef;
let camera, scene, loader, renderer, controls;
let water;
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

    // Testing page transitions
    document.querySelector('#welcomePageButton').addEventListener('click', () => {
        if(currentScene === 'galleryPage') {
            switchScene('welcomePage', 'up');
        } else {
            switchScene('galleryPage', 'down');
        }
    });

    // Add canvas to page and objects to scene
    document.body.appendChild(renderer.domElement);
    scene.add(camera);
    
    // Start by loading galleryPage, as those are elements not hidden at top of init
    loadGalleryPage();

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
    if(isCameraFollowingJelly && currentScene === 'galleryPage') {
        controls.target = new THREE.Vector3(currentJellyTarget.position.x, currentJellyTarget.position.y, currentJellyTarget.position.z);
    }

    if(currentScene === 'welcomePage') water.material.uniforms['time'].value += 1.0 / 60.0;
    
    // Update tween and orbit controls each frame
    TWEEN.update();
    if(!isCameraAnimating && !controls.enabled) controls.update();
    
    // Re-render scene
    renderer.render(delta);
};

// Loads scene with given string, currently supported scenes are welcome page and gallery page, moves camera with transition w/ given direction
const switchScene = (newScene, cameraDirection = 'up') => {
    controls.enabled = false;
    isCameraAnimating = true;

    let newPos;
    if(newScene === 'galleryPage') {
        controls.update();
        newPos = new THREE.Vector3(500, 500, camZoom); // galleryPage start point
    } else {
        newPos = new THREE.Vector3(0, 10, 10); // welcomePage start point
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
                // showWelcomePage();
                break;
        }
    };

    new TWEEN.Tween(camera)
        .to({'position': new THREE.Vector3(camera.position.x, camera.position.y + cameraMovement, camera.position.z)}, 1000)
        .easing(TWEEN.Easing.Circular.InOut)
        .onUpdate(() => camera.updateProjectionMatrix())
        .onComplete(() => {
            unloadScene();
            camera.position.set(newPos.x, newPos.y, newPos.z);
            if(newScene === 'galleryPage') {
                controls.target.set(0, 0, 0);
            } else {
                controls.target.set(0, 10, 0);
            }
            controls.update();
            camera.position.set(camera.position.x, camera.position.y - cameraMovement, camera.position.z);
            loadScene();
            new TWEEN.Tween(camera)
                .to({'position': newPos}, 1000)
                .easing(TWEEN.Easing.Circular.InOut)
                .onUpdate(() => {
                    camera.updateProjectionMatrix();
                    // controls.update();
                })
                .onComplete(() => isCameraAnimating = false)
                .start();
        })
        .start();

    // new TWEEN.Tween(controls)
    //     .to({'target': new THREE.Vector3(controls.target.x, controls.target.y + cameraMovement, controls.target.z)}, 1000)
    //     .easing(TWEEN.Easing.Circular.InOut)
    //     .onUpdate(() => controls.update())
    //     .onComplete(() => {
    //         unloadScene();
    //         controls.target.set(newPos.x, newPos.y - cameraMovement, newPos.z);
    //         loadScene();
    //         new TWEEN.Tween(controls) // camera.position.set(0, 0, 10);
    //             .to({'target': newPos}, 1000)
    //             .easing(TWEEN.Easing.Circular.InOut)
    //             .onUpdate(() => {
    //                 controls.update();
    //             })
    //             // .onComplete(() => isCameraAnimating = false)
    //             .start();
    //     })
    //     .start();
};

// Generates a jellyfish based on the specified string (wish)
const generateJelly = (string) => {
    const jellyCode = hashFunc(string);
    const jellyWidthSegments = Math.round(mapNumToRange(jellyCode[0], 1, 9, 5, 11));
    const jellyHeightSegments = Math.round(mapNumToRange(jellyCode[1], 0, 9, 3, 8));
    const jellyColor = Math.floor(mapNumToRange(jellyCode.substring(2, 4), 0, 99, 0.1, 0.9) * 16777215).toString(16);
    const jellyAnimSpeed = mapNumToRange(jellyCode[4], 0, 9, 0.01, 0.09);
    const jellyGeometery = new THREE.SphereGeometry(15, jellyWidthSegments, jellyHeightSegments, 0, 6.283, 0, 1.7);

    const texture = loader.load('uv-lines.png');
    texture.center.set = (0.5, 0.5);
    const outerMaterial = new THREE.MeshMatcapMaterial({color: `#${jellyColor}`, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide});
    const innerMaterial = new THREE.MeshPhongMaterial({color: 0xffffff, transparent: true, opacity: 0.65, depthWrite: false, map: texture, side: THREE.DoubleSide});
  
    const jellyMesh = new THREE.Mesh(jellyGeometery, outerMaterial);
    const jellyInnerMesh = new THREE.Mesh(jellyGeometery, innerMaterial);
    jellyMesh.depthWrite = false;
    jellyInnerMesh.depthWrite = false;
    jellyInnerMesh.scale.set(0.98, 0.65, 0.98);
  
    const parent = new THREE.Object3D();
    parent.position.set(randomNum(-200, 200), randomNum(-200, 200), randomNum(-200, 200));
    parent.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
    parent.userData.wish = string;
  
    parent.add(jellyMesh);
    parent.add(jellyInnerMesh);
    scene.add(parent);

    jellies.push({jellyMesh, jellyInnerMesh, jellyParent: parent, aStep: jellyAnimSpeed, a: 0, wish: string});
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

    // If it is a new jelly target, zoom in <-- maybe there is still a way we can use this with a transition?
    // if(currentJellyTarget !== jelly) {       because this makes zooming in way easier as it automatically zooms on target
    //   controls.dIn(0.3);
    //   controls.update();
    // }
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
    loadWishes();
    // camera.position.set(500, 500, camZoom);
    // controls.target = new THREE.Vector3(0, 0, 0);
    // controls.maxPolarAngle = Math.PI;
    // controls.minDistance = 0;
    // controls.maxDistance = Infinity;
    // controls.update();
    currentScene = 'galleryPage';
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
    //fix the width size of settings bar to 164
    $('.settings').css("width", "164px");

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

        // controls.maxPolarAngle = Math.PI * 0.495;
        // controls.target.set(0, 10, 0);
        // controls.minDistance = 40.0;
        // controls.maxDistance = 200.0;
        // controls.update();
	};

    updateSun();
    currentScene = 'welcomePage';
    $('.gaugeMeter').fadeOut();
};

const unloadWelcomePage = () => {
    clearScene();
};

// Remove all objects in three js scene
const clearScene = () => {
    for(let i = scene.children.length - 1; i >= 0; i--) {
        const obj = scene.children[i];
        if(obj.type === 'PerspectiveCamera') continue;
        scene.remove(obj);
    }
}

window.onload = init;
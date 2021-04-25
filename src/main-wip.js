'use strict';

// ES6 MODULE IMPORTS
import * as THREE from '../build/three.module.js';
import * as TWEEN from '../build/tween.js';
import Stats from './jsm/libs/stats.module.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { BokehPass } from './jsm/postprocessing/BokehPass.js';
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
const movers = [];
let dbRef;
let camera, scene, loader, renderer, controls;
let water;
let bloomPass, filmPass, bokehPass;
let matShader, linematShader, texture;
let stats;
let clicking, intersects, a;
var MASS_FACTOR = .01; // for display of size


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
    texture = loader.load('../starmap_4k_print.jpeg');
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth  / window.innerHeight, 0.1, 20000);
    const light = new THREE.PointLight(0xffffff, 1);
    camera.position.set(500, 500, camZoom);
    camera.add(light);
    renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true}); // antialias T or F, which looks better?
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    // renderer.setClearColor(0x000000, 0); // not sure if we will need this
    // renderer.toneMapping = THREE.ReinhardToneMapping; // look better with this?
    // renderer.NoToneMapping = THREE.ACESFilmicToneMapping;
    const renderScene = new RenderPass(scene, camera);
    bokehPass = new BokehPass( scene, camera, {
		focus: 20,
		aperture: 2 * 0.00001,
		maxblur: 0.25,
	} );
    bokehPass.renderToScreen = true;
	bokehPass.needsSwap = true;
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
    // composer.addPass(bokehPass)

    // Set up orbit camera controls
    controls = new OrbitControls(camera, renderer.domElement);
    // controls.enableDamping = true;
    // controls.dampingFactor = 0.05;
	// controls.listenToKeyEvents(window);
      
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

    // TEMPORARY Stats for tracking performance
    stats = new Stats();
	document.body.appendChild( stats.dom );

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
        //console.log(currentJelly);
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


        // Re-do line calculations every frame, to match new mesh
        //console.log('jelly Width' + currentJelly.jellyWidthSegments+1);
        for ( let lineIndex = 0; lineIndex < currentJelly.jellyWidthSegments+1; lineIndex ++ ){
            //console.log('working!');
            const temppoints = [];
    
            //let MAX_POINTS = currentJelly.jellyHeightSegments;
            //const linegeo = new THREE.BufferGeometry();
            const positions = currentJelly.lines[lineIndex].geometry.attributes.position.array;
            //console.log(positions);
            //linegeo.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
    
            // loop through jellyfish mesh, pulling out vertical lines from the radial mesh
            for(let jIndex=currentJelly.jellyWidthSegments; jIndex<(currentJelly.jellyWidthSegments*currentJelly.jellyHeightSegments); jIndex+=(currentJelly.jellyWidthSegments+1)){
                // temppoints.push(j+i);
    
                var vec = new THREE.Vector3();
                vec.fromBufferAttribute(position, lineIndex+jIndex)
                temppoints.push(vec);
                //push each of the vertices to temppoints, constructing the line
            }
    
            // loop through length of line, adding each point's x, y, z in order
            // console.log(temppoints);
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
        


    // Make jellies pulsate through shader transforms
        // for(let j = 0; j < jellies.length; j++) {
        // if(matShader) matShader.uniforms.time.value = clock.elapsedTime*10;
        // if(linematShader) linematShader.uniforms.time.value = clock.elapsedTime*10;
        // }
        // if(linematShader) linematShader.uniforms.time.value = time/2000;
  
    // If camera is focused on jelly, move camera
    if(isCameraFollowingJelly && currentScene === 'galleryPage') {
        controls.target = new THREE.Vector3(currentJellyTarget.position.x, currentJellyTarget.position.y, currentJellyTarget.position.z);
        controls.update();
    }

    if(currentScene === 'welcomePage'){
        water.material.uniforms['time'].value += 1.0 / 60.0;
        updateShootingStars();
    }
    
    // TEMPORARY Update Stats for performance readout
    stats.update();

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
};

// Utility function for adding to the top of a BufferArray
const shiftRight = (collection, value) => {
    for (let i = collection.length - 1; i > 0; i--) {
      collection[i] = collection[i - 1]; // Shift right
    }
    collection[0] = value; // Place new value at head
    return collection;
  }

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
    
    outerMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.time = { value: 0}
        shader.vertexShader = `
            uniform float time;
        ` + shader.vertexShader
    
        const token = '#include <begin_vertex>'
        const customTransform = `
        vec3 transformed = vec3(position);
        transformed.y = position.y + sin(position.y*0.40 + time*2.0);
    `
        shader.vertexShader = shader.vertexShader.replace(token,customTransform)
        matShader = shader
    }
    outerMaterial.side = THREE.DoubleSide;

    const lineMat = new THREE.LineBasicMaterial({color:0xffffff, transparent: true, opacity: 0.25})
    lineMat.onBeforeCompile = (shader) => {
    shader.uniforms.time = { value: 0}
    shader.vertexShader = `
        uniform float time;
    ` + shader.vertexShader

    const token = '#include <begin_vertex>'
    const customTransform = `
        vec3 transformed = vec3(position);
        transformed.x = position.x*0.95;
        transformed.z = position.z*0.95;
        transformed.y = position.y*0.65 
        + sin(position.y*0.40 + time*2.0);
`
    shader.vertexShader = shader.vertexShader.replace(token,customTransform)
    linematShader = shader
}
  
    const jellyMesh = new THREE.Mesh(jellyGeometery, outerMaterial);
    // const jellyInnerMesh = new THREE.Mesh(jellyGeometery, innerMaterial);
    // jellyInnerMesh.depthWrite = false;
    // jellyInnerMesh.scale.set(0.98, 0.65, 0.98);

    // Create submesh lines
    const vertex = jellyMesh.geometry.attributes.position;
    const lines = [];
    // < vertex.count

    // Create BufferAttribute array of points, in order of x, y, z
    // Each line gets it's own positions array

    
    for ( let i = 0; i < jellyWidthSegments+1; i ++ ){

        const temppoints = [];

        let MAX_POINTS = jellyHeightSegments+1;
        const linegeo = new THREE.BufferGeometry();
        const positions = new Float32Array( MAX_POINTS * 3 ); // 3 vertices per point
        linegeo.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

        // loop through jellyfish mesh, pulling out vertical lines from the radial mesh
        for(let j=jellyWidthSegments; j<(jellyWidthSegments*jellyHeightSegments); j+=(jellyWidthSegments+1)){
            // temppoints.push(j+i);

            var vec = new THREE.Vector3();
            vec.fromBufferAttribute(vertex, i+j)
            temppoints.push(vec);
            //push each of the vertices to temppoints, constructing the line
        }

        // loop through length of line, adding each point's x, y, z in order
        // console.log(temppoints);
        for(let k=0; k<temppoints.length; k++){

            let point = temppoints[k];

            shiftRight(positions, point.z);
            shiftRight(positions, point.y);
            shiftRight(positions, point.x);
        }

        //const linegeo = new THREE.BufferGeometry().setFromPoints( temppoints );
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
    // if(currentScene !== 'galleryPage') return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    mouse.x = (e.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(e.clientY / renderer.domElement.clientHeight) * 2 + 1;
  
    raycaster.setFromCamera(mouse, camera);

    if(currentScene == 'welcomePage'){
        let plane = new THREE.Plane( new THREE.Vector3(0, 0, 1), 500);
        intersects = new THREE.Vector3();
		raycaster.ray.intersectPlane(plane, intersects);

    } else{
        intersects = raycaster.intersectObjects(scene.children, true);
        if(intersects.length > 0) jellyClicked(intersects[0].object.parent);
    }
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
        .to({'target': orbitTarget}, 500)
        .easing(TWEEN.Easing.Circular.InOut)
        .onUpdate(() => controls.update())
        .onComplete(() => {
            isCameraAnimating = false;
            isCameraFollowingJelly = true
            // Experimenting with zoom transition next
            new TWEEN.Tween(camera)
                .to({'fov': 10}, 1000)
                .easing(TWEEN.Easing.Circular.InOut)
                .onUpdate(() => camera.updateProjectionMatrix())
                .start();
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
    generateStars();
    var intervalID = window.setInterval(createShootingStar, 3500);

    currentScene = 'welcomePage';
    $('.gaugeMeter').fadeOut();
};

// Generates field of random point stars above the water
const generateStars = () =>{

        const geometry = new THREE.BufferGeometry();
        const N = 2000; //Number of stars to be generated
        const vertices = new Float32Array(N);
        let c = 0;


        while (c < N) {

          const theta = Math.random() * 2 * Math.PI,
            phi = Math.acos(2 * Math.random() - 1),
            r = Math.pow(Math.random(), 1 / 3),
            x = r * Math.sin(phi) * Math.cos(theta),
            y = r * Math.sin(phi) * Math.sin(theta),
            z = 0;
        
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
          depthWrite: true
        });
        
        let particles = new THREE.Points(geometry, shaderMaterial);
        particles.scale.set(1200,1200,1200)
        scene.add(particles);
        particles.rotation.z=-0.5
        particles.position.z = -500
}

// The Nature of Code
// Daniel Shiffman
// http://natureofcode.com
/* MOVER CLASS */
function Mover(m,vel,loc) {
    this.location = loc,
    this.velocity = vel,
    this.acceleration = new THREE.Vector3(0.0,0.0,0.0),
    this.mass = m,
    this.c = 0xffffff,
    this.alive = true;
    this.sphere_sides = 4
    this.geometry = new THREE.SphereGeometry(1.0,this.sphere_sides,this.sphere_sides);

    this.vertices = [];     // PATH OF MOVEMENT

    this.line = new THREE.Line();       // line to display movement

    this.color = this.line.material.color;

    this.basicMaterial =  new THREE.MeshPhongMaterial({
        color: this.color, specular: this.color, shininess: 10
    });

    this.mesh = new THREE.Mesh(this.geometry,this.basicMaterial);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;

    this.position = this.location;

    this.index = movers.length;
    this.selected = false;

    scene.add(this.mesh);

    this.applyForce = function(force) {
        if (!this.mass) this.mass = 1.0;
        var f = force.divideScalar(this.mass);
        this.acceleration.add(f);
    };
    this.update = function() {

        this.velocity.add(this.acceleration);
        this.location.add(this.velocity);
        this.acceleration.multiplyScalar(0);

        this.mesh.position.copy(this.location);
        if (this.vertices.length > 10000) this.vertices.splice(0,1);

        this.vertices.push(this.location.clone());
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

        if (m.selected) this.selected = true;
        this.color.lerpHSL(m.color, m.mass /  (m.mass + this.mass));
      
        m.kill();
    };
    this.kill = function () {
        this.alive=false;
        //this.selectionLight.intensity = 0;
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        scene.remove(this.mesh);

    };
    this.attract = function(m) { // m => other Mover object
        var force = new THREE.Vector3().subVectors(this.location,m.location); // Calculate direction of force
        var d = force.lengthSq();
        if (d<0) d*=-1;
        force = force.normalize();
        var strength = - (10 * this.mass * m.mass) / (d);  // Calculate gravitional force magnitude
        force = force.multiplyScalar(strength); // Get force vector --> magnitude * direction
        
        this.applyForce(force);
    };
    this.display = function() {
        if (this.alive) {
            var scale = Math.pow((this.mass*MASS_FACTOR/(4*Math.PI)), 1/3);
            this.mesh.scale.x = scale;
            this.mesh.scale.y = scale;
            this.mesh.scale.z = scale;

        } else {
            this.mesh.dispose();
        }

    };

    // this.showTrails = function() {
        if (!this.lineDrawn) {
            this.lineDrawn = true;
            scene.add(this.line);
        } else if (this.lineDrawn === true) {
            scene.remove(this.line);
            var newLineGeometry = new THREE.Geometry();
            newLineGeometry.vertices = this.vertices.slice();
            newLineGeometry.verticesNeedUpdate = true;
            if (!pause && !this.alive) {
                if (this.lineDrawn === true) {
                  this.vertices.shift();  
                }
            }
            while (newLineGeometry.vertices.length > parseInt(100)) {
                newLineGeometry.vertices.shift();
            }
            this.line = new THREE.Line(newLineGeometry, this.line.material);
            scene.add(this.line);
        }
    // }
}

// Updates movement and math of current shooting stars
const updateShootingStars = () => {
    var movers_alive_count = 0;
    // total_mass = 0;
    var maximum_mass = 0.00;
    //loop through all shooting stars
    for (var i = movers.length-1; i >= 0; i--) {

        var m = movers[i];
        // update so they continue on their path
        m.update();

        if(m.location.y <= 0){ // Kills shooting stars below the horizon
            m.kill();
        } 

        if (m.alive) {
                    // movers.push(new Mover(40, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 100, -500)));
                    // If clicking, set and calculate, otherwise don't
            if(intersects){
                a = new Mover(100, new THREE.Vector3(0, 0, 0), new THREE.Vector3(intersects.x, intersects.y, -500));
                // a.update();
                // a.display();
                if (movers[i].alive) {
                    var distance = m.location.distanceTo(a.location);

                    var radiusM = Math.pow((m.mass / MASS_FACTOR/MASS_FACTOR / 4* Math.PI), 1/3)/3;
                    var radiusA = Math.pow((a.mass / MASS_FACTOR/MASS_FACTOR / 4* Math.PI), 1/3)/6;

                    if (distance < radiusM + radiusA) {
                        // Close enough to mouse to have been caught
                        a.eat(m);
                        console.log('Star caught!')
                    }
                    else
                    {
                        // Not close enough to be caught, but is attracted
                        m.attract(a);
                    }
                }
            }
        }
    }
}

// Generates a new shooting star in the top right, moving towards the bottom left at a random speed
const createShootingStar = () => {
	let speed = -1*(1+Math.random()*5);
	movers.push(new Mover(1, new THREE.Vector3(speed, speed, 0), new THREE.Vector3(500+Math.random()*800, 500+Math.random()*800, -500)));
}

// Individually remove all objects related to WelcomePage
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
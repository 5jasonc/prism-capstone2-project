'use strict';

import * as THREE from '../build/three.module.js';
import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { mapNumToRange, hashFunc, shiftRight, showWishEntry } from './utils.js';

let controls;
let scene, renderer, camera;
let jelly;

const init = () => {
    const canvas = document.querySelector('#app');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth  / window.innerHeight, 0.1, 20000);
    const light = new THREE.PointLight(0xffffff, 1);
    camera.add(light);
    renderer = new THREE.WebGLRenderer({canvas, alpha: true, antialias: true}); // antialias T or F, which looks better?
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    const renderScene = new RenderPass(scene, camera);
    renderScene.renderToScreen = false;
	const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.5;
	bloomPass.strength = 1;
	bloomPass.radius = 0.5;
    bloomPass.renderToScreen = true;
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
	composer.addPass(bloomPass);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
	controls.listenToKeyEvents(window);

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    document.body.appendChild(renderer.domElement);
    camera.position.set(0, 0, -200);
    controls.maxDistance = 300;
    controls.minDistance = 100;
    scene.add(camera);

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    if(!urlParams.get('wish')) document.querySelector('#errortext').innerHTML = 'ERROR: Wish does not exist!';
    else {
        $.ajax({
            url: `https://www.purgomalum.com/service/containsprofanity?text=${urlParams.get('wish').trim()}`
        }).then(isWishBad => {
            if(isWishBad === 'true') {
                document.querySelector('#errortext').innerHTML = 'ERROR: Wish does not exist!';
                return;
            }
            document.querySelector('#errortext').innerHTML = '';
            loadJelly(urlParams.get('wish'));
            const clock = new THREE.Clock();
            animate(composer, clock);
        });
    }
};

const animate = (renderer, clock) => {
    const delta = clock.getDelta();
    requestAnimationFrame(() => animate(renderer, clock));

    jelly.jellyParent.rotateX((Math.PI / 1000) * Math.random());
    jelly.jellyParent.rotateZ((Math.PI / 1000) * Math.random());
  
    // Make jellies pulsate through geometry transforms
    const position = jelly.jellyMesh.geometry.attributes.position;
    const vector = new THREE.Vector3();

    for(let pointIndex = 0; pointIndex < position.count; pointIndex++) {
        vector.fromBufferAttribute(position, pointIndex);
        vector.applyMatrix4(jelly.jellyMesh.matrix);
        let size = 12;
        let magnitude = 7;
        let dist = new THREE.Vector3(vector.x, vector.y, vector.z).sub(new THREE.Vector3(0, 1000, 0));
        vector.normalize();
        vector.multiplyScalar(40 + Math.sin(dist.length() / -size + jelly.a) * magnitude);
        position.setXYZ(pointIndex, vector.x, vector.y, vector.z);
    }
    position.needsUpdate = true;
    for(let lineIndex = 0; lineIndex < jelly.jellyWidthSegments + 1; lineIndex++) {
        const temppoints = [];
        let positions = jelly.lines[lineIndex].geometry.attributes.position.array;

        for(let jIndex = jelly.jellyWidthSegments + 1; jIndex < (jelly.jellyWidthSegments * jelly.jellyHeightSegments); jIndex += (jelly.jellyWidthSegments+1)) {    
            var vec = new THREE.Vector3();
            vec.fromBufferAttribute(position, lineIndex + jIndex)
            temppoints.push(vec);
        }

        for(let k = 0; k < jelly.jellyHeightSegments + 1; k++) {
            let point = temppoints[k];
            if(temppoints[k] !== undefined) {
                shiftRight(positions, point.z);
                shiftRight(positions, point.y);
                shiftRight(positions, point.x);
            }    
        }
        jelly.lines[lineIndex].geometry.attributes.position.needsUpdate = true; // required after the first render
    }
    jelly.jellyMesh.geometry.verticesNeedUpdate = true;
    jelly.jellyMesh.geometry.normalsNeedUpdate = true;
    jelly.jellyMesh.geometry.computeVertexNormals();
    jelly.jellyMesh.geometry.computeFaceNormals();
    jelly.a += jelly.aStep;
    jelly.jellyMesh.geometry.scale(1.15, 1.15, 1.15);

    // update controls re-render scene
    controls.update();
    renderer.render(delta);
};

const loadJelly = (wish) => {
    document.querySelector('#wishText').innerHTML = wish;
    const jellyCode = hashFunc(wish);
    const jellyWidthSegments = Math.round(mapNumToRange(jellyCode.substring(0, 2), 1, 99, 8, 20));
    const jellyHeightSegments = Math.round(mapNumToRange(jellyCode[2], 0, 9, 8, 15));
    const colorArray = ['#490085', '#ad538b', '#ff005d', '#2206c4', '#DE41F2', '#765b8c', '#0e47ab'];
    const jellyColor = colorArray[Math.round(mapNumToRange(jellyCode[3], 0, 9, 0, colorArray.length - 1))];
    const jellyAnimSpeed = mapNumToRange(jellyCode[4], 0, 9, 0.01, 0.09);
    const jellyGeometery = new THREE.SphereGeometry(15, jellyWidthSegments, jellyHeightSegments, 0, 6.283, 0, 1.7);
    const outerMaterial = new THREE.MeshBasicMaterial({color: jellyColor, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide});
    const lineMat = new THREE.LineBasicMaterial({color:0xffffff, transparent: true, opacity: 0.25});

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
    parent.add(jellyMesh);
    for(let i=0; i<lines.length; i++){
		jellyMesh.add(lines[i]);
        lines[i].geometry.attributes.position.needsUpdate = true;
	}
    scene.add(parent);

    $('#wishtxtbox').fadeIn();
    $('#wishText').fadeIn();
    jelly = {jellyMesh, lines, jellyParent: parent, aStep: jellyAnimSpeed, a: 0, jellyWidthSegments: jellyWidthSegments, jellyHeightSegments: jellyHeightSegments};
};

window.onload = init;

"use strict";

import * as THREE from '../build/three.module.js';

import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';

let camera, scene, renderer, controls;
let parent, geometry, mesh;
let container, composer;
let jellyGeometry;
let center = new THREE.Vector3(0, 4000, 0);
var timestep = 0;
let a = 0;

const params = {

	animate: true,
	size: 12,
	magnitude: 7,
	segments: 16,
	wireframe: true
	
};

// const material = new THREE.MeshLambertMaterial( { color: 0xffffff } );

const material = new THREE.MeshLambertMaterial( { color: 0x2194CE } );
						// THREE.guiMaterial( gui, mesh, material, geometry );
						// THREE.guiMeshLambertMaterial( gui, mesh, material, geometry );
						material.side = THREE.DoubleSide;

const wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff, opacity: 0.3, wireframe: true, transparent: true } );

function addJelly(){

	if (mesh !== undefined){
			parent.remove( mesh );
			mesh.geometry.dispose();
	}

	jellyGeometry = new THREE.SphereGeometry(15, params.segments, params.segments, 0, 6.3, 0, 1.7);

	addGeometry( jellyGeometry );

}

function addGeometry( geometry ) {

	// 3D shape
	if (params.wireframe) {
		mesh = new THREE.Mesh( geometry, wireframeMaterial );
		const wireframe = new THREE.Mesh( geometry, wireframeMaterial );
		mesh.add( wireframe );
	} else {
		mesh = new THREE.Mesh( geometry, material );
	}

	parent.add( mesh );

}

init();
animate();

function init(){

	container = document.getElementById( 'container' );

	// camera

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.01, 1000 );
	camera.position.set( 0, 10, 150 );

	// scene

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x000000 );

	// light

	const light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 0, 0, 1 );
	scene.add( light );

	scene.add( new THREE.AmbientLight( 0x404040 ) );

	const pointLight = new THREE.PointLight( 0xffffff, 1 );
	camera.add( pointLight );

	// renderer

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
		renderer.toneMapping = THREE.ReinhardToneMapping;
	container.appendChild( renderer.domElement );	



	// controls

	controls = new OrbitControls(camera, renderer.domElement)
	controls.listenToKeyEvents( window ); // optional

	// jelly

	parent = new THREE.Object3D();
	scene.add( parent );

	addJelly();

	// GUI
	const gui = new dat.GUI();
	gui.add( params, 'animate' );
	gui.add( params, 'size' ).min( 1 ).max( 15 );
	gui.add( params, 'magnitude' ).min( 1 ).max( 15 );
	gui.add( params, 'segments' ).min( 5 ).max( 40 ).onChange( function () {
		addJelly();
	} );
	gui.add( params, 'wireframe' ).onChange( function () {
		addJelly();
	} );


	const renderScene = new RenderPass( scene, camera );

	const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
	bloomPass.threshold = 0;
	bloomPass.strength = 1.5;
	bloomPass.radius = 0;

	composer = new EffectComposer( renderer );
	composer.addPass( renderScene );
	composer.addPass( bloomPass );
}

function animate() {

    requestAnimationFrame(animate);

    if ( mesh.isMesh && params.animate) {
   
        const position = mesh.geometry.attributes.position;
        const vector = new THREE.Vector3();

        for ( let i = 0; i < position.count; i ++ ){
            // console.log("yes");
           vector.fromBufferAttribute( position, i );
           vector.applyMatrix4( mesh.matrixWorld );
            let size = params.size;
            let magnitude = params.magnitude;
            let dist = new THREE.Vector3(vector.x, vector.y, vector.z).sub(center);

            vector.normalize();
            vector.multiplyScalar(40 + Math.sin(dist.length()/-size + a) * magnitude);
            position.setXYZ(i, vector.x, vector.y, vector.z);

        }
        position.needsUpdate = true;
        mesh.geometry.verticesNeedUpdate = true;
        mesh.geometry.normalsNeedUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeFaceNormals();
        a += 0.02;

    }

    composer.render(scene, camera); 

};
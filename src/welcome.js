
"use strict";


import * as THREE from '../build/three.module.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from './jsm/postprocessing/FilmPass.js';
import { BokehPass } from './jsm/postprocessing/BokehPass.js';

var site = site || {};
site.window = $(window);
site.document = $(document);
site.Width = site.window.width();
site.Height = site.window.height();

let container;
let camera, scene, renderer;
let mouseX = 0;
let mouseY = 0;
var windowHalfX = site.Width / 2;
var windowHalfY = site.Height / 2;

const params = {

	animate: true,
	size: 12,
	magnitude: 7,
	segments: 16,
	wireframe: false,
	focus: 100.0,
	aperture: 2,
	maxblur: 0.025

};

$('#welcomescreen').on('mousemove', onDocumentMouseMove);
init();
animate();

function init(){
	

	container = document.getElementById( 'container' );

	// camera

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.01, 1000 );
	camera.position.set( 0, 0, 10 );

	// scene

	scene = new THREE.Scene();
	// scene.background = new THREE.Color( 0x000000 );

	// light
    	const pointLight = new THREE.PointLight( 0xffffff, 1 );
	camera.add( pointLight );

	const light = new THREE.DirectionalLight( 0xffffff );
	light.position.set( 0, 0, 10.10 );
	scene.add( light );

	scene.add( new THREE.AmbientLight( 0xffffff ) );

	// renderer

	renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ReinhardToneMapping;
	container.appendChild( renderer.domElement );	

	// particle system
	// createParticleSystem();

	// controls

	// controls = new OrbitControls(camera, renderer.domElement)
	// controls.listenToKeyEvents( window ); // optional

	// jelly

	parent = new THREE.Object3D();
	scene.add( parent );

    // TEST CUBE
    addCubes(10);

}

function animate() {


    camera.position.x += ( (mouseX * .005) - camera.position.x ) * .05;
    camera.position.y += ( -(mouseY * .005) - camera.position.y ) * .05;

    camera.lookAt( scene.position );

    requestAnimationFrame(animate);
	
    // cube.rotation.y += 0.01;

    renderer.render(scene, camera); 

	
};

function onDocumentMouseMove( event ) {
    mouseX = ( event.clientX - windowHalfX ) / 2;
    mouseY = ( event.clientY - windowHalfY ) / 2;
 }

 function addCubes(n){

    const geometry = new THREE.BoxGeometry( 1, 1, 1 );
    const material = new THREE.MeshPhongMaterial( {color: 0xffffff, wireframe: false} );
    let spread = 5;
    let max = spread*2;


     for(let i=0; i<n; i++){
        let cube = new THREE.Mesh( geometry, material );
        if(n%1 == 0){
            cube.position.x = ((Math.random()*max)-spread)+1;
            cube.position.y = ((Math.random()*max)-spread)+1;
            cube.position.z = ((Math.random()*max)-spread)+1;
        }
        else {
            cube.position.x = Math.random()*-spread;
            cube.position.y = Math.random()*-spread;
        }

        scene.add( cube );
     }
 }
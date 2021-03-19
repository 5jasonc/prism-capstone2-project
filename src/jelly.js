
"use strict";

import * as THREE from '../build/three.module.js';

import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from './jsm/postprocessing/FilmPass.js';
import { BokehPass } from './jsm/postprocessing/BokehPass.js';

let camera, scene, renderer, controls;
let parent, geometry, mesh, subMesh;
let container, composer;
let jellyGeometry;
let particles;
let center = new THREE.Vector3(0, 4000, 0);
var timestep = 0;
let a = 0;
var clock = new THREE.Clock();
let width = window.innerWidth;
let height = window.innerHeight;
const loader = new THREE.TextureLoader();



const params = {

	animate: true,
	size: 12,
	magnitude: 7,
	segments: 16,
	wireframe: false,
	focus: 100.0,
	aperture: 8,
	maxblur: 0.025

};

// const material = new THREE.MeshLambertMaterial( { color: 0xffffff } );

const texture = loader.load( "../uv-lines.png" );
texture.center.set = (0.5, 0.5);

const outerMaterial = new THREE.MeshPhongMaterial({ color: 0xe256cd, transparent: true, opacity: 0.25, depthWrite: false})
outerMaterial.side = THREE.DoubleSide;
const innerMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, depthWrite: false, map: texture})
innerMaterial.side = THREE.DoubleSide;

const material = new THREE.MeshLambertMaterial( { color: 0x2194CE} );
material.side = THREE.DoubleSide;

const wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0xe256cd, wireframe: true } );

const vertexShader = ` 
			varying vec3 vPosition;

      void main() {
        vPosition = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float ps = 1.-distance(vPosition, vec3(0.));
        gl_PointSize = 10.*ps;
        gl_Position = projectionMatrix * mvPosition;
      }
`

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
`


function createParticleSystem() {
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
	particles.scale.set(200,200,200)
	scene.add(particles);
	particles.rotation.z=-0.5
}

function addJelly(){

	if (mesh !== undefined){
			parent.remove( mesh );
			mesh.geometry.dispose();
			parent.remove( subMesh );
			subMesh.geometry.dispose();
	}

	jellyGeometry = new THREE.SphereGeometry(15, params.segments, params.segments, 0, 6.283, 0, 1.7);

	addGeometry( jellyGeometry );

}

function addGeometry( geometry ) {

	// 3D shape
	if (params.wireframe) {
		mesh = new THREE.Mesh( geometry, wireframeMaterial );
		subMesh = new THREE.Mesh( geometry, wireframeMaterial );
	} else {
		mesh = new THREE.Mesh( geometry, outerMaterial );
		subMesh = new THREE.Mesh( geometry, innerMaterial );
		// let wireframeMesh = new THREE.Mesh( geometry, wireframeMaterial );
		// mesh.add( wireframeMesh );
	}

	mesh.depthWrite = false;
	subMesh.depthWrite = false;
	parent.add( mesh );
	parent.add( subMesh );
	

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
	light.position.set( 0, 0, 0.10 );
	scene.add( light );

	scene.add( new THREE.AmbientLight( 0x404040 ) );

	// const pointLight = new THREE.PointLight( 0xffffff, 1 );
	// camera.add( pointLight );

	// renderer

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ReinhardToneMapping;
	container.appendChild( renderer.domElement );	

	// particle system
	createParticleSystem();

	// controls

	controls = new OrbitControls(camera, renderer.domElement)
	controls.listenToKeyEvents( window ); // optional

	// jelly

	parent = new THREE.Object3D();
	scene.add( parent );

	addJelly();
	subMesh.scale.set(0.98,0.65,0.98)


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

	// Render Pass Effects
	const renderScene = new RenderPass( scene, camera );

	const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
	bloomPass.threshold = 0;
	bloomPass.strength = 1.5;
	bloomPass.radius = 0;
	bloomPass.renderToScreen = true;

	const filmPass = new FilmPass(
		0.15,   // noise intensity
		0.025,  // scanline intensity
		0,    // scanline count
		false,  // grayscale
	);
	filmPass.renderToScreen = true;
	
	const bokehPass = new BokehPass( scene, camera, {
		focus: params.focus,
		aperture: params.aperture * 0.00001,
		maxblur: params.maxblur,

		width: width,
		height: height
	} );

	bokehPass.renderToScreen = true;
	bokehPass.needsSwap = true;

	composer = new EffectComposer( renderer );
	composer.addPass( renderScene );
	composer.addPass( bloomPass );
	composer.addPass(filmPass);
	composer.addPass(bokehPass);

}

function animate() {
	var delta = clock.getDelta();
	
    requestAnimationFrame(animate);

	particles.rotation.y+=0.001;
	// subMesh.scale = 0.785;
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

	composer.render(delta);
    // composer.render(scene, camera); 

	
};
"use strict";


import * as THREE from '../build/three.module.js';
import Stats from './jsm/libs/stats.module.js';
import {
	GUI
} from './jsm/libs/dat.gui.module.js';
import {
	Water
} from './jsm/objects/Water.js';
import {
	Sky
} from './jsm/objects/Sky.js';
import {
	OrbitControls
} from './jsm/controls/OrbitControls.js';


import {
	EffectComposer
} from './jsm/postprocessing/EffectComposer.js';
import {
	RenderPass
} from './jsm/postprocessing/RenderPass.js';
import {
	UnrealBloomPass
} from './jsm/postprocessing/UnrealBloomPass.js';
import {
	FilmPass
} from './jsm/postprocessing/FilmPass.js';
import {
	BokehPass
} from './jsm/postprocessing/BokehPass.js';

var site = site || {};
site.window = $(window);
site.document = $(document);
site.Width = site.window.width();
site.Height = site.window.height();

let container, stats;
let camera, scene, renderer;
let mouseX = 0;
let mouseY = 0;
var windowHalfX = site.Width / 2;
var windowHalfY = site.Height / 2;
let makewish = false;
let controls, water, sun, mesh;

const {
	autoPlay,
	Easing,
	onTick,
	Tween
} = TWEEN;

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

function init() {
	container = document.getElementById('container');

	// camera

	camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000);
	camera.position.set(0, 0, 10);

	// Listen for window resize and update renderer accordingly
	window.addEventListener('resize', () => {
		renderer.setSize(window.innerWidth, window.innerHeight);
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
	});

	// scene
	scene = new THREE.Scene();
	// scene.background = new THREE.Color( 0x000000 );

	// light
	const pointLight = new THREE.PointLight(0xffffff, 1);
	camera.add(pointLight);

	const light = new THREE.DirectionalLight(0xffffff);
	light.position.set(0, 0, 10.10);
	scene.add(light);

	scene.add(new THREE.AmbientLight(0xffffff));

	// renderer
	renderer = new THREE.WebGLRenderer({
		antialias: true,
		alpha: true
	});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.NoToneMapping = THREE.ACESFilmicToneMapping;
	container.appendChild(renderer.domElement);

	// particle system
	// createParticleSystem();

	// controls
	//controls = new OrbitControls(camera, renderer.domElement)
	//controls.listenToKeyEvents( window ); // optional

	controls = new OrbitControls(camera, renderer.domElement);
	controls.maxPolarAngle = Math.PI * 0.495;
	controls.target.set(0, 10, 0);
	controls.minDistance = 40.0;
	controls.maxDistance = 200.0;
	controls.update();

	// jelly

	sun = new THREE.Vector3();
	// Water
	const waterGeometry = new THREE.PlaneGeometry(10000, 10000);

	water = new Water(
		waterGeometry, {
			textureWidth: 560,
			textureHeight: 560,
			waterNormals: new THREE.TextureLoader().load('../waternormals.jpeg', function (texture) {

				texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

			}),
			sunDirection: new THREE.Vector3(),
			sunColor: 0xffffff,
			waterColor: 0xaccde8,
			distortionScale: 6,
			fog: scene.fog !== undefined
		}
	);

	water.rotation.x = -Math.PI / 2;
	scene.add(water);

	parent = new THREE.Object3D();
	scene.add(parent);

	// Skybox
	const sky = new Sky();
	sky.scale.setScalar(10000);
	scene.add(sky);

	const skyUniforms = sky.material.uniforms;

	skyUniforms['turbidity'].value = 20;
	skyUniforms['rayleigh'].value = 0.036;
	skyUniforms['mieCoefficient'].value = 0;
	skyUniforms['mieDirectionalG'].value = 1;

	const parameters = {
		inclination: 0.4857,
		azimuth: 0.252,
		exposure: 0.1389
	};

	const pmremGenerator = new THREE.PMREMGenerator(renderer);

	function updateSun() {

		const theta = Math.PI * (parameters.inclination - 0.5);
		const phi = 2 * Math.PI * (parameters.azimuth - 0.5);

		sun.x = Math.cos(phi);
		sun.y = Math.sin(phi) * Math.sin(theta);
		sun.z = Math.sin(phi) * Math.cos(theta);

		sky.material.uniforms['sunPosition'].value.copy(sun);
		water.material.uniforms['sunDirection'].value.copy(sun).normalize();

		scene.environment = pmremGenerator.fromScene(sky).texture;
		//

		controls = new OrbitControls(camera, renderer.domElement);
		controls.maxPolarAngle = Math.PI * 0.495;
		controls.target.set(0, 10, 0);
		controls.minDistance = 40.0;
		controls.maxDistance = 200.0;
		controls.update();
	}

	updateSun();

	// TEST CUBE
	//addCubes(10);

	window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

}

function animate() {

	// CAMERA ANIMATION ON MOUSE MOVE
	// if (makewish == false) {
	// 	camera.position.x += ((mouseX * .005) - camera.position.x) * .05;
	// 	camera.position.y += (-(mouseY * .005) - camera.position.y) * .05;

	// 	camera.lookAt(scene.position);
	// }

	TWEEN.update();
	requestAnimationFrame(animate);
	render();
}

function render() {
	const time = performance.now() * 0.001;

	water.material.uniforms['time'].value += 1.0 / 60.0;

	renderer.render(scene, camera);
}

$('.welcometxt').click(wish);
$('.controlscontainer').delay(800).fadeIn();

function wish() {

	makewish = true;

	new TWEEN.Tween(camera.position)
		.to({
			'y': 100
		}, 5000)
		.easing(Easing.Circular.InOut)
		.start();

	$('#welcomescreen').fadeOut(1000, 0);
	$('#container').attr('style', 'background-color: black');
	$('.starveiw').fadeIn(3000);
	$('#container').fadeOut(5000,0)

	setTimeout(
		function () {
			$("#storycover").fadeOut(2000);
		}, 7000
	);
}

function onDocumentMouseMove(event) {
	mouseX = (event.clientX - windowHalfX) / 2;
	mouseY = (event.clientY - windowHalfY) / 2;
}

function addCubes(n) {

	const geometry = new THREE.BoxGeometry(1, 1, 1);
	const material = new THREE.MeshPhongMaterial({
		color: 0xf64A8A,
		wireframe: false,
		opacity: 0.3
	});
	let spread = 5;
	let max = spread * 2;


	for (let i = 0; i < n; i++) {
		let cube = new THREE.Mesh(geometry, material);
		if (n % 1 == 0) {
			cube.position.x = ((Math.random() * max) - spread) + 1;
			cube.position.y = ((Math.random() * max) - spread) + 1;
			cube.position.z = ((Math.random() * max) - spread) + 1;
		} else {
			cube.position.x = Math.random() * -spread;
			cube.position.y = Math.random() * -spread;
		}

		parent.add(cube);
	}
}


window.onload = () => {
	init();
	animate();
};
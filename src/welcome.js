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
import { OrbitControls } from './jsm/controls/OrbitControls.js';



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
let controls, water, sun, mesh, particles;
let movers = [];
var lastTimeCalled = new Date();
var countFramesPerSecond=0;
var total_mass = 0;
var lerpLookAt = new THREE.Vector3();
var lookAt = new THREE.Vector3();
let time = new THREE.Clock();

var MASS_FACTOR = .01; // for display of size

var SPHERE_SIDES = 12;

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
			textureWidth: 512,
			textureHeight: 512,
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

	// Generates stars, at 0% opacity
	generateStars();

	// movers.push(new Mover(1, new THREE.Vector3(-1, -1, 0), new THREE.Vector3(500, 500, -500)));
	// movers.push(new Mover(1, new THREE.Vector3(-0.5, -0.5, 0), new THREE.Vector3(800, 500, -500)));
	// movers.push(new Mover(40, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 100, -500)));

	// TEST CUBE
	//addCubes(10);

	window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

}

const vertexShader = ` 
			varying vec3 vPosition;

      void main() {
        vPosition = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float ps = 1.-distance(vPosition, vec3(0.));
        gl_PointSize = ps*3.;
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

function generateStars() {
	const geometry = new THREE.BufferGeometry();

	const N = 2000;
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
	
	  vertexShader: vertexShader,
	  fragmentShader: fragmentShader,
	  transparent: true,
	  depthWrite: true
	  //https://threejs.org/docs/#api/en/constants/CustomBlendingEquations
	});
	
	particles = new THREE.Points(geometry, shaderMaterial);
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
    this.geometry = new THREE.SphereGeometry(1.0,SPHERE_SIDES,SPHERE_SIDES);

    this.vertices = [];     // PATH OF MOVEMENT

    this.line = new THREE.Line();       // line to display movement

    this.color = this.line.material.color;
    //this.line = THREE.Line(this.lineGeometry, lineMaterial);

    this.basicMaterial =  new THREE.MeshPhongMaterial({
        color: this.color, specular: this.color, shininess: 10
    });

    //this.selectionLight = new THREE.PointLight(this.color,.1);
    //this.selectionLight.position.copy(this.location);
    this.mesh = new THREE.Mesh(this.geometry,this.basicMaterial);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;


    this.position = this.location;

    this.index = movers.length;
    this.selected = false;

    scene.add(this.mesh);
    //scene.add(this.selectionLight);
    this.applyForce = function(force) {
        if (!this.mass) this.mass = 1.0;
        var f = force.divideScalar(this.mass);
        this.acceleration.add(f);
    };
    this.update = function() {

        this.velocity.add(this.acceleration);
        this.location.add(this.velocity);
        this.acceleration.multiplyScalar(0);

        //this.selectionLight.position.copy(this.location);
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

           //this.line = new THREE.Line(this.lineGeometry,lineMaterial);

            //if (isMoverSelected && this.selected) {
            //    this.selectionLight.intensity = 2;    
            //} else {
            //    this.selectionLight.intensity = constrain(this.mass / total_mass, .1, 1);
            //}
            // var emissiveColor = this.color.getHex().toString(16);
            // emissiveColor = 1; // darkenColor(emissiveColor,1000); // (1-(total_mass-this.mass)/total_mass)*((isMoverSelected && this.selected)?.5:1));
            // this.basicMaterial.emissive.setHex(parseInt(emissiveColor,16));
        } else {
            //this.selectionLight.intensity = 0;
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

var intervalID = window.setInterval(createShootingStar, 3500);

function createShootingStar(){
	let speed = -1*(1+Math.random()*5);
	movers.push(new Mover(1, new THREE.Vector3(speed, speed, 0), new THREE.Vector3(500+Math.random()*800, 500+Math.random()*800, -500)));

}

function render() {
	// const time = performance.now() * 0.001;

	water.material.uniforms['time'].value += 1.0 / 60.0;

    var movers_alive_count = 0;
    total_mass = 0;
    var maximum_mass = 0.00;
			//loop through all shooting stars
            for (var i = movers.length-1; i >= 0; i--) {

                var m = movers[i];
				// update so they continue on their path
				m.update();

                if (m.alive) {
                    for (var j =  movers.length-1; j >= 0; j--) {
                        var a = movers[j];
                        if (movers[i].alive && movers[j].alive && i != j) {
                            var distance = m.location.distanceTo(a.location);

                            var radiusM = Math.pow((m.mass / MASS_FACTOR/MASS_FACTOR / 4* Math.PI), 1/3)/3;
                            var radiusA = Math.pow((a.mass / MASS_FACTOR/MASS_FACTOR / 4* Math.PI), 1/3)/3;

                            if (distance < radiusM + radiusA) {
                                // merge objects
                                a.eat(m);
                            }
                            else
                            {
                               a.attract(m);
                            }
                        }
                    }
                }
            }

			// Random amount of time in between shooting stars being generated
	

	renderer.render(scene, camera);
}

$('.welcometxt').click(wish);
$('.controlscontainer').delay(800).fadeIn();

function wish() {

	makewish = true;

	// Tweens camera upwards towards the sky
	new TWEEN.Tween(camera.rotation)
		.to({
			'x': 0.25
		}, 5000)
		.easing(Easing.Quadratic.InOut)
		.start();

	$('#welcomescreen').fadeOut(1000, 0);
	// $('#container').attr('style', 'background-color: black');
	$('.starview').fadeIn(1000);
	// $('#container').fadeOut(5000,0)

	console.log('Ready to fade stars in!');

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

// Adds cubes for cursor interactivity demo
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
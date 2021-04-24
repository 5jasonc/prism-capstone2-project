
"use strict";


import * as THREE from '../build/three.module.js';

import Stats from './jsm/libs/stats.module.js';

import { OrbitControls } from './jsm/controls/OrbitControls.js';
import { EffectComposer } from './jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from './jsm/postprocessing/FilmPass.js';
import { BokehPass } from './jsm/postprocessing/BokehPass.js';

let camera, scene, renderer, controls;
let parent, geometry, mesh, subMesh, wireframeMesh;
let container, composer;
let jellyGeometry, lines, materialShader, matShader, linematShader;
let particles, stats;
let center = new THREE.Vector3(0, 4000, 0);
var timestep = 0;
let a = 0;
var clock = new THREE.Clock();
let width = window.innerWidth;
let height = window.innerHeight;
let tentacleGeo, tentacle;
const loader = new THREE.TextureLoader();

const params = {

	animate: true,
	size: 1,
	magnitude: 7,
	segments: 45,
	wireframe: false,

};

let texture = loader.load('../starmap_4k_print.jpeg');
texture.mapping = THREE.EquirectangularReflectionMapping;

const mat = new THREE.MeshPhongMaterial({
	color:0xe256cd,
	transparent: true,
	opacity: 0.25,
	depthWrite: false,
	reflectivity: 0.25,
	envMap: texture
})

mat.onBeforeCompile = (shader) => {
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
mat.side = THREE.DoubleSide;

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

const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, opacity: 1, transparent: true });

const material = new THREE.MeshLambertMaterial( { color: 0x2194CE} );
material.side = THREE.DoubleSide;

// PINK: 0xe256cd
let localPlane;
let capturer;

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

	const vertices = new Float32Array(N);
	let c = 0;
	while (c < N) {
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
	particles.scale.set(100,100,100)
	scene.add(particles);
	particles.rotation.z =- 0.5
}

function addJelly(){

	if (mesh !== undefined){
			parent.remove( mesh );
			mesh.geometry.dispose();
			// parent.remove( subMesh );
			// subMesh.geometry.dispose();
	}

	jellyGeometry = new THREE.SphereGeometry(2, params.segments, params.segments, 0, 6.283, 0, 1.7);
	addGeometry( jellyGeometry );

}

function addGeometry( geometry ) {

	// 3D shape
	if (params.wireframe) {
		mesh = new THREE.Mesh( geometry, wireframeMaterial );
		// subMesh = new THREE.Mesh( geometry, wireframeMaterial );
	} else {
		mesh = new THREE.Mesh( geometry, mat );
		let subJellyGeo = new THREE.SphereGeometry(1, params.segments, params.segments, 0, 6.283, 0, 1.9);

		// Create submesh lines
		const vertex = mesh.geometry.attributes.position;
		lines = [];
		// < vertex.count
		
		for ( let i = 0; i < params.segments+1; i ++ ){
			let temppoints = [];
			for(let j=params.segments; j<(params.segments*params.segments); j+=(params.segments+1)){
				// temppoints.push(j+i);
				var vec = new THREE.Vector3();
				vec.fromBufferAttribute(vertex, i+j)
				temppoints.push(vec);
			}
			// console.log(temppoints);
			const linegeo = new THREE.BufferGeometry().setFromPoints( temppoints );
			lines.push( new THREE.Line( linegeo, lineMat));
		}

		// wireframeMesh = new THREE.Mesh( geometry, wireframeMaterial );
		// mesh.add( wireframeMesh );
	}

	mesh.depthWrite = false;
	// subMesh.depthWrite = false;
	
	for(let i=0; i<lines.length; i++){
		mesh.add(lines[i]);
	}
	parent.add( mesh );
	mesh.position.y = -10
	// parent.add( subMesh );

}

function addTentacles(){

	const MAX_POINTS = 550;

	tentacleGeo = new THREE.BufferGeometry();
	const positions = new Float32Array( MAX_POINTS * 3 ); //3 Vertices per point
	tentacleGeo.setAttribute( 'position', new THREE.BufferAttribute(positions, 3) );
	const tentacleMat = new THREE.LineBasicMaterial( { color: 0xffffff } );

	tentacle = new THREE.Line( tentacleGeo, tentacleMat );
	scene.add(tentacle);

	let numTentacles = 5;

	// for(let i=0; i<numTentacles; i++){
	// 	scene.add(new tentacle.clone);
	// }
}

init();
animate();

function init(){
	container = document.getElementById( 'container' );

	// camera
	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.01, 1000 );
	camera.position.set( 0, 0, 10 );
    
	// init scene and camera
    scene = new THREE.Scene();
    scene.add(camera);

    parent = new THREE.Object3D();
    scene.add(parent);

	// light
	// const light = new THREE.DirectionalLight( 0xffffff, 1 );
	// light.position.set( 0, 100, 0 );
	// scene.add( light );

	scene.add( new THREE.AmbientLight( 0xffffff, 0.25 ) );

	// const pointLight = new THREE.PointLight( 0xffffff, 1 );
	// camera.add( pointLight );

	// renderer
	renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setClearColor(0x000000, 0);	
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ReinhardToneMapping;
	container.appendChild( renderer.domElement );
    
    /* AR MODE STUFF */
    /*======================================================*/
    var onRenderFcts = [];
    
    //handle arToolkitSource
    var arToolkitSource = new THREEx.ArToolkitSource({
        // to read from the webcam
        sourceType: 'webcam',
        // url of the source - valid if sourceType = image|video
    });

    arToolkitSource.init(function onReady() {
        onResize();
    });

    // handle resize
    window.addEventListener('resize', function () {
        onResize()
    });

    function onResize() {
        arToolkitSource.onResizeElement()
        arToolkitSource.copyElementSizeTo(renderer.domElement)
        if (arToolkitContext.arController !== null) {
            arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas)
        }
    }

    //initialize arToolkitContext
    // create atToolkitContext
    var arToolkitContext = new THREEx.ArToolkitContext({
        cameraParametersUrl: THREEx.ArToolkitContext.baseURL + '../data/data/camera_para.dat',
        detectionMode: 'mono',
    });

    // initialize it
    arToolkitContext.init(function onCompleted() {
        // copy projection matrix to camera
        camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
    });

    // update artoolkit on every frame
    onRenderFcts.push(function () {
        if (arToolkitSource.ready === false) return

        arToolkitContext.update(arToolkitSource.domElement)

        // update scene.visible if the marker is seen
        scene.visible = camera.visible
    });

    //Create a ArMarkerControls
    // init controls for camera
    var markerControls = new THREEx.ArMarkerControls(arToolkitContext, camera, {
        type: 'pattern',
        patternUrl: THREEx.ArToolkitContext.baseURL + '../data/data/patt.hiro',
        // patternUrl : THREEx.ArToolkitContext.baseURL + '../data/data/patt.kanji',
        // as we controls the camera, set changeMatrixMode: 'cameraTransformMatrix'
        changeMatrixMode: 'cameraTransformMatrix',
        detectionMode: "mono",
        canvasWidth: width,
        canvasHeight: height,
        maxDetectionRate: 30,
    })
    // as we do changeMatrixMode: 'cameraTransformMatrix', start with invisible scene
    scene.visible = false


    onRenderFcts.push(function (delta) {
        parent.position.y = 3
		//parent.rotation = 180
    })

    //render the whole thing on the page
    // render the scene
    onRenderFcts.push(function () {
        renderer.render(scene, camera);
    })

    // run the rendering loop
    var lastTimeMsec = null
    requestAnimationFrame(function animate(nowMsec) {
        // keep looping
        requestAnimationFrame(animate);
        // measure time
        lastTimeMsec = lastTimeMsec || nowMsec - 1000 / 60
        var deltaMsec = Math.min(200, nowMsec - lastTimeMsec)
        lastTimeMsec = nowMsec
        // call each update function
        onRenderFcts.forEach(function (onRenderFct) {
            onRenderFct(deltaMsec / 1000, nowMsec / 1000)
        });
    });

    /*======================================================*/

	// particle system
	createParticleSystem();

	// controls
	controls = new OrbitControls(camera, renderer.domElement)
	controls.listenToKeyEvents( window ); // optional

	// jelly
	parent = new THREE.Object3D();
	scene.add( parent );

	// Establish Wireframe Clipping 
	// localPlane = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), 0 );
	// wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff, wireframe: true, clippingPlanes: [localPlane] } );

	addJelly();
	// subMesh.scale.set(0.98,0.65,0.98)
	addTentacles();

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

	stats = new Stats();
	document.body.appendChild( stats.dom );

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
		focus: 50,
		aperture: 2 * 0.00001,
		maxblur: 0.25,
		width: width,
		height: height
	} );

	bokehPass.renderToScreen = true;
	bokehPass.needsSwap = true;

	composer = new EffectComposer( renderer );
	composer.addPass( renderScene );
	composer.addPass( bloomPass );
	// composer.addPass(filmPass);
	// composer.addPass(bokehPass);

	// renderer.clippingPlanes = [ localPlane ]; // GUI sets it to globalPlanes
	// renderer.localClippingEnabled = true;

	//CCapture
	// capturer = new CCapture( { format: 'png', quality: 100, timeLimit: 24, autoSaveTime: 0 } );
	// capturer.start();

}

function updateTentacles(){
	const positions = tentacle.geometry.attributes.position.array;
	
	const shiftRight = (collection, value) => {
		for (let i = collection.length - 1; i > 0; i--) {
		  collection[i] = collection[i - 1]; // Shift right
		}
		collection[0] = value; // Place new value at head
		return collection;
	  }

	  shiftRight(positions, parent.position.z);
	  shiftRight(positions, parent.position.y);
	  shiftRight(positions, parent.position.x);

	tentacle.geometry.attributes.position.needsUpdate = true; // required after the first render

}

function animate(time) {
	var delta = clock.getDelta();

	stats.update();

    requestAnimationFrame(animate);

	if(params.animate){
		if(matShader) matShader.uniforms.time.value = time/2000;
		if(linematShader) linematShader.uniforms.time.value = time/2000;
		particles.rotation.y+=0.001;
	}
	// parent.rotateX((Math.PI / 1000) * Math.random());
    // parent.rotateZ((Math.PI / 1000) * Math.random());

	// parent.translateY(0.3);
    // if(parent.position.x < -1300 || parent.position.x > 1300) {
    //   parent.position.x = THREE.Math.clamp(parent.position.x, -1300, 1300);
    //   parent.rotateX(Math.PI);
    // }
    // if(parent.position.y < -1300 || parent.position.y > 1300) {
    //   parent.position.y = THREE.Math.clamp(parent.position.y, -1300, 1300);
    //   parent.rotateY(Math.PI);
    // }
    // if(parent.position.z < -1300 || parent.position.z > 1300) {
    //   parent.position.z = THREE.Math.clamp(parent.position.z, -1300, 1300);
    //   parent.rotateZ(Math.PI);
    // }


	updateTentacles();

	// controls.target = parent.position;
	// controls.update();


	// subMesh.scale = 0.785;
	// localPlane.constant = a * -25;

    // if ( mesh.isMesh && params.animate) {
   
    //     const position = mesh.geometry.attributes.position;
    //     const vector = new THREE.Vector3();

    //     for ( let i = 0; i < position.count; i ++ ){
    //         // console.log("yes");
    //        vector.fromBufferAttribute( position, i );
    //        vector.applyMatrix4( mesh.matrixWorld );
    //         let size = params.size;
    //         let magnitude = params.magnitude;
    //         let dist = new THREE.Vector3(vector.x, vector.y, vector.z).sub(center);

    //         vector.normalize();
    //         vector.multiplyScalar(40 + Math.sin(dist.length()/-size + a) * magnitude);
    //         position.setXYZ(i, vector.x, vector.y, vector.z);
	// 		// for(let j=0; j<lines.length;j++){
	// 		// 	// console.log(lines[j].geometry.attributes.position)
	// 		// 	lines[j].geometry.attributes.position.setXYZ(i, vector.x, vector.y, vector.z)
	// 		// }

    //     }
    //     position.needsUpdate = true;
    //     mesh.geometry.verticesNeedUpdate = true;
    //     mesh.geometry.normalsNeedUpdate = true;
    //     mesh.geometry.computeVertexNormals();
    //     mesh.geometry.computeFaceNormals();
	// 	for(let j=0; j<lines.length;j++){
	// 		lines[j].geometry.verticesNeedUpdate = true;
	// 		lines[j].geometry.normalsNeedUpdate = true;
	// 		lines[j].geometry.computeVertexNormals();
    //     	lines[j].geometry.computeFaceNormals();
	// 	}
        
		
    // }
	// a += 0.025;
	// if(wireframeMesh.material.opacity > 0){
	// wireframeMesh.material.opacity = wireframeMesh.material.opacity - (a*0.0005);
	// }
	// if(mesh.material.opacity < 0.15){
	// mesh.material.opacity = mesh.material.opacity + (a*0.0005);
	// }
	// if(subMesh.material.opacity < 0.25){
	// 	subMesh.material.opacity = subMesh.material.opacity + (a*0.0005);
	// }

	// composer.render(delta);
	
    composer.render(scene, camera); 
	// capturer.capture( renderer.domElement );

	
};
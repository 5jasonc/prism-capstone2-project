
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

let center = new THREE.Vector3(0, 4000, 0);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

var timestep = 0;
let a = 0;

const params = {

	animate: true,
	size: 12,
	magnitude: 7
	
};



// MY JELLY DOME
// const geometry = new THREE.SphereGeometry(1, 10, 10, 0, 2*Math.PI, 0, Math.PI/2);
const controls = new THREE.OrbitControls(camera, renderer.domElement)
controls.listenToKeyEvents( window ); // optional

//controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)

controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
controls.dampingFactor = 0.05;

controls.screenSpacePanning = false;

controls.minDistance = 100;
controls.maxDistance = 500;

controls.maxPolarAngle = Math.PI / 2;

const geometry = new THREE.SphereGeometry(15, 16, 16, 0, 6.3, 0, 1.7);

const material = new THREE.MeshBasicMaterial( {
	color: 0xffffff,
    wireframe: true
} );

const plane = new THREE.Mesh(geometry, material);

// plane.position.y = 1;
// plane.rotation.z = Math.PI;

scene.add( plane );





// console.log( plane.geometry.attributes.position.length )
camera.position.z = 150;



// GUI
const gui = new dat.GUI();
gui.add( params, 'animate' );
gui.add( params, 'size' ).min( 1 ).max( 15 );
gui.add( params, 'magnitude' ).min( 1 ).max( 15 );


const animate = function () {
    requestAnimationFrame(animate);

    if ( plane.isMesh && params.animate) {
   
        const position = plane.geometry.attributes.position;
        const vector = new THREE.Vector3();

        for ( let i = 0; i < position.count; i ++ ){
            // console.log("yes");
           vector.fromBufferAttribute( position, i );
           vector.applyMatrix4( plane.matrixWorld );
            let size = params.size;
            let magnitude = params.magnitude;
            let dist = new THREE.Vector3(vector.x, vector.y, vector.z).sub(center);

            vector.normalize();
            vector.multiplyScalar(40 + Math.sin(dist.length()/-size + a) * magnitude);
            position.setXYZ(i, vector.x, vector.y, vector.z);

        }
        position.needsUpdate = true;
        plane.geometry.verticesNeedUpdate = true;
        plane.geometry.normalsNeedUpdate = true;
        plane.geometry.computeVertexNormals();
        plane.geometry.computeFaceNormals();
        a += 0.02;

    }

    renderer.render(scene, camera); 

};

animate();

// IMPORTED DOME


function createPlane() {
	let geom = new THREE.SphereGeometry(12, 12, 12, 0, 6.3, 0, 1.7);
	let texture = new THREE.Texture(generateTexture());
	let textureImage = texture.image;
	texture.needsUpdate = true;
	let material = new THREE.MeshPhongMaterial({
		map: texture,
		color: 0xbbbbbb,
		shininess: 40,
		emissive: 0x780000,
		wireframe: true,
		side: THREE.DoubleSide
	});
	material.transparent = true;
	plane = new THREE.Mesh(geom, material);
	plane.rotation.z += Math.PI / 2;
	plane.position.x -= 60;
	scene.add(plane);
}

function jellyMovement() {
	let length = plane.geometry.numVertices;

	for (i = 0; i < length; i++) {
		let v = plane.geometry.vertices[i];
		let dist = new THREE.Vector3(v.x, v.y, v.z).sub(center);
		let size = 12;
		let magnitude = 7;
		v
			.normalize()
			.multiplyScalar(40 + Math.sin(dist.length() / -size + a) * magnitude);
	}
	plane.geometry.verticesNeedUpdate = true;
	plane.geometry.normalsNeedUpdate = true;
	plane.geometry.computeVertexNormals();
	plane.geometry.computeFaceNormals();
}

function generateTexture() {
	let size = 512;
	canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	let context = canvas.getContext("2d");
	context.rect(0, 0, size, size);
	let gradient = context.createLinearGradient(0, 0, 0, size);
	gradient.addColorStop(0, "#B5FFFC"); // light blue
	gradient.addColorStop(1, "#FFDEE9"); // dark blue
	context.fillStyle = gradient;
	context.fill();
	return canvas;
}

function loop() {
	jellyMovement();
	a += 0.05;
	aline += 0.3;
	renderer.render(scene, camera);
	requestAnimationFrame(loop);
}

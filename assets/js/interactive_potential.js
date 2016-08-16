var SEGMENTS = 40;
// scales all z values from PLOTTING_DATA
var Z_DIVISION = 150.0;

var camera, controls, scene, renderer;

// scene items to keep
var surfaceMesh;
var gradXArrow, gradYArrow;
var sphereIndicator;

var playbackTime = 0.0;
var previousFrame = 0;
// how many frames to update by per 
var PLAYBACK_INCREMENT = 0.25;
var FRAME_COUNT = PLOTTING_DATA.surface.length;

// useful for coloring height
var zMin, zMax, zRange, zMid;

var canvasEle = document.getElementById('canvas-lidar');
var canvasCtx = canvasEle.getContext('2d');

init();
animate();

function init() {
    scene = new THREE.Scene();

    // Setup camera
    var SCREEN_WIDTH = 400.0, SCREEN_HEIGHT = 400.0;

    var VIEW_ANGLE = 45;
    var ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT;
    var NEAR = 0.1, FAR = 20000;
    camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
    camera.position.set(0, -30, 30);
    camera.up = new THREE.Vector3(0, 0, 1);
    camera.lookAt(new THREE.Vector3(0, 0, 3));

    scene.add(camera);

    // Setup renderer
    if (Detector.webgl) {
        console.log("Using WebGL");
        renderer = new THREE.WebGLRenderer({antialias: true});
    } else {
        console.log("Using canvas");
        renderer = new THREE.CanvasRenderer();
    }
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    // retina
    renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1)


    // Add to DOM
    var container = document.getElementById('ThreeJS-potential');
    container.appendChild(renderer.domElement);

    // Orbit controls
    controls = new THREE.OrbitControls(camera, container);
    controls.minDistance = 15;
    controls.maxDistance = 40;
    controls.target = new THREE.Vector3(0, 0, 3);


    // Lighting
    var light = new THREE.PointLight(0xFFFFFF); // white
    light.position.set(0, 250, 0);
    scene.add(light);

    // Background color
    renderer.setClearColor( 0x888888, 1 );


    var wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0x000088, wireframe: true, side:THREE.DoubleSide } );
    var floorGeometry = new THREE.PlaneGeometry(1000,1000,10,10);
    var floor = new THREE.Mesh(floorGeometry, wireframeMaterial);
    floor.position.z = -0.01;
    // rotate to lie in x-y plane
    // floor.rotation.x = Math.PI / 2;
    scene.add(floor);
    
    var normMaterial = new THREE.MeshNormalMaterial;
    var shadeMaterial = new THREE.MeshLambertMaterial( { color: 0xff0000 } );
    
    // "wireframe texture"
    var wireTexture = new THREE.ImageUtils.loadTexture( 'assets/img/square.png' );
    wireTexture.wrapS = wireTexture.wrapT = THREE.RepeatWrapping;
    wireTexture.repeat.set( 40, 40 );
    wireMaterial = new THREE.MeshBasicMaterial( { map: wireTexture, vertexColors: THREE.VertexColors, side:THREE.DoubleSide } );
    
    var vertexColorMaterial  = new THREE.MeshBasicMaterial( { vertexColors: THREE.VertexColors } );

    createGraph();
    createArrows();
    createSphereIndicator();
}

function createArrows() {
    var xgrad = PLOTTING_DATA.gradients[0][0];
    var ygrad = PLOTTING_DATA.gradients[0][1];

    var gradXDir = new THREE.Vector3(Math.sign(xgrad), 0, 0);
    var gradYDir = new THREE.Vector3(0, Math.sign(ygrad), 0);

    var z = PLOTTING_DATA.surface[0][SEGMENTS/2-1][SEGMENTS/2-1] / Z_DIVISION + 0.5;
    
    gradXArrow = new THREE.ArrowHelper(
        gradXDir, new THREE.Vector3(0,0,z), 1, 0x00ff00, 1, 1);

    gradYArrow = new THREE.ArrowHelper(
        gradYDir, new THREE.Vector3(0,0,z), 1, 0xffff01, 1, 1);

    // TODO fix matrix inversion warning
    scene.add(gradXArrow);
    scene.add(gradYArrow);
}

function createSphereIndicator() {
    var sphereGeometry = new THREE.SphereGeometry(0.3, 30, 30, 0, Math.PI*2, Math.PI*2);
    var sphereMaterial = new THREE.MeshNormalMaterial();
    sphereIndicator = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(sphereIndicator);
}

// requires zMid and zRange to be set
function setHeightColor(color, z) {
    // if below zMid, fade blue into white
    // if above zMid, fade white into red
    if (z < zMid) {
        color.setHSL(0.66, 1, 1 - 0.5*(zMid - z) / (zRange/2.0));
    } else {
        // dont get too dark
        var lightness = Math.max(0.3, 1 - 0.5*(z - zMid) / (zRange/2.0));
        color.setHSL(0, 1, lightness);
    }
}

function createGraph() {
    meshFunc = function(x, y) {
        //var xIdx = Math.min(Math.floor(x * SEGMENTS), SEGMENTS - 1);
        //var yIdx = Math.min(Math.floor(y * SEGMENTS), SEGMENTS - 1);
        var xIdx = Math.floor(x * (SEGMENTS - 1));
        var yIdx = Math.floor(y * (SEGMENTS - 1));

        var z = PLOTTING_DATA.surface[0][xIdx][yIdx] / Z_DIVISION;

        x = 20 * x - 10;
        y = 20 * y - 10;
        return new THREE.Vector3(x, y, z);
    };

    var surfaceGeometry = new THREE.ParametricGeometry(meshFunc, SEGMENTS - 1, SEGMENTS - 1, true);

    // coloring
    surfaceGeometry.computeBoundingBox();
    zMin = surfaceGeometry.boundingBox.min.z;
    zMax = surfaceGeometry.boundingBox.max.z;
    zRange = zMax - zMin;
    zMid = zMin + zRange / 2.0;
    for (var i = 0; i < surfaceGeometry.vertices.length; i++) {
        var point = surfaceGeometry.vertices[i];
        var color = new THREE.Color(0);
        setHeightColor(color, point.z);
        surfaceGeometry.colors[i] = color;
    }
    // copy color
    var faceIndices = ['a', 'b', 'c', 'd'];
    for (var i = 0; i < surfaceGeometry.faces.length; i++) {
        var face = surfaceGeometry.faces[i];
        var numSides = (face instanceof THREE.Face3) ? 3 : 4;
        for (var j = 0; j < numSides; j++) {
            var vertexIndex = face[faceIndices[j]];
            face.vertexColors[j] = surfaceGeometry.colors[vertexIndex];
        }
    }

    // Create surface mesh
    wireMaterial.map.repeat.set(SEGMENTS, SEGMENTS);

    surfaceGeometry.computeFaceNormals();              
    surfaceGeometry.mergeVertices()
    surfaceGeometry.computeVertexNormals();

    surfaceMesh = new THREE.Mesh(surfaceGeometry, wireMaterial);
    surfaceMesh.geometry.dynamic = true;
    surfaceMesh.doubleSided = true;
    scene.add(surfaceMesh);
}

function animate() {
    requestAnimationFrame(animate);

    update();
    render();
}

// linear interpolation between numbers `a` and `b`
// at time 0 <= `t` <= 1
function lerp(a, b, t) {
    return a + t * (b - a);
}

function update() {
    playbackTime = (playbackTime + PLAYBACK_INCREMENT) % FRAME_COUNT;
    var currentFrame = Math.floor(playbackTime);
    var oldFrame = Math.floor(playbackTime);
    var nextFrame = Math.floor(playbackTime + 1) % FRAME_COUNT;
    var lerpTime = playbackTime - oldFrame;

    // UPDATE COLOR
    for (var x = 0; x < SEGMENTS; x++) {
        for (var y = 0; y < SEGMENTS; y++) {
            var oldFrame = Math.floor(playbackTime);
            var nextFrame = Math.floor(playbackTime + 1) % FRAME_COUNT;

            var oldZ = PLOTTING_DATA.surface[oldFrame][x][y] / Z_DIVISION;
            var nextZ = PLOTTING_DATA.surface[nextFrame][x][y] / Z_DIVISION;

            var newZ = lerp(oldZ, nextZ, lerpTime);
            // assign into row major array
            surfaceMesh.geometry.vertices[x + y*SEGMENTS].setZ(newZ);

            // change color
            var color = surfaceMesh.geometry.colors[x + y*SEGMENTS];
            setHeightColor(color, newZ);
        }
    }
    surfaceMesh.geometry.verticesNeedUpdate = true;
    surfaceMesh.geometry.colorsNeedUpdate = true;

    // UPDATE GRADIENT ARROWS
    var oldCenterSurfaceZ = PLOTTING_DATA.surface[oldFrame][SEGMENTS/2][SEGMENTS/2] / Z_DIVISION;
    var nextCenterSurfaceZ = PLOTTING_DATA.surface[nextFrame][SEGMENTS/2][SEGMENTS/2] / Z_DIVISION;
    var centerSurfaceZ = lerp(oldCenterSurfaceZ, nextCenterSurfaceZ, lerpTime);
    gradXArrow.position.setZ(centerSurfaceZ + 0.25);
    gradYArrow.position.setZ(centerSurfaceZ + 0.25);

    var oldxgrad = PLOTTING_DATA.gradients[oldFrame][0];
    var nextxgrad = PLOTTING_DATA.gradients[nextFrame][0];
    var xgrad = lerp(oldxgrad, nextxgrad, lerpTime);

    var oldygrad = PLOTTING_DATA.gradients[oldFrame][1];
    var nextygrad = PLOTTING_DATA.gradients[nextFrame][1];
    var ygrad = lerp(oldygrad, nextygrad, lerpTime);

    var gradXDir = new THREE.Vector3(
        Math.sign(xgrad), 0, 0.25).normalize();
    var gradYDir = new THREE.Vector3(
        0, -Math.sign(ygrad), 0.25).normalize();

    gradXArrow.setDirection(gradXDir);
    gradXArrow.setLength(Math.abs(xgrad) / 150.0, 0.7, 0.4);

    gradYArrow.setDirection(gradYDir);
    gradYArrow.setLength(Math.abs(ygrad) / 300.0, 0.7, 0.4);

    // UPDATE SPHERE INDICATOR
    sphereIndicator.position.setZ(centerSurfaceZ + 0.25);

    // draw lidar
    drawCanvasLidar();

    // END
    previousFrame = currentFrame;
}

function render() {
    renderer.render(scene, camera);
}

// scaling factor of lidar points -> canvas points
var LIDAR_PT_SCALE = 100.0;

var canvasShouldUpdate = true;

function drawCanvasLidar() {
    if (!canvasShouldUpdate) {
        canvasShouldUpdate = !canvasShouldUpdate;
        return;
    }

    canvasCtx.clearRect(0, 0, 500, 500);
    var oldFrame = Math.floor(playbackTime);
    var nextFrame = Math.floor(playbackTime + 1) % FRAME_COUNT;
    var lerpTime = playbackTime - oldFrame;

    for (var i = 0; i < PLOTTING_DATA.lidar[0][0].length; i++) {
        var oldLidarX = PLOTTING_DATA.lidar[oldFrame][0][i];
        var nextLidarX = PLOTTING_DATA.lidar[nextFrame][0][i];
        if (Math.abs(nextLidarX - oldLidarX) > 2.6)
            var lidarX = oldLidarX;
        else
            var lidarX = lerp(oldLidarX, nextLidarX, lerpTime);

        var oldLidarY = PLOTTING_DATA.lidar[oldFrame][1][i];
        var nextLidarY = PLOTTING_DATA.lidar[nextFrame][1][i];
        if (Math.abs(nextLidarX - oldLidarX) > 2.6)
            var lidarY = oldLidarY;
        else
            var lidarY = lerp(oldLidarY, nextLidarY, lerpTime);

        var ptX = canvasEle.width/2.0 - lidarX*LIDAR_PT_SCALE;
        var ptY = canvasEle.height/2.0 - lidarY*LIDAR_PT_SCALE;

        canvasCtx.fillRect(Math.round(ptX), Math.round(ptY), 3, 3);
    }

    canvasCtx.beginPath();
    canvasCtx.fillStyle = '#6d5af8';
    canvasCtx.arc(canvasEle.width/2, canvasEle.height/2, 5, 0, Math.PI*2, true);
    canvasCtx.fill();
    canvasCtx.fillStyle = 'black';

    canvasShouldUpdate = !canvasShouldUpdate;
}


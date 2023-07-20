//Helper Functions

//Linear Algebra etc. 

function getPalmOrientation(worldLandmarks, handedness) {
    // Highlight palm normal vector
    let p1 = landmarkToVec(worldLandmarks[0]);
    let p2 = landmarkToVec(worldLandmarks[5]);
    let p3 = landmarkToVec(worldLandmarks[17]);

    //Flip the direction of the palm landmarks
    if (handedness == "Left") {
        let temp = p1;
        p1 = p3;
        p3 = temp;
    }

    let palmNormal = findNormalVector(p1, p2, p3);

    //For some reason a XZ vector does not give negative angles with angleBetween(1,0,0), hacking with v.z in the y axis instead.
    let palmNormalProjectToXZ = window.p.createVector(palmNormal.x, 0, palmNormal.z);

    let refVector = window.p.createVector(0, 0, 1);
    return window.p.degrees(palmNormalProjectToXZ.angleBetween(refVector)) / 180
}
function landmarkToVec(lm) {
    return window.p.createVector(lm.x, lm.y, lm.z);
}

function findNormalVector(p1, p2, p3) {
    // Finds the normal vector of the plane defined by the three points.
    let a = p5.Vector.sub(p2, p1);
    let b = p5.Vector.sub(p3, p1);
    let c = p5.Vector.cross(a, b);
    return c.normalize(c);
}

// Calculate the Euclidean distance between two 3D points
function calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const dz = point2.z - point1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateCentroid(cluster) {
    const centroid = { x: 0, y: 0, z: 0 };
    const numPoints = cluster.length;
    for (const point of cluster) {
        centroid.x += point.x;
        centroid.y += point.y;
        centroid.z += point.z;
    }
    centroid.x /= numPoints;
    centroid.y /= numPoints;
    centroid.z /= numPoints;
    return centroid;
}

function calculateCompactnessEuclidean(cluster) {
    const centroid = calculateCentroid(cluster);
    let sumDistance = 0;
    for (const point of cluster) {
        const distance = calculateDistance(point, centroid);
        sumDistance += distance;
    }
    return sumDistance / cluster.length;
}

function handResultValid(result) {
    if (result != undefined && result.landmarks.length) {
        return true;
    }
    else {
        return false;
    }
}

function drawHandLandmarks(handLandmarks, landmarkColor, canvas) {
    canvas.noStroke();
    canvas.fill(landmarkColor);
    for (let i = 0; i < handLandmarks.length; i++) {
        const landmark = handLandmarks[i];
        canvas.ellipse(landmark.x * width, landmark.y * height, 8, 8);
    }
}

function drawFingerTipLandmarks(handLandmarks, landmarkColor, canvas) {
    canvas.stroke(landmarkColor);
    canvas.fill(landmarkColor);
    for (let i = 1; i < handLandmarks.length; i++) {
        if (i % 4 == 0) {
            const landmark = handLandmarks[i];
            canvas.ellipse(landmark.x * width, landmark.y * height, 10, 10);
        }
    }
}

function drawHandConnections(landmarks, canvas) {
    // Draw connections between landmarks
    for (let i = 0; i < handLandmarkConnections.length; i++) {
        let [pointAIndex, pointBIndex] = handLandmarkConnections[i];
        let pointA = landmarks[pointAIndex];
        let pointB = landmarks[pointBIndex];
        canvas.stroke(255, 255, 255, 60);
        canvas.strokeWeight(5);
        canvas.line(pointA.x * width, pointA.y * height, pointB.x * width, pointB.y * height);
    }
}

function drawPalmFill(landmarks, palmFill, canvas) {
    let palmLandmarks = [landmarks[0], landmarks[1], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    canvas.fill(palmFill);
    canvas.stroke("white");
    canvas.strokeWeight(2);
    canvas.beginShape();
    for (let i = 0; i < palmLandmarks.length; i++) {
        canvas.vertex(palmLandmarks[i].x * width, palmLandmarks[i].y * height);
    }
    canvas.endShape(window.p.CLOSE);
}
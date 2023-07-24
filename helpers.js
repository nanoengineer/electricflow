const handLandmarkConnections = [
    [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
    [5, 6], [6, 7], [7, 8],  // Index finger
    [9, 10], [10, 11], [11, 12],  // Middle finger
    [13, 14], [14, 15], [15, 16],  // Ring finger
    [0, 17], [17, 18], [18, 19], [19, 20]  // Pinky finger
];

//Helper Functions

//Linear Algebra etc. 

function getPalmOrientation(worldLandmarks, handedness) {
    // Highlight palm normal vector
    let p1 = landmarkToVec(worldLandmarks[0]);
    let p2 = landmarkToVec(worldLandmarks[5]);
    let p3 = landmarkToVec(worldLandmarks[17]);

    //Flip the direction of the palm landmarks
    if (handedness == "Left") {
        [p1, p3] = [p3, p1];
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
    const numPoints = cluster.length;
    return cluster.reduce((a, b) => {
        return {
            x: a.x + b.x / numPoints,
            y: a.y + b.y / numPoints,
            z: a.z + b.z / numPoints
        }
    }, { x: 0, y: 0, z: 0 })
}

function calculateCompactnessEuclidean(cluster) {
    const centroid = calculateCentroid(cluster);
    return cluster.reduce((sumDistance, point) => sumDistance + calculateDistance(point, centroid), 0) / cluster.length;
}

function handResultValid(result) {
    return result?.landmarks?.length > 0;
}

function drawHandLandmarks(handLandmarks, landmarkColor, canvas) {
    canvas.noStroke();
    canvas.fill(landmarkColor);
    for (let landmark of handLandmarks) {
        window.p.ellipse(landmark.x * width, landmark.y * height, 8, 8);
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

function drawHandConnections(landmarks, canvas, fc) {
    // Draw connections between landmarks
    for (let i = 0; i < handLandmarkConnections.length; i++) {
        let [pointAIndex, pointBIndex] = handLandmarkConnections[i];
        let pointA = landmarks[pointAIndex];
        let pointB = landmarks[pointBIndex];
        canvas.stroke(fc);
        canvas.strokeWeight(20);
        canvas.line(pointA.x * width, pointA.y * height, pointB.x * width, pointB.y * height);
    }
}

function drawPalmFill(landmarks, palmFill, canvas) {
    let palmLandmarks = [landmarks[0], landmarks[1], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    canvas.fill(palmFill);
    canvas.stroke("white");
    canvas.strokeWeight(2);
    canvas.beginShape();
    for (let { x, y } of palmLandmarks) {
        window.p.vertex(x * width, y * height);
    }
    canvas.endShape(window.p.CLOSE);
}

// CircularBuffer
class CircularBuffer {
    constructor(size) {
        this.buffer = new Array(size);
        this.size = size;
        this.start = 0;
        this.end = 0;
        this.length = 0;
        this.sum = 0;
    }

    isFull() {
        return this.length === this.size;
    }

    isEmpty() {
        return this.length === 0;
    }

    enqueue(value) {
        if (this.isFull()) {
            // If the buffer is full, overwrite the oldest element. Remove it from the sum
            this.sum -= this.buffer[this.start];
            this.start = (this.start + 1) % this.size;
        } else {
            this.length++;
        }

        this.sum += (value);
        this.buffer[this.end] = value;
        this.end = (this.end + 1) % this.size;
    }

    dequeue() {
        if (this.isEmpty()) {
            return undefined;
        }

        const value = this.buffer[this.start];
        this.sum -= value;
        this.start = (this.start + 1) % this.size;
        this.length--;
        return value;
    }

    peek() {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.buffer[this.start];
    }

    clear() {
        this.buffer.fill(null);
        this.start = 0;
        this.end = 0;
        this.length = 0;
    }

    getAverage() {
        return this.sum / this.buffer.length;
    }
}

class CoordinatesCircularBuffer {
    constructor(size) {
        this.buffer = new Array(size);
        this.size = size;
        this.start = 0;
        this.end = 0;
        this.length = 0;
        this.sum = window.p.createVector(0, 0);
    }

    isFull() {
        return this.length === this.size;
    }

    isEmpty() {
        return this.length === 0;
    }

    enqueue(value) {
        if (this.isFull()) {
            // If the buffer is full, overwrite the oldest element. Remove it from the sum
            this.sum.sub(this.buffer[this.start]);
            this.start = (this.start + 1) % this.size;
        } else {
            this.length++;
        }

        this.sum.add(value);
        this.buffer[this.end] = value;
        this.end = (this.end + 1) % this.size;
    }

    dequeue() {
        if (this.isEmpty()) {
            return undefined;
        }

        const value = this.buffer[this.start];
        this.sum.sub(value);
        this.start = (this.start + 1) % this.size;
        this.length--;
        return value;
    }

    peek() {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.buffer[this.start];
    }

    clear() {
        this.buffer.fill(null);
        this.start = 0;
        this.end = 0;
        this.length = 0;
    }

    getAverage() {
        return p5.Vector.div(this.sum, this.buffer.length);
    }
}



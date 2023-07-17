let canvas;
let width = document.getElementById("video").width;
let height = document.getElementById("video").height;

const handLandmarkConnections = [
    [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
    [5, 6], [6, 7], [7, 8],  // Index finger
    [9, 10], [10, 11], [11, 12],  // Middle finger
    [13, 14], [14, 15], [15, 16],  // Ring finger
    [0, 17], [17, 18], [18, 19], [19, 20]  // Pinky finger
];

let sketch = function (p) {
    let leftHandColor = p.color("#4cbcf5");
    let rightHandColor = p.color("#f5823b");

    let fieldDensity = 3.5;
    let fieldPoints = [];
    let charges = [];

    let t = 0;


    p.setup = function () {
        canvas = p.createCanvas(width, height);
        canvas.id = 'p5canvas';

        for (let i = fieldDensity; i < width / fieldDensity; i += fieldDensity) {
            for (let j = fieldDensity; j < height / fieldDensity; j += fieldDensity) {
                fieldPoints.push(new FieldPoint(i * fieldDensity, j * fieldDensity));
            }
        }

        charges.push(new Charge(width / 2, height / 2, 1));
        charges.push(new Charge(width / 2, height / 2, -1));
        charges.push(new Charge(width / 2, height / 2, 1));
        charges.push(new Charge(width / 2, height / 2, -1));
        charges.push(new Charge(width / 2, height / 2, 2));
        charges.push(new Charge(width / 2, height / 2, -2));
        // charges.push(new Charge(width / 2, height / 2, 60));
        // charges.push(new Charge(width / 2, height / 2, -80));
        // charges.push(new Charge(width / 2, height / 2, -40));



    };

    p.draw = function () {
        p.background(0);
        // p.clear();
        // p.noFill();
        // p.stroke("#51b7cf");
        // p.strokeWeight(5);
        // p.rect(0, 0, width, height);
        let results = window.handDetectionResults;

        if (handResultValid(results)) {
            //Handedness seems to be reversed, a bit of hacking to get the correct colors
            if (results.handednesses.length == 2) {
                for (const hand of results.handednesses) {
                    let dotColor = leftHandColor;
                    if (hand[0].categoryName == "Right") {
                        dotColor = rightHandColor;
                    }
                    const lm = results.landmarks[(hand[0].index)];
                    const wlm = results.worldLandmarks[(hand[0].index)];
                    const palmFill = p.lerpColor(p.color("#FF0000"), p.color("#0000FF"), getPalmOrientation(wlm, hand[0].categoryName));
                    drawPalmFill(lm, palmFill);
                    drawHandConnections(lm);
                    drawHandLandmarks(lm, dotColor);
                }
            } else if (results.handednesses.length == 1) {
                let hand = results.handednesses[0][0];
                let dotColor = leftHandColor;
                if (hand.categoryName == 'Right') {
                    dotColor = rightHandColor;
                }
                const lm = results.landmarks[0];
                const palmFill = p.lerpColor(p.color("#FF0000"), p.color("#0000FF"), getPalmOrientation(results.worldLandmarks[0], hand.categoryName));
                drawPalmFill(lm, palmFill);
                drawHandConnections(lm);
                drawHandLandmarks(lm, dotColor);

                // for (let i = 0; i < 5; i++) {
                //     charges[i].position = p.createVector(lm[(i + 1) * 4].x * width, lm[(i + 1) * 4].y * height);
                // }

            }
        }

        t = t + 0.005;


        for (let i = 0; i < charges.length; i++) {
            let x = p.noise(t + 5 + i) * 1.5 * width;
            let y = p.noise(t + 80 + i) * 1.5 * height;
            charges[i].position = p.createVector(x, y);
        }

        for (ch of charges) {
            ch.draw();
        }

        for (fp of fieldPoints) {
            fp.update(charges);
            fp.draw();
        }
    };

    //helper functions

    class FieldPoint {
        constructor(x, y) {
            this.pos = p.createVector(x, y);
            this.vector = p.createVector(0, 0);
            this.potential = 0;
            this.negativeColor = p.color("#ff0000");
            this.positiveColor = p.color("#0000f7");
        }

        update(charges) {
            const field_potential = getElectricFieldandPotential(charges, this.pos);
            this.vector = field_potential.fieldVector;
            this.potential = field_potential.potential;
        }

        draw() {
            let vectorDrawLength = p.constrain(this.vector.mag() * 10, 0, 25);
            p.stroke(p.lerpColor(this.negativeColor, this.positiveColor, p.map(this.potential, -1000, 1000, 0, 1)));
            p.strokeWeight(3);
            this.vector.normalize();
            p.line(this.pos.x, this.pos.y, this.pos.x - this.vector.x * vectorDrawLength, this.pos.y - this.vector.y * vectorDrawLength)
        }
    }


    function getElectricFieldandPotential(charges, point) {

        const k = 100000;
        let fieldVector = p.createVector(0, 0);
        let potential = 0;

        //electric potential kq/r
        //electric field kq/r^2

        for (let i = 0; i < charges.length; i++) {

            const chPos = charges[i].position;
            const chCharge = charges[i].chargeMag;
            const distance = chPos.dist(point);
            const vectorDirection = p.createVector(chPos.x - point.x, chPos.y - point.y).normalize();
            const v = k * chCharge / (distance);
            const fieldStrength = v / distance;
            potential += v;
            const E = vectorDirection.mult(fieldStrength);
            fieldVector.add(E);
        }
        return { fieldVector, potential };
    }

    class Charge {

        constructor(x, y, charge) {
            this.pos = p.createVector(x, y);
            this.charge = charge
            this.color = p.color(p.random(100) + 125, p.random(100) + 125, p.random(100) + 125);
        }

        draw() {
            // p.fill(this.color)
            // p.circle(this.pos.x, this.pos.y, p.sqrt(p.abs(this.charge) * 100 / p.PI) - 5);
        }

        get chargeMag() {
            return this.charge;
        }

        get position() {
            return this.pos;
        }

        set position(pos) {
            this.pos = pos;
        }
    }

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
        let palmNormalProjectToXZ = p.createVector(palmNormal.x, 0, palmNormal.z);

        let refVector = p.createVector(0, 0, 1);
        return p.degrees(palmNormalProjectToXZ.angleBetween(refVector)) / 180
    }
    function landmarkToVec(lm) {
        return p.createVector(lm.x, lm.y, lm.z);
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

    function drawHandLandmarks(handLandmarks, landmarkColor) {
        p.noStroke();
        p.fill(landmarkColor);
        for (let i = 0; i < handLandmarks.length; i++) {
            const landmark = handLandmarks[i];
            p.ellipse(landmark.x * width, landmark.y * height, 8, 8);
        }
    }

    function drawHandConnections(landmarks) {
        // Draw connections between landmarks
        for (let i = 0; i < handLandmarkConnections.length; i++) {
            let [pointAIndex, pointBIndex] = handLandmarkConnections[i];
            let pointA = landmarks[pointAIndex];
            let pointB = landmarks[pointBIndex];
            p.stroke("white");
            p.strokeWeight(2);
            p.line(pointA.x * width, pointA.y * height, pointB.x * width, pointB.y * height);
        }
    }

    function drawPalmFill(landmarks, palmFill) {
        let palmLandmarks = [landmarks[0], landmarks[1], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
        p.fill(palmFill);
        p.stroke("white");
        p.strokeWeight(2);
        p.beginShape();
        for (let i = 0; i < palmLandmarks.length; i++) {
            p.vertex(palmLandmarks[i].x * width, palmLandmarks[i].y * height);
        }
        p.endShape(p.CLOSE);
    }
};



let myp5 = new p5(sketch, document.getElementById('p5canvas'));
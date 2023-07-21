let canvas;
let width = document.getElementById("video").width * 2;
let height = document.getElementById("video").height * 2;



const handLandmarkConnections = [
    [0, 1], [1, 2], [2, 3], [3, 4],  // Thumb
    [5, 6], [6, 7], [7, 8],  // Index finger
    [9, 10], [10, 11], [11, 12],  // Middle finger
    [13, 14], [14, 15], [15, 16],  // Ring finger
    [0, 17], [17, 18], [18, 19], [19, 20]  // Pinky finger
];

//make p global so other classes can call p5.js functions
window.p = undefined;

//additional graphics canvasses
particleGraphics = undefined;
handGraphics = undefined;


let sketch = function (p) {
    window.p = p;

    let leftHandColor = p.color("#4cbcf5");
    let rightHandColor = p.color("#f5823b");

    let charges = [];

    let aParticles = [];
    let bParticles = [];
    let cParticles = [];
    let dParticles = [];

    //Interaction settings
    const InteractionSettings = {
        showHand: false,
        showFrameRate: false,
        palmControlsAmbientCharges: false,
        nColor: window.p.color("#4e1e9c"),
        pColor: window.p.color("#cd8fe3"),
        particleMaxSpeedScaler: 10,
        perlinNoiseTimeStep: 0.01,
        chargeMagnitude: 0.1,
        chargeFlip: 1,
        numOfAmbientCharges: 8,
        numOfFingerCharges: 0
    };

    let uxSettings = Object.create(InteractionSettings);

    //For perlin noise
    let t = 0;

    //Rolling window for smoothing hand coordinates
    const rollingWindowSize = 3;
    let handCoordinatesBuffer = [];
    let smoothedHandLandmarks = [];

    let fingersCompactBuffer = new CircularBuffer(rollingWindowSize);

    p.setup = function () {
        canvas = p.createCanvas(width, height);
        window.particleGraphics = p.createGraphics(width, height);
        window.handGraphics = p.createGraphics(width, height);


        // //Setting up electric field
        // const fieldDensity = fieldSettings.pixelsPerStep;

        // for (let i = 0; i < fieldSettings.rows; i++) {
        //     for (let j = 0; j < fieldSettings.cols; j++) {
        //         fieldPoints.push(new FieldPoint(j * fieldDensity, i * fieldDensity, p));
        //     }
        // }

        //Setting up charges
        for (let i = 0; i < uxSettings.numOfAmbientCharges + uxSettings.numOfFingerCharges; i++) {
            charges.push(new Charge(0, 0, 0));
        }

        let N = 1000;
        let nc = uxSettings.nColor;
        let pc = uxSettings.pColor;
        let scl = uxSettings.particleMaxSpeedScaler;
        //Setting up particles
        for (let i = 0; i < N; i++) {
            aParticles[i] = new Particle(6 * scl, nc, pc);
        }
        for (let i = 0; i < N; i++) {
            bParticles[i] = new Particle(5 * scl, nc, pc);
        }

        for (let i = 0; i < N; i++) {
            cParticles[i] = new Particle(4 * scl, nc, pc);
        }

        for (let i = 0; i < N; i++) {
            dParticles[i] = new Particle(3 * scl, nc, pc);
        }

        //setting up hand coordinate rolling window
        for (let i = 0; i < 21; i++) {
            handCoordinatesBuffer.push(new CoordinatesCircularBuffer(rollingWindowSize));
            smoothedHandLandmarks.push(p.createVector(0, 0));
        }

        p.background(0);
        particleGraphics.background(0);
        handGraphics.background(0);
        p.image(particleGraphics, 0, 0);
        p.image(handGraphics, 0, 0);
    };

    p.draw = function () {
        p.background(0);
        particleGraphics.background(0, 10);
        handGraphics.clear();

        t = t + uxSettings.perlinNoiseTimeStep / (p.frameRate() + 0.001);;

        //Only evolve the ambient charges
        for (let i = 0; i < uxSettings.numOfAmbientCharges; i++) {
            let polarity = 1;
            let x = p.noise(t + 5 + i) * 1.2 * width - 0.1 * width;
            let y = p.noise(t + 10 + i) * 1.2 * height - 0.1 * height;
            charges[i].position.set([x, y]);
            //even index charges are sources, odd are sinks. 
            if ((i % 2) == 1) {
                polarity = -1;
            }
            charges[i].charge = p.noise(t + 20 * i) * (0.2) * (polarity * uxSettings.chargeFlip)
            // if (i == 0) {
            //     charges[i].draw(particleGraphics);
            // }

        }

        // setTestCharge(-0.5);

        //Hand detection from MediaPipe
        let results = window.handDetectionResults;

        if (handResultValid(results)) {
            let hand = results.handednesses[0][0];
            let dotColor = leftHandColor;
            if (hand.categoryName == 'Right') {
                dotColor = rightHandColor;
            }
            const lm = results.landmarks[0];
            const wlm = results.worldLandmarks[0];

            for (let i = 0; i < lm.length; i++) {
                handCoordinatesBuffer[i].enqueue([lm[i].x, lm[i].y]);
                smoothedHandLandmarks[i].set(handCoordinatesBuffer[i].getAverage());
            }

            const palmOrient = getPalmOrientation(wlm, hand.categoryName);
            const fieldColor = p.lerpColor(uxSettings.pColor, uxSettings.nColor, palmOrient);

            //Calculate compactness of finger tips
            fingersCompactBuffer.enqueue(calculateCompactnessEuclidean([wlm[4], wlm[8], wlm[12], wlm[16], wlm[20]]));
            const smoothedCompactness = fingersCompactBuffer.getAverage();
            uxSettings.particleMaxSpeedScaler = p.map(smoothedCompactness, 0.02, 0.06, 1, 11);

            uxSettings.chargeFlip = p.map(palmOrient, 0, 1, -1, 1);

            if (uxSettings.showHand) {
                drawHandConnections(smoothedHandLandmarks, handGraphics, fieldColor);
            }

            if (uxSettings.numOfFingerCharges > 0) {
                setHandCharges(uxSettings, smoothedHandLandmarks, p.map(palmOrient, 1, 0, -0.1, 0.1));
            }
        }
        else {
            clearHandCharges(uxSettings, charges);
        }


        runParticlesEngine(aParticles, charges, 5, particleGraphics);
        runParticlesEngine(bParticles, charges, 4, particleGraphics);
        runParticlesEngine(cParticles, charges, 3, particleGraphics);
        runParticlesEngine(dParticles, charges, 2, particleGraphics);


        p.drawingContext.filter = 'blur(2px)';
        p.image(particleGraphics, 0, 0);
        p.image(handGraphics, 0, 0);
        p.drawingContext.filter = 'blur(0px)';
        if (uxSettings.showFrameRate) {
            showFrameRate();
        }
        // for (fp of fieldPoints) {
        //     fp.draw();
        // }
    };

    p.keyPressed = function (key) {
        if (key.key == "h") {
            uxSettings.showHand = !uxSettings.showHand;
        }
        if (key.key == "f") {
            uxSettings.showFrameRate = !uxSettings.showFrameRate;
        }
    };

    //Show framerate
    function showFrameRate() {
        let fps = p.frameRate();
        p.textSize(30);
        p.fill(255);
        p.noStroke();
        p.push();

        // Scale -1, 1 means reverse the x axis, keep y the same.
        p.scale(-1, 1);

        // Because the x-axis is reversed, we need to draw at different x position.
        p.text(p.nf(fps, 2, 0), -width, height - 10);
        p.pop();
    }


    function setTestCharge(c) {
        // For Debugging
        for (let i = 0; i < uxSettings.numOfAmbientCharges; i++) {
            let x = 0.5 * width;
            let y = 0.5 * height;
            charges[i].position = p.createVector(x, y);
            charges[i].charge = c;
        }
    }

    //Running the particle engine and show it
    function runParticlesEngine(particles, charges, dotSize, canvas) {
        canvas.strokeWeight(dotSize);
        const indices = getSourceIndices(charges);
        for (var i = 0; i < particles.length; i++) {
            particles[i].followField(charges);
            particles[i].maxspeed = dotSize * uxSettings.particleMaxSpeedScaler;
            particles[i].update();
            particles[i].edges();
            particles[i].show(canvas);
            particles[i].sinks(charges, indices);
        }
    }

    function getSourceIndices(charges) {
        let indices = [];
        for (let i = 0; i < charges.length; i++) {
            if (charges[i].chargeMag > 0) {
                indices.push(i);
            }
        }
        return indices;
    }

    //Setting and clear charges attached to hand

    function setHandCharges(settings, lm, value) {
        for (let i = settings.numOfAmbientCharges; i < settings.numOfAmbientCharges + settings.numOfFingerCharges; i++) {
            charges[i].position.set([lm[(i - settings.numOfAmbientCharges + 1) * 4].x * width, lm[(i - settings.numOfAmbientCharges + 1) * 4].y * height]);
            charges[i].charge = value;
        }
    }
    function clearHandCharges(settings, charges) {
        for (let i = settings.numOfAmbientCharges; i < settings.numOfAmbientCharges + settings.numOfFingerCharges; i++) {
            charges[i].position.set([0, 0]);
            charges[i].charge = 0;
        }
    }
    function setAmbientChargeswithPalmOrientation(settings, orientation) {
        //Palm to change ambient charges
        for (let i = 0; i < settings.numOfAmbientCharges; i++) {
            const c = charges[i].charge;
            charges[i].charge = p.map(orientation, 0, 1, -1.5 * c, 1.5 * c);
        }
    }
};



let myp5 = new p5(sketch, document.getElementById('p5canvas'));
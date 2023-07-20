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

    let fieldPoints = [];
    let charges = [];

    let lParticles = [];
    let sParticles = [];

    //Interaction settings
    const InteractionSettings = {
        showHand: false,
        showFrameRate: false,
        palmControlsAmbientCharges: false
    };

    //Field Matrix
    const FieldSettings = {
        numOfAmbientCharges: 8,
        numOfFingerCharges: 5,
        pixelsPerStep: 10,
        cols: 0,
        rows: 0
    };

    let fieldSettings = Object.create(FieldSettings);
    fieldSettings.cols = (width / fieldSettings.pixelsPerStep);
    fieldSettings.rows = (height / fieldSettings.pixelsPerStep)

    let interactionSettings = Object.create(InteractionSettings);


    //For perlin noise
    let t = 0;

    //Rolling window for smoothing hand coordinates
    const rollingWindowSize = 5;
    let handCoordinatesBuffer = [];
    let smoothedHandLandmarks = [];

    p.setup = function () {
        canvas = p.createCanvas(width, height);
        window.particleGraphics = p.createGraphics(width, height);
        window.handGraphics = p.createGraphics(width, height);


        //Setting up electric field
        const fieldDensity = fieldSettings.pixelsPerStep;

        for (let i = 0; i < fieldSettings.rows; i++) {
            for (let j = 0; j < fieldSettings.cols; j++) {
                fieldPoints.push(new FieldPoint(j * fieldDensity, i * fieldDensity, p));
            }
        }

        //Setting up charges
        for (let i = 0; i < fieldSettings.numOfAmbientCharges + fieldSettings.numOfFingerCharges; i++) {
            charges.push(new Charge(0, 0, 0, p));
        }

        //Setting up particles
        for (let i = 0; i < 2000; i++) {
            lParticles[i] = new Particle(60);
        }
        for (let i = 0; i < 2000; i++) {
            sParticles[i] = new Particle(50);
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
        particleGraphics.background(0, 20);
        handGraphics.clear();

        t = t + 0.004;

        //Only evolve the ambient charges
        for (let i = 0; i < fieldSettings.numOfAmbientCharges; i++) {
            let polarity = 1;
            let x = p.noise(t + 5 + i) * 1.2 * width - 0.1 * width;
            let y = p.noise(t + 80 + i) * 1.2 * height - 0.1 * height;
            charges[i].position.set([x, y]);
            //even index charges are sources, odd are sinks. 
            if ((i % 2) == 1) {
                polarity = -1;
            }
            // Sources are more powerful
            charges[i].charge = p.noise(t + 20 * i) * 0.3 * (polarity) - polarity * 0.1;
        }

        // setTestCharge(-0.5);

        //Hand detection from MediaPipe
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
                    // drawPalmFill(lm, palmFill);
                    // drawHandConnections(lm);
                    // drawHandLandmarks(lm, dotColor);
                }
            } else if (results.handednesses.length == 1) {
                let hand = results.handednesses[0][0];
                let dotColor = leftHandColor;
                if (hand.categoryName == 'Right') {
                    dotColor = rightHandColor;
                }
                const lm = results.landmarks[0];
                const palmOrient = getPalmOrientation(results.worldLandmarks[0], hand.categoryName)
                // const palmFill = p.lerpColor(p.color("#FF0000"), p.color("#0000FF"), palmOrient);
                // drawPalmFill(lm, palmFill);

                const nc = window.p.color("#a9f702");
                const pc = window.p.color("#0260f7");

                const tipColor = p.lerpColor(nc, pc, palmOrient);

                for (let i = 0; i < lm.length; i++) {
                    handCoordinatesBuffer[i].enqueue(lm[i]);
                    smoothedHandLandmarks[i].set(handCoordinatesBuffer[i].getAverage());
                }

                if (interactionSettings.showHand) {
                    drawHandConnections(lm, handGraphics);
                }

                setHandCharges(fieldSettings, lm, p.map(palmOrient, 1, 0, -0.07, 0.07));
            }
        }
        else {
            clearHandCharges(fieldSettings, charges);
        }

        let sinkVal = 0;
        let sourceVal = 0;
        for (fp of fieldPoints) {
            fp.update(charges);
            if (fp.potential < sinkVal) {
                sinkVal = fp.potential;
            }
            if (fp.potential > sourceVal) {
                sourceVal = fp.potential;
            }
        }

        // setTestField(-1, -1);

        // for (ch of charges) {
        //     ch.draw();
        // }

        runParticlesEngine(lParticles, fieldPoints, fieldSettings, 4, sinkVal, particleGraphics);
        runParticlesEngine(sParticles, fieldPoints, fieldSettings, 3, sinkVal, particleGraphics);


        p.image(particleGraphics, 0, 0);
        p.image(handGraphics, 0, 0);
        if (interactionSettings.showFrameRate) {
            showFrameRate();
        }
        // for (fp of fieldPoints) {
        //     fp.draw();
        // }
    };

    p.keyPressed = function (key) {
        if (key.key == "h") {
            interactionSettings.showHand = !interactionSettings.showHand;
        }
        if (key.key == "f") {
            interactionSettings.showFrameRate = !interactionSettings.showFrameRate;
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

    function setTestField(x, y) {
        for (ch of charges) {
            ch.chargeMag = 0;
        }
    }

    function setTestCharge(c) {
        // For Debugging
        for (let i = 0; i < fieldSettings.numOfAmbientCharges; i++) {
            let x = 0.5 * width;
            let y = 0.5 * height;
            charges[i].position = p.createVector(x, y);
            charges[i].charge = c;
        }
    }

    //Running the particle engine and show it
    function runParticlesEngine(particles, fieldPoints, fieldSettings, dotSize, sinkVal, canvas) {
        canvas.strokeWeight(dotSize);
        for (var i = 0; i < particles.length; i++) {
            particles[i].follow(fieldPoints, fieldSettings);
            particles[i].update();
            particles[i].edges();
            particles[i].sinks(sinkVal);
            particles[i].show(canvas);
        }
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
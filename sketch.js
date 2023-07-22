
import { enableCam } from './detection.js';


//make p global so other classes can call p5.js functions
window.p = undefined;
// window.width = document.getElementById("video").width * 8;
// window.height = document.getElementById("video").height * 8;

window.width = window.innerWidth;
window.height = window.innerHeight;


let sketch = function (p) {
    window.p = p;

    //additional graphics canvasses
    let particleGraphics = undefined;
    let handGraphics = undefined;

    let leftHandColor = p.color("#4cbcf5");
    let rightHandColor = p.color("#f5823b");

    let charges = [];

    let aParticles = [];
    let bParticles = [];
    let cParticles = [];
    let dParticles = [];

    const colorList = [
        [p.color("#abc8f7"), p.color("#163273")],
        [p.color("#abc8f7"), p.color("#163273")],
        [p.color("#f5a70c"), p.color("#6d14c7")],
        [p.color("#eba4e4"), p.color("#300738")],
        [p.color("#f5c1bf"), p.color("#fa05ea")],
        [p.color("#07c7e0"), p.color("#016069")],
        [p.color("#abc8f7"), p.color("#163273")],
    ];

    //Interaction settings
    const InteractionSettings = {
        showHand: false,
        showFrameRate: false,
        nColor: colorList[0][0],
        pColor: colorList[0][1],
        particleMaxSpeedScaler: 10,
        perlinTimestepScaler: 1,
        perlinNoiseTimeStep: 0.2,
        chargeMagnitude: 0.2,
        handChargeMultiplier: 3,
        chargeFlip: 1,
        numOfAmbientCharges: 8,
        numOfFingerCharges: 1
    };

    let uxSettings = Object.create(InteractionSettings);

    //For perlin noise
    let t = 0;

    //time scale for color cycling
    let ct = 0;


    //Rolling window for smoothing hand coordinates
    const rollingWindowSize = 3;
    let handCoordinatesBuffer = [];
    let smoothedHandLandmarks = [];

    let fingersCompactBuffer = new CircularBuffer(rollingWindowSize);

    p.setup = function () {
        p.createCanvas(width, height);
        particleGraphics = p.createGraphics(width, height);
        handGraphics = p.createGraphics(width, height);
        // window.blurGraphics = p.createGraphics(width, height);

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
        particleGraphics.background(0, 5 + 2 * uxSettings.particleMaxSpeedScaler);
        handGraphics.clear();

        t = t + uxSettings.perlinNoiseTimeStep * uxSettings.perlinTimestepScaler / (p.frameRate() + 0.001);

        ct = ct + uxSettings.perlinNoiseTimeStep * uxSettings.perlinTimestepScaler * 0.5 / (p.frameRate() + 0.001);

        const l = colorList.length;
        const id = p.noise(ct) * (l);


        const i = p.floor(id);
        const d = id - i;

        uxSettings.nColor = p.lerpColor(colorList[i][0], colorList[(i + 1) % l][0], d);
        uxSettings.pColor = p.lerpColor(colorList[i][1], colorList[(i + 1) % l][1], d);

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
            charges[i].charge = p.noise(t + 20 * i) * (uxSettings.chargeMagnitude) * (polarity * uxSettings.chargeFlip)
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
            let fieldColor = p.lerpColor(uxSettings.pColor, uxSettings.nColor, palmOrient);
            fieldColor.setAlpha(100);

            //Calculate compactness of finger tips
            fingersCompactBuffer.enqueue(calculateCompactnessEuclidean([wlm[4], wlm[8], wlm[12], wlm[16], wlm[20]]));
            const smoothedCompactness = fingersCompactBuffer.getAverage();
            uxSettings.particleMaxSpeedScaler = p.map(smoothedCompactness, 0.02, 0.06, 1, 18);
            uxSettings.perlinTimestepScaler = p.map(smoothedCompactness, 0.02, 0.06, 0.2, 2);

            uxSettings.chargeFlip = p.map(palmOrient, 0, 1, -1, 1);

            if (uxSettings.showHand) {
                drawHandConnections(smoothedHandLandmarks, handGraphics, fieldColor);
            }

            if (uxSettings.numOfFingerCharges > 0) {
                setHandCharges(uxSettings, smoothedHandLandmarks, uxSettings.chargeMagnitude * uxSettings.handChargeMultiplier);
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
        p.drawingContext.filter = 'blur(50px)';
        p.image(handGraphics, 0, 0);
        p.drawingContext.filter = 'blur(0px)';

        if (uxSettings.showFrameRate) {
            showFrameRate();
        }
        // for (fp of fieldPoints) {
        //     fp.draw();
        // }
    };

    //TODO: when a hand charge is present, max speed of particles should increase
    p.keyPressed = function (key) {
        if (key.key == "h") {
            uxSettings.showHand = !uxSettings.showHand;
        }
        if (key.key == "r") {
            uxSettings.showFrameRate = !uxSettings.showFrameRate;
        }
        if (key.key == "ArrowUp") {
            uxSettings.handChargeMultiplier += 1;
        }
        if (key.key == "ArrowDown") {
            uxSettings.handChargeMultiplier -= 1;
        }
        if (key.key == "c") {
            enableCam(null);
        }
        if (key.key == "f") {
            let fs = p.fullscreen();
            if (!fs) {
                updateSketchSize(p.displayWidth, p.displayHeight);
            } else {
                updateSketchSize(p.windowWidth, p.windowHeight);
            }
            p.fullscreen(!fs);
        }
        return false;
    };

    p.windowResized = function () {
        // Resize the canvas to match the new window dimensions
        updateSketchSize(p.windowWidth, p.windowHeight);
    }

    function updateSketchSize(w, h) {
        p.resizeCanvas(w, h);
        window.width = w;
        window.height = h; //update the global width height variables for p5.js 
        width = w;
        height = h;
        particleGraphics = p.createGraphics(w, h);
        handGraphics = p.createGraphics(w, h);
    }

    //Show framerate
    function showFrameRate() {
        let fps = p.frameRate();
        p.textSize(30); //TODO: parameterize this
        p.fill(255);
        p.noStroke();
        p.push();

        // Scale -1, 1 means reverse the x axis, keep y the same.
        p.scale(-1, 1);

        // Because the x-axis is reversed, we need to draw at different x position.
        //TODO: parameterize this
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
            particles[i].updateMotion();
            particles[i].edges(0.05 * height);
            particles[i].setColors([uxSettings.nColor, uxSettings.pColor]);
            particles[i].show(canvas);
            particles[i].sinks(charges, indices); //sinks affect the NEXT frame of animation after show
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
        let palmCentroid = calculateCentroid([lm[4], lm[8], lm[12], lm[16], lm[20]]);
        for (let i = settings.numOfAmbientCharges; i < settings.numOfAmbientCharges + settings.numOfFingerCharges; i++) {
            // charges[i].position.set([lm[(i - settings.numOfAmbientCharges + 1) * 4].x * width, lm[(i - settings.numOfAmbientCharges + 1) * 4].y * height]);
            charges[i].position.set(palmCentroid.x * width, palmCentroid.y * height);
            charges[i].charge = -value * settings.chargeFlip;
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
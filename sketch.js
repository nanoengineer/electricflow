
import { enableCam } from './detection.js';


//make p global so other classes can call p5.js functions
window.p = undefined;

window.width = window.innerWidth;
window.height = window.innerHeight;


let sketch = function (p) {
    window.p = p;

    //additional graphics canvasses
    let particleGraphics;
    let handGraphics;
    let welcomeGraphics;

    let leftHandColor = p.color("#4cbcf5");
    let rightHandColor = p.color("#f5823b");

    let charges = [];

    let aParticles = [];
    let bParticles = [];
    let cParticles = [];
    let dParticles = [];

    const colorList = [
        [window.p.color("#abc8f7"), window.p.color("#163273")],
        [window.p.color("#abc8f7"), window.p.color("#163273")],
        [window.p.color("#f5a70c"), window.p.color("#6d14c7")],
        [window.p.color("#eba4e4"), window.p.color("#300738")],
        [window.p.color("#f5c1bf"), window.p.color("#fa05ea")],
        [window.p.color("#07c7e0"), window.p.color("#016069")],
        [window.p.color("#abc8f7"), window.p.color("#163273")],
        [window.p.color("#abc8f7"), window.p.color("#163273")],
    ];

    const InteractionSettings = {
        showHand: false,
        showInfo: false,
        showCamera: false,
        showFrameRate: false,
        nColor: colorList[0][0],
        pcolor: colorList[0][1],
        particleMaxSpeedScaler: 6,
        perlinTimestepScaler: 1,
        perlinNoiseTimeStep: 0.1,
        chargeMagnitude: 0.2,
        handChargeMultiplier: 2,
        chargeFlip: 1,
        numOfAmbientCharges: 8,
        numOfFingerCharges: 1,
        trailCoeff: 8,
        fingerCompactnessRange: { min: 0.02, max: 0.06 },
        handSmoothingRollingWindowFrameSize: 5,
        particleBlurPx: 3,
        handBlurPx: 30,
        manipulatedMaxSpeedScalerRange: { min: 0, max: 6 },
        particlesPerPixel: 0.000375 * p.pixelDensity() * p.displayDensity(),
        averageFrameRateWindow: 50,
        desiredFrameRate: 40,
        desiredFrameRateDelta: 3,
        minimumParticles: 200,
        fixedParticleSink: { x: -500, y: 500 },
    };

    InteractionSettings.manipulatedMaxSpeedScalerRange.max = InteractionSettings.particleMaxSpeedScaler * 2;

    //Interaction settings
    let uxSettings = Object.create(InteractionSettings);

    //For perlin noise
    let t = 0;
    //time scale for color cycling
    let ct = 0;


    //Rolling window for smoothing hand coordinates
    let handCoordinatesBuffer = [];
    let smoothedHandLandmarks = [];

    let fingersCompactnessBuffer = new CircularBuffer(uxSettings.handSmoothingRollingWindowFrameSize);
    let averageFrameRateBuffer = new CircularBuffer(uxSettings.averageFrameRateWindow)
    let palmOrientBuffer = new CircularBuffer(uxSettings.handSmoothingRollingWindowFrameSize);;

    let musicHigh;
    let musicLow;
    p.preload = function () {
        musicHigh = p.loadSound('./media_assets/LordOfTheDawn-JesseGallagher.mp3', highSongLoaded);
        musicLow = p.loadSound('./media_assets/LordOfTheDawn-JesseGallagher.mp3', lowSongLoaded);
    }

    p.setup = function () {
        p.createCanvas(width, height);
        particleGraphics = p.createGraphics(width, height);
        handGraphics = p.createGraphics(width, height);
        welcomeGraphics = p.createGraphics(width, height);

        //Setting up charges
        for (let i = 0; i < uxSettings.numOfAmbientCharges + uxSettings.numOfFingerCharges; i++) {
            charges.push(new Charge(0, 0, 0));
        }

        //Offscreen sink where all new particles are initialized
        charges.push(new Charge(uxSettings.fixedParticleSink.x, uxSettings.fixedParticleSink.y, -0.0001));

        // let N = uxSettings.particlesPerPixel * width * height / 4;
        let N = uxSettings.minimumParticles / 4;
        let nc = uxSettings.nColor;
        let pc = uxSettings.pColor;
        let scl = uxSettings.particleMaxSpeedScaler;
        let spot = uxSettings.fixedParticleSink;

        //Setting up particles
        for (let i = 0; i < N; i++) {
            aParticles.push(new Particle(spot));
            bParticles.push(new Particle(spot));
            cParticles.push(new Particle(spot));
            dParticles.push(new Particle(spot));
        }

        //setting up hand coordinate rolling window
        for (let i = 0; i < 21; i++) {
            handCoordinatesBuffer.push(new CoordinatesCircularBuffer(uxSettings.handSmoothingRollingWindowFrameSize));
            smoothedHandLandmarks.push(p.createVector(0, 0));
        }

        p.background(0);
    };

    p.draw = function () {
        p.background(0);

        particleGraphics.background(0, uxSettings.trailCoeff);
        handGraphics.clear();

        averageFrameRateBuffer.enqueue(p.frameRate());
        const avgFr = averageFrameRateBuffer.getAverage();

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

        //generate keep adding particles until the specified framerate


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
            palmOrientBuffer.enqueue(palmOrient);

            let fieldColor = p.lerpColor(uxSettings.nColor, uxSettings.pColor, palmOrientBuffer.getAverage());
            fieldColor.setAlpha(100);

            //Calculate compactness of finger tips
            fingersCompactnessBuffer.enqueue(calculateCompactnessEuclidean([wlm[4], wlm[8], wlm[12], wlm[16], wlm[20]]));
            const smoothedCompactness = fingersCompactnessBuffer.getAverage();

            updateManipulation(smoothedCompactness, palmOrient);


            if (uxSettings.showHand) {
                drawHandConnections(smoothedHandLandmarks, handGraphics, fieldColor);
            }

            if (uxSettings.numOfFingerCharges > 0) {
                setHandCharges(uxSettings, smoothedHandLandmarks, uxSettings.chargeMagnitude * uxSettings.handChargeMultiplier);
            }
        }
        else {
            clearHandCharges(uxSettings, charges);
            generateParticlesUntilFramerate(aParticles, avgFr);
            generateParticlesUntilFramerate(bParticles, avgFr);
            generateParticlesUntilFramerate(cParticles, avgFr);
            generateParticlesUntilFramerate(dParticles, avgFr);
        }

        runParticlesEngine(aParticles, charges, 10, particleGraphics);
        runParticlesEngine(bParticles, charges, 8, particleGraphics);
        runParticlesEngine(cParticles, charges, 6, particleGraphics);
        runParticlesEngine(dParticles, charges, 4, particleGraphics);

        p.drawingContext.filter = `blur(${uxSettings.particleBlurPx}px)`;
        p.image(particleGraphics, 0, 0);
        p.drawingContext.filter = `blur(${uxSettings.handBlurPx}px)`;
        p.image(handGraphics, 0, 0);
        p.drawingContext.filter = 'blur(0px)';
        p.image(welcomeGraphics, 0, 0);


        if (uxSettings.showFrameRate) {
            showFrameRate(avgFr);
        }
    };

    //TODO: when a hand charge is present, max speed of particles should increase
    p.keyPressed = function (key) {

        //Debug 
        if (window.location.href === 'http://127.0.0.1:8080/') {
            if (key.key == "r") {
                uxSettings.showFrameRate = !uxSettings.showFrameRate;
            }
            if (key.key == "ArrowUp") {
                uxSettings.trailCoeff += 1;
            }
            if (key.key == "ArrowDown") {
                uxSettings.trailCoeff -= 1;
            }
            if (key.key == "ArrowLeft") {
                uxSettings.particleMaxSpeedScaler -= 1;
            }
            if (key.key == "ArrowRight") {
                uxSettings.particleMaxSpeedScaler += 1;
            }
        }

        if (key.key == "o") {
            //Toggle all overlay
            uxSettings.showHand = !uxSettings.showHand;
            uxSettings.showCamera = !uxSettings.showCamera;
            uxSettings.showInfo = !uxSettings.showInfo;
            showCamera(uxSettings.showCamera);
            showInfo(uxSettings.showInfo);
        }

        if (key.key == "1") {
            //Handmirror Toggle
            uxSettings.showHand = !uxSettings.showHand;
        }

        if (key.key == "2") {
            //Camera viz toggle
            uxSettings.showCamera = !uxSettings.showCamera;
            showCamera(uxSettings.showCamera);
        }

        if (key.key == "3") {
            //info panel toggle
            uxSettings.showInfo = !uxSettings.showInfo;
            showInfo(uxSettings.showInfo);
        }


        if (key.key == " ") {
            if (musicHigh != undefined && musicLow != undefined) {
                musicHigh.setVolume(0.2);
                musicLow.setVolume(1);
                musicLow.rate(0.5);
                musicHigh.play();
                musicLow.play();
            }
            let fs = p.fullscreen();
            if (!fs) {
                updateSketchSize(p.displayWidth, p.displayHeight);
            } else {
                updateSketchSize(p.windowWidth, p.windowHeight);
            }
            p.fullscreen(!fs);
        }

        if (key.key == "c") {
            enableCam(null);
        }
        if (key.key == "f") {

        }
        return false;
    };

    p.windowResized = function () {
        // Resize the canvas to match the new window dimensions
        updateSketchSize(p.windowWidth, p.windowHeight);
    }

    function highSongLoaded(song) {
        musicHigh = song;
        musicLow.setVolume(0.2);
        musicHigh.loop();
    }
    function lowSongLoaded(song) {
        musicLow = song;
        musicLow.setVolume(1.0);
        musicLow.loop();
    }

    function updateSketchSize(w, h) {
        p.resizeCanvas(w, h);
        window.width = w;
        window.height = h; //update the global width height variables for p5.js 
        width = w;
        height = h;
        particleGraphics = p.createGraphics(w, h);
        handGraphics = p.createGraphics(w, h);
        welcomeGraphics = p.createGraphics(w, h);
    }

    function makeWelcomePage() {

        welcomeGraphics.fill(0, 240);
        welcomeGraphics.rect(0, 0, width, height);
        welcomeGraphics.textSize(100); //TODO: parameterize this
        welcomeGraphics.textAlign(p.CENTER, p.CENTER);

        // Scale -1, 1 means reverse the x axis, keep y the same.
        welcomeGraphics.translate(width, 0);
        welcomeGraphics.scale(-1, 1);
        welcomeGraphics.erase(255, 200);
        welcomeGraphics.text("Welcome to Bloom.Electric", width / 2, height / 2);
        welcomeGraphics.noErase();
        welcomeGraphics.fill(255, 70);
        welcomeGraphics.text("Welcome to Bloom.Electric", width / 2, height / 2);
    }

    function showCamera(flag) {
        if (window.webcamRunning === true) {
            if (flag) {
                document.getElementById("video").style.display = 'initial';

            }
            else {
                document.getElementById("video").style.display = 'none';
            }
        }
    }

    function showInfo(flag) {
        if (flag) {
            document.getElementById("overlayDiv").style.display = 'flex';

        }
        else {
            document.getElementById("overlayDiv").style.display = 'none';
        }
    }


    //Show framerate
    function showFrameRate(avgFr) {
        let fps = avgFr;

        p.textSize(0.05 * height); //TODO: parameterize this
        p.fill(255);
        p.noStroke();
        p.push();

        // Scale -1, 1 means reverse the x axis, keep y the same.
        p.scale(-1, 1);

        // Because the x-axis is reversed, we need to draw at different x position.
        //TODO: parameterize this
        p.text(p.nf(fps, 2, 0), -width, 0.85 * height);
        p.text(`Trail Coeff: ${uxSettings.trailCoeff}`, -width, 0.8 * height);
        p.text(`Max Speed Scaler: ${uxSettings.particleMaxSpeedScaler}`, -width, 0.75 * height);
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

    function updateManipulation(compact, palmOrient) {
        const cmin = uxSettings.fingerCompactnessRange.min;
        const cmax = uxSettings.fingerCompactnessRange.max;

        let smin = uxSettings.manipulatedMaxSpeedScalerRange.min;
        let smax = uxSettings.manipulatedMaxSpeedScalerRange.max;

        uxSettings.particleMaxSpeedScaler = p.map(compact, cmin, cmax, smin, smax);
        uxSettings.perlinTimestepScaler = p.map(compact, cmin, cmax, 0.2, 2);
        uxSettings.chargeFlip = p.map(palmOrient, 0, 1, -1, 1);

        if (musicHigh != undefined) {
            let a = p.map(compact, cmin, cmax, 0.0, 0.5);
            const v = p.constrain(a, 0.05, 0.5);
            const s = p.constrain(a, 0.1, 0.5);
            musicHigh.setVolume(v);
            musicLow.rate(s);
        }
    }

    function generateParticlesUntilFramerate(particlesList, currentFr) {
        const th = uxSettings.desiredFrameRateDelta;
        if (currentFr > uxSettings.desiredFrameRate + th) {
            particlesList.push(new Particle(uxSettings.fixedParticleSink));
        }
        else if (currentFr < uxSettings.desiredFrameRate - th) {
            if (particlesList.length > uxSettings.minimumParticles / 4) {
                particlesList.pop();
            }
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
            // particles[i].showWhite(canvas);
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
    function setVideoPositionAndSize(x, y, w, h) {
        const videoElement = document.getElementById('video');
        videoElement.style.left = `${x}px`;
        videoElement.style.top = `${y}px`;
        videoElement.width = `${w}`;
        videoElement.height = `${h}`;
    }
};


let myp5 = new p5(sketch, document.getElementById('p5canvas'));
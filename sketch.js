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

window.p = undefined;
window.pg = undefined;

let sketch = function (p) {
    window.p = p;

    let leftHandColor = p.color("#4cbcf5");
    let rightHandColor = p.color("#f5823b");

    let fieldPoints = [];
    let charges = [];

    let lParticles = [];
    let sParticles = [];


    //Field Matrix
    const FieldSettings = {
        numOfAmbientCharges: 4,
        numOfFingerCharges: 5,
        pixelsPerStep: 8,
        cols: 0,
        rows: 0
    };

    const fieldSettings = Object.create(FieldSettings);
    fieldSettings.cols = width / fieldSettings.pixelsPerStep;
    fieldSettings.rows = height / fieldSettings.pixelsPerStep;

    //For perlin noise
    let t = 0;

    p.setup = function () {
        canvas = p.createCanvas(width, height);
        window.pg = p.createGraphics(width, height);
        // canvas.id = 'p5canvas';

        const fieldDensity = fieldSettings.pixelsPerStep;

        for (let i = 0; i < fieldSettings.rows; i++) {
            for (let j = 0; j < fieldSettings.cols; j++) {
                fieldPoints.push(new FieldPoint(j * fieldDensity, i * fieldDensity, p));
            }
        }

        for (let i = 0; i < fieldSettings.numOfAmbientCharges + fieldSettings.numOfFingerCharges; i++) {
            charges.push(new Charge(0, 0, 0, p));
        }

        for (let i = 0; i < 1000; i++) {
            lParticles[i] = new Particle(140);
        }
        for (let i = 0; i < 2000; i++) {
            sParticles[i] = new Particle(60);
        }
        p.background(0);


        // window.pg.background(0, 0);
    };

    p.draw = function () {

        p.background(0, 20);
        // window.pg.clear();

        t = t + 0.004;

        //Only evolve the ambient charges
        for (let i = 0; i < fieldSettings.numOfAmbientCharges; i++) {
            let x = p.noise(t + 5 + i) * 2 * width - 0.5 * width;
            let y = p.noise(t + 80 + i) * 2 * height - 0.5 * height;
            charges[i].position.set([x, y]);
            charges[i].charge = p.noise(t + 20 * i) * 0.4 - 0.2;
        }

        // For Debugging
        // for (let i = 0; i < fieldSettings.numOfAmbientCharges; i++) {
        //     let x = 0.5 * width;
        //     let y = 0.5 * height;
        //     charges[i].position = p.createVector(x, y);
        //     charges[i].charge = -0.1;
        // }
        let sinkVal = 0;
        for (fp of fieldPoints) {
            fp.update(charges);
            if (fp.potential < sinkVal) {
                sinkVal = fp.potential;
            }
            // fp.negColor = p.lerpColor(p.color("#faab00"), p.color("#e35cf7"), p.noise(t));
            // fp.posColor = p.lerpColor(p.color("#009efa"), p.color("#6f00ff"), p.noise(t + 19));
            // fp.draw();
        }

        for (ch of charges) {
            ch.draw();
        }

        runParticlesEngine(lParticles, fieldPoints, fieldSettings, 4, sinkVal);
        runParticlesEngine(sParticles, fieldPoints, fieldSettings, 1, sinkVal);

        showFramerate();


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
                // drawHandConnections(lm, window.pg);
                // drawHandLandmarks(lm, dotColor, window.pg);

                setHandCharges(fieldSettings, lm, p.map(palmOrient, 0, 1, -1, 1));
            }
        }
        else {
            clearHandCharges(fieldSettings, charges);
        }

        // p.push();
        // p.tint(255, 10);
        // p.image(window.pg, 0, 0);
        // p.pop();

    };



    //Show framerate
    function showFramerate() {
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

    //Running the particle engine and show it
    function runParticlesEngine(particles, fieldPoints, fieldSettings, dotSize, sinkVal) {
        for (var i = 0; i < particles.length; i++) {
            particles[i].follow(fieldPoints, fieldSettings);
            particles[i].update();
            particles[i].edges();
            particles[i].sinks(sinkVal);
            particles[i].show(dotSize);
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
};



let myp5 = new p5(sketch, document.getElementById('p5canvas'));
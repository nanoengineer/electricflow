class FieldPoint {
    #privateVector1 = window.p.createVector(0, 0);

    constructor(x, y, p5) {
        this.p = p5;
        this.pos = window.p.createVector(x, y);
        this.vector = window.p.createVector(0, 0);
        this.unitVector = window.p.createVector(0, 0);
        this.potential = 0;
        this.negativeColor = window.p.color("#faab00");
        this.positiveColor = window.p.color("#009efa");
    }

    update(charges) {
        this.#updateElectricFieldandPotential(charges, this.pos);
    }

    draw() {
        let vectorDrawLength = window.p.constrain(this.vector.mag() * 10, 0, 35);
        window.p.stroke(window.p.lerpColor(this.negativeColor, this.positiveColor, window.p.map(this.potential, -1000, 1000, 0, 1)));
        window.p.strokeWeight(2);
        p5.Vector.normalize(this.vector, this.unitVector);
        window.p.line(this.pos.x, this.pos.y, this.pos.x - this.unitVector.x * vectorDrawLength, this.pos.y - this.unitVector.y * vectorDrawLength)
    }

    #updateElectricFieldandPotential(charges, point) {

        const k = 100000;
        this.vector.set([0, 0]);
        this.potential = 0;

        //electric potential kq/r
        //electric field kq/r^2

        for (let i = 0; i < charges.length; i++) {
            const chCharge = charges[i].chargeMag;
            if (chCharge == 0) {
                continue;
            }
            const chPos = charges[i].position;
            const distance = chPos.dist(point);
            const v = k * chCharge / (distance + 0.1); //prevent infinity
            const fieldStrength = v / (distance + 0.1);
            this.#privateVector1.set([chPos.x - point.x, chPos.y - point.y]).normalize();
            this.potential += v;
            this.vector.add(this.#privateVector1.mult(fieldStrength));
        }
    }
}

class Charge {


    constructor(x, y, charge) {
        this.pos = window.p.createVector(x, y);
        this.charge = charge;
        this.color = window.p.color(0);
    }

    draw(canvas) {
        canvas.strokeWeight(20);
        canvas.stroke(125, 10);
        canvas.ellipse(this.pos.x, this.pos.y, 20, 20);
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

class Particle {
    #privateVector1 = window.p.createVector(0, 0);

    constructor(sinkPos) {
        this.pos = window.p.createVector(sinkPos.x, sinkPos.y);
        this.vel = window.p.createVector(0, 0);
        this.acc = window.p.createVector(0, 0);
        this.maxspeed; //pixels/second
        this.prevPos = this.pos.copy();
        this.potential = 0;
        this.nColor;
        this.pColor;
        this.fixedSink = window.p.createVector(sinkPos.x, sinkPos.y);
    }

    updateMotion() {
        this.vel.add(this.acc.mult(-1)); //deal with flipped canvas
        this.vel.limit(this.maxspeed * window.p.random(0.9, 1.1) / window.p.frameRate());
        this.pos.add(this.vel);
        this.acc.set([0, 0]);
    }

    setColors(clrs) {
        this.nColor = clrs[0];
        this.pColor = clrs[1];
    }

    follow(fieldPoints, fieldSettings) {
        const step = fieldSettings.pixelsPerStep;
        let x = window.p.floor(this.pos.x / step);
        let y = window.p.floor(this.pos.y / step);
        const index = x + y * fieldSettings.cols;
        if (x <= window.width && x >= 0 && y <= window.height && y >= 0) {
            if (index < fieldPoints.length && index >= 0) {
                let force = fieldPoints[index].vector;
                this.acc.add(force.add(window.p.random(-0.02, 0.02)));
                this.potential = fieldPoints[index].potential;
            }
        } else {

        }
    }

    followField(charges) {
        const k = 100000;
        this.acc.set([0, 0]);
        this.potential = 0;

        //electric potential kq/r
        //electric field kq/r^2

        for (let i = 0; i < charges.length; i++) {
            const chCharge = charges[i].chargeMag;
            if (chCharge == 0) {
                continue;
            }
            const chPos = charges[i].position;
            const distance = chPos.dist(this.pos);
            const v = k * chCharge / (distance + 1); //prevent infinity
            const fieldStrength = v / (distance + 1);
            this.#privateVector1.set([chPos.x - this.pos.x, chPos.y - this.pos.y]).normalize();
            this.potential += v;
            this.acc.add(this.#privateVector1.mult(fieldStrength));
        }
    }

    show(canvas) {
        canvas.stroke(window.p.lerpColor(this.nColor, this.pColor, window.p.map(this.potential, -100, 100, 1, 0)));
        // canvas.stroke(255);
        canvas.line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
        this.updatePrev();
    }

    showWhite(canvas) {
        canvas.stroke(255);
        canvas.line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
        // canvas.point(this.pos.x, this.pos.y);
        this.updatePrev();
    }

    #isWithinCanvas() {
        if (this.pos.x <= window.width && this.pos.x >= 0 && this.pos.y <= window.height && this.pos.y >= 0) {
            return true;
        } else {
            return false;
        }
    }

    updatePrev() {
        this.prevPos.set(this.pos);
    }

    edges(border) {
        // if (this.pos.x > window.width + border) {
        //     this.pos.x = 0 - border;
        //     this.updatePrev();

        // }
        // if (this.pos.x < 0 - border) {
        //     this.pos.x = window.width + border;
        //     this.updatePrev();

        // }
        // if (this.pos.y > window.height + border) {
        //     this.pos.y = 0 - border;
        //     this.updatePrev();

        // }
        // if (this.pos.y < 0 - border) {
        //     this.pos.y = window.height + border;
        //     this.updatePrev();
        // }

        if (this.pos.x > window.width + border || this.pos.x < 0 - border || this.pos.y > window.height + border || this.pos.y < 0 - border) {
            this.pos.x = this.fixedSink.x;
            this.pos.y = this.fixedSink.y;
            this.updatePrev();
        }
    }

    sinks(charges, sourcesIndices) {
        //if particle is within rsink px of a sink, emit it at a source with rsource px
        const rsource = 10;
        const rsink = 10;
        if (sourcesIndices.length != 0) {
            const source = charges[window.p.random(sourcesIndices)];
            for (const ch of charges) {
                if (ch.chargeMag < 0 && window.p.dist(this.pos.x, this.pos.y, ch.pos.x, ch.pos.y) < rsink) {
                    this.pos.x = source.pos.x + window.p.random(-rsource, rsource);
                    this.pos.y = source.pos.y + window.p.random(-rsource, rsource);
                    this.updatePrev();
                    break;
                }
            }
        }
    }

}
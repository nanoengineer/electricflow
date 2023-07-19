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

    set negColor(nc) {
        this.negativeColor = nc;
    }

    set posColor(pc) {
        this.positiveColor = pc;
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
            const v = k * chCharge / (distance);
            const fieldStrength = v / distance;
            this.#privateVector1.set([chPos.x - point.x, chPos.y - point.y]).normalize();
            this.potential += v;
            this.vector.add(this.#privateVector1.mult(fieldStrength));
        }
    }
}

class Charge {

    constructor(x, y, charge, p5) {
        this.p = p5;
        this.pos = window.p.createVector(x, y);
        this.charge = charge;
        this.color = window.p.color(0);
    }

    draw() {
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
    #defaultForce = window.p.createVector(0, 0);
    constructor(maxspeed) {
        this.pos = window.p.createVector(p.random(width), p.random(height));
        this.vel = window.p.createVector(0, 0);
        this.acc = window.p.createVector(0, 0);
        this.maxspeed = maxspeed; //pixels/second
        this.prevPos = this.pos.copy();
        this.potential = 0;
        this.nc = window.p.color("#a9f702");
        this.pc = window.p.color("#0260f7");

    }

    update() {
        this.vel.add(this.acc.mult(-1)); //deal with flipped canvas
        this.vel.limit(this.maxspeed / window.p.frameRate());
        this.pos.add(this.vel);
        this.acc.mult(0);
    }

    follow(fieldPoints, fieldSettings) {
        let step = fieldSettings.pixelsPerStep;
        let x = window.p.floor(this.pos.x / step);
        let y = window.p.floor(this.pos.y / step);
        let index = x + y * fieldSettings.cols;
        if (index < fieldPoints.length && index >= 0) {
            let force = fieldPoints[index].vector;
            this.applyForce(force.add(window.p.random(-0.1, 0.1)));
            this.potential = fieldPoints[index].potential;
        } else {
            // let force = this.#defaultForce.set([width / 2 - this.pos.x, height / 2 - this.pos.y]);
            // this.applyForce(force);
        }
    }

    applyForce(force) {
        this.acc.add(force);
    }

    show(sw) {
        window.p.stroke(window.p.lerpColor(this.nc, this.pc, window.p.map(this.potential, -200, 100, 0, 1)));
        window.p.strokeWeight(sw);
        window.p.line(this.pos.x, this.pos.y, this.prevPos.x, this.prevPos.y);
        this.updatePrev();
    }

    updatePrev() {
        this.prevPos.x = this.pos.x;
        this.prevPos.y = this.pos.y;
    }

    edges() {
        if (this.pos.x > width) {
            this.pos.x = 0;
            this.updatePrev();
            // this.vel.set([0, 0]);
        }
        if (this.pos.x < 0) {
            this.pos.x = width;
            this.updatePrev();
            // this.vel.set([0, 0]);
        }
        if (this.pos.y > height) {
            this.pos.y = 0;
            this.updatePrev();
            // this.vel.set([0, 0]);
        }
        if (this.pos.y < 0) {
            this.pos.y = height;
            this.updatePrev();
            // this.vel.set([0, 0]);
        }
    }

    sinks(sinkValue) {
        //particle is in a potential sink, source it from corner of screen
        if (this.potential < 0.90 * sinkValue) {
            let edge = window.p.random([0, 1, 2, 3]);
            if (edge % 2 == 0) {
                this.pos.x = window.p.random([0, width]);
                this.pos.y = window.p.random(0, height);
            } else {
                this.pos.x = window.p.random(0, width);
                this.pos.y = window.p.random([0, height]);
            }
            this.updatePrev();
        }
        // const delta = 5;
        // for (const charge of charges) {
        //     if (this.pos.x > charge.position.x - delta && this.pos.x < charge.position.x + delta && this.pos.y > charge.position.y - delta && this.pos.y < charge.position.y + delta && charge.chargeMag < 0) {
        //         this.pos.x = window.p.random(0, 5);
        //         this.pos.y = window.p.random(0, 5);
        //         this.updatePrev();
        //         break;
        //     }
        // }
    }

}
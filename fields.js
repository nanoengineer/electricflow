class FieldPoint {
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
        const field_potential = this.#getElectricFieldandPotential(charges, this.pos);
        this.vector = field_potential.fieldVector;
        this.potential = field_potential.potential;
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

    #getElectricFieldandPotential(charges, point) {

        const k = 100000;
        let fieldVector = window.p.createVector(0, 0);
        let potential = 0;

        //electric potential kq/r
        //electric field kq/r^2

        for (let i = 0; i < charges.length; i++) {
            const chCharge = charges[i].chargeMag;
            if (chCharge == 0) {
                continue;
            }
            const chPos = charges[i].position;
            const distance = chPos.dist(point);
            const vectorDirection = window.p.createVector(chPos.x - point.x, chPos.y - point.y).normalize();
            const v = k * chCharge / (distance);
            const fieldStrength = v / distance;
            potential += v;
            fieldVector.add(vectorDirection.mult(fieldStrength));
        }
        return { fieldVector, potential };
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
    constructor(maxspeed) {
        this.pos = window.p.createVector(p.random(width), p.random(height));
        this.vel = window.p.createVector(0, 0);
        this.acc = window.p.createVector(0, 0);
        this.maxspeed = maxspeed;
        this.prevPos = this.pos.copy();
        this.potential = 0;
    }

    update() {
        this.vel.add(this.acc.mult(-1));
        this.vel.limit(this.maxspeed);
        this.pos.add(this.vel);
        this.acc.mult(0);
    }

    follow(fieldPoints, fieldSettings) {
        let step = fieldSettings.pixelsPerStep;
        let x = window.p.floor(this.pos.x / step);
        let y = window.p.floor(this.pos.y / step);
        let index = x + y * fieldSettings.cols;
        if (index < fieldPoints.length) {
            let force = fieldPoints[index].vector;
            this.applyForce(force.add(window.p.random(-0.1, 0.1)));
            this.potential = fieldPoints[index].potential;
        } else {
            console.log("WTF");
        }
    }

    applyForce(force) {
        this.acc.add(force);
    }

    show(sw) {
        window.p.stroke(window.p.lerpColor(window.p.color("#a9f702"), window.p.color("#0260f7"), window.p.map(this.potential, -200, 100, 0, 1)));
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
        }
        if (this.pos.x < 0) {
            this.pos.x = width;
            this.updatePrev();
        }
        if (this.pos.y > height) {
            this.pos.y = 0;
            this.updatePrev();
        }
        if (this.pos.y < 0) {
            this.pos.y = height;
            this.updatePrev();
        }

    }

    sinks(charges) {
        const delta = 2;
        for (const charge of charges) {
            if (this.pos.x > charge.position.x - delta && this.pos.x < charge.position.x + delta && this.pos.y > charge.position.y - delta && this.pos.y < charge.position.y + delta && charge.chargeMag < 0) {
                this.pos.x = window.p.random(0, 5);
                this.pos.y = window.p.random(0, 5);
                this.updatePrev();
                break;
            }
        }
    }

}
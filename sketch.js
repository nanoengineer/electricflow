let canvas;
let width = document.getElementById("video").width;
let height = document.getElementById("video").height;
let sketch = function(p) {  
    p.setup = function() {
      canvas = p.createCanvas(width, height);
      canvas.id = 'p5canvas';
    };
  
    p.draw = function() {
        p.clear();
        p.noFill();
        p.stroke("#51b7cf");
        p.strokeWeight(5);
        p.rect(0,0,width,height);
        if(window.detectedLandmarks!=undefined) {
            if(window.detectedLandmarks.length) {
                //there are two hands detects max
                for (let i = 0; i < detectedLandmarks[0].length; i++) {
                    let landmark = detectedLandmarks[0][i];
                    console.log(landmark);
                    p.fill(255);
                    p.ellipse(landmark.x*width,landmark.y*height,5,5);
                }
            }
        }
    };
  };
  
  let myp5 = new p5(sketch,document.getElementById('p5canvas'));
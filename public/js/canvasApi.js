/* eslint-disable no-param-reassign */
/**
 * CanvasApi module
 * @module canvasApi
 */
/**
 * Function to help for zooming
 * @param {number} delta - the zooming constant
 * @param {number=|sting} xx - ususally undefined
 * @param {number=|string} yy - usually undefined
 * @param {number} method - 1 for zooming wrt mouse
 * 2,3 for zooming wrt screen
 */
function changeScale(delta, xx, yy, method = 1) {
    if (method === 3) {
        xx = (width / 2 - globalScope.ox) / globalScope.scale;
        yy = (height / 2 - globalScope.oy) / globalScope.scale;
    } else if (
        xx === undefined
        || yy === undefined
        || xx === 'zoomButton'
        || yy === 'zoomButton'
    ) {
        if (
            simulationArea.lastSelected
            && simulationArea.lastSelected.objectType !== 'Wire'
        ) {
            // selected object
            xx = simulationArea.lastSelected.x;
            yy = simulationArea.lastSelected.y;
        } else {
            // mouse location
            // eslint-disable-next-line no-lonely-if
            if (method === 1) {
                xx = simulationArea.mouseX;
                yy = simulationArea.mouseY;
            } else if (method === 2) {
                xx = (width / 2 - globalScope.ox) / globalScope.scale;
                yy = (height / 2 - globalScope.oy) / globalScope.scale;
            }
        }
    }
    // Shift accordingly, so that we zoom wrt to the selected point
    const oldScale = globalScope.scale;
    globalScope.scale = Math.max(
        0.5,
        Math.min(4 * DPR, globalScope.scale + delta),
    );
    globalScope.scale = Math.round(globalScope.scale * 10) / 10;
    globalScope.ox -= Math.round(xx * (globalScope.scale - oldScale));
    globalScope.oy -= Math.round(yy * (globalScope.scale - oldScale));

    // update MiniMap but not for embed or light mode
    if (!embed && !lightMode) {
        findDimensions(globalScope);
        miniMapArea.setup();
        $('#miniMap').show();
        lastMiniMapShown = new Date().getTime();
        $('#miniMap').show();
        setTimeout(removeMiniMap, 2000);
    }
}
/**
 * fn to draw Dots on screen
 * the function is called only when the zoom level or size of screen changes.
 * Otherwise for normal panning, the canvas itself is moved to give the illusion of movement
 * @param {boolean} transparentBackground - not used tbd
 * @param {boolean} force -not used tbd
 */

function dots(transparentBackground = false, force = false) {
    var scale = unit * globalScope.scale;
    var ox = globalScope.ox % scale; // offset
    var oy = globalScope.oy % scale; // offset

    document.getElementById('backgroundArea').style.left = (ox - scale) / DPR;
    document.getElementById('backgroundArea').style.top = (oy - scale) / DPR;

    if (globalScope.scale === simulationArea.prevScale && !force) return;

    if (!backgroundArea.context) return;
    simulationArea.prevScale = globalScope.scale;

    var canvasWidth = backgroundArea.canvas.width; // max X distance
    var canvasHeight = backgroundArea.canvas.height; // max Y distance

    var ctx = backgroundArea.context;
    ctx.beginPath();
    backgroundArea.clear();
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    if (!transparentBackground) {
        ctx.fillStyle = 'white';
        ctx.rect(0, 0, canvasWidth, canvasHeight);
        ctx.fill();
    }

    var correction = 0.5 * (ctx.lineWidth % 2);
    for (var i = 0; i < canvasWidth; i += scale) {
        ctx.moveTo(Math.round(i + correction) - correction, 0);
        ctx.lineTo(Math.round(i + correction) - correction, canvasHeight);
    }
    for (var j = 0; j < canvasHeight; j += scale) {
        ctx.moveTo(0, Math.round(j + correction) - correction);
        ctx.lineTo(canvasWidth, Math.round(j + correction) - correction);
    }
    ctx.stroke();

    // old code for archive
    // function drawPixel(x, y, r, g, b, a) {
    //     var index = (x + y * canvasWidth) * 4;
    //     canvasData.data[index + 0] = r;
    //     canvasData.data[index + 1] = g;
    //     canvasData.data[index + 2] = b;
    //     canvasData.data[index + 3] = a;
    // }
    // if (dots) {
    //     var canvasData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    //
    //
    //
    //     for (var i = 0 + ox; i < canvasWidth; i += scale)
    //         for (var j = 0 + oy; j < canvasHeight; j += scale)
    //             drawPixel(i, j, 0, 0, 0, 255);
    //     ctx.putImageData(canvasData, 0, 0);
    // }
}

// Helper canvas API starts here
// All canvas functions are wrt to a center point (xx,yy),
// direction is used to abstract rotation of everything by a certain angle
// Possible values for direction = "RIGHT" (default), "LEFT", "UP", "DOWN"
/**
 * return actual point which will be center for bezier curve
 * @param {number} x1 - rotate wrt x1 and y1
 * @param {string} y1 - rotate wrt x1 and y1.
 * @param {string} dir - new direction.
 */
function rotate(x1, y1, dir) {
    if (dir === 'LEFT') return [-x1, y1];
    if (dir === 'DOWN') return [y1, x1];
    if (dir === 'UP') return [y1, -x1];
    return [x1, y1];
}

/**
 * function to return a new angles to draw the arc in correct direction.
 * @param {number} start - start angle
 * @param {*} stop - stop angle
 * @param {*} dir - direction
 */
function rotateAngle(start, stop, dir) {
    if (dir === 'LEFT') return [start, stop, true];
    if (dir === 'DOWN') return [start - Math.PI / 2, stop - Math.PI / 2, true];
    if (dir === 'UP') return [start - Math.PI / 2, stop - Math.PI / 2, false];
    return [start, stop, false];
}

/**
 * Function to draw bezier curve
 * @param {number} x1 - x of point 1.
 * @param {number} y1 - y of point 1.
 * @param {number} x2 - x of point 2.
 * @param {number} y2 - y of point 2.
 * @param {number} x3 - x of point 3.
 * @param {number} y3 - y of point 3.
 * @param {number} xx - x bezier point.
 * @param {number} yy - y bezier point.
 * @param {string} dir - direction of the curve.
 */
function bezierCurveTo(x1, y1, x2, y2, x3, y3, xx, yy, dir) {
    const { ox } = globalScope;
    const { oy } = globalScope;
    [x1, y1] = rotate(x1, y1, dir);
    [x2, y2] = rotate(x2, y2, dir);
    [x3, y3] = rotate(x3, y3, dir);
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    x2 *= globalScope.scale;
    y2 *= globalScope.scale;
    x3 *= globalScope.scale;
    y3 *= globalScope.scale;
    xx *= globalScope.scale;
    yy *= globalScope.scale;
    ctx.bezierCurveTo(
        Math.round(xx + ox + x1),
        Math.round(yy + oy + y1),
        Math.round(xx + ox + x2),
        Math.round(yy + oy + y2),
        Math.round(xx + ox + x3),
        Math.round(yy + oy + y3),
    );
}

/**
 * we move to xx+-x1 and yy+-y1 according to distance.
 * @param {HTMLCanvasElement} ctx - the working canvas
 * @param {number} x1 - horizontal distance of the path
 * @param {number} y1 - vertical  distance of the path
 * @param {number} xx - x of point from path's beginning
 * @param {number} yy - y of point from path's beginning
 * @param {number} dir - direction of distance
 * @param {boolean} bypass - WIP
 */
function moveTo(ctx, x1, y1, xx, yy, dir, bypass = false) {
    var correction = 0.5 * (ctx.lineWidth % 2);
    [newX, newY] = rotate(x1, y1, dir);
    newX *= globalScope.scale;
    newY *= globalScope.scale;
    xx *= globalScope.scale;
    yy *= globalScope.scale;
    if (bypass) {
        ctx.moveTo(xx + globalScope.ox + newX, yy + globalScope.oy + newY);
    } else {
        ctx.moveTo(
            Math.round(xx + globalScope.ox + newX - correction) + correction,
            Math.round(yy + globalScope.oy + newY - correction) + correction,
        );
    }
}

/**
 * we draw a line from xx,yy to  xx+-x1 and yy+-y1 according to distance.
 * @param {HTMLCanvasElement} ctx - the working canvas
 * @param {number} x1 - horizontal distance of the path
 * @param {number} y1 - vertical  distance of the path
 * @param {number} xx - x of point from path's beginning
 * @param {number} yy - y of point from path's beginning
 * @param {number} dir - direction of distance
 */
function lineTo(ctx, x1, y1, xx, yy, dir) {
    var correction = 0.5 * (ctx.lineWidth % 2);
    [newX, newY] = rotate(x1, y1, dir);
    newX *= globalScope.scale;
    newY *= globalScope.scale;
    xx *= globalScope.scale;
    yy *= globalScope.scale;
    ctx.lineTo(
        Math.round(xx + globalScope.ox + newX - correction) + correction,
        Math.round(yy + globalScope.oy + newY - correction) + correction,
    );
}

/**
 * Function to draw an arc
 * @param {HTMLCanvasElement} ctx
 * @param {number} sx - shift in x from element
 * @param {number} sy - shift in y from element
 * @param {number} radius
 * @param {number} start - starting angle
 * @param {number} stop - starting angle
 * @param {number} xx - center x cordinate
 * @param {number} yy -center y cordinate
 * @param {string} dir - direction of the side of curve
 * ox-x of origin
 */
function arc(ctx, sx, sy, radius, start, stop, xx, yy, dir) {
    var correction = 0.5 * (ctx.lineWidth % 2);
    [Sx, Sy] = rotate(sx, sy, dir);
    Sx *= globalScope.scale;
    Sy *= globalScope.scale;
    xx *= globalScope.scale;
    yy *= globalScope.scale;
    radius *= globalScope.scale;
    [newStart, newStop, counterClock] = rotateAngle(start, stop, dir);
    ctx.arc(
        Math.round(xx + globalScope.ox + Sx + correction) - correction,
        Math.round(yy + globalScope.oy + Sy + correction) - correction,
        Math.round(radius),
        newStart,
        newStop,
        counterClock,
    );
}

/**
 * function to built arcs with clock
 * @param {HTMLCanvasElement} ctx
 * @param {number} sx - shift in x direction
 * @param {number} sy -shift in y direction
 * @param {number} radius
 * @param {number} start - start angle
 * @param {number} stop - stop angle
 * @param {number} xx -starting x
 * @param {number} yy - starting y
 * @param {string} dir
 */
function arc2(ctx, sx, sy, radius, start, stop, xx, yy, dir) {
    // ox-x of origin
    var correction = 0.5 * (ctx.lineWidth % 2);
    [Sx, Sy] = rotate(sx, sy, dir);
    Sx *= globalScope.scale;
    Sy *= globalScope.scale;
    xx *= globalScope.scale;
    yy *= globalScope.scale;
    radius *= globalScope.scale;
    [newStart, newStop, counterClock] = rotateAngle(start, stop, dir);
    var pi = 0;
    if (counterClock) {
        pi = Math.PI;
    }
    ctx.arc(
        Math.round(xx + globalScope.ox + Sx + correction) - correction,
        Math.round(yy + globalScope.oy + Sy + correction) - correction,
        Math.round(radius),
        newStart + pi,
        newStop + pi,
    );
}

/**
 * function to draw circle a better descriprion is wip
 * @param {HTMLCanvasElement} ctx
 * @param {number} sx - shift in x direction
 * @param {number} sy -shift in y direction
 * @param {number} r - radius
 * @param {string} color - color of the circle
 */
function drawCircle(ctx, x1, y1, r, color) {
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(
        Math.round(x1 + globalScope.ox),
        Math.round(y1 + globalScope.oy),
        Math.round(r * globalScope.scale),
        0,
        Math.PI * 2,
        false,
    );
    ctx.closePath();
    ctx.fill();
}

/**
 * function to draw circle a better descriprion is wip
 * @param {HTMLCanvasElement} ctx
 * @param {number} sx - shift in x direction
 * @param {number} sy -shift in y direction
 * @param {number} radius
 * @param {number} xx -starting x
 * @param {number} yy - starting y
 * @param {string} dir
 */
function drawCircle2(ctx, sx, sy, radius, xx, yy, dir) {
    [Sx, Sy] = rotate(sx, sy, dir);
    Sx *= globalScope.scale;
    Sy *= globalScope.scale;
    xx *= globalScope.scale;
    yy *= globalScope.scale;
    radius *= globalScope.scale;
    ctx.arc(
        Math.round(xx + globalScope.ox + Sx),
        Math.round(yy + globalScope.oy + Sy),
        Math.round(radius),
        0,
        2 * Math.PI,
    );
}

/**
 * function to draw a rectangle
 * @param {HTMLCanvasElement} ctx
 * @param {number} x1 shift of rectangles
 * @param {number} y1 shift of rectangles
 * @param {number} x2 shift of rectangles
 * @param {number} y2 shift of rectangles
 */
function rect(ctx, x1, y1, x2, y2) {
    var correction = 0.5 * (ctx.lineWidth % 2);
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    x2 *= globalScope.scale;
    y2 *= globalScope.scale;
    ctx.rect(
        Math.round(globalScope.ox + x1 - correction) + correction,
        Math.round(globalScope.oy + y1 - correction) + correction,
        Math.round(x2),
        Math.round(y2),
    );
}

/**
 * another helper function to draw a rectangle in front of an element
 * @param {HTMLCanvasElement} ctx
 * @param {number} x1 shift of the rectangle from xx and yy
 * @param {number} y1 shift of the rectangle from xx and yy
 * @param {number} x2 shift of the rectangle from xx and yy
 * @param {number} y2 shift of the rectangle from xx and yy
 * @param {number} xx x of element
 * @param {number} yy y of element
 */
function rect2(ctx, x1, y1, x2, y2, xx, yy, dir = 'RIGHT') {
    var correction = 0.5 * (ctx.lineWidth % 2);
    [x1, y1] = rotate(x1, y1, dir);
    [x2, y2] = rotate(x2, y2, dir);
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    x2 *= globalScope.scale;
    y2 *= globalScope.scale;
    xx *= globalScope.scale;
    yy *= globalScope.scale;
    ctx.rect(
        Math.round(globalScope.ox + xx + x1 - correction) + correction,
        Math.round(globalScope.oy + yy + y1 - correction) + correction,
        Math.round(x2),
        Math.round(y2),
    );
}

/**
 * getting the maximum width
 * @param {number} w -given width
 */
function correctWidth(w) {
    return Math.max(1, Math.round(w * globalScope.scale));
}

/**
 * function to draw a line
 * @param {HTMLCanvasElement} ctx
 * @param {number} x1 - x of point 1
 * @param {number} y1 - y of point 1
 * @param {number} x2 - x of point 2
 * @param {number} y2 - y of point 2
 * @param {string} color - color of the line
 * @param {number} width - width of the line
 */
function drawLine(ctx, x1, y1, x2, y2, color, width) {
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    x2 *= globalScope.scale;
    y2 *= globalScope.scale;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = correctWidth(width); //* globalScope.scale;
    var correction = 0.5 * (ctx.lineWidth % 2);
    var hCorrection = 0;
    var vCorrection = 0;
    if (y1 === y2) vCorrection = correction;
    if (x1 === x2) hCorrection = correction;
    ctx.moveTo(
        Math.round(x1 + globalScope.ox + hCorrection) - hCorrection,
        Math.round(y1 + globalScope.oy + vCorrection) - vCorrection,
    );
    ctx.lineTo(
        Math.round(x2 + globalScope.ox + hCorrection) - hCorrection,
        Math.round(y2 + globalScope.oy + vCorrection) - vCorrection,
    );
    ctx.stroke();
}

/**
 * function to check if string color is a valid color using a hack
 * @param {string} color - color to be checked
 */
function validColor(color) {
    var $div = $('<div>');
    $div.css('border', `1px solid ${color}`);
    return $div.css('border-color') !== '';
}

/**
 * helper function to color "RED" to RGBA
 * @param {string} color - color to be converted
 */
function colorToRGBA(color) {
    var cvs;
    var ctx;
    cvs = document.createElement('canvas');
    cvs.height = 1;
    cvs.width = 1;
    ctx = cvs.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return ctx.getImageData(0, 0, 1, 1).data;
}

/**
 * Helper function to show message like values, node name etc
 * @param {HTMLCanvasElement} ctx
 * @param {string} str - message string
 * @param {number} x1 - x cordinate of div to show message
 * @param {number} y1 - y cordinate of div to show message
 * @param {number} fontSize
 */
function canvasMessage(ctx, str, x1, y1, fontSize = 10) {
    if (!str || !str.length) return;

    ctx.font = `${Math.round(fontSize * globalScope.scale)}px Georgia`;
    ctx.textAlign = 'center';
    var width = ctx.measureText(str).width / globalScope.scale + 8;
    var height = 13;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = correctWidth(1);
    ctx.fillStyle = 'yellow';
    ctx.save();
    ctx.beginPath();
    rect(ctx, x1 - width / 2, y1 - height / 2 - 3, width, height);
    ctx.shadowColor = '#999';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    ctx.beginPath();
    ctx.fillStyle = 'black';
    ctx.fillText(
        str,
        Math.round(x1 + globalScope.ox),
        Math.round(y1 + globalScope.oy),
    );
    ctx.fill();
}

/**
 * One way to fill text in labels
 * @param {HTMLCanvasElement} ctx
 * @param {string} str - message string
 * @param {number} x1 - x cordinate of div to fill text
 * @param {number} y1 - y cordinate of div to fill text
 * @param {number=} fontSize - font size
 */
function fillText(ctx, str, x1, y1, fontSize = 20) {
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    ctx.font = `${Math.round(fontSize * globalScope.scale)}px Georgia`;
    ctx.fillText(
        str,
        Math.round(x1 + globalScope.ox),
        Math.round(y1 + globalScope.oy),
    );
}

/**
 * One way to fill text out of 4
 * @param {HTMLCanvasElement} ctx
 * @param {string} str - message
 * @param {number} x1 - shift in x
 * @param {number} y1 - shift in y
 * @param {number} xx - x cordinate of element
 * @param {number} yy - y cordinate of element
 * @param {string} dir - the direction of the text
 */
function fillText2(ctx, str, x1, y1, xx, yy, dir) {
    angle = {
        RIGHT: 0,
        LEFT: 0,
        DOWN: Math.PI / 2,
        UP: -Math.PI / 2,
    };
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    [x1, y1] = rotate(x1, y1, dir);
    xx *= globalScope.scale;
    yy *= globalScope.scale;
    ctx.font = `${Math.round(14 * globalScope.scale)}px Georgia`;
    ctx.save();
    ctx.translate(
        Math.round(xx + x1 + globalScope.ox),
        Math.round(yy + y1 + globalScope.oy),
    );
    ctx.rotate(angle[dir]);
    ctx.textAlign = 'center';
    ctx.fillText(
        str,
        0,
        Math.round(4 * globalScope.scale) * (1 - 0 * +(dir === 'DOWN')),
    );
    ctx.restore();
}

/**
 * One way to fill text out of 4
 * @param {HTMLCanvasElement} ctx
 * @param {string} str - message
 * @param {number} x1 - shift in x
 * @param {number} y1 - shift in y
 * @param {number=} xx - x cordinate of element
 * @param {number=} yy - y cordinate of element
 * @param {number} fontSize - the font size of the text
 * @param {string=} font - the font of the text
 * @param {string=} textAlign - the alignment of the text
 */
function fillText3(
    ctx,
    str,
    x1,
    y1,
    xx = 0,
    yy = 0,
    fontSize = 14,
    font = 'Georgia',
    textAlign = 'center',
) {
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    xx *= globalScope.scale;
    yy *= globalScope.scale;

    ctx.font = `${Math.round(fontSize * globalScope.scale)}px ${font}`;
    ctx.textAlign = textAlign;
    ctx.fillText(
        str,
        Math.round(xx + x1 + globalScope.ox),
        Math.round(yy + y1 + globalScope.oy),
    );
}

/**
 * One way to fill text out of 4
 * @param {HTMLCanvasElement} ctx
 * @param {string} str - message
 * @param {number} x1 - shift in x
 * @param {number} y1 - shift in y
 * @param {number} xx - x cordinate of element
 * @param {number} yy - y cordinate of element
 * @param {string} dir - the direction of the text
 * @param {number} fontSize - the font size of the text
 * @param {string=} textAlign - the alignment of the text
 */
function fillText4(
    ctx,
    str,
    x1,
    y1,
    xx,
    yy,
    dir,
    fontSize = 14,
    textAlign = 'center',
) {
    angle = {
        RIGHT: 0,
        LEFT: 0,
        DOWN: Math.PI / 2,
        UP: -Math.PI / 2,
    };
    x1 *= globalScope.scale;
    y1 *= globalScope.scale;
    [x1, y1] = rotate(x1, y1, dir);
    xx *= globalScope.scale;
    yy *= globalScope.scale;

    ctx.font = `${Math.round(fontSize * globalScope.scale)}px Georgia`;
    // ctx.font = 20+"px Georgia";
    ctx.textAlign = textAlign;
    ctx.fillText(
        str,
        xx + x1 + globalScope.ox,
        yy
            + y1
            + globalScope.oy
            + Math.round((fontSize / 3) * globalScope.scale),
    );
}

oppositeDirection = {
    RIGHT: 'LEFT',
    LEFT: 'RIGHT',
    DOWN: 'UP',
    UP: 'DOWN',
};
fixDirection = {
    right: 'LEFT',
    left: 'RIGHT',
    down: 'UP',
    up: 'DOWN',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    UP: 'UP',
    DOWN: 'DOWN',
};

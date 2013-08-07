(function(window) {

    var fps = d3.select("body")
        .append("p")
        .style({
            "position": "absolute",
            "top": "0px",
            "left": "10px",
            "font-family": "helvetica",
            "font-size": "16px",
            "font-style": "bold"
        });

    var max, min;

    var height = window.innerHeight;
    var width = window.innerWidth;
    // var height = 1000;
    // var width = 1000;

    var visibleSystems = {};
    var showSystem = function(s) {
        if (s.regionId > 10000070) return false;

        visibleSystems[s.id] = s;
        return true;
    };

    var showSolarJump = function(jump) {
        return jump.toRegionId === jump.fromRegionId && visibleSystems[jump.toSolarSystemId] && visibleSystems[jump.fromSolarSystemId];
    };

    var showRegionJump = function(jump) {
        return jump.toRegionId !== jump.fromRegionId && visibleSystems[jump.toSolarSystemId] && visibleSystems[jump.fromSolarSystemId];
    };

    var systems = _(window.systems).filter(showSystem);
    var jumps = _(window.jumps).filter(showSolarJump);
    var regionJumps = _(window.jumps).filter(showRegionJump);

    jumps = _(jumps).map(function(j) {
        var to = visibleSystems[j.toSolarSystemId];
        var from = visibleSystems[j.fromSolarSystemId];

        return {
            to: to,
            from: from
        };
    });

    regionJumps = _(regionJumps).map(function(j) {
        var to = visibleSystems[j.toSolarSystemId];
        var from = visibleSystems[j.fromSolarSystemId];

        return {
            to: to,
            from: from
        };
    });


    var minX = _(systems).min(function(s) { return s.x; }).x;
    var maxX = _(systems).max(function(s) { return s.x; }).x;
    var deltaX = maxX - minX;
    var midX = minX + deltaX / 2;

    var minZ = _(systems).min(function(s) { return s.z; }).z;
    var maxZ = _(systems).max(function(s) { return s.z; }).z;
    var deltaZ = maxZ - minZ;
    var midZ = minZ + deltaZ / 2;

    var screenRatio = width / height;
    var mapRatio = deltaX / deltaZ;

    var x = d3.scale.linear()
        // .domain([minX, maxX])
        .domain([midX - deltaX / 2, midX + deltaX / 2])
        .range([0, height * mapRatio]);

    var z = d3.scale.linear()
        // .domain([maxZ, minZ])
        .domain([midZ - deltaZ / 2, midZ + deltaZ / 2])
        .range([0, height]);

    var canvas = d3.select("body").append("canvas")
        .attr("width", width)
        .attr("height", height);

    var context = canvas.node().getContext("2d");

    var TWOPI = 2 * Math.PI;

    var regionTree = new RTree();
    _(regionJumps).each(function(j) {
        var minX = d3.min([j.to.x, j.from.x]);
        var maxX = d3.max([j.to.x, j.from.x]);
        var minZ = d3.min([j.to.z, j.from.z]);
        var maxZ = d3.max([j.to.z, j.from.z]);

        regionTree.insert({
            x: minX,
            y: minZ,
            w: maxX - minX,
            h: maxZ - minZ
        }, j);
    });

    var jumpTree = new RTree();
    _(jumps).each(function(j) {
        var minX = d3.min([j.to.x, j.from.x]);
        var maxX = d3.max([j.to.x, j.from.x]);
        var minZ = d3.min([j.to.z, j.from.z]);
        var maxZ = d3.max([j.to.z, j.from.z]);

        jumpTree.insert({
            x: minX,
            y: minZ,
            w: maxX - minX,
            h: maxZ - minZ
        }, j);
    });

    var systemTree = new RTree();
    _(systems).each(function(s) {
        var minX = d3.min([s.xMin, s.xMax]);
        var maxX = d3.max([s.xMin, s.xMax]);
        var minZ = d3.min([-s.zMin, -s.zMax]);
        var maxZ = d3.max([-s.zMin, -s.zMax]);

        systemTree.insert({
            x: minX,
            y: minZ,
            w: maxX - minX,
            h: maxZ - minZ
        }, s);
    });


    function draw() {

        var start = new Date().getTime();

        console.timeStamp('draw start');

        var gutter = 0;

        var screen = {
            x1: gutter,
            y1: gutter,
            x2: width - gutter,
            y2: height - gutter
        };

        var bounds = {
            x: x.invert(screen.x1),
            y: z.invert(screen.y2),
            w: x.invert(screen.x2) - x.invert(screen.x1),
            h: z.invert(screen.y1) - z.invert(screen.y2)
        };

        context.strokeStyle = '#F00';
        context.beginPath();

        // _(regionJumps).each(function(j) {
        //     // context.moveTo(x(j.to.x), z(j.to.z));
        //     // context.lineTo(x(j.from.x), z(j.from.z));
        //     context.moveTo(x(j.to.x) | 0, z(j.to.z) | 0);
        //     context.lineTo(x(j.from.x) | 0, z(j.from.z) | 0);
        // });

        _(regionTree.search(bounds)).each(function(j) {
            context.moveTo(x(j.to.x) | 0, z(j.to.z) | 0);
            context.lineTo(x(j.from.x) | 0, z(j.from.z) | 0);
        });

        context.stroke();
        context.closePath();

        context.strokeStyle = '#000';
        context.beginPath();

        // _(jumps).each(function(j) {
        //     // context.moveTo(x(j.to.x), z(j.to.z));
        //     // context.lineTo(x(j.from.x), z(j.from.z));
        //     context.moveTo(x(j.to.x) | 0, z(j.to.z) | 0);
        //     context.lineTo(x(j.from.x) | 0, z(j.from.z) | 0);
        // });

        _(jumpTree.search(bounds)).each(function(j) {
            context.moveTo(x(j.to.x) | 0, z(j.to.z) | 0);
            context.lineTo(x(j.from.x) | 0, z(j.from.z) | 0);
        });

        context.stroke();
        context.closePath();

        context.strokeStyle = '#000';
        context.fillStyle = '#000';
        context.beginPath();

        // _(systems).each(function(s) {
        //     // context.moveTo(x(s.x), z(s.z));
        //     // context.arc(x(s.x), z(s.z), 2, 0, TWOPI);
        //     context.moveTo(x(s.x) | 0, z(s.z) | 0);
        //     context.arc(x(s.x) | 0, z(s.z) | 0, 2, 0, TWOPI);
        // });

        _(systemTree.search(bounds)).each(function(s) {
            context.moveTo(x(s.x) | 0, z(s.z) | 0);
            context.arc(x(s.x) | 0, z(s.z) | 0, 2, 0, TWOPI);
        });

        context.fill();
        context.closePath();

        console.timeStamp('draw end');

        var end = new Date().getTime();
        var time = end - start;

        if (!max && !min) {
            max = time;
            min = time;
        } else {
            if(time > max) {
                max = time;
            }

            if(time < min) {
                min = time;
            }
        }

        fps.text(time + ", min: " + min + ", max: " + max);
    }

    draw();

    var zoom = d3.behavior.zoom()
        .x(x)
        .y(z)
        .scaleExtent([1, 16])
        .on("zoom", zoomed);

    canvas.call(zoom);

    function zoomed() {
        // context.save();
        context.clearRect(0, 0, width, height);
        // context.translate(d3.event.translate[0], d3.event.translate[1]);
        // context.scale(d3.event.scale, d3.event.scale);
        draw();
        // context.restore();
    }

    // var translateX = 0;
    // var translateY = 0;

    // var drag = d3.behavior.drag()
    //     .on("drag", function(d) {
    //         translateX += d3.event.dx;
    //         translateY += d3.event.dy;

    //         x = d3.scale.linear()
    //             .domain([minX, maxX])
    //             .range([0 + translateX, (height - 100) * mapRatio + translateX]);

    //         z = d3.scale.linear()
    //             .domain([maxZ, minZ])
    //             .range([0 + translateY, height - 100 + translateY]);

    //         draw();
    //     });

    // canvas.call(drag);

})(window);

(function(window) {

    var start, end;
    console.log('start', start = new Date().getTime());

    var height = window.innerHeight;
    var width = window.innerWidth;

    var visibleSystems = {};
    var showSystem = function(s) {
        if (s.regionId >   10000070) return false;
        // if (s.regionId === 10000001) return false;

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

    var minZ = _(systems).min(function(s) { return s.z; }).z;
    var maxZ = _(systems).max(function(s) { return s.z; }).z;
    var deltaZ = maxZ - minZ;

    var screenRatio = width / height;
    var mapRatio = deltaX / deltaZ;

    var x = d3.scale.linear()
        .domain([minX, maxX])
        .range([0, (height - 100) * mapRatio]);

    var z = d3.scale.linear()
        .domain([maxZ, minZ])
        .range([0, height - 100]);

    var map = d3.select('svg#map')
        .append('g')
        .attr('transform', 'translate(50, 50)');

    map.append('g').selectAll('line')
        .data(regionJumps)
        .enter()
            .append('line')
            .attr('class', 'region')
            .attr('x1', function(d) { return x(d.to.x); })
            .attr('y1', function(d) { return z(d.to.z); })
            .attr('x2', function(d) { return x(d.from.x); })
            .attr('y2', function(d) { return z(d.from.z); });

    map.append('g').selectAll('line')
        .data(jumps)
        .enter()
            .append('line')
            .attr('class', 'solar')
            .attr('x1', function(d) { return x(d.to.x); })
            .attr('y1', function(d) { return z(d.to.z); })
            .attr('x2', function(d) { return x(d.from.x); })
            .attr('y2', function(d) { return z(d.from.z); });


    regionNames = {
        10000060: 'delve',
        10000058: 'fountain',
        10000054: 'aridia'
    };

    var colors = d3.scale.category10();

    map.selectAll('circle')
        .data(systems)
        .enter()
            .append('circle')
            .attr('class', function(d) { return regionNames[d.regionId]; })
            .attr('cx', function(d) { return x(d.x); })
            .attr('cy', function(d) { return z(d.z); })
            .attr('r', 1)
            .attr('stroke', function(d) { return colors(d.regionId); })
            .attr('fill', '#FFF');



    console.log('end', end = new Date().getTime());
    console.log('time', end - start);

    console.log('elements', regionJumps.length, jumps.length, systems.length);

    var scale = 1;
    var pos = [50, 50];

    var last = null;

    var transform = function(pos, scale) {
        return 'translate(' + pos[0] + ', ' + pos[1] + ')scale(' + scale + ')';
    };

    var mousedown = false;

    d3.select('svg').on('mousedown', function(d, i) {
        mousedown = true;
        last = [d3.event.x, d3.event.y];
    });

    d3.select('svg').on('mouseup', function(d, i) {
        mousedown = false;
    });

    d3.select('svg').on('mousemove', function(d, i) {
        if (!mousedown) return;

        if (last) {
            pos[0] = pos[0] + d3.event.x - last[0];
            pos[1] = pos[1] + d3.event.y - last[1];
            d3.select('svg g').attr('transform',  transform(pos, scale));
        }
        last = [d3.event.x, d3.event.y];
    });

    var lines = map.selectAll('line');
    var circles = map.selectAll('circle');

    var zoomIn = function() {
        scale = scale * 2;
        pos[0] = pos[0] * 2;
        pos[1] = pos[1] * 2;

        var duration = 200;

        d3.select('svg g').transition().duration(duration).attr('transform',  transform(pos, scale));

        circles.attr('r', 4 / scale).attr('stroke-width', 2 / scale);
        lines.attr('stroke-width', 1 / scale);
    }

    var zoomOut = function() {
        scale = scale / 2;
        pos[0] = pos[0] / 2;
        pos[1] = pos[1] / 2;

        var duration = 200;

        d3.select('svg g').transition().duration(duration).attr('transform',  transform(pos, scale));

        circles.attr('r', 4 / scale).attr('stroke-width', 2 / scale);
        lines.attr('stroke-width', 1 / scale);
    }

    d3.select('svg').on('dblclick', zoomIn);
    d3.select('#zoom-in').on('click', zoomIn);
    d3.select('#zoom-out').on('click', zoomOut);

    var rights = new Rx.Subject();

    d3.select('svg').on('contextmenu', function() {
        rights.onNext([d3.event.x, d3.event.y]);
        d3.event.preventDefault();
    });

    var rightDoubles = rights
        .timeInterval()
        .skip(1)
        .where(function(d) { return d.interval < 250; })
        .select(function(d) { return d.value; })
        .take(1)
        .repeat();

    rightDoubles.subscribe(function() { zoomOut(); });
    rightDoubles.subscribe(function(d) { console.log('right double!', d); });

})(window);
